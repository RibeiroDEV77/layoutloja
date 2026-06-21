/**
 * Server Functions: Sincronização de rastreamento de envios.
 * Manual sync (admin/staff) e exposição de helpers para o cron interno.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import { Errors } from './errors';
import * as Svc from './services/shipping/tracking.server';

export const syncShipmentTracking = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { shipment_id: string }) => d)
  .handler(
    withBusiness(async ({ data, context }) => {
      // Permissão: descobre store_id do shipment via RPC pública não existe,
      // então lemos via supabase com RLS (a leitura exige fulfillment.read).
      const { data: ship, error } = await context.supabase
        .from('shipments')
        .select('id, store_id')
        .eq('id', data.shipment_id)
        .maybeSingle();
      if (error) throw Errors.internal('Falha ao carregar shipment', { error: error.message });
      if (!ship) throw Errors.notFound('Shipment', data.shipment_id);
      await Svc.assertCanSyncTracking(context.supabase, context.userId, ship.store_id);
      return Svc.syncShipmentTracking(context.supabase, { shipment_id: data.shipment_id });
    }),
  );
