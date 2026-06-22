import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { StorefrontShell } from '@/components/storefront/storefront';
import { useStorefrontCart, formatBRL, clearStoredCart } from '@/hooks/use-storefront-cart';
import {
  anonQuoteShipping,
  anonSelectShipping,
  placeOrder,
} from '@/lib/business/checkout.functions';
import { lookupPostalCode } from '@/lib/business/shipping.functions';
import { Loader2, Truck, Check } from 'lucide-react';

export const Route = createFileRoute('/checkout')({
  head: () => ({ meta: [{ title: 'Checkout — Layout Loja' }] }),
  component: CheckoutPage,
});

type AddressForm = {
  postal_code: string; street: string; number: string; complement: string;
  district: string; city: string; state: string;
};

const EMPTY_ADDRESS: AddressForm = {
  postal_code: '', street: '', number: '', complement: '',
  district: '', city: '', state: '',
};

function digits(s: string) { return s.replace(/\D/g, ''); }

function CheckoutPage() {
  const cart = useStorefrontCart();
  const navigate = useNavigate();
  const fnQuote = useServerFn(anonQuoteShipping);
  const fnSelect = useServerFn(anonSelectShipping);
  const fnPlace = useServerFn(placeOrder);
  const fnLookup = useServerFn(lookupPostalCode);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchedCep = useRef<string>('');

  // CEP autocomplete + auto-cotação
  useEffect(() => {
    const cep = digits(address.postal_code);
    if (cep.length !== 8) return;
    if (cep === lastFetchedCep.current) return;
    if (!cart.cartId) return;
    lastFetchedCep.current = cep;

    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);
    (async () => {
      try {
        const lookup = await fnLookup({ data: { postal_code: cep } });
        if (!cancelled && lookup.ok) {
          const d = lookup.data;
          setAddress((a) => ({
            ...a,
            street: a.street || (d.street ?? ''),
            district: a.district || (d.district ?? ''),
            city: a.city || (d.city ?? ''),
            state: a.state || (d.state ?? ''),
          }));
        }
      } catch { /* ignore lookup errors */ }
      try {
        const res = (await fnQuote({ data: { cart_id: cart.cartId!, postal_code: cep } })) as { quotes: unknown[] };
        if (cancelled) return;
        await cart.refresh();
        if (!res.quotes || res.quotes.length === 0) {
          setQuoteError('Nenhuma modalidade disponível para este CEP.');
        }
      } catch (err) {
        if (!cancelled) setQuoteError(err instanceof Error ? err.message : 'Erro ao consultar frete');
      } finally {
        if (!cancelled) setQuoting(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address.postal_code, cart.cartId]);

  const selectedQuoteId = cart.selectedShippingQuoteId;
  const selectedQuote = useMemo(
    () => cart.shippingQuotes.find((q) => q.id === selectedQuoteId) ?? null,
    [cart.shippingQuotes, selectedQuoteId],
  );

  async function handleSelectQuote(quoteId: string) {
    if (!cart.cartId) return;
    await fnSelect({ data: { cart_id: cart.cartId, quote_id: quoteId } });
    await cart.refresh();
  }

  async function handlePlaceOrder() {
    if (!cart.cartId) return;
    setError(null);
    if (!name || !email || !phone) { setError('Preencha nome, e-mail e telefone'); return; }
    if (!address.postal_code || !address.street || !address.number || !address.city || !address.state) {
      setError('Preencha o endereço completo'); return;
    }
    if (!selectedQuoteId) { setError('Selecione uma modalidade de frete'); return; }

    setPlacing(true);
    try {
      const res = await fnPlace({
        data: {
          cart_id: cart.cartId,
          session_token: cart.sessionToken,
          email, name, phone,
          address: { ...address, country: 'BR', postal_code: digits(address.postal_code) },
        },
      });
      clearStoredCart();
      navigate({ to: '/pedido/$id', params: { id: res.order_id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao finalizar pedido');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Checkout</h1>
        {!cart.ready ? (
          <p className="mt-8 text-[#666]">Carregando…</p>
        ) : cart.items.length === 0 ? (
          <p className="mt-8 text-[#666]">Sua sacola está vazia.</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
            <div className="space-y-8">
              <section>
                <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold">Identificação</h2>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Nome completo" value={name} onChange={setName} />
                  <Field label="E-mail" type="email" value={email} onChange={setEmail} />
                  <Field label="Telefone" value={phone} onChange={setPhone} />
                </div>
              </section>

              <section>
                <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold">Endereço de entrega</h2>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-3">
                  <Field className="col-span-2 md:col-span-2" label="CEP" value={address.postal_code} onChange={(v) => setAddress((a) => ({ ...a, postal_code: v }))} />
                  <Field className="col-span-2 md:col-span-4" label="Rua" value={address.street} onChange={(v) => setAddress((a) => ({ ...a, street: v }))} />
                  <Field className="col-span-1 md:col-span-1" label="Número" value={address.number} onChange={(v) => setAddress((a) => ({ ...a, number: v }))} />
                  <Field className="col-span-1 md:col-span-2" label="Complemento" value={address.complement} onChange={(v) => setAddress((a) => ({ ...a, complement: v }))} />
                  <Field className="col-span-2 md:col-span-3" label="Bairro" value={address.district} onChange={(v) => setAddress((a) => ({ ...a, district: v }))} />
                  <Field className="col-span-2 md:col-span-4" label="Cidade" value={address.city} onChange={(v) => setAddress((a) => ({ ...a, city: v }))} />
                  <Field className="col-span-2 md:col-span-2" label="UF" value={address.state} onChange={(v) => setAddress((a) => ({ ...a, state: v.toUpperCase().slice(0, 2) }))} />
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Modalidade de envio</h2>
                  {quoting && <span className="flex items-center gap-1 text-[12px] text-[#666]"><Loader2 className="h-3 w-3 animate-spin" /> Consultando…</span>}
                </div>
                {!digits(address.postal_code) || digits(address.postal_code).length !== 8 ? (
                  <p className="mt-3 text-[13px] text-[#666]">Informe o CEP para calcular o frete automaticamente.</p>
                ) : quoteError ? (
                  <p className="mt-3 text-[13px] text-[var(--brand-red)]">{quoteError}</p>
                ) : cart.shippingQuotes.length === 0 && !quoting ? (
                  <p className="mt-3 text-[13px] text-[#666]">Sem cotações disponíveis.</p>
                ) : (
                  <ul className="mt-3 grid gap-2">
                    {cart.shippingQuotes.map((q) => {
                      const selected = q.id === selectedQuoteId;
                      const days = q.estimated_days_max ?? q.estimated_days_min;
                      return (
                        <li key={q.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectQuote(q.id)}
                            className={`w-full text-left border px-4 py-3 flex items-center justify-between transition-colors ${selected ? 'border-[#111] bg-[#F8F8F8]' : 'border-[#EFEFEF] hover:border-[#999]'}`}
                          >
                            <div>
                              <p className="text-[14px] font-medium flex items-center gap-2">
                                {selected && <Check className="h-4 w-4 text-[var(--brand-red)]" />}
                                {q.method_name ?? q.method_code ?? 'Frete'}
                              </p>
                              <p className="text-[12px] text-[#666]">
                                {(q.carrier || q.provider_code) ?? '—'}{days ? ` · ${days} dias úteis` : ''}
                              </p>
                            </div>
                            <span className="text-[15px] font-semibold">{formatBRL(Number(q.price), cart.currency)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {error && <p className="text-[13px] text-[var(--brand-red)]">{error}</p>}
            </div>

            <aside className="bg-[#F8F8F8] p-6 self-start space-y-4">
              <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold">Resumo</h2>
              <ul className="space-y-2 text-[13px]">
                {cart.items.map((it) => (
                  <li key={it.id} className="flex justify-between">
                    <span>{String(it.snapshot?.product_name ?? 'Item')} × {it.qty}</span>
                    <span>{formatBRL(Number(it.line_total), cart.currency)}</span>
                  </li>
                ))}
              </ul>
              <dl className="space-y-1 text-[14px] border-t border-[#EFEFEF] pt-3">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(cart.subtotal, cart.currency)}</dd></div>
                <div className="flex justify-between">
                  <dt>Frete</dt>
                  <dd>{selectedQuote ? formatBRL(Number(selectedQuote.price), cart.currency) : '—'}</dd>
                </div>
                <div className="flex justify-between text-[16px] font-semibold border-t border-[#EFEFEF] pt-2 mt-2">
                  <dt>Total</dt>
                  <dd>{formatBRL(cart.subtotal + (selectedQuote ? Number(selectedQuote.price) : 0), cart.currency)}</dd>
                </div>
              </dl>
              <button
                disabled={placing || !selectedQuoteId}
                onClick={handlePlaceOrder}
                className="w-full bg-[#111] text-white py-3 text-[12px] uppercase tracking-[0.18em] hover:bg-[var(--brand-red)] transition-colors disabled:opacity-50"
              >
                {placing ? 'Finalizando…' : 'Finalizar pedido'}
              </button>
              <p className="text-[11px] text-[#666] leading-relaxed">
                O pagamento será combinado por contato após a finalização.
              </p>
            </aside>
          </div>
        )}
      </div>
    </StorefrontShell>
  );
}

function Field({ label, value, onChange, type = 'text', className = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] uppercase tracking-[0.18em] text-[#666] mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#EFEFEF] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#111] transition-colors"
      />
    </label>
  );
}
