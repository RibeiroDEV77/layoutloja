import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { StorefrontShell } from '@/components/storefront/storefront';
import { useStorefrontCart, formatBRL } from '@/hooks/use-storefront-cart';
import { getStorefrontProduct, type StorefrontProductDetail } from '@/lib/business/storefront-product.functions';
import { ChevronLeft, ChevronRight, Loader2, ShoppingBag, Check } from 'lucide-react';

export const Route = createFileRoute('/produto/$slug')({
  head: () => ({ meta: [{ title: 'Produto — Layout Loja' }] }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const fnGet = useServerFn(getStorefrontProduct);
  const cart = useStorefrontCart();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<StorefrontProductDetail | null>(null);
  const [colorId, setColorId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { product } = await fnGet({ data: { slug } });
        if (cancelled) return;
        setProduct(product);
        if (product) {
          const def = product.colors.find((c) => c.is_default) ?? product.colors[0] ?? null;
          setColorId(def?.id ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, fnGet]);

  const color = useMemo(
    () => product?.colors.find((c) => c.id === colorId) ?? null,
    [product, colorId],
  );

  const variantsForColor = useMemo(
    () => (product?.variants ?? []).filter((v) => !colorId || v.product_color_id === colorId),
    [product, colorId],
  );

  const sizesAvailability = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const v of variantsForColor) {
      if (!v.size_attribute_value_id) continue;
      const prev = map.get(v.size_attribute_value_id) ?? false;
      map.set(v.size_attribute_value_id, prev || v.available);
    }
    return map;
  }, [variantsForColor]);

  const selectedVariant = useMemo(() => {
    if (!product) return null;
    return variantsForColor.find((v) => {
      if (product.sizes.length > 0) return v.size_attribute_value_id === sizeId;
      return true;
    }) ?? null;
  }, [product, variantsForColor, sizeId]);

  const media = color?.media ?? [];
  const currentMedia = media[galleryIdx] ?? media[0] ?? null;

  useEffect(() => { setGalleryIdx(0); }, [colorId]);

  async function handleAdd() {
    if (!product) return;
    setError(null);
    if (product.sizes.length > 0 && !sizeId) { setError('Selecione um tamanho'); return; }
    if (!selectedVariant) { setError('Variante indisponível'); return; }
    if (!selectedVariant.available) { setError('Esta variação está esgotada'); return; }
    setAdding(true);
    try {
      await cart.addVariant(selectedVariant.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar à sacola');
    } finally {
      setAdding(false);
    }
  }

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {loading ? (
          <div className="grid place-items-center py-32"><Loader2 className="h-6 w-6 animate-spin text-[#666]" /></div>
        ) : !product ? (
          <div className="py-24 text-center">
            <p className="text-[#666]">Produto não encontrado.</p>
            <Link to="/" className="mt-4 inline-block underline text-[13px]">Voltar à loja</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* Galeria */}
            <div>
              <div className="relative aspect-[3/4] bg-[#F8F8F8] overflow-hidden">
                {currentMedia ? (
                  <img src={currentMedia.url} alt={currentMedia.alt ?? product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-7xl font-semibold text-[#EFEFEF]">
                    {product.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {media.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Anterior"
                      onClick={() => setGalleryIdx((i) => (i - 1 + media.length) % media.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center bg-white/90 hover:bg-white shadow-sm rounded-full"
                    ><ChevronLeft className="h-4 w-4" /></button>
                    <button
                      type="button"
                      aria-label="Próximo"
                      onClick={() => setGalleryIdx((i) => (i + 1) % media.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center bg-white/90 hover:bg-white shadow-sm rounded-full"
                    ><ChevronRight className="h-4 w-4" /></button>
                  </>
                )}
              </div>
              {media.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {media.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setGalleryIdx(i)}
                      className={`aspect-square bg-[#F8F8F8] overflow-hidden border ${i === galleryIdx ? 'border-[#111]' : 'border-transparent hover:border-[#999]'}`}
                    >
                      <img src={m.url} alt={m.alt ?? ''} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              {product.brand && (
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#666] font-medium">{product.brand.name}</p>
              )}
              <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">{product.name}</h1>

              <div className="mt-4 flex items-baseline gap-3">
                {product.list_price_from && product.price_from && product.list_price_from > product.price_from && (
                  <span className="text-[14px] text-[#999] line-through">{formatBRL(product.list_price_from)}</span>
                )}
                <span className="text-2xl font-semibold">
                  {product.price_from
                    ? (product.price_to && product.price_to !== product.price_from
                        ? `${formatBRL(product.price_from)} – ${formatBRL(product.price_to)}`
                        : formatBRL(product.price_from))
                    : 'Sob consulta'}
                </span>
              </div>

              {product.short_description && (
                <p className="mt-4 text-[14px] text-[#444]">{product.short_description}</p>
              )}

              {/* Cores */}
              {product.colors.length > 0 && (
                <div className="mt-6">
                  <p className="text-[12px] uppercase tracking-[0.18em] font-semibold">
                    Cor: <span className="font-normal normal-case tracking-normal text-[#666]">{color?.name ?? '—'}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.colors.map((c) => {
                      const selected = c.id === colorId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setColorId(c.id)}
                          aria-label={c.name}
                          className={`h-9 w-9 rounded-full border-2 transition-colors ${selected ? 'border-[#111]' : 'border-[#EFEFEF] hover:border-[#999]'}`}
                          style={{ backgroundColor: c.hex ?? '#EFEFEF' }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tamanhos */}
              {product.sizes.length > 0 && (
                <div className="mt-6">
                  <p className="text-[12px] uppercase tracking-[0.18em] font-semibold">Tamanho</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.sizes.map((s) => {
                      const available = sizesAvailability.get(s.attribute_value_id) ?? false;
                      const selected = s.attribute_value_id === sizeId;
                      return (
                        <button
                          key={s.attribute_value_id}
                          type="button"
                          disabled={!available}
                          onClick={() => setSizeId(s.attribute_value_id)}
                          className={`min-w-[3rem] px-3 py-2 text-[13px] border transition-colors ${
                            selected ? 'border-[#111] bg-[#111] text-white'
                            : available ? 'border-[#EFEFEF] hover:border-[#111]'
                            : 'border-[#EFEFEF] text-[#CCC] line-through cursor-not-allowed'
                          }`}
                        >{s.label}</button>
                      );
                    })}
                  </div>
                  {sizeId && selectedVariant && !selectedVariant.available && (
                    <p className="mt-2 text-[12px] text-[var(--brand-red)]">Esgotado nesta variação.</p>
                  )}
                </div>
              )}

              {error && <p className="mt-4 text-[13px] text-[var(--brand-red)]">{error}</p>}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={adding || !cart.ready}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-[#111] text-white px-6 py-3 text-[12px] uppercase tracking-[0.18em] hover:bg-[var(--brand-red)] transition-colors disabled:opacity-50"
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" />
                    : added ? <Check className="h-4 w-4" />
                    : <ShoppingBag className="h-4 w-4" />}
                  {added ? 'Adicionado' : 'Adicionar à sacola'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ to: '/sacola' })}
                  className="px-6 py-3 text-[12px] uppercase tracking-[0.18em] border border-[#111] hover:bg-[#F8F8F8]"
                >Ver sacola</button>
              </div>

              {/* Descrição */}
              {product.description && (
                <div className="mt-8 border-t border-[#EFEFEF] pt-6">
                  <h2 className="text-[12px] uppercase tracking-[0.18em] font-semibold">Descrição</h2>
                  <div className="mt-3 text-[14px] text-[#333] whitespace-pre-line">{product.description}</div>
                </div>
              )}

              {/* Atributos */}
              {product.attributes.length > 0 && (
                <div className="mt-8 border-t border-[#EFEFEF] pt-6">
                  <h2 className="text-[12px] uppercase tracking-[0.18em] font-semibold">Especificações</h2>
                  <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                    {product.attributes.map((a) => (
                      <div key={a.code} className="flex justify-between gap-3 border-b border-[#F4F4F4] py-1.5">
                        <dt className="text-[#666]">{a.label}</dt>
                        <dd className="text-[#111] font-medium text-right">{a.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </StorefrontShell>
  );
}
