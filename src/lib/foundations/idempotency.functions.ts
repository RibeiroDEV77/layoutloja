/**
 * Idempotency helpers.
 *
 * Wrap any side-effectful operation (checkout, order create, payment, webhook)
 * with `withIdempotency` to deduplicate retries and replay cached responses.
 */
import { createHash } from 'crypto';

export type IdempotencyAction =
  | { action: 'proceed'; id: string }
  | { action: 'retry'; id: string }
  | { action: 'replay'; status: number; body: unknown; resource_id: string | null }
  | { action: 'in_progress'; id: string }
  | { action: 'conflict'; reason: string };

export function hashRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
}

export interface WithIdempotencyOptions<T> {
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>;
  scope: string;
  key: string;
  storeId: string | null;
  actorUserId: string | null;
  requestPayload: unknown;
  ttlSeconds?: number;
  /** Optional resource type to record (e.g. 'order'). */
  resourceType?: string;
  /** Run the protected operation; return result + optional resourceId. */
  execute: () => Promise<{ result: T; resourceId?: string | null; status?: number }>;
}

/**
 * Begin an idempotent operation. If the key is already complete and the
 * request hash matches, returns the cached result. Otherwise runs `execute`
 * and persists the response for future replays.
 */
export async function withIdempotency<T>(
  opts: WithIdempotencyOptions<T>,
): Promise<{ replayed: boolean; result: T; status: number; resourceId: string | null }> {
  const requestHash = hashRequest(opts.requestPayload);
  const { data: beginResp, error: beginErr } = await opts.supabase.rpc('idempotency_begin', {
    _scope: opts.scope,
    _key: opts.key,
    _store_id: opts.storeId,
    _actor_user_id: opts.actorUserId,
    _request_hash: requestHash,
    _ttl_seconds: opts.ttlSeconds ?? 86400,
  });
  if (beginErr) throw beginErr;

  const decision = beginResp as IdempotencyAction;
  if (decision.action === 'replay') {
    return {
      replayed: true,
      result: decision.body as T,
      status: decision.status,
      resourceId: decision.resource_id,
    };
  }
  if (decision.action === 'in_progress') {
    throw new Error('Idempotent operation already in progress for this key.');
  }
  if (decision.action === 'conflict') {
    throw new Error(`Idempotency conflict: ${decision.reason}`);
  }

  // proceed or retry
  const id = decision.id;
  try {
    const { result, resourceId, status } = await opts.execute();
    const body = result as unknown;
    await opts.supabase.rpc('idempotency_complete', {
      _id: id,
      _status: 'succeeded',
      _response_status: status ?? 200,
      _response_body: body as never,
      _response_hash: hashRequest(body),
      _resource_type: opts.resourceType ?? null,
      _resource_id: resourceId ?? null,
      _error_code: null,
    });
    return { replayed: false, result, status: status ?? 200, resourceId: resourceId ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await opts.supabase.rpc('idempotency_complete', {
      _id: id,
      _status: 'failed',
      _response_status: 500,
      _response_body: { error: message } as never,
      _response_hash: hashRequest({ error: message }),
      _resource_type: opts.resourceType ?? null,
      _resource_id: null,
      _error_code: 'execution_failed',
    });
    throw err;
  }
}
