import { createFileRoute } from "@tanstack/react-router";
import {
  StorefrontShell, StorefrontNavbar, StorefrontLogoStrip, StorefrontHero, StorefrontFooter,
  Section, SectionHeader, ProductCarousel, CategoryGrid,
  NewsletterSection, TrustStrip, ProductGrid,
  type HeroBanner,
} from "@/components/storefront/storefront";
import bannerCountry from "@/assets/banner-country.jpg";
import bannerMasculino from "@/assets/banner-masculino.jpg";
import bannerFeminino from "@/assets/banner-feminino.jpg";
import bannerSportFino from "@/assets/banner-sport-fino.jpg";

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

  // Banners do Hero: imagens premium de campanha por coleção (sem textos sobrepostos).
  // Sem fallback de placeholder — clique abre a categoria quando o slug existir no catálogo.
  const findSlug = (...candidates: string[]) => {
    const set = new Set(categories.map((c: { slug: string }) => c.slug));
    return candidates.find((s) => set.has(s));
  };
  const heroBanners: HeroBanner[] = [
    { image: "/__hero/banner-country.jpg", ctaSlug: findSlug("country") },
    { image: "/__hero/banner-masculino.jpg", ctaSlug: findSlug("masculino", "homem") },
    { image: "/__hero/banner-feminino.jpg", ctaSlug: findSlug("feminino", "mulher") },
    { image: "/__hero/banner-sport-fino.jpg", ctaSlug: findSlug("sport-fino", "social") },
  ];


  // Divide o pool em "estilos" diferentes para preencher as seções temáticas
  const sportFino = todos.slice(0, 8);
  const country = todos.slice(2, 10);
  const social = todos.slice(4, 12);

  return (
    <StorefrontShell>
      <div className="min-h-screen flex flex-col bg-white">
        <StorefrontNavbar categories={categories} brands={brands} />
        <StorefrontLogoStrip />
        <main className="flex-1">
          <StorefrontHero banners={heroBanners} />



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

          {/* Categorias */}
          <Section>
            <SectionHeader
              eyebrow="Coleções"
              title="Categorias"
              description="Navegue pelas coleções do catálogo."
              action={{ label: "Ver todas" }}
            />
            <CategoryGrid categories={categories} />
          </Section>

          {/* Mais vendidos */}
          <Section>
            <SectionHeader
              eyebrow="Destaques"
              title="Mais vendidos"
              description="As peças mais procuradas do momento."
              action={{ label: "Ver todos" }}
            />
            <ProductGrid products={(maisVendidos.length ? maisVendidos : todos).slice(0, 8)} />
          </Section>

          {/* Sport Fino */}
          <Section>
            <SectionHeader
              eyebrow="Coleção"
              title="Sport Fino"
              description="Seleção da linha sport fino."
              action={{ label: "Ver coleção" }}
            />
            <ProductCarousel products={sportFino.length ? sportFino : destaques.slice(0, 8)} />
          </Section>

          {/* Country */}
          <Section>
            <SectionHeader
              eyebrow="Coleção"
              title="Country"
              description="Seleção da linha country."
              action={{ label: "Ver coleção" }}
            />
            <ProductCarousel products={country.length ? country : todos.slice(0, 8)} />
          </Section>

          {/* Social */}
          <Section>
            <SectionHeader
              eyebrow="Coleção"
              title="Social"
              description="Seleção da linha social."
              action={{ label: "Ver coleção" }}
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
