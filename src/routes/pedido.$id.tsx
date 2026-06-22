import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { StorefrontShell } from '@/components/storefront/storefront';
import { getPublicOrder } from '@/lib/business/checkout.functions';
import { formatBRL } from '@/hooks/use-storefront-cart';
import { CheckCircle2 } from 'lucide-react';

export const Route = createFileRoute('/pedido/$id')({
  head: () => ({ meta: [{ title: 'Pedido confirmado — Layout Loja' }] }),
  component: PedidoPage,
});

function PedidoPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getPublicOrder);
  const [state, setState] = useState<{ loading: boolean; data: Awaited<ReturnType<typeof fn>> | null; error: string | null }>(
    { loading: true, data: null, error: null },
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fn({ data: { order_id: id } });
        if (!cancelled) setState({ loading: false, data: res, error: null });
      } catch (err) {
        if (!cancelled) setState({ loading: false, data: null, error: err instanceof Error ? err.message : 'Erro' });
      }
    })();
    return () => { cancelled = true; };
  }, [id, fn]);

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        {state.loading ? (
          <p className="text-[#666]">Carregando…</p>
        ) : state.error || !state.data ? (
          <p className="text-[var(--brand-red)]">{state.error ?? 'Pedido não encontrado'}</p>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mt-1" />
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Pedido recebido!</h1>
                <p className="text-[#666] mt-1">Número: <span className="font-mono">{state.data.order?.order_number}</span></p>
                <p className="text-[#666]">Status: Aguardando pagamento — entraremos em contato em breve.</p>
              </div>
            </div>

            <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold">Itens</h2>
                <ul className="mt-3 divide-y divide-[#EFEFEF]">
                  {state.data.items.map((it, i) => (
                    <li key={i} className="py-3 flex justify-between text-[14px]">
                      <span>{it.name} × {it.qty}</span>
                      <span>{formatBRL(Number(it.line_total), state.data!.order?.currency ?? 'BRL')}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-4 space-y-1 text-[14px] border-t border-[#EFEFEF] pt-3">
                  <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(Number(state.data.order?.subtotal ?? 0), state.data.order?.currency ?? 'BRL')}</dd></div>
                  <div className="flex justify-between"><dt>Frete</dt><dd>{formatBRL(Number(state.data.order?.shipping_total ?? 0), state.data.order?.currency ?? 'BRL')}</dd></div>
                  <div className="flex justify-between font-semibold text-[15px]"><dt>Total</dt><dd>{formatBRL(Number(state.data.order?.total ?? 0), state.data.order?.currency ?? 'BRL')}</dd></div>
                </dl>
              </div>

              <div>
                <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold">Envio</h2>
                {state.data.shipping ? (
                  <div className="mt-3 text-[14px] text-[#333] space-y-1">
                    <p><strong>{state.data.shipping.carrier ?? '—'}</strong> · {state.data.shipping.service ?? '—'}</p>
                    <p>Valor: {formatBRL(Number(state.data.shipping.price ?? 0), state.data.order?.currency ?? 'BRL')}</p>
                    {state.data.shipping.eta_days != null && <p>Prazo: até {state.data.shipping.eta_days} dias úteis</p>}
                  </div>
                ) : <p className="mt-3 text-[#666] text-[14px]">—</p>}

                {state.data.address && (
                  <>
                    <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold mt-6">Endereço</h2>
                    <p className="mt-2 text-[14px] text-[#333] leading-relaxed">
                      {state.data.address.recipient}<br />
                      {state.data.address.street}, {state.data.address.number}{state.data.address.complement ? ` — ${state.data.address.complement}` : ''}<br />
                      {state.data.address.district} · {state.data.address.city}/{state.data.address.state}<br />
                      CEP {state.data.address.postal_code}
                    </p>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </StorefrontShell>
  );
}
