import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useCart } from '@/components/storefront/cart-provider';
import { formatBRL } from '@/hooks/use-storefront-cart';
import { StorefrontShell, StorefrontNavbar } from '@/components/storefront/storefront';
import { Minus, Plus, Trash2, ArrowRight, ChevronRight, ShoppingBag, Tag, Truck } from 'lucide-react';
import { listStorefrontProducts, type StorefrontProduct } from '@/lib/business/storefront.functions';

export const Route = createFileRoute('/sacola')({
  head: () => ({ meta: [{ title: 'Sacola — Layout Loja' }] }),
  component: SacolaPage,
});

function SacolaPage() {
  const cart = useCart();
  const fnProducts = useServerFn(listStorefrontProducts);
  const [related, setRelated] = useState<StorefrontProduct[]>([]);
  const [recent, setRecent] = useState<StorefrontProduct[]>([]);

  useEffect(() => {
    fnProducts({ data: { flag: 'featured', limit: 8 } }).then((r) => setRelated(r.rows ?? [])).catch(() => {});
    try {
      const raw = window.localStorage.getItem('storefront.recent');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (ids.length) {
        fnProducts({ data: { limit: 12 } }).then((r) => {
          const map = new Map((r.rows ?? []).map((p) => [p.id, p]));
          setRecent(ids.map((id) => map.get(id)).filter(Boolean) as StorefrontProduct[]);
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  }, [fnProducts]);

  return (
    <StorefrontShell>
      <StorefrontNavbar />
      <main className="mx-auto max-w-[1280px] px-4 lg:px-8 py-8 lg:py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[12px] text-[#666] mb-6" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-[var(--brand-red)]">Início</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#111]">Sacola</span>
        </nav>

        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">Sua sacola</h1>

        {!cart.ready ? (
          <p className="text-[#666]">Carregando…</p>
        ) : cart.items.length === 0 ? (
          <div className="grid place-items-center gap-4 border border-dashed border-[#EFEFEF] py-20 text-center">
            <ShoppingBag className="h-10 w-10 text-[#CCC]" strokeWidth={1.2} />
            <p className="text-[#666]">Sua sacola está vazia.</p>
            <Link to="/" className="bg-[#111] text-white px-6 py-3 text-[12px] uppercase tracking-[0.18em] hover:bg-[var(--brand-red)] transition-colors">
              Continuar comprando
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
            {/* Itens */}
            <ul className="divide-y divide-[#EFEFEF] border-y border-[#EFEFEF]">
              {cart.items.map((it) => {
                const snap = it.snapshot as Record<string, unknown>;
                const img = snap.image_url as string | undefined;
                const color = snap.color_name as string | undefined;
                const size = snap.size_label as string | undefined;
                return (
                  <li key={it.id} className="py-5 flex items-start gap-4">
                    <div className="h-28 w-24 bg-[#F8F8F8] overflow-hidden shrink-0">
                      {img ? (
                        <img src={img} alt={String(snap.product_name ?? '')} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-2xl font-semibold text-[#CCC]">
                          {String(snap.product_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-[#111]">{String(snap.product_name ?? 'Item')}</p>
                      <div className="mt-1 text-[12px] text-[#666] space-y-0.5">
                        {color && <p>Cor: <span className="text-[#111]">{color}</span></p>}
                        {size && <p>Tamanho: <span className="text-[#111]">{size}</span></p>}
                        {snap.sku ? <p>SKU: {String(snap.sku)}</p> : null}
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center border border-[#EFEFEF]">
                          <button onClick={() => cart.update(it.id, Math.max(1, it.qty - 1))} className="px-2 py-1" aria-label="Diminuir"><Minus className="h-3 w-3" /></button>
                          <span className="px-3 text-[13px] tabular-nums">{it.qty}</span>
                          <button onClick={() => cart.update(it.id, it.qty + 1)} className="px-2 py-1" aria-label="Aumentar"><Plus className="h-3 w-3" /></button>
                        </div>
                        <button onClick={() => cart.remove(it.id)} className="text-[12px] text-[#666] hover:text-[var(--brand-red)] flex items-center gap-1">
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-semibold">{formatBRL(Number(it.line_total), cart.currency)}</p>
                      <p className="text-[12px] text-[#666]">{formatBRL(Number(it.unit_price), cart.currency)} cada</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Resumo */}
            <aside className="lg:sticky lg:top-24 self-start space-y-4">
              <div className="bg-[#F8F8F8] p-6">
                <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold">Resumo</h2>
                <dl className="mt-4 space-y-2 text-[14px]">
                  <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(cart.subtotal, cart.currency)}</dd></div>
                  <div className="flex justify-between"><dt>Frete</dt><dd className="text-[#666]">no checkout</dd></div>
                  <div className="flex justify-between text-[16px] font-semibold border-t border-[#EFEFEF] pt-3 mt-3">
                    <dt>Total</dt><dd>{formatBRL(cart.total, cart.currency)}</dd>
                  </div>
                </dl>
                <Link to="/checkout" className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-[#111] text-white py-3 text-[12px] uppercase tracking-[0.18em] hover:bg-[var(--brand-red)] transition-colors">
                  Finalizar compra <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/" className="mt-2 inline-block w-full text-center py-2.5 text-[11px] uppercase tracking-[0.18em] text-[#666] hover:text-[#111]">
                  Continuar comprando
                </Link>
              </div>

              {/* Cupom (preparado) */}
              <div className="border border-[#EFEFEF] p-5">
                <p className="text-[12px] uppercase tracking-[0.18em] font-semibold flex items-center gap-2"><Tag className="h-3.5 w-3.5" /> Cupom de desconto</p>
                <div className="mt-3 flex gap-2">
                  <input disabled placeholder="Em breve" className="flex-1 border border-[#EFEFEF] px-3 py-2 text-[13px] bg-white disabled:opacity-60" />
                  <button disabled className="px-4 py-2 text-[12px] uppercase tracking-[0.18em] border border-[#EFEFEF] text-[#999] cursor-not-allowed">Aplicar</button>
                </div>
              </div>

              {/* CEP */}
              <div className="border border-[#EFEFEF] p-5">
                <p className="text-[12px] uppercase tracking-[0.18em] font-semibold flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Calcular frete</p>
                <div className="mt-3 flex gap-2">
                  <input disabled placeholder="00000-000" className="flex-1 border border-[#EFEFEF] px-3 py-2 text-[13px] bg-white disabled:opacity-60" />
                  <button disabled className="px-4 py-2 text-[12px] uppercase tracking-[0.18em] border border-[#EFEFEF] text-[#999] cursor-not-allowed">Calcular</button>
                </div>
                <p className="mt-2 text-[11px] text-[#666]">O frete será calculado no checkout.</p>
              </div>
            </aside>
          </div>
        )}

        {/* Produtos relacionados / recentes */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold mb-4">Você também pode gostar</h2>
            <ProductCarousel products={related} />
          </section>
        )}
        {recent.length > 0 && (
          <section className="mt-12">
            <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold mb-4">Vistos recentemente</h2>
            <ProductCarousel products={recent} />
          </section>
        )}
      </main>
    </StorefrontShell>
  );
}

function ProductCarousel({ products }: { products: StorefrontProduct[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
      {products.map((p) => (
        <Link
          key={p.id}
          to="/produto/$slug"
          params={{ slug: p.slug }}
          className="snap-start shrink-0 w-[180px] sm:w-[220px] group"
        >
          <div className="aspect-[3/4] bg-[#F8F8F8] overflow-hidden">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="grid h-full w-full place-items-center text-3xl text-[#EFEFEF]">{p.name.charAt(0).toUpperCase()}</div>
            )}
          </div>
          <p className="mt-2 text-[13px] text-[#111] line-clamp-2">{p.name}</p>
        </Link>
      ))}
    </div>
  );
}
