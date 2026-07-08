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

/**
 * Remove campos sensíveis de documento e adiciona doc_number_masked.
 * Mantém demais campos do row.
 */
export function stripCustomerDoc<T extends Record<string, unknown>>(
  row: T | null | undefined,
): (Omit<T, 'doc_number' | 'doc_number_hash' | 'doc_number_encrypted'> & { doc_number_masked: string | null }) | null {
  if (!row) return null;
  // Destructure defensively — properties may not exist depending on select().
  const {
    doc_number, doc_number_hash, doc_number_encrypted, ...rest
  } = row as T & { doc_number?: string | null; doc_number_hash?: string | null; doc_number_encrypted?: unknown };
  void doc_number_hash; void doc_number_encrypted;
  const type = (rest as { type?: string | null }).type ?? null;
  return {
    ...(rest as Omit<T, 'doc_number' | 'doc_number_hash' | 'doc_number_encrypted'>),
    doc_number_masked: maskDoc(doc_number ?? null, type),
  };
}

export function stripCustomerDocList<T extends Record<string, unknown>>(rows: T[] | null | undefined) {
  return (rows ?? []).map((r) => stripCustomerDoc(r)!);
}
