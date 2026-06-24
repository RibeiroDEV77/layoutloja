import { createFileRoute } from "@tanstack/react-router";
import {
  StorefrontShell, StorefrontNavbar, StorefrontLogoStrip, StorefrontHero, StorefrontFooter,
  Section, SectionHeader, ProductCarousel, CategoryGrid, CategoryCircles,
  NewsletterSection, TrustStrip, ProductGrid,
  type HeroBanner,
} from "@/components/storefront/storefront";
import heroCountry from "@/assets/hero-country.png.asset.json";
import heroFeminino from "@/assets/hero-feminino.png.asset.json";
import heroBrasil from "@/assets/hero-brasil.png.asset.json";

import {
  getStorefrontStore, listStorefrontCategories, listStorefrontProducts,
  listStorefrontBrands, type StorefrontCategory, type StorefrontProduct,
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

  // Banners do Hero: imagens premium de campanha por coleção (sem textos sobrepostos).
  // Sem fallback de placeholder — clique abre a categoria quando o slug existir no catálogo.
  const findSlug = (...candidates: string[]) => {
    const set = new Set(categories.map((c: { slug: string }) => c.slug));
    return candidates.find((s) => set.has(s));
  };
  const heroBanners: HeroBanner[] = [
    { image: bannerCountry, ctaSlug: findSlug("country") },
    { image: bannerMasculino, ctaSlug: findSlug("masculino", "homem") },
    { image: bannerFeminino, ctaSlug: findSlug("feminino", "mulher") },
    { image: bannerSportFino, ctaSlug: findSlug("sport-fino", "social") },
  ];


  const collectCategoryIds = (slugs: string[]) => {
    const targets = new Set(
      categories
        .filter((category: StorefrontCategory) => slugs.includes(category.slug))
        .map((category: StorefrontCategory) => category.id),
    );
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of categories as StorefrontCategory[]) {
        if (category.parent_id && targets.has(category.parent_id) && !targets.has(category.id)) {
          targets.add(category.id);
          changed = true;
        }
      }
    }
    return targets;
  };

  const filterByCategory = (slugs: string[]) => {
    const ids = collectCategoryIds(slugs);
    if (!ids.size) return [];
    return (todos as StorefrontProduct[]).filter((product) => {
      const assigned = product.category_ids?.length ? product.category_ids : product.category_id ? [product.category_id] : [];
      return assigned.some((categoryId) => ids.has(categoryId));
    });
  };

  const sportFino = filterByCategory(["sport-fino", "esporte-fino", "masc-esporte-fino", "masc-calcas-sport-fino", "masc-bermudas-sport-fino", "fem-calcas-sport-fino"]);
  const country = filterByCategory(["country", "masc-calcas-country", "fem-calcas-country"]);
  const social = filterByCategory(["social", "masc-social", "masc-calcas-social", "fem-calcas-social"]);

  return (
    <StorefrontShell>
      <div className="min-h-screen flex flex-col bg-white">
        <StorefrontNavbar categories={categories} brands={brands} products={todos} />
        <StorefrontLogoStrip />
        <main className="flex-1">
          <StorefrontHero banners={heroBanners} />

          {/* Barra de Benefícios */}
          <TrustStrip />

          {/* Navegação de Categorias */}
          <nav aria-label="Categorias" className="py-8 md:py-12 border-b border-gray-100">
            <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
              <CategoryCircles categories={categories} />
            </div>
          </nav>

          {/* Novidades */}
          <Section id="novidades">
            <SectionHeader
              eyebrow="Acabou de chegar"
              title="Novidades"
              description="Confira os lançamentos mais recentes da coleção."
              action={{ label: "Ver todos" }}
            />
            <ProductCarousel products={novidades.length ? novidades : todos.slice(0, 8)} />
          </Section>

          {/* Mais vendidos */}
          <Section>
            <SectionHeader
              eyebrow="Destaques"
              title="Mais vendidos"
              description="As peças mais procuradas do momento."
              action={{ label: "Ver todos" }}
            />
            <ProductCarousel products={(maisVendidos.length ? maisVendidos : todos).slice(0, 12)} />
          </Section>

          {/* Sport Fino */}
          <Section>
            <SectionHeader
              eyebrow="Coleção"
              title="Sport Fino"
              description="Seleção da linha sport fino."
              action={{ label: "Ver coleção" }}
            />
            <ProductCarousel products={sportFino} />
          </Section>

          {/* Country */}
          <Section>
            <SectionHeader
              eyebrow="Coleção"
              title="Country"
              description="Seleção da linha country."
              action={{ label: "Ver coleção" }}
            />
            <ProductCarousel products={country} />
          </Section>

          {/* Social */}
          <Section>
            <SectionHeader
              eyebrow="Coleção"
              title="Social"
              description="Seleção da linha social."
              action={{ label: "Ver coleção" }}
            />
            <ProductCarousel products={social} />
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
