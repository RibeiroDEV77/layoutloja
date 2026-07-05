/**
 * WholesaleMeta — bloco de informações exclusivo do Canal Atacado
 * (Sprint 10.9 — apenas UX, sem regra de negócio).
 *
 * Renderiza:
 *  - Badge "ATACADO"
 *  - Rótulo "Preço para Revenda"
 *  - Pedido mínimo (configurável / simulado)
 *  - Grade disponível (configurável / simulada)
 *
 * Não afeta o varejo — só é renderizado em rotas do canal atacado
 * (ex.: /atacado/home) ou quando `channel === 'wholesale'` na PDP.
 */

const DEFAULT_MIN_ORDER = 6;
const DEFAULT_GRID = ['38', '40', '42', '44', '46'];

export function WholesaleBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white ${className}`}
    >
      Atacado
    </span>
  );
}

export function WholesaleMeta({
  minOrder = DEFAULT_MIN_ORDER,
  grid = DEFAULT_GRID,
  variant = 'card',
}: {
  minOrder?: number;
  grid?: string[];
  variant?: 'card' | 'pdp';
}) {
  if (variant === 'pdp') {
    return (
      <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center gap-2">
          <WholesaleBadge />
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
            Preço para Revenda
          </span>
        </div>
        <dl className="mt-3 space-y-2 text-[13px] text-zinc-700">
          <div className="flex items-baseline gap-2">
            <dt className="min-w-[110px] font-medium text-zinc-500">Pedido mínimo:</dt>
            <dd className="font-semibold text-zinc-900">{minOrder} peças</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="min-w-[110px] font-medium text-zinc-500">Grade disponível:</dt>
            <dd className="font-semibold text-zinc-900">{grid.join(' • ')}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1 text-[12px] text-zinc-600">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
        Preço para Revenda
      </div>
      <div>
        <span className="text-zinc-500">Mín.:</span>{' '}
        <span className="font-medium text-zinc-800">{minOrder} pçs</span>
      </div>
      <div className="truncate">
        <span className="text-zinc-500">Grade:</span>{' '}
        <span className="font-medium text-zinc-800">{grid.join(' • ')}</span>
      </div>
    </div>
  );
}
