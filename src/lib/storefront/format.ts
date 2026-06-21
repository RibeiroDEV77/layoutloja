/**
 * Formatador BRL único — usado em catálogo, PDP e carrinho.
 */
export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}
