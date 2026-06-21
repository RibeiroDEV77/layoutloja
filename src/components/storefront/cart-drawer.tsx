import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCartUi } from '@/hooks/use-cart-ui';
import { formatBRL } from '@/lib/storefront/format';
import {
  getPublicCart,
  updatePublicCartItemQty,
  removePublicCartItem,
} from '@/lib/business/cart-public.functions';

export function CartDrawer() {
  const isOpen = useCartUi((s) => s.isOpen);
  const close = useCartUi((s) => s.close);
  const qc = useQueryClient();
  const getFn = useServerFn(getPublicCart);
  const updFn = useServerFn(updatePublicCartItemQty);
  const rmFn = useServerFn(removePublicCartItem);

  const { data, isLoading } = useQuery({
    queryKey: ['storefront', 'cart'],
    queryFn: () => getFn(),
    enabled: isOpen,
    staleTime: 5 * 1000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['storefront', 'cart'] });

  const update = useMutation({
    mutationFn: (v: { item_id: string; qty: number }) => updFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || 'Falha ao atualizar item'),
  });
  const remove = useMutation({
    mutationFn: (item_id: string) => rmFn({ data: { item_id } }),
    onSuccess: () => { invalidate(); toast.success('Item removido'); },
    onError: (e: Error) => toast.error(e.message || 'Falha ao remover'),
  });

  const items = data?.items ?? [];
  const cart = data?.cart;

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? null : close())}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-6 py-4">
          <SheetTitle className="text-sm font-medium uppercase tracking-widest-tight">Sacola ({cart?.items_count ?? 0})</SheetTitle>
          <SheetDescription className="sr-only">Itens do carrinho</SheetDescription>
          <button onClick={close} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>}
          {!isLoading && items.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Sua sacola está vazia.</p>
              <Button variant="outline" className="mt-6" onClick={close}>Continuar comprando</Button>
            </div>
          )}
          {items.map((it) => {
            const snap = (it.snapshot ?? {}) as { product_name?: string; sku?: string };
            const lineTotal = Number(it.line_total ?? Number(it.unit_price ?? 0) * Number(it.qty ?? 0));
            return (
              <div key={it.id} className="flex gap-3 border-b border-border py-4 last:border-b-0">
                <div className="flex h-20 w-16 shrink-0 items-center justify-center bg-secondary text-[10px] text-muted-foreground">
                  IMG
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{snap.product_name ?? 'Produto'}</div>
                      <div className="text-xs text-muted-foreground">SKU {snap.sku ?? '—'}</div>
                    </div>
                    <button onClick={() => remove.mutate(it.id)} aria-label="Remover">
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <QtyControl
                      value={Number(it.qty ?? 1)}
                      onChange={(qty) => update.mutate({ item_id: it.id, qty })}
                      disabled={update.isPending}
                    />
                    <div className="text-sm font-medium">{formatBRL(lineTotal)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {items.length > 0 && cart && (
          <div className="border-t border-border px-6 py-5 space-y-3">
            <Row label="Subtotal" value={formatBRL(Number(cart.subtotal))} />
            {Number(cart.discount_total) > 0 && (
              <Row label="Descontos" value={`- ${formatBRL(Number(cart.discount_total))}`} accent />
            )}
            <Row label="Total" value={formatBRL(Number(cart.total))} strong />
            <Button className="w-full" onClick={() => { close(); window.location.href = '/carrinho'; }}>
              Finalizar compra
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">Frete e impostos calculados no checkout.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${strong ? 'text-base font-medium' : 'text-sm'} ${accent ? 'text-accent' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function QtyControl({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex items-center border border-border">
      <button disabled={disabled || value <= 1} onClick={() => onChange(value - 1)} className="p-1.5 disabled:opacity-40" aria-label="Diminuir">
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-8 text-center text-xs">{value}</span>
      <button disabled={disabled} onClick={() => onChange(value + 1)} className="p-1.5 disabled:opacity-40" aria-label="Aumentar">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
