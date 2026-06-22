import { createFileRoute, Link } from '@tanstack/react-router';
import { useStorefrontCart, formatBRL } from '@/hooks/use-storefront-cart';
import { StorefrontShell } from '@/components/storefront/storefront';
import { Minus, Plus, Trash2, ArrowRight } from 'lucide-react';

export const Route = createFileRoute('/sacola')({
  head: () => ({ meta: [{ title: 'Sacola — Layout Loja' }] }),
  component: SacolaPage,
});

function SacolaPage() {
  const cart = useStorefrontCart();

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Sua sacola</h1>
        {!cart.ready ? (
          <p className="mt-8 text-[#666]">Carregando…</p>
        ) : cart.items.length === 0 ? (
          <div className="mt-12 grid place-items-center gap-4 border border-dashed border-[#EFEFEF] py-16">
            <p className="text-[#666]">Sua sacola está vazia.</p>
            <Link to="/" className="bg-[#111] text-white px-6 py-3 text-[12px] uppercase tracking-[0.18em] hover:bg-[var(--brand-red)] transition-colors">Continuar comprando</Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10">
            <ul className="divide-y divide-[#EFEFEF]">
              {cart.items.map((it) => (
                <li key={it.id} className="py-5 flex items-start gap-4">
                  <div className="h-20 w-20 bg-[#F8F8F8] grid place-items-center text-2xl font-semibold text-[#CCC]">
                    {String(it.snapshot?.product_name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-medium">{String(it.snapshot?.product_name ?? 'Item')}</p>
                    {it.snapshot?.sku ? <p className="text-[12px] text-[#666]">SKU {String(it.snapshot.sku)}</p> : null}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center border border-[#EFEFEF]">
                        <button onClick={() => cart.update(it.id, Math.max(1, it.qty - 1))} className="px-2 py-1" aria-label="Diminuir"><Minus className="h-3 w-3" /></button>
                        <span className="px-3 text-[13px]">{it.qty}</span>
                        <button onClick={() => cart.update(it.id, it.qty + 1)} className="px-2 py-1" aria-label="Aumentar"><Plus className="h-3 w-3" /></button>
                      </div>
                      <button onClick={() => cart.remove(it.id)} className="text-[12px] text-[#666] hover:text-[var(--brand-red)] flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />Remover</button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-semibold">{formatBRL(Number(it.line_total), cart.currency)}</p>
                    <p className="text-[12px] text-[#666]">{formatBRL(Number(it.unit_price), cart.currency)} cada</p>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="bg-[#F8F8F8] p-6 self-start">
              <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold">Resumo</h2>
              <dl className="mt-4 space-y-2 text-[14px]">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(cart.subtotal, cart.currency)}</dd></div>
                <div className="flex justify-between"><dt>Frete</dt><dd className="text-[#666]">calculado no checkout</dd></div>
                <div className="flex justify-between text-[16px] font-semibold border-t border-[#EFEFEF] pt-3 mt-3"><dt>Total</dt><dd>{formatBRL(cart.total, cart.currency)}</dd></div>
              </dl>
              <Link to="/checkout" className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-[#111] text-white py-3 text-[12px] uppercase tracking-[0.18em] hover:bg-[var(--brand-red)] transition-colors">
                Finalizar compra <ArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        )}
      </div>
    </StorefrontShell>
  );
}
