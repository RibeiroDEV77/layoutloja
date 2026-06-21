import { createFileRoute } from "@tanstack/react-router";
import {
  StorefrontShell, StorefrontNavbar, StorefrontHero, StorefrontFooter,
  Section, SectionHeader, ProductCarousel, CategoryGrid,
  InstitutionalBanner, NewsletterSection, TrustStrip, ProductGrid,
  type HeroBanner,
} from "@/components/storefront/storefront";
import {
  getStorefrontStore, listStorefrontCategories, listStorefrontProducts,
  listStorefrontBrands,
} from "@/lib/business/storefront.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Layout — Indústria do Vestuário" },
      { name: "description", content: "Moda autoral com a qualidade da indústria Layout. Masculino, feminino, country, social e sport fino." },
      { property: "og:title", content: "Layout — Indústria do Vestuário" },
      { property: "og:description", content: "Moda autoral com a qualidade da indústria Layout." },
    ],
  }),
  loader: async () => {
    const { store } = await getStorefrontStore();
    const store_id = store?.id;
    const [cats, brands, novos, best, featured, all] = await Promise.all([
      listStorefrontCategories({ data: { store_id } }),
      listStorefrontBrands({ data: { store_id } }),
      listStorefrontProducts({ data: { store_id, flag: "new", limit: 12 } }),
      listStorefrontProducts({ data: { store_id, limit: 12 } }),
      listStorefrontProducts({ data: { store_id, flag: "featured", limit: 12 } }),
      listStorefrontProducts({ data: { store_id, limit: 24 } }),
    ]);
    return {
      store,
      categories: cats.rows,
      brands: brands.rows,
      novidades: novos.rows,
      maisVendidos: best.rows,
      destaques: featured.rows,
      todos: all.rows,
    };
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">{error.message}</div>
  ),
  component: HomePage,
});

function HomePage() {
  const { store, categories, brands, novidades, maisVendidos, destaques, todos } = Route.useLoaderData();
  const storeName = store?.name ?? "Layout";

  // Banners do Hero: derivados das categorias raiz com imagem (admin-driven)
  const heroBanners: HeroBanner[] = categories
    .filter((c: { parent_id: string | null; image_url: string | null }) => !c.parent_id && c.image_url)
    .slice(0, 5)
    .map((c: { image_url: string | null; name: string; slug: string }) => ({ image: c.image_url as string, tag: c.name, ctaSlug: c.slug }));


  // Divide o pool em "estilos" diferentes para preencher as seções temáticas
  const sportFino = todos.slice(0, 8);
  const country = todos.slice(2, 10);
  const social = todos.slice(4, 12);

  return (
    <StorefrontShell>
      <div className="min-h-screen flex flex-col bg-white">
        <StorefrontNavbar categories={categories} brands={brands} />
        <main className="flex-1">
          <StorefrontHero banners={heroBanners} />


          {/* Novidades */}
          <Section id="novidades">
            <SectionHeader
              title="Novidades"
              description="Os lançamentos mais recentes da nossa coleção."
              action={{ label: "Ver todos" }}
              align="left"
            />
            <ProductCarousel products={novidades.length ? novidades : todos.slice(0, 8)} />
          </Section>

          {/* Categorias */}
          <Section tone="soft">
            <SectionHeader
              title="Categorias"
              description="Encontre o estilo que combina com você."
              align="center"
            />
            <CategoryGrid categories={categories} />
          </Section>

          {/* Banner institucional */}
          <InstitutionalBanner />

          {/* Mais vendidos */}
          <Section>
            <SectionHeader
              title="Mais vendidos"
              description="As peças preferidas pelos nossos clientes."
              action={{ label: "Ver todos" }}
              align="left"
            />
            <ProductGrid products={(maisVendidos.length ? maisVendidos : todos).slice(0, 8)} />
          </Section>

          {/* Sport Fino */}
          <Section tone="soft">
            <SectionHeader
              title="Sport Fino"
              description="Conforto e elegância para o dia a dia."
              action={{ label: "Ver coleção" }}
              align="center"
            />
            <ProductCarousel products={sportFino.length ? sportFino : destaques.slice(0, 8)} />
          </Section>

          {/* Country */}
          <Section>
            <SectionHeader
              title="Country"
              description="Tradição e atitude no melhor estilo country."
              action={{ label: "Ver coleção" }}
              align="left"
            />
            <ProductCarousel products={country.length ? country : todos.slice(0, 8)} />
          </Section>

          {/* Social */}
          <Section tone="soft">
            <SectionHeader
              title="Social"
              description="Alfaiataria moderna para momentos especiais."
              action={{ label: "Ver coleção" }}
              align="center"
            />
            <ProductCarousel products={social.length ? social : todos.slice(0, 8)} />
          </Section>

          {/* Newsletter */}
          <NewsletterSection />

          {/* Trust strip */}
          <TrustStrip />
        </main>
        <StorefrontFooter storeName={storeName} categories={categories} />
      </div>
    </StorefrontShell>
  );
}
