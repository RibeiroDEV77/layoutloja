/**
 * DAM — camada de serviço (server-only).
 *
 * Responsável por:
 *  - registrar/listar assets (driver external para URLs, YouTube, Vimeo;
 *    driver supabase quando o bucket existir)
 *  - jobs de upload (criar/cancelar/concluir, com retry e auditoria)
 *  - vincular assets a entidades (asset_links, polimórfico)
 *  - versionamento (asset_versions) ao substituir o binário
 *  - validação de exclusão (bloqueia se houver vínculos)
 */
import type { SbClient } from '../events/dispatcher.server';
import { dispatchEvent } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin, requirePermission, requireStoreAccess } from './permissions.server';
import { getStorageDriver, type UploadTarget } from '@/lib/dam/storage';

type AssetContext = 'product' | 'category' | 'brand' | 'collection' | 'banner' | 'institutional' | 'marketing' | 'other';
type AssetKind = 'image' | 'video' | 'youtube' | 'vimeo' | 'pdf' | 'svg' | 'other';
type AssetDriver = 'supabase' | 'external' | 'youtube' | 'vimeo';
type AssetStatus = 'active' | 'archived';

async function ensureRead(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  await requireStoreAccess(supabase, userId, storeId);
}

/* -------------------------- helpers de identificação -------------------------- */

function parseYouTube(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}
function parseVimeo(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}
function inferKindFromUrl(url: string): { kind: AssetKind; driver: AssetDriver; externalId?: string } {
  const y = parseYouTube(url);
  if (y) return { kind: 'youtube', driver: 'youtube', externalId: y };
  const v = parseVimeo(url);
  if (v) return { kind: 'vimeo', driver: 'vimeo', externalId: v };
  const u = url.toLowerCase().split('?')[0];
  if (/\.(png|jpe?g|webp|gif|bmp|tiff?|avif)$/.test(u)) return { kind: 'image', driver: 'external' };
  if (/\.svg$/.test(u)) return { kind: 'svg', driver: 'external' };
  if (/\.(mp4|webm|mov|m4v)$/.test(u)) return { kind: 'video', driver: 'external' };
  if (/\.pdf$/.test(u)) return { kind: 'pdf', driver: 'external' };
  return { kind: 'other', driver: 'external' };
}

/* ------------------------------- listagem ------------------------------- */

export interface ListAssetsParams {
  store_id: string;
  context?: AssetContext;
  kind?: AssetKind;
  status?: AssetStatus;
  search?: string;
  folder_id?: string | null;
  page?: number;
  page_size?: number;
}

