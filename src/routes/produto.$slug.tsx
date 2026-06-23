import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StorefrontShell, StorefrontNavbar } from '@/components/storefront/storefront';
import { useCart } from '@/components/storefront/cart-provider';
import { formatBRL } from '@/hooks/use-storefront-cart';
import { getStorefrontProduct, type StorefrontProductDetail } from '@/lib/business/storefront-product.functions';
import { listStorefrontProducts, type StorefrontProduct } from '@/lib/business/storefront.functions';
import {
  ChevronLeft, ChevronRight, Loader2, ShoppingBag, Check,
  Star, Heart, Share2, Ruler, Truck,
} from 'lucide-react';

export const Route = createFileRoute('/produto/$slug')({
  head: () => ({ meta: [{ title: 'Produto — Layout Loja' }] }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const fnGet = useServerFn(getStorefrontProduct);
  const fnList = useServerFn(listStorefrontProducts);
  const cart = useCart();
  const navigate = useNavigate();

  const [colorId, setColorId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [related, setRelated] = useState<StorefrontProduct[]>([]);

  const productQ = useQuery({
    queryKey: ['storefront', 'product', slug],
    queryFn: async () => {
      const { product } = await fnGet({ data: { slug } });
      return product as StorefrontProductDetail | null;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
  const product = productQ.data ?? null;

  useEffect(() => {
    if (!product) { setColorId(null); setSizeId(null); return; }
    const currentColorStillExists = product.colors.some((c) => c.id === colorId);
    if (!currentColorStillExists) {
      const hasAvailableVariant = (productColorId: string) =>
        product.variants.some((v) => v.product_color_id === productColorId && v.available);
      const def = product.colors.find((c) => c.is_default && c.media.length > 0 && hasAvailableVariant(c.id))
        ?? product.colors.find((c) => c.media.length > 0 && hasAvailableVariant(c.id))
        ?? product.colors.find((c) => c.is_default && hasAvailableVariant(c.id))
        ?? product.colors.find((c) => hasAvailableVariant(c.id))
        ?? product.colors.find((c) => c.is_default && c.media.length > 0)
        ?? product.colors.find((c) => c.media.length > 0)
        ?? product.colors.find((c) => c.is_default)
        ?? product.colors[0]
        ?? null;
      setColorId(def?.id ?? null);
    }
    const currentSizeStillExists = product.sizes.some((s) => s.attribute_value_id === sizeId);
    if (sizeId && !currentSizeStillExists) setSizeId(null);
  }, [product, colorId, sizeId]);

  // registrar em "vistos recentemente" + favorito
  useEffect(() => {
    if (!product) return;
    try {
      const raw = window.localStorage.getItem('storefront.recent');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const next = [product.id, ...ids.filter((i) => i !== product.id)].slice(0, 12);
      window.localStorage.setItem('storefront.recent', JSON.stringify(next));
    } catch { /* ignore */ }
    try {
      const raw = window.localStorage.getItem('storefront.wishlist');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setFavorited(ids.includes(product.id));
    } catch { /* ignore */ }
  }, [product]);

  // produtos relacionados (featured fallback)
  useEffect(() => {
    fnList({ data: { flag: 'featured', limit: 8 } })
      .then((r) => setRelated((r.rows ?? []).filter((p) => p.id !== product?.id)))
      .catch(() => {});
  }, [fnList, product?.id]);

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
    for (const v of product?.variants ?? []) {
      if (!v.size_attribute_value_id) continue;
      const prev = map.get(v.size_attribute_value_id) ?? false;
      map.set(v.size_attribute_value_id, prev || v.available);
    }
    return map;
  }, [product?.variants]);

  const selectedVariant = useMemo(() => {
    if (!product) return null;
    const exactAvailable = variantsForColor.find((v) => {
      if (product.sizes.length > 0) return v.size_attribute_value_id === sizeId && v.available;
      return v.available;
    });
    if (exactAvailable) return exactAvailable;
    return variantsForColor.find((v) => {
      if (product.sizes.length > 0) return v.size_attribute_value_id === sizeId;
      return true;
    }) ?? null;
  }, [product, variantsForColor, sizeId]);

  const media = color?.media ?? [];
  const currentMedia = media[galleryIdx] ?? media[0] ?? null;

  useEffect(() => { setGalleryIdx(0); }, [colorId]);

  function handleSizeSelect(nextSizeId: string) {
    setError(null);
    const sameColorVariant = product?.variants.find((v) =>
      v.size_attribute_value_id === nextSizeId
      && (!colorId || v.product_color_id === colorId)
      && v.available,
    );
    const availableVariant = sameColorVariant ?? product?.variants.find((v) =>
      v.size_attribute_value_id === nextSizeId && v.available,
    );
    if (availableVariant?.product_color_id && availableVariant.product_color_id !== colorId) {
      setColorId(availableVariant.product_color_id);
    }
    setSizeId(nextSizeId);
  }

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
      cart.openCart();
      toast.success('Adicionado à sacola');
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar à sacola');
    } finally {
      setAdding(false);
    }
  }

  function handleFavorite() {
    if (!product) return;
    try {
      const raw = window.localStorage.getItem('storefront.wishlist');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const next = favorited ? ids.filter((i) => i !== product.id) : [product.id, ...ids];
      window.localStorage.setItem('storefront.wishlist', JSON.stringify(next));
      setFavorited(!favorited);
      toast.success(favorited ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
    } catch { /* ignore */ }
  }

  async function handleShare() {
    if (!product) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch { /* user cancel */ }
  }

  const installments = product?.price_from ? Math.min(10, Math.floor(product.price_from / 50) || 1) : 0;
  const pixPrice = product?.price_from ? product.price_from * 0.95 : 0;

  return (
    <StorefrontShell>
      <StorefrontNavbar />
      <main className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[12px] text-[#666] mb-6" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-[var(--brand-red)]">Início</Link>
          <ChevronRight className="h-3 w-3" />
          {product?.brand && (
            <>
              <span className="text-[#666]">{product.brand.name}</span>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          <span className="text-[#111] truncate max-w-[40ch]">{product?.name ?? '…'}</span>
        </nav>

        {productQ.isLoading ? (
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
                    <button type="button" aria-label="Anterior"
                      onClick={() => setGalleryIdx((i) => (i - 1 + media.length) % media.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center bg-white/90 hover:bg-white shadow-sm rounded-full"
                    ><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" aria-label="Próximo"
                      onClick={() => setGalleryIdx((i) => (i + 1) % media.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center bg-white/90 hover:bg-white shadow-sm rounded-full"
                    ><ChevronRight className="h-4 w-4" /></button>
                  </>
                )}
              </div>
              {media.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {media.map((m, i) => (
                    <button key={m.id} type="button" onClick={() => setGalleryIdx(i)}
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

              {/* Avaliações (estrutura pronta) */}
              <div className="mt-2 flex items-center gap-2 text-[12px] text-[#666]">
                <div className="flex">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 text-[#DDD]" strokeWidth={1.5} />
                  ))}
                </div>
                <span>Sem avaliações ainda</span>
              </div>

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

              {/* Parcelamento + Pix */}
              {product.price_from && (
                <div className="mt-2 text-[13px] text-[#444] space-y-1">
                  {installments > 1 && (
                    <p>
                      ou <strong>{installments}x</strong> de <strong>{formatBRL(product.price_from / installments)}</strong> sem juros
                    </p>
                  )}
                  <p>
                    <span className="inline-flex items-center gap-1 text-[var(--brand-red)] font-medium">
                      Pix
                    </span>{' '}
                    <strong>{formatBRL(pixPrice)}</strong> à vista (5% off)
                  </p>
                </div>
              )}

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
                        <button key={c.id} type="button" onClick={() => setColorId(c.id)} aria-label={c.name}
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
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] uppercase tracking-[0.18em] font-semibold">Tamanho</p>
                    <button
                      type="button"
                      onClick={() => toast.info('Guia de medidas em breve')}
                      className="inline-flex items-center gap-1 text-[11px] text-[#666] hover:text-[#111] underline"
                    >
                      <Ruler className="h-3 w-3" /> Guia de medidas
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.sizes.map((s) => {
                      const available = sizesAvailability.get(s.attribute_value_id) ?? false;
                      const selected = s.attribute_value_id === sizeId;
                      return (
                        <button key={s.attribute_value_id} type="button" disabled={!available}
                          onClick={() => handleSizeSelect(s.attribute_value_id)}
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
                <button type="button" onClick={handleAdd} disabled={adding || !cart.ready}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-[#111] text-white px-6 py-3 text-[12px] uppercase tracking-[0.18em] hover:bg-[var(--brand-red)] transition-colors disabled:opacity-50"
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" />
                    : added ? <Check className="h-4 w-4" />
                    : <ShoppingBag className="h-4 w-4" />}
                  {added ? 'Adicionado' : 'Adicionar à sacola'}
                </button>
                <button type="button" onClick={() => navigate({ to: '/sacola' })}
                  className="px-6 py-3 text-[12px] uppercase tracking-[0.18em] border border-[#111] hover:bg-[#F8F8F8]"
                >Ver sacola</button>
              </div>

              {/* Ações secundárias */}
              <div className="mt-4 flex items-center gap-4 text-[12px] text-[#666]">
                <button type="button" onClick={handleFavorite} className="inline-flex items-center gap-1.5 hover:text-[var(--brand-red)]">
                  <Heart className={`h-4 w-4 ${favorited ? 'fill-[var(--brand-red)] text-[var(--brand-red)]' : ''}`} /> Favoritar
                </button>
                <button type="button" onClick={handleShare} className="inline-flex items-center gap-1.5 hover:text-[#111]">
                  <Share2 className="h-4 w-4" /> Compartilhar
                </button>
              </div>

              {/* Calcular frete (preparado) */}
              <div className="mt-6 border border-[#EFEFEF] p-4">
                <p className="text-[12px] uppercase tracking-[0.18em] font-semibold flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5" /> Calcular frete e prazo
                </p>
                <div className="mt-3 flex gap-2">
                  <input disabled placeholder="Seu CEP" className="flex-1 border border-[#EFEFEF] px-3 py-2 text-[13px] bg-white disabled:opacity-60" />
                  <button disabled className="px-4 py-2 text-[12px] uppercase tracking-[0.18em] border border-[#EFEFEF] text-[#999] cursor-not-allowed">OK</button>
                </div>
                <p className="mt-2 text-[11px] text-[#666]">Disponível no checkout.</p>
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

        {/* Produtos relacionados */}
        {related.length > 0 && (
          <section className="mt-16 border-t border-[#EFEFEF] pt-12">
            <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold mb-4">Você também pode gostar</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
              {related.map((p) => (
                <Link key={p.id} to="/produto/$slug" params={{ slug: p.slug }}
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
          </section>
        )}
      </main>
    </StorefrontShell>
  );
}
