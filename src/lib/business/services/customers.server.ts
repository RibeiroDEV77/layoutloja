/**
 * Service: Customers — regras de negócio do módulo Clientes (Fase 5.1).
 *
 * - Validação de PF/PJ (CPF/CNPJ) — formato; dígito verificador é opcional.
 * - Normalização de email/telefone/documento.
 * - Default address por tipo (delegado ao trigger).
 * - Ledger de crédito append-only com cálculo de saldo.
 * - Emissão de eventos via Outbox (Fundações 5.0).
 * - Métricas via observability.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin, hasPermission, requirePermission, requireStoreAccess } from './permissions.server';
import * as Repo from '../repositories/customers.server';
import { enqueueOutbox } from '@/lib/foundations/outbox.functions';
import { recordMetric } from '@/lib/foundations/observability.functions';
import { CommerceEventTypes, AggregateTypes } from '@/lib/foundations/events';

// ---------------- list ----------------
export interface ListCustomersInput {
  store_id: string;
  q?: string;
  page?: number;
  pageSize?: number;
  status?: 'active' | 'inactive' | 'blocked';
  type?: 'pf' | 'pj';
  segment?: string;
  include_deleted?: boolean;
}

export async function listCustomers(supabase: SbClient, userId: string, input: ListCustomersInput) {
  if (!input.store_id) throw Errors.validation('store_id obrigatório');
  if (!(await isSuperAdmin(supabase, userId))) {
    await requireStoreAccess(supabase, userId, input.store_id);
    if (!(await hasPermission(supabase, userId, 'customers.read', input.store_id))) {
      throw Errors.forbidden('Permissão necessária: customers.read');
    }
  }

  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase
    .from('customers').select('*', { count: 'exact' })
    .eq('store_id', input.store_id);
  if (!input.include_deleted) q = q.is('deleted_at', null);
  if (input.status) q = q.eq('status', input.status);
  if (input.type) q = q.eq('type', input.type);
  if (input.segment) q = q.eq('segment', input.segment as never);
  if (input.q?.trim()) {
    const raw = input.q.trim();
    const digits = raw.replace(/\D/g, '');
    // CPF (11) ou CNPJ (14): buscar por hash exato — nunca ILIKE em plaintext.
    if (digits.length === 11 || digits.length === 14) {
      const { data: hashRow, error: hashErr } = await supabase.rpc('hash_doc_number', { _doc: digits });
      if (hashErr) throw Errors.internal('Falha ao computar hash de busca', { error: hashErr.message });
      const hash = (hashRow as string | null) ?? '';
      q = q.eq('doc_number_hash', hash);
    } else {
      const safe = raw.replace(/[%,]/g, '');
      q = q.or(`name.ilike.%${safe}%,legal_name.ilike.%${safe}%,trade_name.ilike.%${safe}%,email.ilike.%${safe}%,code.ilike.%${safe}%`);
    }
  }
  q = q.order('name', { ascending: true }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar clientes', { error: error.message });
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}

export async function getCustomer(supabase: SbClient, userId: string, id: string) {
  const c = await Repo.findById(supabase, id);
  if (!c) throw Errors.notFound('Cliente', id);
  if (!(await isSuperAdmin(supabase, userId)) && c.auth_user_id !== userId) {
    if (!(await hasPermission(supabase, userId, 'customers.read', c.store_id))) {
      throw Errors.forbidden('Permissão necessária: customers.read');
    }
  }
  const [addresses, contacts, tax, groups, balance] = await Promise.all([
    Repo.listAddresses(supabase, id),
    Repo.listContacts(supabase, id),
    Repo.getTaxProfile(supabase, id),
    Repo.listGroups(supabase, id),
    Repo.getCreditBalance(supabase, id),
  ]);
  return { customer: c, addresses, contacts, tax_profile: tax, group_ids: groups, credit_balance: balance };
}

// ---------------- create / update / delete ----------------
function normalizeDoc(doc?: string | null): string | null {
  if (!doc) return null;
  const v = doc.replace(/\D/g, '');
  return v.length ? v : null;
}

export interface CreateCustomerInput {
  store_id: string;
  type: 'pf' | 'pj';
  name: string;
  code?: string;
  legal_name?: string;
  trade_name?: string;
  email?: string;
  phone?: string;
  doc_number?: string;
  state_registration?: string;
  municipal_registration?: string;
  birth_date?: string | null;
  gender?: string;
  default_price_list_id?: string | null;
  default_payment_terms?: string;
  credit_limit?: number;
  segment?: 'retail' | 'wholesale' | 'rep' | 'distributor' | 'reseller' | 'vip';
  origin?: string;
  marketing_opt_in?: boolean;
  notes?: string;
  group_ids?: string[];
}

export async function createCustomer(supabase: SbClient, userId: string, input: CreateCustomerInput) {
  if (!input.name?.trim()) throw Errors.validation('Nome obrigatório');
  if (input.type !== 'pf' && input.type !== 'pj') throw Errors.validation('Tipo inválido');
  await requirePermission(supabase, userId, 'customers.create', input.store_id);

  const doc = normalizeDoc(input.doc_number);
  if (input.type === 'pf' && doc && doc.length !== 11) throw Errors.validation('CPF deve ter 11 dígitos');
  if (input.type === 'pj' && doc && doc.length !== 14) throw Errors.validation('CNPJ deve ter 14 dígitos');

  const row = await Repo.insert(supabase, {
    store_id: input.store_id,
    type: input.type,
    name: input.name.trim(),
    code: input.code?.trim() || null,
    legal_name: input.legal_name?.trim() || null,
    trade_name: input.trade_name?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    doc_number: doc,
    state_registration: input.state_registration?.trim() || null,
    municipal_registration: input.municipal_registration?.trim() || null,
    birth_date: input.birth_date || null,
    gender: input.gender ?? null,
    default_price_list_id: input.default_price_list_id ?? null,
    default_payment_terms: input.default_payment_terms ?? null,
    credit_limit: input.credit_limit ?? 0,
    segment: input.segment ?? 'retail',
    origin: input.origin ?? null,
    marketing_opt_in: !!input.marketing_opt_in,
    notes: input.notes ?? null,
    created_by: userId,
  });

  if (input.group_ids?.length) {
    await Repo.setGroups(supabase, row.id, input.group_ids);
  }

  await enqueueOutbox(supabase, {
    storeId: row.store_id,
    aggregateType: AggregateTypes.Customer,
    aggregateId: row.id,
    eventType: CommerceEventTypes.CustomerCreated,
    payload: { name: row.name, type: row.type, segment: row.segment },
  });
  await recordMetric(supabase, { scope: 'customers', name: 'created', value: 1, storeId: row.store_id });

  return row;
}

export type UpdateCustomerInput = Partial<Omit<CreateCustomerInput, 'store_id' | 'type'>> & {
  status?: 'active' | 'inactive' | 'blocked';
};

export async function updateCustomer(supabase: SbClient, userId: string, id: string, patch: UpdateCustomerInput) {
  const current = await Repo.findById(supabase, id);
  if (!current) throw Errors.notFound('Cliente', id);
  await requirePermission(supabase, userId, 'customers.update', current.store_id);

  if (patch.doc_number !== undefined) {
    const doc = normalizeDoc(patch.doc_number);
    if (current.type === 'pf' && doc && doc.length !== 11) throw Errors.validation('CPF deve ter 11 dígitos');
    if (current.type === 'pj' && doc && doc.length !== 14) throw Errors.validation('CNPJ deve ter 14 dígitos');
    patch.doc_number = doc as never;
  }
  if (patch.email !== undefined) patch.email = patch.email?.trim().toLowerCase() || undefined;

  const { group_ids, ...colPatch } = patch;
  const row = await Repo.update(supabase, id, colPatch as never);

  if (group_ids !== undefined) await Repo.setGroups(supabase, id, group_ids ?? []);

  await enqueueOutbox(supabase, {
    storeId: row.store_id,
    aggregateType: AggregateTypes.Customer,
    aggregateId: row.id,
    eventType: CommerceEventTypes.CustomerUpdated,
    payload: { changed: Object.keys(colPatch) },
  });
  await recordMetric(supabase, { scope: 'customers', name: 'updated', value: 1, storeId: row.store_id });
  return row;
}

export async function deleteCustomer(supabase: SbClient, userId: string, id: string) {
  const current = await Repo.findById(supabase, id);
  if (!current) throw Errors.notFound('Cliente', id);
  await requirePermission(supabase, userId, 'customers.delete', current.store_id);
  await Repo.softDelete(supabase, id);
  await enqueueOutbox(supabase, {
    storeId: current.store_id,
    aggregateType: AggregateTypes.Customer,
    aggregateId: id,
    eventType: CommerceEventTypes.CustomerUpdated,
    payload: { soft_deleted: true },
  });
  return { ok: true, id };
}

// ---------------- addresses ----------------
export interface AddressInput {
  customer_id: string;
  label?: string;
  type?: 'main' | 'shipping' | 'billing' | 'commercial';
  is_default_shipping?: boolean;
  is_default_billing?: boolean;
  recipient?: string;
  doc_number?: string;
  zipcode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  reference?: string;
}

async function ensureCustomerWritable(supabase: SbClient, userId: string, customerId: string) {
  const c = await Repo.findById(supabase, customerId);
  if (!c) throw Errors.notFound('Cliente', customerId);
  if (!(await isSuperAdmin(supabase, userId)) && c.auth_user_id !== userId) {
    await requirePermission(supabase, userId, 'customers.update', c.store_id);
  }
  return c;
}

export async function addAddress(supabase: SbClient, userId: string, input: AddressInput) {
  const c = await ensureCustomerWritable(supabase, userId, input.customer_id);
  const row = await Repo.insertAddress(supabase, {
    customer_id: input.customer_id,
    label: input.label ?? null,
    type: (input.type ?? 'main') as never,
    is_default_shipping: !!input.is_default_shipping,
    is_default_billing: !!input.is_default_billing,
    recipient: input.recipient ?? null,
    doc_number: input.doc_number ?? null,
    zipcode: input.zipcode ?? null,
    street: input.street ?? null,
    number: input.number ?? null,
    complement: input.complement ?? null,
    district: input.district ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    country: input.country ?? 'BR',
    phone: input.phone ?? null,
    reference: input.reference ?? null,
  });
  await enqueueOutbox(supabase, {
    storeId: c.store_id,
    aggregateType: AggregateTypes.Customer,
    aggregateId: c.id,
    eventType: CommerceEventTypes.CustomerAddressAdded,
    payload: { address_id: row.id, type: row.type },
  });
  return row;
}

export async function updateAddress(supabase: SbClient, userId: string, id: string, patch: Partial<AddressInput>) {
  const addr = await Repo.findAddressById(supabase, id);
  if (!addr) throw Errors.notFound('Endereço', id);
  await ensureCustomerWritable(supabase, userId, addr.customer_id);
  const { customer_id: _ignore, ...rest } = patch;
  void _ignore;
  return Repo.updateAddress(supabase, id, rest as never);
}

export async function deleteAddress(supabase: SbClient, userId: string, id: string) {
  const addr = await Repo.findAddressById(supabase, id);
  if (!addr) throw Errors.notFound('Endereço', id);
  await ensureCustomerWritable(supabase, userId, addr.customer_id);
  await Repo.deleteAddress(supabase, id);
  return { ok: true, id };
}

// ---------------- contacts ----------------
export interface ContactInput {
  customer_id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  is_primary?: boolean;
  notes?: string;
}

export async function addContact(supabase: SbClient, userId: string, input: ContactInput) {
  await ensureCustomerWritable(supabase, userId, input.customer_id);
  if (!input.name?.trim()) throw Errors.validation('Nome do contato obrigatório');
  return Repo.insertContact(supabase, {
    customer_id: input.customer_id,
    name: input.name.trim(),
    role: input.role ?? null,
    email: input.email?.toLowerCase() ?? null,
    phone: input.phone ?? null,
    is_primary: !!input.is_primary,
    notes: input.notes ?? null,
  });
}

export async function updateContact(supabase: SbClient, userId: string, id: string, patch: Partial<ContactInput>) {
  const { data, error } = await supabase.from('customer_contacts').select('customer_id').eq('id', id).maybeSingle();
  if (error || !data) throw Errors.notFound('Contato', id);
  await ensureCustomerWritable(supabase, userId, data.customer_id);
  return Repo.updateContact(supabase, id, patch as never);
}

export async function removeContact(supabase: SbClient, userId: string, id: string) {
  const { data, error } = await supabase.from('customer_contacts').select('customer_id').eq('id', id).maybeSingle();
  if (error || !data) throw Errors.notFound('Contato', id);
  await ensureCustomerWritable(supabase, userId, data.customer_id);
  await Repo.deleteContact(supabase, id);
  return { ok: true, id };
}

// ---------------- tax profile ----------------
export interface TaxProfileInput {
  customer_id: string;
  regime?: 'mei' | 'simples' | 'presumido' | 'real' | 'isento' | null;
  icms_taxpayer?: boolean;
  suframa?: string;
  ie_isento?: boolean;
  cnae?: string;
  notes?: string;
}

export async function upsertTaxProfile(supabase: SbClient, userId: string, input: TaxProfileInput) {
  await ensureCustomerWritable(supabase, userId, input.customer_id);
  return Repo.upsertTaxProfile(supabase, {
    customer_id: input.customer_id,
    regime: input.regime ?? null,
    icms_taxpayer: !!input.icms_taxpayer,
    suframa: input.suframa ?? null,
    ie_isento: !!input.ie_isento,
    cnae: input.cnae ?? null,
    notes: input.notes ?? null,
  });
}

// ---------------- credit ----------------
export interface CreditEntryInput {
  customer_id: string;
  kind: 'credit' | 'debit' | 'refund' | 'adjustment' | 'expiration';
  amount: number;
  reason?: string;
  reference_type?: string;
  reference_id?: string;
}

export async function addCreditEntry(supabase: SbClient, userId: string, input: CreditEntryInput) {
  const c = await Repo.findById(supabase, input.customer_id);
  if (!c) throw Errors.notFound('Cliente', input.customer_id);
  await requirePermission(supabase, userId, 'customers.credit.manage', c.store_id);
  if (!Number.isFinite(input.amount) || input.amount === 0) throw Errors.validation('Valor inválido');

  const current = await Repo.getCreditBalance(supabase, input.customer_id);
  const delta = input.kind === 'debit' || input.kind === 'expiration' ? -Math.abs(input.amount) : Math.abs(input.amount);
  const balance_after = Number((current + delta).toFixed(2));

  const row = await Repo.insertCreditEntry(supabase, {
    customer_id: input.customer_id,
    kind: input.kind,
    amount: Math.abs(input.amount),
    balance_after,
    reason: input.reason ?? null,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    actor_user_id: userId,
  });

  await recordMetric(supabase, { scope: 'customers', name: 'credit_adjusted', value: delta, storeId: c.store_id });
  return { entry: row, balance: balance_after };
}

export async function getCreditLedger(supabase: SbClient, userId: string, customerId: string) {
  const c = await Repo.findById(supabase, customerId);
  if (!c) throw Errors.notFound('Cliente', customerId);
  if (!(await isSuperAdmin(supabase, userId)) && c.auth_user_id !== userId) {
    await requirePermission(supabase, userId, 'customers.read', c.store_id);
  }
  const [entries, balance] = await Promise.all([
    Repo.listCreditEntries(supabase, customerId),
    Repo.getCreditBalance(supabase, customerId),
  ]);
  return { entries, balance };
}
