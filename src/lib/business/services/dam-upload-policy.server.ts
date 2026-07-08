/**
 * P7 — Validação segura de upload no bucket `dam`.
 *
 * Camada única, chamada em `createUploadJob` (checagem preliminar) e
 * `completeUploadJob` (verificação real do conteúdo já gravado). Além disso,
 * o próprio bucket `dam` recebe `allowed_mime_types` e `file_size_limit` na
 * migration de P7 como defesa em profundidade.
 *
 * Nunca confiar em `file.type` do navegador — o MIME informado é apenas uma
 * hint; a decisão final vem dos **magic bytes** do binário armazenado.
 */
import { Errors } from '../errors';

/** MIME → extensões aceitas e tamanho máximo (bytes). */
const RULES = {
  'image/jpeg': { exts: ['jpg', 'jpeg'], maxBytes: 25 * 1024 * 1024 },
  'image/png': { exts: ['png'], maxBytes: 25 * 1024 * 1024 },
  'image/webp': { exts: ['webp'], maxBytes: 25 * 1024 * 1024 },
  'image/avif': { exts: ['avif'], maxBytes: 25 * 1024 * 1024 },
  'image/gif': { exts: ['gif'], maxBytes: 15 * 1024 * 1024 },
  'application/pdf': { exts: ['pdf'], maxBytes: 25 * 1024 * 1024 },
  'video/mp4': { exts: ['mp4', 'm4v'], maxBytes: 200 * 1024 * 1024 },
  'video/webm': { exts: ['webm'], maxBytes: 200 * 1024 * 1024 },
} as const;

export type AllowedMime = keyof typeof RULES;
export const ALLOWED_MIMES = Object.keys(RULES) as AllowedMime[];

/** MIMEs explicitamente bloqueados por serem executáveis no browser. */
const HARD_BLOCK_MIMES = new Set([
  'image/svg+xml',
  'text/html',
  'text/javascript',
  'application/javascript',
  'application/xhtml+xml',
  'application/x-msdownload',
  'application/x-sh',
]);

/** Extensões proibidas mesmo se o MIME parecer inocente. */
const HARD_BLOCK_EXTS = new Set([
  'svg', 'html', 'htm', 'xhtml', 'js', 'mjs', 'exe', 'bat', 'cmd',
  'sh', 'ps1', 'phtml', 'php', 'jsp', 'asp', 'aspx',
]);

function extOf(filename: string): string {
  const parts = (filename || '').toLowerCase().split('.');
  return parts.length > 1 ? parts.pop()! : '';
}

/**
 * Bloqueia extensão dupla suspeita como `foto.php.jpg` ou `logo.svg.png`.
 * Qualquer segmento intermediário perigoso rejeita o arquivo.
 */
function hasDoubleExtensionAttack(filename: string): boolean {
  const segs = (filename || '').toLowerCase().split('.');
  if (segs.length <= 2) return false;
  // Ignora primeiro e último (nome-base e extensão final); qualquer meio
  // que caia na blocklist é dupla-extensão maliciosa.
  return segs.slice(1, -1).some((s) => HARD_BLOCK_EXTS.has(s));
}

/**
 * Validação estática de metadados anunciados (nome de arquivo, mime hint,
 * tamanho reportado). Chamar ANTES de gerar signed URL.
 */
export function assertUploadPolicyByMetadata(input: {
  filename: string;
  mime?: string | null;
  size_bytes?: number | null;
}): AllowedMime {
  const filename = input.filename ?? '';
  const mime = (input.mime ?? '').toLowerCase();
  const ext = extOf(filename);

  if (HARD_BLOCK_EXTS.has(ext)) {
    throw Errors.validation('Extensão de arquivo não permitida', { ext });
  }
  if (hasDoubleExtensionAttack(filename)) {
    throw Errors.validation('Nome de arquivo com dupla extensão suspeita', { filename });
  }
  if (HARD_BLOCK_MIMES.has(mime)) {
    throw Errors.validation('Tipo de arquivo bloqueado por segurança', { mime });
  }
  if (!mime || !(mime in RULES)) {
    throw Errors.validation('Tipo de arquivo não permitido', {
      mime: mime || 'unknown',
      allowed: ALLOWED_MIMES.join(','),
    });
  }
  const rule = RULES[mime as AllowedMime];
  if (!(rule.exts as readonly string[]).includes(ext)) {
    throw Errors.validation('Extensão não confere com o tipo declarado', { ext, mime });
  }
  if (input.size_bytes != null && input.size_bytes > rule.maxBytes) {
    throw Errors.validation('Arquivo acima do limite permitido', {
      size_bytes: input.size_bytes, max_bytes: rule.maxBytes,
    });
  }
  return mime as AllowedMime;
}

/**
 * Inspeciona magic bytes e confirma que o binário realmente corresponde ao
 * MIME anunciado. Retorna o MIME detectado (que precisa bater com o alegado).
 */
export function detectMimeFromMagicBytes(head: Uint8Array): AllowedMime | null {
  const b = head;
  const eq = (offset: number, sig: number[]) =>
    sig.every((v, i) => b[offset + i] === v);

  if (b.length >= 3 && eq(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (b.length >= 8 && eq(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (b.length >= 6 && (eq(0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || eq(0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))) return 'image/gif';
  if (b.length >= 12 && eq(0, [0x52, 0x49, 0x46, 0x46]) && eq(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  // ISO-BMFF (mp4 / avif): "ftyp" em offset 4, marca em offset 8..11
  if (b.length >= 12 && eq(4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif';
    if (['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'm4v ', 'mp4 '].some((x) => brand.startsWith(x.trim()))) return 'video/mp4';
  }
  if (b.length >= 5 && eq(0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (b.length >= 4 && eq(0, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';

  return null;
}

/**
 * Verificação final pós-upload: baixa o head do objeto no bucket, valida
 * magic bytes contra o MIME anunciado e o tamanho contra o limite.
 * Em falha, remove o arquivo e lança.
 */
export async function assertUploadedContentSafe(
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>;
      remove: (paths: string[]) => Promise<{ data: unknown; error: unknown }>;
    };
  },
  bucket: string,
  path: string,
  declaredMime: AllowedMime,
): Promise<{ verified_mime: AllowedMime; size_bytes: number }> {
  const { data: blob, error } = await storage.from(bucket).download(path);
  if (error || !blob) {
    throw Errors.internal('Falha ao verificar upload', { error: error?.message ?? 'no blob' });
  }
  const size = blob.size;
  const rule = RULES[declaredMime];
  if (size > rule.maxBytes) {
    await storage.from(bucket).remove([path]).catch(() => undefined);
    throw Errors.validation('Arquivo acima do limite permitido', { size_bytes: size, max_bytes: rule.maxBytes });
  }
  const headBuf = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const detected = detectMimeFromMagicBytes(headBuf);
  if (!detected) {
    await storage.from(bucket).remove([path]).catch(() => undefined);
    throw Errors.validation('Formato do arquivo não reconhecido ou não permitido');
  }
  if (detected !== declaredMime) {
    // Aceita divergência inócua entre image/jpeg e image/jpg? Não — MIME canônico.
    await storage.from(bucket).remove([path]).catch(() => undefined);
    throw Errors.validation('Conteúdo do arquivo não corresponde ao tipo declarado', {
      declared: declaredMime, detected,
    });
  }
  return { verified_mime: detected, size_bytes: size };
}
