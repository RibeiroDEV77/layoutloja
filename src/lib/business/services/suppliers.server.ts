/**
 * Service: Suppliers — regras de negócio.
 */
import type { SbClient } from '../events/dispatcher.server';
import { dispatchEvent } from '../events/dispatcher.server';
import { DomainEvent } from '../events/types';
import { Errors } from '../errors';
import { requirePermission, isSuperAdmin, hasPermission, requireStoreAccess } from './permissions.server';
import * as Repo from '../repositories/suppliers.server';

export interface ListSuppliersInput {
  store_id: string;
  q?: string;
  page?: number;
  pageSize?: number;
  is_active?: boolean;
}

export async function listSuppliers(
  supabase: SbClient,
  userId: string,
  input: ListSuppliersInput,
) {
  if (!input.store_id) throw Errors.validation('store_id obrigatório');
  if (!(await isSuperAdmin(supabase, userId))) {
    await requireStoreAccess(supabase, userId, input.store_id);
    const ok = (await hasPermission(supabase, userId, 'suppliers.read', input.store_id))
      || (await hasPermission(supabase, userId, 'suppliers.manage', input.store_id));
    if (!ok) throw Errors.forbidden('Permissão necessária: suppliers.read');
  }

  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase
    .from('suppliers')
    .select('*', { count: 'exact' })
    .eq('store_id', input.store_id);

  if (input.q?.trim()) {
    const safe = input.q.replace(/[%,]/g, '');
    q = q.or(`legal_name.ilike.%${safe}%,trade_name.ilike.%${safe}%,code.ilike.%${safe}%,tax_id.ilike.%${safe}%`);
  }
  if (typeof input.is_active === 'boolean') q = q.eq('is_active', input.is_active);

  q = q.order('legal_name', { ascending: true }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar fornecedores', { error: error.message });
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}


export interface CreateSupplierInput {
  store_id: string;
  legal_name: string;
  code?: string;
  trade_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: Record<string, unknown>;
  payment_terms?: string;
  lead_time_days?: number;
  notes?: string;
}

export async function createSupplier(
  supabase: SbClient,
  userId: string,
  input: CreateSupplierInput,
) {
  if (!input.legal_name?.trim()) throw Errors.validation('Razão social obrigatória');
  await requirePermission(supabase, userId, 'suppliers.manage', input.store_id);

  const row = await Repo.insert(supabase, {
    store_id: input.store_id,
    legal_name: input.legal_name.trim(),
    code: input.code?.trim() || null,
    trade_name: input.trade_name?.trim() || null,
    tax_id: input.tax_id?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    address: (input.address ?? {}) as never,
    payment_terms: input.payment_terms ?? null,
    lead_time_days: input.lead_time_days ?? null,
    notes: input.notes ?? null,
  });

  await dispatchEvent(supabase, {
    event_type: DomainEvent.SupplierCreated,
    aggregate_type: 'supplier',
    aggregate_id: row.id,
    store_id: row.store_id,
    payload: { legal_name: row.legal_name, code: row.code },
  });

  return row;
}

export type UpdateSupplierInput = Partial<Omit<CreateSupplierInput, 'store_id'>> & {
  is_active?: boolean;
};

export async function updateSupplier(
  supabase: SbClient,
  userId: string,
  id: string,
  patch: UpdateSupplierInput,
) {
  const current = await Repo.findById(supabase, id);
  if (!current) throw Errors.notFound('Fornecedor', id);
  await requirePermission(supabase, userId, 'suppliers.manage', current.store_id);

  const row = await Repo.update(supabase, id, patch as never);

  await dispatchEvent(supabase, {
    event_type: DomainEvent.SupplierUpdated,
    aggregate_type: 'supplier',
    aggregate_id: row.id,
    store_id: row.store_id,
    payload: { changed: Object.keys(patch) },
  });

  return row;
}

export async function deleteSupplier(supabase: SbClient, userId: string, id: string) {
  const current = await Repo.findById(supabase, id);
  if (!current) throw Errors.notFound('Fornecedor', id);
  await requirePermission(supabase, userId, 'suppliers.manage', current.store_id);

  const openPOs = await Repo.countOpenPurchaseOrders(supabase, id);
  if (openPOs > 0) {
    throw Errors.rule('Fornecedor possui ordens de compra abertas', { open_purchase_orders: openPOs });
  }

  await Repo.remove(supabase, id);

  await dispatchEvent(supabase, {
    event_type: DomainEvent.SupplierDeleted,
    aggregate_type: 'supplier',
    aggregate_id: id,
    store_id: current.store_id,
    payload: { legal_name: current.legal_name },
  });

  return { ok: true, id };
}
