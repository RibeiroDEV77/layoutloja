/**
 * Workflow Engine helpers.
 *
 * Aggregates (orders, returns, etc.) attach a workflow instance that tracks
 * their state and emits an outbox event on every transition.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { CommerceEventTypes, AggregateTypes } from './events';

export type SupabaseClient = ReturnType<typeof import('@supabase/supabase-js').createClient>;

/** Start a workflow instance for an aggregate, positioned at the initial state. */
export async function startWorkflow(
  supabase: SupabaseClient,
  args: {
    storeId: string | null;
    definitionCode: string;
    aggregateType: string;
    aggregateId: string;
    context?: Record<string, unknown>;
  },
): Promise<string> {
  const { data: def, error: defErr } = await supabase
    .from('workflow_definitions')
    .select('id, store_id')
    .eq('code', args.definitionCode)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (defErr) throw defErr;
  if (!def) throw new Error(`Workflow definition not found: ${args.definitionCode}`);

  const { data: initialState, error: stErr } = await supabase
    .from('workflow_states')
    .select('id, sla_minutes')
    .eq('definition_id', def.id)
    .eq('is_initial', true)
    .maybeSingle();
  if (stErr) throw stErr;
  if (!initialState) throw new Error(`No initial state on workflow ${args.definitionCode}`);

  const slaDueAt = initialState.sla_minutes
    ? new Date(Date.now() + initialState.sla_minutes * 60_000).toISOString()
    : null;

  const { data: inst, error: insErr } = await supabase
    .from('workflow_instances')
    .insert({
      store_id: args.storeId,
      definition_id: def.id,
      aggregate_type: args.aggregateType,
      aggregate_id: args.aggregateId,
      current_state_id: initialState.id,
      sla_due_at: slaDueAt,
      context: args.context ?? {},
    })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return inst.id as string;
}

/** Transition a workflow instance via its transition code. */
export async function transitionWorkflow(
  supabase: SupabaseClient,
  args: {
    instanceId: string;
    transitionCode: string;
    actorUserId?: string | null;
    reason?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const { data: inst, error: instErr } = await supabase
    .from('workflow_instances')
    .select('id, store_id, definition_id, current_state_id, started_at, status')
    .eq('id', args.instanceId)
    .maybeSingle();
  if (instErr) throw instErr;
  if (!inst) throw new Error('Workflow instance not found');
  if (inst.status !== 'active') throw new Error(`Workflow not active (status=${inst.status})`);

  const { data: trans, error: trErr } = await supabase
    .from('workflow_transitions')
    .select('id, to_state_id, from_state_id')
    .eq('definition_id', inst.definition_id)
    .eq('code', args.transitionCode)
    .eq('from_state_id', inst.current_state_id)
    .maybeSingle();
  if (trErr) throw trErr;
  if (!trans) throw new Error(`Invalid transition ${args.transitionCode} from current state`);

  const { data: targetState, error: tsErr } = await supabase
    .from('workflow_states')
    .select('id, is_final, sla_minutes')
    .eq('id', trans.to_state_id)
    .single();
  if (tsErr) throw tsErr;

  const newSla = targetState.sla_minutes
    ? new Date(Date.now() + targetState.sla_minutes * 60_000).toISOString()
    : null;

  const { error: updErr } = await supabase
    .from('workflow_instances')
    .update({
      current_state_id: trans.to_state_id,
      status: targetState.is_final ? 'completed' : 'active',
      completed_at: targetState.is_final ? new Date().toISOString() : null,
      sla_due_at: newSla,
    })
    .eq('id', args.instanceId);
  if (updErr) throw updErr;

  const { error: histErr } = await supabase.from('workflow_state_history').insert({
    instance_id: args.instanceId,
    from_state_id: inst.current_state_id,
    to_state_id: trans.to_state_id,
    transition_id: trans.id,
    actor_user_id: args.actorUserId ?? null,
    reason: args.reason ?? null,
    payload: args.payload ?? {},
  });
  if (histErr) throw histErr;

  // Emit domain event via outbox
  await supabase.rpc('enqueue_outbox_event', {
    _store_id: inst.store_id,
    _aggregate_type: AggregateTypes.WorkflowInstance,
    _aggregate_id: args.instanceId,
    _event_type: CommerceEventTypes.WorkflowTransitioned,
    _payload: {
      transition_code: args.transitionCode,
      from_state_id: inst.current_state_id,
      to_state_id: trans.to_state_id,
      reason: args.reason ?? null,
    },
    _metadata: { actor_user_id: args.actorUserId ?? null },
    _correlation_id: null,
    _causation_id: null,
    _ordered: true,
  });
}

/** Fetch workflow state + history for an aggregate (read-only). */
export const getWorkflowForAggregate = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { aggregateType: string; aggregateId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: inst, error } = await context.supabase
      .from('workflow_instances')
      .select('*, current_state:workflow_states!current_state_id(*), definition:workflow_definitions(*)')
      .eq('aggregate_type', data.aggregateType)
      .eq('aggregate_id', data.aggregateId)
      .maybeSingle();
    if (error) throw error;
    if (!inst) return null;
    const { data: history } = await context.supabase
      .from('workflow_state_history')
      .select('*')
      .eq('instance_id', inst.id)
      .order('occurred_at', { ascending: true });
    return { instance: inst, history: history ?? [] };
  });
