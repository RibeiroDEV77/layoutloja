import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getStorefrontHome } from '@/lib/business/storefront.functions';
import { ProductCard } from '@/components/storefront/product-card';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_store/')({
  head: () => ({
    meta: [
      { title: 'Layout — Moda atemporal e curadoria minimalista' },
      { name: 'description', content: 'Descubra peças essenciais de moda masculina, feminina, infantil, calçados e acessórios. Frete grátis acima de R$ 299.' },
      { property: 'og:title', content: 'Layout — Moda atemporal' },
      { property: 'og:description', content: 'Curadoria minimalista. Peças que duram além das estações.' },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const fn = useServerFn(getStorefrontHome);
  const { data, isLoading } = useQuery({
    queryKey: ['storefront', 'home'],
    queryFn: () => fn(),
    staleTime: 60 * 1000,
  });

  return (
    <>
      {/* Hero */}
      <section className="relative bg-foreground text-background">
        <div className="mx-auto grid min-h-[70vh] max-w-7xl items-center gap-8 px-4 py-20 md:grid-cols-2">
          <div className="space-y-6">
            <span className="text-[11px] font-medium uppercase tracking-widest-tight text-accent">Coleção · Inverno 2026</span>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] md:text-7xl">
              Essenciais que <br />acompanham você.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-background/70">
              Curadoria minimalista, tecidos premium, caimento atemporal. Construa um guarda-roupa que dura.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" variant="secondary" className="rounded-none">
                <Link to="/c/$category" params={{ category: 'novidades' }}>Ver novidades</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-none border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background">
                <Link to="/c/$category" params={{ category: 'feminino' }}>Feminino</Link>
              </Button>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="aspect-[4/5] w-full border border-background/10 bg-background/5">
              <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-widest-tight text-background/40">
                Banner principal · DAM
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categorias destacadas */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <h2 className="font-display text-2xl font-semibold">Compre por categoria</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { slug: 'masculino', label: 'Masculino' },
            { slug: 'feminino', label: 'Feminino' },
            { slug: 'infantil', label: 'Infantil' },
            { slug: 'calcados', label: 'Calçados' },
            { slug: 'acessorios', label: 'Acessórios' },
          ].map((c) => (
            <Link
              key={c.slug}
              to="/c/$category"
              params={{ category: c.slug }}
              className="group flex aspect-[3/4] items-end justify-start border border-border bg-secondary p-4 transition hover:bg-foreground hover:text-background"
            >
              <span className="text-sm font-medium uppercase tracking-widest-tight">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <ProductSection title="Em destaque" cta={{ to: '/c/$category', params: { category: 'masculino' }, label: 'Ver tudo' }} loading={isLoading} products={data?.featured ?? []} />
      <ProductSection title="Lançamentos" cta={{ to: '/c/$category', params: { category: 'novidades' }, label: 'Ver novidades' }} loading={isLoading} products={data?.novelties ?? []} />
      <ProductSection title="Mais vendidos" cta={{ to: '/c/$category', params: { category: 'feminino' }, label: 'Ver tudo' }} loading={isLoading} products={data?.best_sellers ?? []} />

      {/* Banner promo */}
      <section className="mx-auto my-20 max-w-7xl px-4">
        <div className="flex flex-col items-center justify-between gap-6 border-y border-foreground bg-foreground px-8 py-12 text-background md:flex-row">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-widest-tight text-accent">Liquidação de estação</span>
            <h3 className="mt-2 font-display text-3xl font-semibold">Até 50% off em peças selecionadas</h3>
          </div>
          <Button asChild size="lg" variant="secondary" className="rounded-none">
            <Link to="/c/$category" params={{ category: 'promocoes' }}>Comprar promoções</Link>
          </Button>
        </div>
      </section>

      <ProductSection title="Promoções" cta={{ to: '/c/$category', params: { category: 'promocoes' }, label: 'Ver todas' }} loading={isLoading} products={data?.on_sale ?? []} />

      {/* Newsletter inline */}
      <section className="mx-auto my-20 max-w-3xl px-4 text-center">
        <h3 className="font-display text-3xl font-semibold">Fique por dentro</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          Lançamentos, editoriais e ofertas exclusivas. Sem spam.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); }}
          className="mt-6 flex items-center border border-border bg-background"
        >
          <input
            type="email"
            placeholder="seu@email.com"
            className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" className="bg-foreground px-6 py-3 text-xs font-medium uppercase tracking-widest-tight text-background hover:opacity-90">
            Inscrever-se
          </button>
        </form>
      </section>
    </>
  );
}

function ProductSection({
  title, cta, products, loading,
}: {
  title: string;
  cta: { to: string; params: Record<string, string>; label: string };
  products: Array<{ id: string; slug: string; name: string; short_description: string | null; brand_id: string | null; category_id: string | null; featured: boolean; new_product: boolean; best_seller: boolean; on_sale: boolean; image_url: string | null; price_from: number | null; list_price_from: number | null }>;
  loading?: boolean;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <Link to={cta.to as never} params={cta.params as never} className="text-xs uppercase tracking-widest-tight underline-offset-4 hover:underline">
          {cta.label}
        </Link>
      </div>
      {loading && products.length === 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse bg-secondary" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Nenhum produto publicado nesta seção ainda.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </section>
  );
}
