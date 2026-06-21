/**
 * Repository: Customers — acesso baixo nível ao banco.
 */
import type { SbClient } from '../events/dispatcher.server';
import type { Database } from '@/integrations/supabase/types';
import { Errors } from '../errors';

export type CustomerRow = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export type AddressRow = Database['public']['Tables']['customer_addresses']['Row'];
export type AddressInsert = Database['public']['Tables']['customer_addresses']['Insert'];
export type AddressUpdate = Database['public']['Tables']['customer_addresses']['Update'];

export type ContactRow = Database['public']['Tables']['customer_contacts']['Row'];
export type ContactInsert = Database['public']['Tables']['customer_contacts']['Insert'];
export type ContactUpdate = Database['public']['Tables']['customer_contacts']['Update'];

export type TaxProfileRow = Database['public']['Tables']['customer_tax_profiles']['Row'];
export type TaxProfileUpsert = Database['public']['Tables']['customer_tax_profiles']['Insert'];

export type CreditEntryRow = Database['public']['Tables']['customer_credit_ledger']['Row'];
export type CreditEntryInsert = Database['public']['Tables']['customer_credit_ledger']['Insert'];

// ---- customers ----
export async function findById(supabase: SbClient, id: string): Promise<CustomerRow | null> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar cliente', { error: error.message });
  return data;
}

export async function insert(supabase: SbClient, row: CustomerInsert): Promise<CustomerRow> {
  const { data, error } = await supabase.from('customers').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Cliente duplicado (documento ou código já existe)', { error: error.message });
    throw Errors.internal('Falha ao criar cliente', { error: error.message });
  }
  return data;
}

export async function update(supabase: SbClient, id: string, patch: CustomerUpdate): Promise<CustomerRow> {
  const { data, error } = await supabase.from('customers').update(patch).eq('id', id).select('*').single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Documento ou código já em uso');
    throw Errors.internal('Falha ao atualizar cliente', { error: error.message });
  }
  return data;
}

export async function softDelete(supabase: SbClient, id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', id);
  if (error) throw Errors.internal('Falha ao excluir cliente', { error: error.message });
}

// ---- addresses ----
export async function listAddresses(supabase: SbClient, customerId: string): Promise<AddressRow[]> {
  const { data, error } = await supabase
    .from('customer_addresses').select('*').eq('customer_id', customerId).order('created_at');
  if (error) throw Errors.internal('Falha ao listar endereços', { error: error.message });
  return data ?? [];
}

export async function insertAddress(supabase: SbClient, row: AddressInsert): Promise<AddressRow> {
  const { data, error } = await supabase.from('customer_addresses').insert(row).select('*').single();
  if (error) throw Errors.internal('Falha ao criar endereço', { error: error.message });
  return data;
}

export async function updateAddress(supabase: SbClient, id: string, patch: AddressUpdate): Promise<AddressRow> {
  const { data, error } = await supabase.from('customer_addresses').update(patch).eq('id', id).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar endereço', { error: error.message });
  return data;
}

export async function deleteAddress(supabase: SbClient, id: string): Promise<void> {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
  if (error) throw Errors.internal('Falha ao remover endereço', { error: error.message });
}

export async function findAddressById(supabase: SbClient, id: string): Promise<AddressRow | null> {
  const { data, error } = await supabase.from('customer_addresses').select('*').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar endereço', { error: error.message });
  return data;
}

// ---- contacts ----
export async function listContacts(supabase: SbClient, customerId: string): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from('customer_contacts').select('*').eq('customer_id', customerId).order('is_primary', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar contatos', { error: error.message });
  return data ?? [];
}

export async function insertContact(supabase: SbClient, row: ContactInsert): Promise<ContactRow> {
  const { data, error } = await supabase.from('customer_contacts').insert(row).select('*').single();
  if (error) throw Errors.internal('Falha ao criar contato', { error: error.message });
  return data;
}

export async function updateContact(supabase: SbClient, id: string, patch: ContactUpdate): Promise<ContactRow> {
  const { data, error } = await supabase.from('customer_contacts').update(patch).eq('id', id).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar contato', { error: error.message });
  return data;
}

export async function deleteContact(supabase: SbClient, id: string): Promise<void> {
  const { error } = await supabase.from('customer_contacts').delete().eq('id', id);
  if (error) throw Errors.internal('Falha ao remover contato', { error: error.message });
}

// ---- tax profile ----
export async function getTaxProfile(supabase: SbClient, customerId: string): Promise<TaxProfileRow | null> {
  const { data, error } = await supabase
    .from('customer_tax_profiles').select('*').eq('customer_id', customerId).maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar perfil fiscal', { error: error.message });
  return data;
}

export async function upsertTaxProfile(supabase: SbClient, row: TaxProfileUpsert): Promise<TaxProfileRow> {
  const { data, error } = await supabase
    .from('customer_tax_profiles').upsert(row, { onConflict: 'customer_id' }).select('*').single();
  if (error) throw Errors.internal('Falha ao salvar perfil fiscal', { error: error.message });
  return data;
}

// ---- credit ----
export async function getCreditBalance(supabase: SbClient, customerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('customer_credit_ledger').select('balance_after')
    .eq('customer_id', customerId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw Errors.internal('Falha ao calcular saldo', { error: error.message });
  return Number(data?.balance_after ?? 0);
}

export async function listCreditEntries(supabase: SbClient, customerId: string): Promise<CreditEntryRow[]> {
  const { data, error } = await supabase
    .from('customer_credit_ledger').select('*')
    .eq('customer_id', customerId).order('created_at', { ascending: false }).limit(200);
  if (error) throw Errors.internal('Falha ao listar lançamentos', { error: error.message });
  return data ?? [];
}

export async function insertCreditEntry(supabase: SbClient, row: CreditEntryInsert): Promise<CreditEntryRow> {
  const { data, error } = await supabase.from('customer_credit_ledger').insert(row).select('*').single();
  if (error) throw Errors.internal('Falha ao lançar crédito', { error: error.message });
  return data;
}

// ---- groups ----
export async function listGroups(supabase: SbClient, customerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('customer_groups_map').select('customer_group_id').eq('customer_id', customerId);
  if (error) throw Errors.internal('Falha ao listar grupos', { error: error.message });
  return (data ?? []).map((r) => r.customer_group_id);
}

export async function setGroups(supabase: SbClient, customerId: string, groupIds: string[]): Promise<void> {
  const del = await supabase.from('customer_groups_map').delete().eq('customer_id', customerId);
  if (del.error) throw Errors.internal('Falha ao limpar grupos', { error: del.error.message });
  if (groupIds.length === 0) return;
  const ins = await supabase.from('customer_groups_map').insert(
    groupIds.map((customer_group_id) => ({ customer_id: customerId, customer_group_id })),
  );
  if (ins.error) throw Errors.internal('Falha ao vincular grupos', { error: ins.error.message });
}