export async function listAssets(supabase: SbClient, userId: string, p: ListAssetsParams) {
  await ensureRead(supabase, userId, p.store_id);
  const page = Math.max(1, p.page ?? 1);
  const size = Math.min(200, Math.max(1, p.page_size ?? 48));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase
    .from('assets')
    .select('*', { count: 'exact' })
    .eq('store_id', p.store_id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (p.context) q = q.eq('context', p.context);
  if (p.kind) q = q.eq('kind', p.kind);
  q = p.status ? q.eq('status', p.status) : q.eq('status', 'active');
  if (p.folder_id !== undefined) {
    q = p.folder_id === null ? q.is('folder_id', null) : q.eq('folder_id', p.folder_id);
  }
  if (p.search && p.search.trim()) {
    const s = `%${p.search.trim()}%`;
    q = q.or(`title.ilike.${s},original_filename.ilike.${s},alt_text.ilike.${s},description.ilike.${s}`);
  }

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar assets', { error: error.message });

  // Resolve URLs via driver (com fallback inline para storage_driver='supabase')
  const driver = getStorageDriver();
  const rows = await Promise.all(
    (data ?? []).map(async (a) => ({
      ...a,
      preview_url: await resolvePreviewUrl(supabase, a),
    })),
  );

  return { rows, page, page_size: size, total: count ?? 0 };
}

async function resolvePreviewUrl(
  supabase: SbClient,
  a: { storage_driver: AssetDriver; bucket: string | null; storage_path: string | null; thumb_path: string | null; external_url: string | null },
): Promise<string | null> {
  const path = a.thumb_path ?? a.storage_path;
  if (a.storage_driver === 'supabase' && a.bucket && path) {
    const { data } = await supabase.storage.from(a.bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }
  const driver = getStorageDriver();
  return driver.resolveUrl({ bucket: a.bucket, path, externalUrl: a.external_url });
}

export async function getAsset(supabase: SbClient, userId: string, id: string) {
  const { data, error } = await supabase.from('assets').select('*').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar asset', { error: error.message });
  if (!data) throw Errors.notFound('Asset', id);
  await ensureRead(supabase, userId, data.store_id);
  const url = await resolvePreviewUrl(supabase, data);
  return { ...data, preview_url: url };
}


export async function getAssetUsage(supabase: SbClient, userId: string, id: string) {
  const asset = await getAsset(supabase, userId, id);
  const { data, error } = await supabase
    .from('asset_links')
    .select('*')
    .eq('asset_id', asset.id)
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar usos', { error: error.message });
  return { asset_id: asset.id, count: data?.length ?? 0, links: data ?? [] };
}

/* --------------------------- registro / criação --------------------------- */

export interface RegisterExternalParams {
  store_id: string;
  context: AssetContext;
  url: string;
  title?: string;
  alt_text?: string;
  description?: string;
  folder_id?: string | null;
}

export async function registerExternalAsset(
  supabase: SbClient,
  userId: string,
  p: RegisterExternalParams,
) {
  await requirePermission(supabase, userId, 'dam.upload', p.store_id);
  if (!p.url || !/^https?:\/\//i.test(p.url)) {
    throw Errors.validation('URL inválida', { url: p.url });
  }
  const inf = inferKindFromUrl(p.url);
  const insert = {
    store_id: p.store_id,
    context: p.context,
    kind: inf.kind,
    storage_driver: inf.driver,
    external_url: inf.driver === 'external' ? p.url : null,
    external_id: inf.externalId ?? null,
    title: p.title ?? null,
    alt_text: p.alt_text ?? null,
    description: p.description ?? null,
    folder_id: p.folder_id ?? null,
    created_by: userId,
    original_filename: p.url.split('/').pop()?.split('?')[0] ?? null,
  };
  const { data, error } = await supabase.from('assets').insert(insert).select('*').single();
  if (error) throw Errors.internal('Falha ao registrar asset', { error: error.message });

  await dispatchEvent(supabase, {
    event_type: 'asset.registered',
    aggregate_type: 'asset',
    aggregate_id: data.id,
    store_id: p.store_id,
    payload: { kind: data.kind, driver: data.storage_driver },
  });
  return data;
}

/* ------------------------------ upload jobs ------------------------------ */

export interface CreateUploadJobParams {
  store_id: string;
  context: AssetContext;
  filename: string;
  size_bytes?: number;
  mime?: string;
}

export async function createUploadJob(
  supabase: SbClient,
  userId: string,
  p: CreateUploadJobParams,
): Promise<{ job_id: string; target: UploadTarget }> {
  await requirePermission(supabase, userId, 'dam.upload', p.store_id);
  // P7: valida metadados anunciados antes de gerar signed URL.
  const { assertUploadPolicyByMetadata } = await import('./dam-upload-policy.server');
  assertUploadPolicyByMetadata({
    filename: p.filename,
    mime: p.mime ?? null,
    size_bytes: p.size_bytes ?? null,
  });
  const driver = getStorageDriver();
  const target = await driver.prepareUpload({
    storeId: p.store_id,
    filename: p.filename,
    mime: p.mime ?? 'application/octet-stream',
  });
  const { data, error } = await supabase
    .from('asset_upload_jobs')
    .insert({
      store_id: p.store_id,
      user_id: userId,
      context: p.context,
      filename: p.filename,
      size_bytes: p.size_bytes ?? null,
      mime: p.mime ?? null,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw Errors.internal('Falha ao criar job de upload', { error: error.message });
  return { job_id: data.id, target };
}

/* ----------- upload binário direto ao bucket `dam` (Supabase Storage) ----------- */

const DAM_BUCKET = 'dam';

function buildStoragePath(storeId: string, jobId: string, filename: string) {
  const safe = (filename || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 180);
  return `${storeId}/${jobId}/${safe}`;
}

export async function signUploadJob(supabase: SbClient, userId: string, jobId: string) {
  const { data: job, error } = await supabase
    .from('asset_upload_jobs')
    .select('id, store_id, filename, status')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar job', { error: error.message });
  if (!job) throw Errors.notFound('Upload job', jobId);
  await requirePermission(supabase, userId, 'dam.upload', job.store_id);
  const path = buildStoragePath(job.store_id, job.id, job.filename);
  const { data: signed, error: signErr } = await supabase
    .storage.from(DAM_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (signErr || !signed) {
    throw Errors.internal(
      'Falha ao gerar URL de upload — verifique se o bucket "dam" existe (Supabase → Storage)',
      { error: signErr?.message },
    );
  }
  await supabase.from('asset_upload_jobs').update({ status: 'uploading' }).eq('id', jobId);
  return { url: signed.signedUrl, token: signed.token, bucket: DAM_BUCKET, path };
}

export interface CompleteUploadJobParams {
  job_id: string;
  size_bytes?: number;
  mime?: string;
  width?: number;
  height?: number;
  title?: string;
  alt_text?: string;
  folder_id?: string | null;
}

export async function completeUploadJob(
  supabase: SbClient,
  userId: string,
  p: CompleteUploadJobParams,
) {
  const { data: job, error } = await supabase
    .from('asset_upload_jobs')
    .select('id, store_id, context, filename, mime, size_bytes, status, asset_id')
    .eq('id', p.job_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar job', { error: error.message });
  if (!job) throw Errors.notFound('Upload job', p.job_id);

  if (job.status === 'done' && job.asset_id) {
    const { data: existing } = await supabase.from('assets').select('*').eq('id', job.asset_id).maybeSingle();
    if (existing) return existing;
  }

  await requirePermission(supabase, userId, 'dam.upload', job.store_id);

  const mime = p.mime ?? job.mime ?? 'application/octet-stream';
  const kind: AssetKind =
    mime.startsWith('image/svg') ? 'svg'
    : mime.startsWith('image/') ? 'image'
    : mime.startsWith('video/') ? 'video'
    : mime === 'application/pdf' ? 'pdf'
    : 'other';

  const path = buildStoragePath(job.store_id, job.id, job.filename);

  const { data: asset, error: insErr } = await supabase
    .from('assets')
    .insert({
      store_id: job.store_id,
      context: job.context as AssetContext,
      kind,
      storage_driver: 'supabase' as AssetDriver,
      bucket: DAM_BUCKET,
      storage_path: path,
      mime,
      size_bytes: p.size_bytes ?? job.size_bytes ?? null,
      width: p.width ?? null,
      height: p.height ?? null,
      original_filename: job.filename,
      title: p.title ?? null,
      alt_text: p.alt_text ?? null,
      folder_id: p.folder_id ?? null,
      created_by: userId,
    })
    .select('*')
    .single();
  if (insErr) throw Errors.internal('Falha ao registrar asset', { error: insErr.message });

  await supabase
    .from('asset_upload_jobs')
    .update({
      status: 'done',
      asset_id: asset.id,
      bytes_uploaded: p.size_bytes ?? job.size_bytes ?? 0,
    })
    .eq('id', p.job_id);

  await dispatchEvent(supabase, {
    event_type: 'asset.registered',
    aggregate_type: 'asset',
    aggregate_id: asset.id,
    store_id: job.store_id,
    payload: { kind: asset.kind, driver: 'supabase', bucket: DAM_BUCKET, path },
  });

  const preview_url = await resolvePreviewUrl(supabase, asset);
  return { ...asset, preview_url };
}

export async function cancelUploadJob(supabase: SbClient, userId: string, jobId: string) {

  const { data, error } = await supabase
    .from('asset_upload_jobs')
    .update({ status: 'canceled' })
    .eq('id', jobId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao cancelar job', { error: error.message });
  if (!data) throw Errors.notFound('Upload job', jobId);
  return { ok: true };
}

export async function failUploadJob(
  supabase: SbClient,
  userId: string,
  p: { job_id: string; error: string },
) {
  const { data: job } = await supabase
    .from('asset_upload_jobs')
    .select('attempts')
    .eq('id', p.job_id)
    .eq('user_id', userId)
    .maybeSingle();
  await supabase
    .from('asset_upload_jobs')
    .update({ status: 'failed', error: p.error, attempts: (job?.attempts ?? 0) + 1 })
    .eq('id', p.job_id)
    .eq('user_id', userId);
  return { ok: true };
}

/* ---------------------------- metadados / órbita ---------------------------- */

export interface UpdateMetaParams {
  id: string;
  title?: string | null;
  alt_text?: string | null;
  description?: string | null;
  caption?: string | null;
  original_filename?: string | null;
  folder_id?: string | null;
  context?: AssetContext;
}

export async function updateAssetMeta(supabase: SbClient, userId: string, p: UpdateMetaParams) {
  const asset = await getAsset(supabase, userId, p.id);
  await requirePermission(supabase, userId, 'dam.update', asset.store_id);
  const patch: Partial<{
    title: string | null; alt_text: string | null; description: string | null;
    caption: string | null; original_filename: string | null; folder_id: string | null;
    context: AssetContext;
  }> = {};
  if (p.title !== undefined) patch.title = p.title;
  if (p.alt_text !== undefined) patch.alt_text = p.alt_text;
  if (p.description !== undefined) patch.description = p.description;
  if (p.caption !== undefined) patch.caption = p.caption;
  if (p.original_filename !== undefined) patch.original_filename = p.original_filename;
  if (p.folder_id !== undefined) patch.folder_id = p.folder_id;
  if (p.context !== undefined) patch.context = p.context;
  const { data, error } = await supabase.from('assets').update(patch).eq('id', p.id).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar metadados', { error: error.message });
  return data;
}

export async function archiveAsset(supabase: SbClient, userId: string, id: string) {
  const asset = await getAsset(supabase, userId, id);
  await requirePermission(supabase, userId, 'dam.archive', asset.store_id);
  const { data, error } = await supabase
    .from('assets')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw Errors.internal('Falha ao arquivar', { error: error.message });
  return data;
}
export async function restoreAsset(supabase: SbClient, userId: string, id: string) {
  const asset = await getAsset(supabase, userId, id);
  await requirePermission(supabase, userId, 'dam.archive', asset.store_id);
  const { data, error } = await supabase
    .from('assets')
    .update({ status: 'active', archived_at: null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw Errors.internal('Falha ao restaurar', { error: error.message });
  return data;
}

export async function deleteAsset(supabase: SbClient, userId: string, id: string) {
  const asset = await getAsset(supabase, userId, id);
  await requirePermission(supabase, userId, 'dam.delete', asset.store_id);
  // Pre-check (trigger no banco também bloqueia)
  const { data: usage } = await supabase.from('asset_links').select('id', { count: 'exact' }).eq('asset_id', id).limit(1);
  if (usage && usage.length > 0) {
    throw Errors.rule('Asset vinculado — remova os vínculos ou arquive-o.', { asset_id: id });
  }
  // Remove do storage (se houver)
  if (asset.storage_driver === 'supabase' && asset.bucket && asset.storage_path) {
    await supabase.storage.from(asset.bucket).remove([asset.storage_path]);
  } else {
    const driver = getStorageDriver();
    await driver.remove({ bucket: asset.bucket, path: asset.storage_path });
  }

  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) throw Errors.internal('Falha ao excluir', { error: error.message });
  return { ok: true };
}

/* -------------------------------- links -------------------------------- */

export interface LinkAssetParams {
  asset_id: string;
  owner_type: string;
  owner_id: string;
  role?: string;
  sort_order?: number;
}
export async function linkAsset(supabase: SbClient, userId: string, p: LinkAssetParams) {
  const asset = await getAsset(supabase, userId, p.asset_id);
  await requirePermission(supabase, userId, 'dam.link', asset.store_id);
  const { data, error } = await supabase
    .from('asset_links')
    .insert({
      asset_id: p.asset_id,
      owner_type: p.owner_type,
      owner_id: p.owner_id,
      role: p.role ?? 'gallery',
      sort_order: p.sort_order ?? 0,
      created_by: userId,
    })
    .select('*')
    .single();
  if (error) throw Errors.internal('Falha ao vincular', { error: error.message });
  return data;
}

export async function unlinkAsset(supabase: SbClient, userId: string, linkId: string) {
  const { data: link } = await supabase.from('asset_links').select('asset_id').eq('id', linkId).maybeSingle();
  if (!link) throw Errors.notFound('Vínculo', linkId);
  const asset = await getAsset(supabase, userId, link.asset_id);
  await requirePermission(supabase, userId, 'dam.link', asset.store_id);
  const { error } = await supabase.from('asset_links').delete().eq('id', linkId);
  if (error) throw Errors.internal('Falha ao desvincular', { error: error.message });
  return { ok: true };
}

export async function listLinksByOwner(
  supabase: SbClient,
  userId: string,
  p: { owner_type: string; owner_id: string; store_id: string },
) {
  await ensureRead(supabase, userId, p.store_id);
  const { data, error } = await supabase
    .from('asset_links')
    .select('*, assets(*)')
    .eq('owner_type', p.owner_type)
    .eq('owner_id', p.owner_id)
    .order('sort_order', { ascending: true });
  if (error) throw Errors.internal('Falha ao listar vínculos', { error: error.message });
  const driver = getStorageDriver();
  const rows = await Promise.all(
    (data ?? []).map(async (l) => {
      const a = l.assets;
      const preview_url = a
        ? await driver.resolveUrl({ bucket: a.bucket, path: a.thumb_path ?? a.storage_path, externalUrl: a.external_url })
        : null;
      return { ...l, preview_url };
    }),
  );
  return rows;
}

export async function reorderLinks(
  supabase: SbClient,
  userId: string,
  p: { items: { id: string; sort_order: number }[] },
) {
  for (const it of p.items) {
    const { data: link } = await supabase.from('asset_links').select('asset_id').eq('id', it.id).maybeSingle();
    if (!link) continue;
    const asset = await getAsset(supabase, userId, link.asset_id);
    await requirePermission(supabase, userId, 'dam.link', asset.store_id);
    await supabase.from('asset_links').update({ sort_order: it.sort_order }).eq('id', it.id);
  }
  return { ok: true };
}

/* -------------------------------- pastas -------------------------------- */

export async function listFolders(supabase: SbClient, userId: string, p: { store_id: string; context?: AssetContext }) {
  await ensureRead(supabase, userId, p.store_id);
  let q = supabase.from('asset_folders').select('*').eq('store_id', p.store_id).order('name');
  if (p.context) q = q.eq('context', p.context);
  const { data, error } = await q;
  if (error) throw Errors.internal('Falha ao listar pastas', { error: error.message });
  return data ?? [];
}

export async function createFolder(
  supabase: SbClient,
  userId: string,
  p: { store_id: string; name: string; context: AssetContext; parent_id?: string | null },
) {
  await requirePermission(supabase, userId, 'dam.update', p.store_id);
  const { data, error } = await supabase
    .from('asset_folders')
    .insert({ store_id: p.store_id, name: p.name, context: p.context, parent_id: p.parent_id ?? null })
    .select('*')
    .single();
  if (error) throw Errors.internal('Falha ao criar pasta', { error: error.message });
  return data;
}
