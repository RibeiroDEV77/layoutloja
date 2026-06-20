/**
 * Server Functions: Digital Asset Manager (DAM).
 *
 * Único ponto de entrada do cliente para qualquer operação sobre ativos.
 * Nenhum outro módulo deve gravar diretamente em `assets`, `asset_links`,
 * `asset_versions` ou `asset_upload_jobs` — sempre via estas funções.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as S from './services/assets.server';

export const listAssets = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: S.ListAssetsParams) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.listAssets(context.supabase, context.userId, data),
  ));

export const getAsset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.getAsset(context.supabase, context.userId, data.id),
  ));

export const getAssetUsage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.getAssetUsage(context.supabase, context.userId, data.id),
  ));

export const registerExternalAsset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: S.RegisterExternalParams) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.registerExternalAsset(context.supabase, context.userId, data),
  ));

export const createUploadJob = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: S.CreateUploadJobParams) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.createUploadJob(context.supabase, context.userId, data),
  ));

export const cancelUploadJob = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { job_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.cancelUploadJob(context.supabase, context.userId, data.job_id),
  ));

export const failUploadJob = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { job_id: string; error: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.failUploadJob(context.supabase, context.userId, data),
  ));

export const updateAssetMeta = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: S.UpdateMetaParams) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.updateAssetMeta(context.supabase, context.userId, data),
  ));

export const archiveAsset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.archiveAsset(context.supabase, context.userId, data.id),
  ));

export const restoreAsset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.restoreAsset(context.supabase, context.userId, data.id),
  ));

export const deleteAsset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.deleteAsset(context.supabase, context.userId, data.id),
  ));

export const linkAsset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: S.LinkAssetParams) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.linkAsset(context.supabase, context.userId, data),
  ));

export const unlinkAsset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.unlinkAsset(context.supabase, context.userId, data.id),
  ));

export const listLinksByOwner = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { owner_type: string; owner_id: string; store_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.listLinksByOwner(context.supabase, context.userId, data),
  ));

export const reorderLinks = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { items: { id: string; sort_order: number }[] }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.reorderLinks(context.supabase, context.userId, data),
  ));

export const listFolders = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { store_id: string; context?: S.ListAssetsParams['context'] }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.listFolders(context.supabase, context.userId, data),
  ));

export const createFolder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { store_id: string; name: string; context: NonNullable<S.ListAssetsParams['context']>; parent_id?: string | null }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    S.createFolder(context.supabase, context.userId, data),
  ));
