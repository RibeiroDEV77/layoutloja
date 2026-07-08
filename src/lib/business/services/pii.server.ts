/**
 * PII helpers — server-only. Máscara e sanitização de documentos.
 *
 * Regra: nenhum payload de listagem/detalhe padrão pode conter
 *   - customers.doc_number       (plaintext)
 *   - customers.doc_number_hash  (interno)
 *   - customers.doc_number_encrypted (interno)
 *
 * Em vez disso, retornar `doc_number_masked`.
 */

export function maskDoc(doc: string | null | undefined, type?: string | null): string | null {
  if (!doc) return null;
  const digits = String(doc).replace(/\D/g, '');
  if (digits.length === 11 || type === 'pf') {
    // CPF: ***.***.***-XX (revela apenas os 2 últimos dígitos)
    if (digits.length !== 11) return '***.***.***-**';
    return `***.***.***-${digits.slice(-2)}`;
  }
  if (digits.length === 14 || type === 'pj') {
    // CNPJ: **.***.***/****-XX
    if (digits.length !== 14) return '**.***.***/****-**';
    return `**.***.***/****-${digits.slice(-2)}`;
  }
  return '***';
}

// Uses `any` in the index signature so TanStack's serializable-return check
// allows the sanitized row through (unknown is rejected as non-serializable).
type SanitizedCustomer = { doc_number_masked: string | null } & { [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export function stripCustomerDoc(row: Record<string, unknown> | null | undefined): SanitizedCustomer | null {
  if (!row) return null;
  const { doc_number, doc_number_hash, doc_number_encrypted, ...rest } = row as {
    doc_number?: string | null;
    doc_number_hash?: unknown;
    doc_number_encrypted?: unknown;
  } & Record<string, unknown>;
  void doc_number_hash; void doc_number_encrypted;
  const type = (rest.type as string | null | undefined) ?? null;
  return {
    ...(rest as Record<string, unknown>),
    doc_number_masked: maskDoc(doc_number ?? null, type),
  } as SanitizedCustomer;
}

export function stripCustomerDocList(rows: Record<string, unknown>[] | null | undefined): SanitizedCustomer[] {
  return (rows ?? []).map((r) => stripCustomerDoc(r) as SanitizedCustomer);
}

/**
 * Remove chaves sensíveis (documento, cpf, cnpj, rg) de um objeto metadata
 * antes de enviar ao cliente. Preserva nome/razão/telefone/etc.
 */
const SENSITIVE_META_KEYS = new Set([
  'cpf', 'cnpj', 'doc', 'doc_number', 'documento', 'document', 'rg',
  'cpf_cnpj', 'cpfcnpj', 'docnumber', 'tax_id', 'taxid',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeMetadata<T extends Record<string, any> | null | undefined>(meta: T): T {
  if (!meta || typeof meta !== 'object') return meta;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (SENSITIVE_META_KEYS.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out as T;
}



