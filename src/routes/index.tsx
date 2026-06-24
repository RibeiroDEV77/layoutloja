import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  StorefrontShell, StorefrontNavbar, StorefrontLogoStrip, StorefrontHero, StorefrontFooter,
  Section, SectionHeader, ProductCarousel, CategoryGrid, CategoryCircles,
  NewsletterSection, TrustStrip, ProductGrid,
  type HeroBanner,
} from "@/components/storefront/storefront";
import { CATEGORY_TABS, resolveCategoryIds, type CategoryNode } from "@/lib/category-tabs";
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
    { image: heroCountry.url, ctaSlug: findSlug("country") },
    { image: heroFeminino.url, ctaSlug: findSlug("feminino", "mulher") },
    { image: heroBrasil.url, ctaSlug: findSlug("brasil", "selecao", "futebol") },
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

          {/* Todos os Produtos */}
          <TodosProdutosSection todos={todos as StorefrontProduct[]} categories={categories as StorefrontCategory[]} />









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

function TodosProdutosSection({
  todos,
  categories,
}: {
  todos: StorefrontProduct[];
  categories: StorefrontCategory[];
}) {
  const [active, setActive] = useState<string>("all");

  // Resolve ids descendentes por aba (memoizado).
  const tabsWithData = useMemo(() => {
    const nodes = categories as unknown as CategoryNode[];
    const productCatIds = (p: StorefrontProduct) =>
      p.category_ids?.length ? p.category_ids : p.category_id ? [p.category_id] : [];
    return CATEGORY_TABS.map((tab) => {
      const ids = new Set(resolveCategoryIds(nodes, tab.roots));
      const matches =
        tab.key === "all"
          ? todos
          : todos.filter((p) => productCatIds(p).some((id) => ids.has(id)));
      return { ...tab, count: matches.length, matches };
    }).filter((t) => t.key === "all" || t.count > 0);
  }, [todos, categories]);

  const sorted = useMemo(() => {
    const score = (p: StorefrontProduct) =>
      (p.featured ? 100 : 0) + (p.new_product ? 10 : 0) + (p.best_seller ? 1 : 0);
    const tab = tabsWithData.find((t) => t.key === active) ?? tabsWithData[0];
    return [...tab.matches].sort((a, b) => score(b) - score(a)).slice(0, 12);
  }, [active, tabsWithData]);

  return (
    <Section id="todos-os-produtos">
      <SectionHeader
        eyebrow="Nosso catálogo"
        title="Todos os Produtos"
        description="Confira todos os produtos disponíveis da Layout."
        action={{ label: "Ver todos", href: "/produtos" }}
      />

      <div className="mb-8 flex flex-wrap justify-center gap-2 md:gap-3" role="tablist" aria-label="Filtrar por categoria">
        {tabsWithData.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.key)}
              className={
                "px-5 py-2.5 text-[12px] md:text-[13px] uppercase tracking-[0.22em] border transition-colors duration-200 " +
                (isActive
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]")
              }
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
            >
              {tab.label}
              <span className={"ml-2 text-[10px] " + (isActive ? "opacity-70" : "opacity-50")}>
                ({tab.count})
              </span>
            </button>
          );
        })}
      </div>

      <div key={active} className="animate-in fade-in duration-300">
        {sorted.length > 0 ? (
          <ProductGrid products={sorted} minCount={sorted.length} />
        ) : (
          <div className="py-16 text-center text-sm text-gray-500" style={{ fontFamily: "Inter, sans-serif" }}>
            Nenhum produto disponível nesta categoria no momento.
          </div>
        )}
      </div>

      <div className="mt-12 flex justify-center">
        <a
          href="/produtos"
          className="inline-flex items-center gap-2 border border-[#111111] px-8 py-4 text-[12px] md:text-[13px] uppercase tracking-[0.22em] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors duration-200"
          style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
        >
          VER TODOS OS PRODUTOS →
        </a>
      </div>
    </Section>
  );
}


