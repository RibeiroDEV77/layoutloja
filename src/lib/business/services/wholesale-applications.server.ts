/**
 * Service: Wholesale Applications (Sprint 2 — Atacado).
 *
 * Camada de negócio ÚNICA para `wholesale_applications`. Toda interação
 * futura (site, painel, APIs) deve consumir este módulo.
 *
 * Reutiliza:
 *  - `customers` (PII; nunca duplicada aqui)
 *  - `workflow_*` engine via `@/lib/foundations/workflow.functions`
 *  - `audit_log` (registro imutável de transições e edições)
 *  - `customer_notes`, `assets`, `asset_links`, `customer_groups`,
 *    `price_lists` permanecem inalterados — consumidos por outros serviços.
 *
 * Não altera nada do varejo nem do Price Engine.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin, hasPermission } from './permissions.server';
import { startWorkflow, transitionWorkflow } from '@/lib/foundations/workflow.functions';
import { sanitizeMetadata, maskDoc } from './pii.server';

function safeApp<T extends { metadata?: unknown }>(row: T): T {
  return { ...row, metadata: sanitizeMetadata((row.metadata ?? {}) as Record<string, unknown>) as never };
}


// ---------------- Tipos ----------------
export type WholesaleStatus =
  | 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'cancelled';

const OPEN_STATUSES: WholesaleStatus[] = ['draft', 'submitted', 'in_review'];

/** Transições válidas (FSM). Espelha o workflow `wholesale_application` quando existir. */
const TRANSITIONS: Record<WholesaleStatus, WholesaleStatus[]> = {
  draft:      ['submitted', 'cancelled'],
  submitted:  ['in_review', 'rejected', 'cancelled'],
  in_review:  ['approved', 'rejected'],
  approved:   [],
  rejected:   [],
  cancelled:  [],
};

/** Mapa transição → código no workflow engine (opcional; usado se a definição existir). */
const WF_TRANSITION_CODE: Partial<Record<`${WholesaleStatus}->${WholesaleStatus}`, string>> = {
  'draft->submitted':     'submit',
  'submitted->in_review': 'start_review',
  'in_review->approved':  'approve',
  'in_review->rejected':  'reject',
  'submitted->rejected':  'reject',
  'draft->cancelled':     'cancel',
  'submitted->cancelled': 'cancel',
};

const WF_DEFINITION_CODE = 'wholesale_application';
const AGGREGATE_TYPE = 'wholesale_application';

export interface CreateApplicationInput {
  customer_id: string;
  requested_group_id?: string | null;
  requested_price_list_id?: string | null;
  metadata?: JsonObject;
  /** Se true, já marca como `submitted` e inicia o workflow. */
  submit?: boolean;
}

