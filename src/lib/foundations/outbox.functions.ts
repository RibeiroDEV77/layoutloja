/**
 * Transactional Outbox helpers.
 *
 * Events are enqueued in the SAME transaction as the aggregate write,
 * guaranteeing at-least-once delivery to consumers via the dispatcher worker.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { CommerceEventType, AggregateType } from './events';

export interface EnqueueOutboxInput {
  storeId: string | null;
  aggregateType: AggregateType | string;
  aggregateId: string;
  eventType: CommerceEventType | string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
  ordered?: boolean;
}

/**
 * Enqueue an outbox event. Intended to be called from within a server function
 * that has already performed (or is about to perform, in the same transaction)
 * the aggregate write.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enqueueOutbox(supabase: any, input: EnqueueOutboxInput): Promise<string> {
  const { data, error } = await supabase.rpc('enqueue_outbox_event', {
    _store_id: input.storeId,
    _aggregate_type: input.aggregateType,
    _aggregate_id: input.aggregateId,
    _event_type: input.eventType,
    _payload: input.payload ?? {},
    _metadata: input.metadata ?? {},
    _correlation_id: input.correlationId ?? null,
    _causation_id: input.causationId ?? null,
    _ordered: input.ordered ?? false,
  });
  if (error) throw error;
  return data as string;
}

/** List recent outbox events for a store (admin view). */
export const listOutbox = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storeId?: string; status?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = context.supabase
      .from('event_outbox')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (data.storeId) q = q.eq('store_id', data.storeId);
    if (data.status) q = q.eq('status', data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows;
  });

/** List dead-letter events. */
export const listDeadLetter = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storeId?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from('event_outbox_dead_letter')
      .select('*')
      .order('failed_at', { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (data.storeId) q = q.eq('store_id', data.storeId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows;
  });
