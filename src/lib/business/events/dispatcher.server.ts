/**
 * Event Dispatcher (server-only).
 *
 * Persiste o evento em `domain_events` via RPC `emit_domain_event`.
 * Consumidores (e-mail, WhatsApp, ERP, marketplace, analytics) serão
 * implementados em fase posterior, lendo `domain_events` em background.
 *
 * O dispatcher é write-only e isolado da lógica de negócio.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { DomainEventPayload } from './types';

export type SbClient = SupabaseClient<Database>;

export interface DispatchedEvent {
  id: string;
  event_type: string;
  aggregate_id: string;
}

/**
 * Emite um único Domain Event.
 * Falhas de emissão NÃO interrompem a operação principal — apenas são logadas.
 * Isso garante desacoplamento: a regra de negócio é a fonte da verdade,
 * o evento é uma notificação eventual.
 */
export async function dispatchEvent(
  supabase: SbClient,
  event: DomainEventPayload,
): Promise<DispatchedEvent | null> {
  const { data, error } = await supabase.rpc('emit_domain_event', {
    _event_type: event.event_type,
    _aggregate_type: event.aggregate_type,
    _aggregate_id: event.aggregate_id,
    _store_id: event.store_id,
    _payload: (event.payload ?? {}) as never,
    _metadata: (event.metadata ?? {}) as never,
  });

  if (error) {
    console.error('[dispatcher] emit_domain_event failed', {
      event_type: event.event_type,
      aggregate_id: event.aggregate_id,
      error: error.message,
    });
    return null;
  }

  return {
    id: data as unknown as string,
    event_type: event.event_type,
    aggregate_id: event.aggregate_id,
  };
}

/** Emite múltiplos eventos em sequência. */
export async function dispatchAll(
  supabase: SbClient,
  events: DomainEventPayload[],
): Promise<DispatchedEvent[]> {
  const results: DispatchedEvent[] = [];
  for (const ev of events) {
    const r = await dispatchEvent(supabase, ev);
    if (r) results.push(r);
  }
  return results;
}
