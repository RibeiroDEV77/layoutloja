/**
 * Service: Customer Hub (Fase 5.1+) — Customer 360°, Timeline, Tags, Notes,
 * Consents (LGPD), Score, Geolocation prep.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin, hasPermission } from './permissions.server';
import { enqueueOutbox } from '@/lib/foundations/outbox.functions';
import { recordMetric } from '@/lib/foundations/observability.functions';

async function loadCustomer(supabase: SbClient, id: string) {
  const { data, error } = await supabase.from('customers').select('id, store_id, auth_user_id').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar cliente', { error: error.message });
  if (!data) throw Errors.notFound('Cliente', id);
  return data;
}

async function assertRead(supabase: SbClient, userId: string, customerId: string) {
  const c = await loadCustomer(supabase, customerId);
  if (await isSuperAdmin(supabase, userId)) return c;
  if (c.auth_user_id === userId) return c;
  if (await hasPermission(supabase, userId, 'customers.read', c.store_id)) return c;
  throw Errors.forbidden('Permissão necessária: customers.read');
}

async function assertWrite(supabase: SbClient, userId: string, customerId: string) {
  const c = await loadCustomer(supabase, customerId);
  if (await isSuperAdmin(supabase, userId)) return c;
  if (await hasPermission(supabase, userId, 'customers.update', c.store_id)) return c;
  throw Errors.forbidden('Permissão necessária: customers.update');
}

// ---------------- 360° ----------------
export async function getCustomer360(supabase: SbClient, userId: string, customerId: string) {
  const c = await assertRead(supabase, userId, customerId);
  const [{ data: customer }, addresses, contacts, tax, notes, tags, factors, consents] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).maybeSingle(),
    supabase.from('customer_addresses').select('*').eq('customer_id', customerId).order('created_at'),
    supabase.from('customer_contacts').select('*').eq('customer_id', customerId).order('created_at'),
    supabase.from('customer_tax_profiles').select('*').eq('customer_id', customerId).maybeSingle(),
    supabase.from('customer_notes').select('*').eq('customer_id', customerId).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(10),
    supabase.from('customer_tag_map').select('tag_id, customer_tags(id, name, slug, color)').eq('customer_id', customerId),
    supabase.from('customer_score_factors').select('*').eq('customer_id', customerId),
    supabase.from('customer_consents_log').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(20),
  ]);
  // credit balance
  const { data: ledger } = await supabase.from('customer_credit_ledger').select('kind, amount').eq('customer_id', customerId);
  const credit_balance = (ledger ?? []).reduce((acc: number, e: { kind: string; amount: number }) => {
    if (['grant', 'refund', 'adjustment_add'].includes(e.kind)) return acc + Number(e.amount);
    if (['consume', 'adjustment_sub', 'expire'].includes(e.kind)) return acc - Number(e.amount);
    return acc;
  }, 0);
  return {
    customer, addresses: addresses.data ?? [], contacts: contacts.data ?? [], tax_profile: tax.data,
    notes: notes.data ?? [], tags: (tags.data ?? []).map((t) => t.customer_tags), factors: factors.data ?? [],
    consents: consents.data ?? [], credit_balance, store_id: c.store_id,
  };
}

// ---------------- Timeline ----------------
export async function getCustomerTimeline(
  supabase: SbClient, userId: string,
  input: { customer_id: string; limit?: number; before?: string },
) {
  await assertRead(supabase, userId, input.customer_id);
  const limit = Math.min(100, input.limit ?? 30);
  let q = supabase.from('customer_timeline_view').select('*').eq('customer_id', input.customer_id)
    .order('occurred_at', { ascending: false }).limit(limit);
  if (input.before) q = q.lt('occurred_at', input.before);
  const { data, error } = await q;
  if (error) throw Errors.internal('Falha ao carregar timeline', { error: error.message });
  return { rows: data ?? [] };
}

// ---------------- Tags ----------------
export async function listTags(supabase: SbClient, userId: string, store_id: string) {
  if (!(await isSuperAdmin(supabase, userId)) && !(await hasPermission(supabase, userId, 'customers.read', store_id))) {
    throw Errors.forbidden('Permissão necessária: customers.read');
  }
  const { data, error } = await supabase.from('customer_tags').select('*').eq('store_id', store_id).order('name');
  if (error) throw Errors.internal('Falha ao listar tags', { error: error.message });
  return data ?? [];
}

export async function upsertTag(
  supabase: SbClient, userId: string,
  input: { id?: string; store_id: string; name: string; color?: string | null },
) {
  if (!(await isSuperAdmin(supabase, userId)) && !(await hasPermission(supabase, userId, 'customers.update', input.store_id))) {
    throw Errors.forbidden('Permissão necessária: customers.update');
  }
  const slug = input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const payload = { store_id: input.store_id, name: input.name.trim(), slug, color: input.color ?? null };
  if (input.id) {
    const { data, error } = await supabase.from('customer_tags').update(payload).eq('id', input.id).select().single();
    if (error) throw Errors.internal('Falha ao atualizar tag', { error: error.message });
    return data;
  }
  const { data, error } = await supabase.from('customer_tags').insert(payload).select().single();
  if (error) throw Errors.internal('Falha ao criar tag', { error: error.message });
  return data;
}

export async function deleteTag(supabase: SbClient, userId: string, id: string) {
  const { data: tag } = await supabase.from('customer_tags').select('store_id').eq('id', id).maybeSingle();
  if (!tag) throw Errors.notFound('Tag', id);
  if (!(await isSuperAdmin(supabase, userId)) && !(await hasPermission(supabase, userId, 'customers.update', tag.store_id))) {
    throw Errors.forbidden('Permissão necessária: customers.update');
  }
  const { error } = await supabase.from('customer_tags').delete().eq('id', id);
  if (error) throw Errors.internal('Falha ao excluir tag', { error: error.message });
  return { ok: true };
}

export async function assignTags(
  supabase: SbClient, userId: string,
  input: { customer_id: string; tag_ids: string[] },
) {
  await assertWrite(supabase, userId, input.customer_id);
  // replace strategy
  await supabase.from('customer_tag_map').delete().eq('customer_id', input.customer_id);
  if (input.tag_ids.length === 0) return { ok: true };
  const rows = input.tag_ids.map((tag_id) => ({ customer_id: input.customer_id, tag_id }));
  const { error } = await supabase.from('customer_tag_map').insert(rows);
  if (error) throw Errors.internal('Falha ao atribuir tags', { error: error.message });
  return { ok: true };
}

// ---------------- Notes ----------------
export async function addNote(
  supabase: SbClient, userId: string,
  input: { customer_id: string; body: string; pinned?: boolean },
) {
  const c = await assertWrite(supabase, userId, input.customer_id);
  const { data, error } = await supabase.from('customer_notes').insert({
    customer_id: input.customer_id, body: input.body, pinned: !!input.pinned, author_user_id: userId,
  }).select().single();
  if (error) throw Errors.internal('Falha ao adicionar nota', { error: error.message });
  await recordMetric('customers', 'customer.note.added', 1, 'count', {}, c.store_id);
  return data;
}

export async function updateNote(
  supabase: SbClient, userId: string,
  input: { id: string; body?: string; pinned?: boolean },
) {
  const { data: note } = await supabase.from('customer_notes').select('customer_id').eq('id', input.id).maybeSingle();
  if (!note) throw Errors.notFound('Nota', input.id);
  await assertWrite(supabase, userId, note.customer_id);
  const patch: Record<string, unknown> = {};
  if (input.body !== undefined) patch.body = input.body;
  if (input.pinned !== undefined) patch.pinned = input.pinned;
  const { data, error } = await supabase.from('customer_notes').update(patch).eq('id', input.id).select().single();
  if (error) throw Errors.internal('Falha ao atualizar nota', { error: error.message });
  return data;
}

export async function deleteNote(supabase: SbClient, userId: string, id: string) {
  const { data: note } = await supabase.from('customer_notes').select('customer_id').eq('id', id).maybeSingle();
  if (!note) throw Errors.notFound('Nota', id);
  await assertWrite(supabase, userId, note.customer_id);
  const { error } = await supabase.from('customer_notes').delete().eq('id', id);
  if (error) throw Errors.internal('Falha ao excluir nota', { error: error.message });
  return { ok: true };
}

// ---------------- Consents (LGPD) ----------------
type ConsentChannel = 'marketing_email' | 'marketing_sms' | 'marketing_whatsapp' | 'data_processing';

export async function updateConsents(
  supabase: SbClient, userId: string,
  input: {
    customer_id: string;
    consents: Partial<Record<ConsentChannel, boolean>>;
    source?: string; ip?: string; user_agent?: string;
  },
) {
  const c = await assertWrite(supabase, userId, input.customer_id);
  const colMap: Record<ConsentChannel, string> = {
    marketing_email: 'consent_marketing_email',
    marketing_sms: 'consent_marketing_sms',
    marketing_whatsapp: 'consent_marketing_whatsapp',
    data_processing: 'consent_data_processing',
  };
  const patch: Record<string, unknown> = { consent_updated_at: new Date().toISOString() };
  const logRows: Array<Record<string, unknown>> = [];
  for (const [ch, granted] of Object.entries(input.consents) as [ConsentChannel, boolean][]) {
    patch[colMap[ch]] = granted;
    logRows.push({
      customer_id: input.customer_id, channel: ch, granted,
      source: input.source ?? 'admin', ip: input.ip ?? null, user_agent: input.user_agent ?? null,
      actor_user_id: userId,
    });
  }
  const { error: e1 } = await supabase.from('customers').update(patch).eq('id', input.customer_id);
  if (e1) throw Errors.internal('Falha ao atualizar consentimentos', { error: e1.message });
  if (logRows.length) {
    const { error: e2 } = await supabase.from('customer_consents_log').insert(logRows);
    if (e2) throw Errors.internal('Falha ao registrar log de consentimento', { error: e2.message });
  }
  await enqueueOutbox({
    store_id: c.store_id, aggregate_type: 'customer', aggregate_id: input.customer_id,
    event_type: 'customer.consents.updated', payload: input.consents,
  });
  await recordMetric('customers', 'customer.consents.updated', logRows.length, 'count', {}, c.store_id);
  return { ok: true };
}

// ---------------- Geolocation prep ----------------
export async function setAddressGeolocation(
  supabase: SbClient, userId: string,
  input: { address_id: string; latitude: number; longitude: number; provider: string; precision: 'rooftop' | 'interpolated' | 'approximate' | 'city' },
) {
  const { data: addr } = await supabase.from('customer_addresses').select('customer_id').eq('id', input.address_id).maybeSingle();
  if (!addr) throw Errors.notFound('Endereço', input.address_id);
  await assertWrite(supabase, userId, addr.customer_id);
  const { error } = await supabase.from('customer_addresses').update({
    latitude: input.latitude, longitude: input.longitude,
    geocoded_at: new Date().toISOString(),
    geocode_provider: input.provider, geocode_precision: input.precision,
  }).eq('id', input.address_id);
  if (error) throw Errors.internal('Falha ao gravar geolocalização', { error: error.message });
  return { ok: true };
}

// ---------------- Score ----------------
export async function recomputeScore(supabase: SbClient, userId: string, customer_id: string) {
  const c = await assertWrite(supabase, userId, customer_id);
  const { data, error } = await supabase.rpc('recompute_customer_score', { _customer_id: customer_id });
  if (error) throw Errors.internal('Falha ao recalcular score', { error: error.message });
  await recordMetric('customers', 'customer.score.recomputed', 1, 'count', {}, c.store_id);
  return { score: data as number };
}
