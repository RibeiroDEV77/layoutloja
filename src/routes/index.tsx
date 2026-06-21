import { createFileRoute } from "@tanstack/react-router";
import {
  StorefrontShell, StorefrontNavbar, StorefrontLogoStrip, StorefrontHero, StorefrontFooter,
  Section, SectionHeader, ProductCarousel, CategoryGrid, ProductGrid,
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
      { property: "og:title", content: "Layout — Indústria do Vestuário" },
    ],
  }),
  loader: async () => {
    const { store } = await getStorefrontStore();
    const store_id = store?.id;
    const [cats, brands, novos, best] = await Promise.all([
      listStorefrontCategories({ data: { store_id } }),
      listStorefrontBrands({ data: { store_id } }),
      listStorefrontProducts({ data: { store_id, flag: "new", limit: 12 } }),
      listStorefrontProducts({ data: { store_id, limit: 12 } }),
    ]);
    return {
      store,
      categories: cats.rows,
      brands: brands.rows,
      novidades: novos.rows,
      maisVendidos: best.rows,
    };
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">{error.message}</div>
  ),
  component: HomePage,
});

function HomePage() {
  const { store, categories, brands, novidades, maisVendidos } = Route.useLoaderData();
  const storeName = store?.name ?? "Layout";

  // Banners do Hero: apenas categorias raiz que possuem imagem cadastrada no admin
  const heroBanners: HeroBanner[] = categories
    .filter((c) => !c.parent_id && c.image_url)
    .slice(0, 5)
    .map((c) => ({ image: c.image_url as string, tag: c.name, title: c.name, ctaSlug: c.slug }));

  const hasRootCategories = categories.some((c) => !c.parent_id);

  return (
    <StorefrontShell>
      <div className="min-h-screen flex flex-col bg-white">
        <StorefrontNavbar categories={categories} brands={brands} />
        <StorefrontLogoStrip />
        <main className="flex-1">
          {heroBanners.length > 0 && <StorefrontHero banners={heroBanners} />}

          {novidades.length > 0 && (
            <Section id="novidades">
              <SectionHeader title="Novidades" />
              <ProductCarousel products={novidades} />
            </Section>
          )}

          {hasRootCategories && (
            <Section tone="soft">
              <SectionHeader title="Categorias" />
              <CategoryGrid categories={categories} />
            </Section>
          )}

          {maisVendidos.length > 0 && (
            <Section>
              <SectionHeader title="Mais vendidos" />
              <ProductGrid products={maisVendidos.slice(0, 8)} />
            </Section>
          )}
        </main>
        <StorefrontFooter storeName={storeName} categories={categories} />
      </div>
    </StorefrontShell>
  );
}

