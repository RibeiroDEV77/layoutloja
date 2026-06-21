import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  StorefrontShell, StorefrontNavbar, StorefrontFooter,
  Breadcrumb, SidebarFilter, CategoryToolbar, ProductGrid,
  type FilterGroup,
} from "@/components/storefront/storefront";
import {
  getStorefrontStore, listStorefrontCategories, listStorefrontProducts,
  listStorefrontBrands,
  type StorefrontCategory,
  type StorefrontBrand,
  type StorefrontProduct,
} from "@/lib/business/storefront.functions";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { findStorefrontNavItem, storefrontCategoryLabel, resolveStorefrontCategory } from "@/lib/storefront-navigation";

export const Route = createFileRoute("/categoria/$slug")({
  loader: async ({ params }) => {
    const { store } = await getStorefrontStore();
    const store_id = store?.id;
    const [cats, brands, prods] = await Promise.all([
      listStorefrontCategories({ data: { store_id } }),
      listStorefrontBrands({ data: { store_id } }),
      listStorefrontProducts({ data: { store_id, limit: 24 } }),
    ]);
    const navItem = findStorefrontNavItem(params.slug);
    const matchedNavCategory = navItem ? resolveStorefrontCategory(navItem, cats.rows) : undefined;
    const category = cats.rows.find((c) => c.slug === params.slug) ?? matchedNavCategory ?? {
      id: `placeholder-${params.slug}`,
      name: navItem?.label ?? storefrontCategoryLabel(params.slug),
      slug: navItem?.slug ?? params.slug,
      parent_id: null,
      image_url: null,
      level: 0,
      sort_order: 0,
      seo_title: null,
      seo_description: null,
    };
    const subcategories = cats.rows.filter((c) => c.parent_id === category.id);
    const categoryIds = new Set<string>([category.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of cats.rows) {
        if (c.parent_id && categoryIds.has(c.parent_id) && !categoryIds.has(c.id)) {
          categoryIds.add(c.id);
          changed = true;
        }
      }
    }
    const categoryProducts = category.id.startsWith("placeholder-")
      ? navItem?.key === "promocoes"
        ? prods.rows.filter((product) => product.on_sale)
        : navItem?.key === "novidades"
          ? prods.rows.filter((product) => product.new_product)
          : prods.rows
      : prods.rows.filter((product) => product.category_id && categoryIds.has(product.category_id));
    const parents: typeof cats.rows = [];
    let p = category.parent_id;
    while (p) {
      const parent = cats.rows.find((c) => c.id === p);
      if (!parent) break;
      parents.unshift(parent);
      p = parent.parent_id;
    }
    return { store, category, subcategories, parents, products: categoryProducts, allProducts: prods.rows, categories: cats.rows, brands: brands.rows };
  },

  head: ({ loaderData }) => {
    const name = loaderData?.category.name ?? "Categoria";
    return {
      meta: [
        { title: `${name} — Layout` },
        { name: "description", content: `Confira a seleção ${name} da Layout.` },
        { property: "og:title", content: `${name} — Layout` },
        { property: "og:description", content: `Confira a seleção ${name} da Layout.` },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">Categoria não encontrada</p>
      <Link to="/" className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-neutral-900 hover:text-[var(--brand-red)] transition-colors">← Voltar à home</Link>
    </div>
  ),
  component: CategoryPage,
});

function buildFilterGroups(subcategories: StorefrontCategory[], brands: StorefrontBrand[], products: StorefrontProduct[]): FilterGroup[] {
  const groups: FilterGroup[] = [];
  if (subcategories.length > 0) {
    groups.push({ key: "subcategory", title: "Subcategorias", options: subcategories.map((category) => ({ label: category.name })) });
  }
  if (brands.length > 0) {
    groups.push({
      key: "brand",
      title: "Marcas",
      options: brands.map((brand) => ({ label: brand.name, count: products.filter((product) => product.brand_id === brand.id).length })),
    });
  }
  const highlights = [
    { label: "Novidades", count: products.filter((product) => product.new_product).length },
    { label: "Promoções", count: products.filter((product) => product.on_sale).length },
    { label: "Mais vendidos", count: products.filter((product) => product.best_seller).length },
  ].filter((option) => option.count > 0);
  if (highlights.length > 0) groups.push({ key: "highlights", title: "Destaques", options: highlights });
  return groups;
}

function CategoryPage() {
  const { store, category, subcategories, parents, products, allProducts, categories, brands } = Route.useLoaderData();
  const storeName = store?.name ?? "Layout";
  const [sort, setSort] = useState("relevance");

  const sorted = useMemo(() => {
    const arr = [...products];
    if (sort === "new") arr.sort((a, b) => Number(b.new_product) - Number(a.new_product));
    if (sort === "best") arr.sort((a, b) => Number(b.best_seller) - Number(a.best_seller));
    return arr;
  }, [products, sort]);
  const filterGroups = useMemo(() => buildFilterGroups(subcategories, brands, products), [subcategories, brands, products]);

  return (
    <StorefrontShell>
      <div className="min-h-screen flex flex-col bg-white">
        <StorefrontNavbar categories={categories} brands={brands} products={allProducts} />

        <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 lg:px-10 pt-8 pb-24">
          <Breadcrumb
            items={[
              { label: "Início", to: "/" },
              ...parents.map((p: StorefrontCategory) => ({ label: p.name, to: `/categoria/${p.slug}` })),
              { label: category.name },
            ]}
          />

          {/* Título da categoria — alinhamento à esquerda em páginas internas */}
          <header className="mt-8 mb-6 max-w-3xl">
            <h1 className="font-storefront-display text-4xl md:text-5xl font-light tracking-tight text-neutral-900">
              {category.name}
            </h1>
          </header>

          {/* Subcategorias */}
          {subcategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-8">
              {subcategories.map((s: StorefrontCategory) => (
                <Link
                  key={s.id}
                  to="/categoria/$slug"
                  params={{ slug: s.slug }}
                  className={cn(
                    "px-4 py-2 border border-neutral-200 text-[11px] uppercase tracking-[0.22em] text-neutral-700",
                    "hover:border-neutral-900 hover:text-neutral-950 transition-colors duration-300",
                  )}
                >
                  {s.name}
                </Link>
              ))}
            </div>
          )}

          <CategoryToolbar count={sorted.length} sort={sort} onSortChange={setSort} />

          <div className={cn("mt-10 grid grid-cols-1 gap-10 lg:gap-14", filterGroups.length > 0 && "lg:grid-cols-[260px_minmax(0,1fr)]")}>
            {filterGroups.length > 0 && <SidebarFilter groups={filterGroups} onClear={() => setSort("relevance")} />}
            <div>
              <ProductGrid products={sorted} />
            </div>
          </div>
        </main>
        <StorefrontFooter storeName={storeName} categories={categories} />
      </div>
    </StorefrontShell>
  );
}