export interface TransitionInput {
  id: string;
  to: WholesaleStatus;
  reason?: string;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

interface ApplicationRow {
  id: string;
  store_id: string;
  customer_id: string;
  status: WholesaleStatus;
  workflow_instance_id: string | null;
  requested_group_id: string | null;
  requested_price_list_id: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_reason: string | null;
  metadata: JsonObject;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------- Helpers internos ----------------
async function loadCustomer(supabase: SbClient, customerId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, store_id, auth_user_id')
    .eq('id', customerId)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar cliente', { error: error.message });
  if (!data) throw Errors.notFound('Cliente', customerId);
  return data as { id: string; store_id: string; auth_user_id: string | null };
}

async function loadApplication(supabase: SbClient, id: string): Promise<ApplicationRow> {
  const { data, error } = await supabase
    .from('wholesale_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar solicitação', { error: error.message });
  if (!data) throw Errors.notFound('Solicitação de atacado', id);
  return data as ApplicationRow;
}

async function isOwner(supabase: SbClient, userId: string, customerId: string) {
  const c = await loadCustomer(supabase, customerId);
  return c.auth_user_id === userId;
}

async function canManage(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return true;
  return hasPermission(supabase, userId, 'customers.update', storeId);
}

async function canRead(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return true;
  return hasPermission(supabase, userId, 'customers.read', storeId);
}

async function workflowDefinitionExists(supabase: SbClient): Promise<boolean> {
  const { data } = await supabase
    .from('workflow_definitions')
    .select('id')
    .eq('code', WF_DEFINITION_CODE)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function writeAudit(
  supabase: SbClient,
  args: { storeId: string; userId: string | null; entityId: string; action: string; diff?: Record<string, unknown> },
) {
  // Best-effort: nunca derruba a operação principal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('audit_log').insert({
    store_id: args.storeId,
    actor_user_id: args.userId,
    entity_type: 'wholesale_application',
    entity_id: args.entityId,
    action: args.action,
    diff: args.diff ?? {},
  }).then((r: { error: unknown }) => {
    if (r.error) console.error('[wholesale] audit_log insert falhou', r.error);
  });
}

function assertTransition(from: WholesaleStatus, to: WholesaleStatus) {
  if (!TRANSITIONS[from].includes(to)) {
    throw Errors.rule(`Transição inválida: ${from} → ${to}`, { from, to });
  }
}

// ---------------- API pública ----------------

/** Cria uma solicitação de atacado. Garante unicidade de solicitação aberta. */
export async function createApplication(
  supabase: SbClient, userId: string, input: CreateApplicationInput,
) {
  const customer = await loadCustomer(supabase, input.customer_id);

  const owner = customer.auth_user_id === userId;
  const manager = await canManage(supabase, userId, customer.store_id);
  if (!owner && !manager) {
    throw Errors.forbidden('Sem permissão para criar solicitação para este cliente');
  }

  // Impede múltiplas solicitações abertas (também garantido por unique index parcial)
  const existing = await getActiveApplication(supabase, userId, input.customer_id);
  if (existing) {
    throw Errors.conflict('Já existe uma solicitação de atacado em andamento para este cliente', {
      application_id: existing.id, status: existing.status,
    });
  }

  const status: WholesaleStatus = input.submit ? 'submitted' : 'draft';
  const nowIso = new Date().toISOString();

  const { data: created, error } = await supabase
    .from('wholesale_applications')
    .insert({
      store_id: customer.store_id,
      customer_id: customer.id,
      status,
      requested_group_id: input.requested_group_id ?? null,
      requested_price_list_id: input.requested_price_list_id ?? null,
      submitted_at: status === 'submitted' ? nowIso : null,
      metadata: (input.metadata ?? {}) as never,
      created_by: userId,
    })
    .select('*')
    .single();
  if (error) {
    if (/wholesale_applications_one_open_per_customer/.test(error.message)) {
      throw Errors.conflict('Já existe uma solicitação de atacado em andamento para este cliente');
    }
    throw Errors.internal('Falha ao criar solicitação', { error: error.message });
  }
  const row = created as ApplicationRow;

  // Integração com workflow engine (best-effort: só se a definição existir).
  if (status === 'submitted' && await workflowDefinitionExists(supabase)) {
    try {
      const instId = await startWorkflow(supabase, {
        storeId: customer.store_id,
        definitionCode: WF_DEFINITION_CODE,
        aggregateType: AGGREGATE_TYPE,
        aggregateId: row.id,
        context: { customer_id: customer.id, created_by: userId },
      });
      await supabase.from('wholesale_applications')
        .update({ workflow_instance_id: instId }).eq('id', row.id);
      row.workflow_instance_id = instId;
    } catch (e) {
      console.error('[wholesale] startWorkflow falhou', e);
    }
  }

  await writeAudit(supabase, {
    storeId: customer.store_id, userId, entityId: row.id,
    action: 'wholesale.application.created', diff: { status },
  });

  return safeApp(row);
}

/** Retorna a solicitação ativa (draft/submitted/in_review) do cliente, se houver. */
export async function getActiveApplication(
  supabase: SbClient, userId: string, customerId: string,
): Promise<ApplicationRow | null> {
  const customer = await loadCustomer(supabase, customerId);
  if (customer.auth_user_id !== userId && !(await canRead(supabase, userId, customer.store_id))) {
    throw Errors.forbidden('Sem permissão para ler solicitações deste cliente');
  }
  const { data, error } = await supabase
    .from('wholesale_applications')
    .select('*')
    .eq('customer_id', customerId)
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar solicitação ativa', { error: error.message });
  return data ? safeApp(data as ApplicationRow) : null;
}

/** Lista todas as solicitações de um cliente, mais recentes primeiro. */
export async function listApplicationsByCustomer(
  supabase: SbClient, userId: string, customerId: string,
) {
  const customer = await loadCustomer(supabase, customerId);
  if (customer.auth_user_id !== userId && !(await canRead(supabase, userId, customer.store_id))) {
    throw Errors.forbidden('Sem permissão para ler solicitações deste cliente');
  }
  const { data, error } = await supabase
    .from('wholesale_applications')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar solicitações', { error: error.message });
  return ((data ?? []) as ApplicationRow[]).map(safeApp);
}

// ---------------- Admin: listagem global ----------------

export interface AdminListInput {
  store_id: string;
  /** Busca livre em nome / razão / fantasia / documento / email do cliente. */
  search?: string;
  status?: WholesaleStatus | WholesaleStatus[];
  /** Filtro por tipo do cadastro (PF/PJ) — vem de `customers.type`. */
  customer_type?: 'pf' | 'pj';
  /** Filtro por janela de `created_at` (ISO). */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminListRow extends ApplicationRow {
  customer: {
    id: string;
    type: 'pf' | 'pj';
    name: string;
    trade_name: string | null;
    legal_name: string | null;
    doc_number_masked: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

/**
 * Listagem administrativa (paginada) de TODAS as solicitações de uma loja.
 * Somente leitura. Exige `customers.read` (ou super admin).
 */
export async function listApplications(
  supabase: SbClient, userId: string, input: AdminListInput,
): Promise<{ rows: AdminListRow[]; total: number }> {
  if (!input.store_id) throw Errors.validation('store_id é obrigatório');
  if (!(await canRead(supabase, userId, input.store_id))) {
    throw Errors.forbidden('Sem permissão para listar solicitações');
  }

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, input.pageSize ?? 50));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  // Selecionamos doc_number/type do cliente apenas para computar máscara + busca
  // por hash — o campo nunca chega ao payload retornado (é removido em memória).
  let q = supabase
    .from('wholesale_applications')
    .select(
      'id, store_id, customer_id, status, workflow_instance_id, requested_group_id, requested_price_list_id, submitted_at, decided_at, decided_by, decision_reason, metadata, created_by, created_at, updated_at, ' +
      'customer:customers!wholesale_applications_customer_id_fkey(id, type, name, trade_name, legal_name, doc_number, email, phone)',
      { count: 'exact' },
    )
    .eq('store_id', input.store_id);

  if (input.status) {
    q = Array.isArray(input.status) ? q.in('status', input.status) : q.eq('status', input.status);
  }
  if (input.from) q = q.gte('created_at', input.from);
  if (input.to) q = q.lte('created_at', input.to);

  q = q.order('created_at', { ascending: false }).range(fromIdx, toIdx);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar solicitações', { error: error.message });

  type RawRow = ApplicationRow & {
    customer: (Omit<NonNullable<AdminListRow['customer']>, 'doc_number_masked'> & { doc_number: string | null }) | null;
  };
  let rawRows = ((data ?? []) as unknown as RawRow[]);

  // Filtros aplicados em memória (dependem de customer/metadata e mantêm a
  // página atual; aceitável para volumes administrativos).
  if (input.customer_type) {
    rawRows = rawRows.filter((r) => r.customer?.type === input.customer_type);
  }
  if (input.search?.trim()) {
    const needle = input.search.trim().toLowerCase();
    const onlyDigits = needle.replace(/\D/g, '');
    rawRows = rawRows.filter((r) => {
      const c = r.customer;
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      const haystack = [
        c?.name, c?.trade_name, c?.legal_name, c?.email,
        meta['name'], meta['legal_name'], meta['trade_name'], meta['responsavel'],
      ].filter(Boolean).map((s) => String(s).toLowerCase()).join(' ');
      if (haystack.includes(needle)) return true;
      if (onlyDigits.length >= 3) {
        const docs = [c?.doc_number, meta['cpf'], meta['cnpj']]
          .filter(Boolean).map((s) => String(s).replace(/\D/g, ''));
        if (docs.some((d) => d.includes(onlyDigits))) return true;
      }
      return false;
    });
  }

  // Mask before returning — nenhum plaintext sai daqui.
  const { maskDoc } = await import('./pii.server');
  const rows: AdminListRow[] = rawRows.map((r) => {
    if (!r.customer) return { ...r, customer: null } as AdminListRow;
    const { doc_number, ...rest } = r.customer;
    return {
      ...r,
      customer: { ...rest, doc_number_masked: maskDoc(doc_number, rest.type) },
    } as AdminListRow;
  });

  return { rows, total: count ?? rows.length };
}


/** Busca uma solicitação pelo id (com autorização). */
export async function getApplication(supabase: SbClient, userId: string, id: string) {
  const app = await loadApplication(supabase, id);
  const customer = await loadCustomer(supabase, app.customer_id);
  if (customer.auth_user_id !== userId && !(await canRead(supabase, userId, app.store_id))) {
    throw Errors.forbidden('Sem permissão para ler esta solicitação');
  }
  return safeApp(app);
}

/**
 * Atualiza o status conforme a FSM e propaga para o workflow engine quando
 * houver instância vinculada. `approve`/`reject` exigem `reason` e gravam
 * `decided_at` / `decided_by`. Aqui NÃO mexemos em customer_groups, price
 * lists ou regras comerciais — esse efeito é responsabilidade de outra sprint.
 */
export async function transitionApplication(
  supabase: SbClient, userId: string, input: TransitionInput,
) {
  const app = await loadApplication(supabase, input.id);
  assertTransition(app.status, input.to);

  const customer = await loadCustomer(supabase, app.customer_id);
  const owner = customer.auth_user_id === userId;
  const manager = await canManage(supabase, userId, app.store_id);

  const customerAllowed: WholesaleStatus[] = ['submitted', 'cancelled'];
  const isCustomerTransition = customerAllowed.includes(input.to) && app.status !== 'in_review';

  if (!manager && !(owner && isCustomerTransition)) {
    throw Errors.forbidden('Sem permissão para esta transição');
  }

  if ((input.to === 'approved' || input.to === 'rejected') && !input.reason?.trim()) {
    throw Errors.validation('Motivo é obrigatório para aprovar/rejeitar');
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.to };
  if (input.to === 'submitted' && !app.submitted_at) patch.submitted_at = nowIso;
  if (input.to === 'approved' || input.to === 'rejected') {
    patch.decided_at = nowIso;
    patch.decided_by = userId;
    patch.decision_reason = input.reason ?? null;
  }

  const { data: updated, error } = await supabase
    .from('wholesale_applications')
    .update(patch as never)
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw Errors.internal('Falha ao atualizar solicitação', { error: error.message });
  const row = updated as ApplicationRow;

  // Workflow engine — best-effort.
  const wfCode = WF_TRANSITION_CODE[`${app.status}->${input.to}`];
  if (wfCode) {
    try {
      let instId = row.workflow_instance_id;
      if (!instId && input.to !== 'cancelled' && await workflowDefinitionExists(supabase)) {
        instId = await startWorkflow(supabase, {
          storeId: app.store_id, definitionCode: WF_DEFINITION_CODE,
          aggregateType: AGGREGATE_TYPE, aggregateId: row.id,
          context: { customer_id: app.customer_id },
        });
        await supabase.from('wholesale_applications')
          .update({ workflow_instance_id: instId }).eq('id', row.id);
        row.workflow_instance_id = instId;
      }
      if (instId) {
        await transitionWorkflow(supabase, {
          instanceId: instId, transitionCode: wfCode,
          actorUserId: userId, reason: input.reason,
        });
      }
    } catch (e) {
      console.error('[wholesale] transitionWorkflow falhou', e);
    }
  }

  await writeAudit(supabase, {
    storeId: app.store_id, userId, entityId: row.id,
    action: `wholesale.application.${input.to}`,
    diff: { from: app.status, to: input.to, reason: input.reason ?? null },
  });

  return row;
}

/** Cancelar — atalho para `transitionApplication({ to: 'cancelled' })`. */
export async function cancelApplication(
  supabase: SbClient, userId: string, id: string, reason?: string,
) {
  return transitionApplication(supabase, userId, { id, to: 'cancelled', reason });
}
