/**
 * DAM Storage Driver — interface única consumida pelo serviço de assets.
 *
 * Drivers disponíveis:
 *  - `supabase` (padrão) — bucket `dam` no Supabase Storage, com URL assinada
 *    para leitura privada e remoção real do binário.
 *  - `external` — fallback para mídias registradas por URL (YouTube/Vimeo/CDN
 *    externo). Continua sendo usado para assets cujo `storage_driver` ≠ 'supabase'.
 *
 * O caminho de upload binário (signed PUT) é tratado diretamente em
 * `signUploadJob` no serviço de assets — esta camada apenas resolve URL,
 * prepara destino e remove objeto.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export type StorageDriverKind = 'supabase' | 'external';

export interface UploadTargetExternal {
  mode: 'external';
}
export interface UploadTargetSupabase {
  mode: 'supabase';
  bucket: string;
  path: string;
  signedUrl?: string;
}
export type UploadTarget = UploadTargetExternal | UploadTargetSupabase;

export interface StorageDriver {
  kind: StorageDriverKind;
  prepareUpload(input: { storeId: string; filename: string; mime: string }): Promise<UploadTarget>;
  resolveUrl(input: { bucket?: string | null; path?: string | null; externalUrl?: string | null }): Promise<string | null>;
  remove(input: { bucket?: string | null; path?: string | null }): Promise<void>;
}

class ExternalDriver implements StorageDriver {
  kind: StorageDriverKind = 'external';
  async prepareUpload(): Promise<UploadTarget> { return { mode: 'external' }; }
  async resolveUrl({ externalUrl }: { externalUrl?: string | null }) { return externalUrl ?? null; }
  async remove(): Promise<void> { /* no-op */ }
}

const DAM_BUCKET = 'dam';

/**
 * Cliente lazy de service-role para operações administrativas de storage
 * (signed URL de leitura, remoção). NÃO usar para uploads — uploads passam
 * pela URL assinada gerada por `signUploadJob` no contexto do usuário.
 */
let _admin: SupabaseClient<Database> | null = null;
function admin(): SupabaseClient<Database> {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes — driver supabase indisponível');
  }
  _admin = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

class SupabaseStorageDriver implements StorageDriver {
  kind: StorageDriverKind = 'supabase';

  async prepareUpload({ storeId, filename }: { storeId: string; filename: string }): Promise<UploadTarget> {
    // O job persistente é criado no serviço; aqui só descrevemos o destino canônico.
    const safe = (filename || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 180);
    return { mode: 'supabase', bucket: DAM_BUCKET, path: `${storeId}/${safe}` };
  }

  async resolveUrl({ bucket, path, externalUrl }: { bucket?: string | null; path?: string | null; externalUrl?: string | null }) {
    if (externalUrl) return externalUrl;
    if (!bucket || !path) return null;
    try {
      const { data } = await admin().storage.from(bucket).createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    } catch {
      return null;
    }
  }

  async remove({ bucket, path }: { bucket?: string | null; path?: string | null }) {
    if (!bucket || !path) return;
    try { await admin().storage.from(bucket).remove([path]); } catch { /* ignore */ }
  }
}

let cached: StorageDriver | null = null;
export function getStorageDriver(): StorageDriver {
  if (cached) return cached;
  // Padrão = supabase. Permite forçar external via DAM_DRIVER=external (testes/local).
  const kind = (process.env.DAM_DRIVER ?? 'supabase').toLowerCase();
  cached = kind === 'external' ? new ExternalDriver() : new SupabaseStorageDriver();
  return cached;
}

/** Apenas para testes; força um driver específico no próximo `getStorageDriver()`. */
export function __resetStorageDriverForTests() { cached = null; }
