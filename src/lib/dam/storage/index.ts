/**
 * DAM Storage Driver — interface única consumida pelo serviço de assets.
 *
 * Hoje só o driver `external` está plenamente operacional (URLs colados pelo
 * usuário). Quando o bucket `dam` for habilitado no Supabase Storage, basta
 * trocar a fábrica para devolver `SupabaseStorageDriver`. O contrato com o
 * resto da aplicação é o mesmo.
 */
export type StorageDriverKind = 'supabase' | 'external';

export interface UploadTargetExternal {
  mode: 'external';
}
export interface UploadTargetSupabase {
  mode: 'supabase';
  bucket: string;
  path: string;
  // No futuro: signed upload URL
  signedUrl?: string;
}
export type UploadTarget = UploadTargetExternal | UploadTargetSupabase;

export interface StorageDriver {
  kind: StorageDriverKind;
  /** Prepara um destino de upload para um job. */
  prepareUpload(input: { storeId: string; filename: string; mime: string }): Promise<UploadTarget>;
  /** Devolve uma URL pública/assinada para exibir o asset. */
  resolveUrl(input: { bucket?: string | null; path?: string | null; externalUrl?: string | null }): Promise<string | null>;
  /** Remove um objeto (no-op no driver external). */
  remove(input: { bucket?: string | null; path?: string | null }): Promise<void>;
}

class ExternalDriver implements StorageDriver {
  kind: StorageDriverKind = 'external';
  async prepareUpload(): Promise<UploadTarget> {
    return { mode: 'external' };
  }
  async resolveUrl({ externalUrl }: { externalUrl?: string | null }) {
    return externalUrl ?? null;
  }
  async remove(): Promise<void> {
    /* nada a fazer */
  }
}

let cached: StorageDriver | null = null;
export function getStorageDriver(): StorageDriver {
  if (cached) return cached;
  // TODO: detectar disponibilidade do bucket `dam` e retornar SupabaseStorageDriver.
  cached = new ExternalDriver();
  return cached;
}
