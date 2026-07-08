/**
 * Ordenação canônica de tamanhos para exibição.
 * - Tamanhos por letra: PP, P, M, G, GG, XG, XGG, EXG, G1, G2, G3, G4 …
 * - Tamanhos numéricos: crescente.
 * - Ordem mista: letras primeiro, depois numéricos.
 *
 * Não altera dados do banco — usar apenas para ordenar arrays antes da renderização.
 */

const LETTER_ORDER: Record<string, number> = {
  PP: 1, P: 2, M: 3, G: 4, GG: 5, XG: 6, XGG: 7, EXG: 8,
  G1: 9, G2: 10, G3: 11, G4: 12, G5: 13, G6: 14,
};

export function sizeSortRank(label: string): { bucket: number; rank: number; tie: string } {
  const raw = String(label ?? "").trim();
  const upper = raw.toUpperCase();
  // 1) Letra conhecida
  if (upper in LETTER_ORDER) return { bucket: 0, rank: LETTER_ORDER[upper], tie: upper };
  // 2) Número puro (com possível sufixo/decimal simples)
  const num = Number(raw.replace(",", ".").replace(/[^\d.-]/g, ""));
  if (Number.isFinite(num) && /\d/.test(raw)) return { bucket: 1, rank: num, tie: upper };
  // 3) Fallback: mantém letras à frente, alfabético
  return { bucket: 2, rank: 0, tie: upper };
}

export function compareSizes(a: string, b: string): number {
  const ra = sizeSortRank(a);
  const rb = sizeSortRank(b);
  if (ra.bucket !== rb.bucket) return ra.bucket - rb.bucket;
  if (ra.rank !== rb.rank) return ra.rank - rb.rank;
  return ra.tie.localeCompare(rb.tie);
}

export function sortSizes<T>(items: T[], getLabel: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareSizes(getLabel(a), getLabel(b)));
}
