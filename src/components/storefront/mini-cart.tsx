/**
 * MiniCart — drawer lateral global. Consome `useCart()` (mesma instância).
 */
import { Link } from '@tanstack/react-router';
import { Minus, Plus, Trash2, ShoppingBag, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCart } from './cart-provider';
import { formatBRL } from '@/hooks/use-storefront-cart';

export function MiniCart() {
  const cart = useCart();

  return (
    <Sheet open={cart.isOpen} onOpenChange={(v) => (v ? cart.openCart() : cart.closeCart())}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0 bg-white">
        <SheetHeader className="px-5 py-4 border-b border-[#EFEFEF] flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-[13px] uppercase tracking-[0.18em] font-semibold text-[#111]">
            Sacola ({cart.itemsCount})
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {!cart.ready ? (
            <p className="p-8 text-center text-[14px] text-[#666]">Carregando…</p>
          ) : cart.items.length === 0 ? (
            <div className="p-8 text-center grid gap-3">
              <ShoppingBag className="h-10 w-10 text-[#CCC] mx-auto" strokeWidth={1.2} />
              <p className="text-[14px] text-[#666]">Sua sacola está vazia</p>
              <button
                type="button"
                onClick={cart.closeCart}
                className="mt-2 text-[12px] uppercase tracking-[0.18em] underline text-[#111]"
              >
                Continuar comprando
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#F1F1F1]">
              {cart.items.map((it) => {
                const snap = it.snapshot ?? {};
                const img = (snap as Record<string, unknown>).image_url as string | undefined;
                const color = (snap as Record<string, unknown>).color_name as string | undefined;
                const size = (snap as Record<string, unknown>).size_label as string | undefined;
                return (
                  <li key={it.id} className="p-4 flex gap-3">
                    <div className="h-20 w-16 bg-[#F8F8F8] overflow-hidden shrink-0">
                      {img ? (
                        <img src={img} alt={String(snap.product_name ?? '')} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-xl text-[#CCC]">
                          {String(snap.product_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium text-[#111] truncate">{String(snap.product_name ?? 'Item')}</p>
                        <button
                          type="button"
                          onClick={() => cart.remove(it.id)}
                          aria-label="Remover"
                          className="text-[#999] hover:text-[var(--brand-red)] shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {(color || size) && (
                        <p className="text-[11px] text-[#666] mt-0.5">
                          {[color, size].filter(Boolean).join(' • ')}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center border border-[#EFEFEF]">
                          <button
                            type="button"
                            onClick={() => cart.update(it.id, Math.max(1, it.qty - 1))}
                            disabled={cart.loading}
                            className="px-2 py-1 hover:bg-[#F8F8F8] disabled:opacity-50"
                            aria-label="Diminuir"
                          ><Minus className="h-3 w-3" /></button>
                          <span className="px-3 text-[12px] tabular-nums">{it.qty}</span>
                          <button
                            type="button"
                            onClick={() => cart.update(it.id, it.qty + 1)}
                            disabled={cart.loading}
                            className="px-2 py-1 hover:bg-[#F8F8F8] disabled:opacity-50"
                            aria-label="Aumentar"
                          ><Plus className="h-3 w-3" /></button>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-semibold text-[#111]">{formatBRL(Number(it.line_total), cart.currency)}</p>
                          <p className="text-[10px] text-[#999]">{formatBRL(Number(it.unit_price), cart.currency)} un</p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="border-t border-[#EFEFEF] p-5 space-y-3 bg-white">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#666]">Subtotal</span>
              <span className="font-semibold text-[#111]">{formatBRL(cart.subtotal, cart.currency)}</span>
            </div>
            <p className="text-[11px] text-[#999]">Frete e cupom calculados no checkout.</p>
            <Link
              to="/checkout"
              onClick={cart.closeCart}
              className="block w-full text-center bg-[#111] text-white py-3 text-[12px] uppercase tracking-[0.18em] font-semibold hover:bg-[var(--brand-red)] transition-colors"
            >
              Finalizar compra
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={cart.closeCart}
                className="py-2.5 text-[11px] uppercase tracking-[0.18em] border border-[#EFEFEF] hover:border-[#111] transition-colors"
              >
                Continuar
              </button>
              <Link
                to="/sacola"
                onClick={cart.closeCart}
                className="py-2.5 text-[11px] uppercase tracking-[0.18em] text-center border border-[#EFEFEF] hover:border-[#111] transition-colors"
              >
                Ver sacola
              </Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
