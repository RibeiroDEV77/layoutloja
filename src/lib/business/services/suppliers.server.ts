/**
 * Service: Suppliers — regras de negócio.
 */
import type { SbClient } from '../events/dispatcher.server';
import { dispatchEvent } from '../events/dispatcher.server';
import { DomainEvent } from '../events/types';
import { Errors } from '../errors';
import { requirePermission } from './permissions.server';
import * as Repo from '../repositories/suppliers.server';

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
    address: input.address ?? {},
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

  const row = await Repo.update(supabase, id, patch);

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
