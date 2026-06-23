import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  StorefrontShell, StorefrontNavbar, StorefrontFooter,
  Breadcrumb, SidebarFilter, CategoryToolbar, ProductGrid, SectionHeader,
  type FilterGroup,
} from "@/components/storefront/storefront";
import {
  getStorefrontStore, listStorefrontCategories, listStorefrontProducts,
  listStorefrontBrands,
  type StorefrontCategory,
} from "@/lib/business/storefront.functions";
import { listProductCategoryMap } from "@/lib/business/product-categories.functions";
import { getCategoryFilters, type StorefrontFilterGroup } from "@/lib/business/storefront-filters.functions";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { findStorefrontNavItem, storefrontCategoryLabel, resolveStorefrontCategory, resolveStorefrontCategories } from "@/lib/storefront-navigation";

type SearchParams = {
  sort?: string;
  attr?: Record<string, string>; // attributeCode -> "valId1,valId2"
  pmin?: number;
  pmax?: number;
};

export const Route = createFileRoute("/categoria/$slug")({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const out: SearchParams = {};
    if (typeof search.sort === "string") out.sort = search.sort;
    if (typeof search.pmin === "number") out.pmin = search.pmin;
    if (typeof search.pmax === "number") out.pmax = search.pmax;
    if (search.attr && typeof search.attr === "object") {
      const a: Record<string, string> = {};
      for (const [k, v] of Object.entries(search.attr as Record<string, unknown>)) {
        if (typeof v === "string" && v.length > 0) a[k] = v;
      }
      if (Object.keys(a).length > 0) out.attr = a;
    }
    return out;
  },
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
    const navCategories = navItem ? resolveStorefrontCategories(navItem, cats.rows) : [];
    const categoryIds = new Set<string>([
      category.id,
      ...navCategories.map((c) => c.id),
    ]);
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
    const { map: extraCategoryMap } = await listProductCategoryMap({
      data: { product_ids: prods.rows.map((p) => p.id) },
    });
    // Multi-categoria é a fonte da verdade. Se o produto tem entradas na
    // junção (painel admin → Organização → Seções), usamos APENAS elas e
    // ignoramos o `products.category_id` legado — assim trocar/remover uma
    // seção no painel não deixa o produto "preso" na categoria antiga.
    // Quando não há junção (produto antigo ainda não migrado), caímos no
    // campo legado para não sumir produtos pré-existentes.
    const productInCategory = (product: { id: string; category_id: string | null }) => {
      const extras = extraCategoryMap[product.id] ?? [];
      if (extras.length > 0) {
        return extras.some((cid) => categoryIds.has(cid));
      }
      return !!product.category_id && categoryIds.has(product.category_id);
    };
    const categoryProducts = category.id.startsWith("placeholder-")
      ? navItem?.key === "promocoes"
        ? prods.rows.filter((product) => product.on_sale)
        : navItem?.key === "novidades"
          ? prods.rows.filter((product) => product.new_product)
          : prods.rows.filter(productInCategory)
      : prods.rows.filter(productInCategory);
    const parents: typeof cats.rows = [];
    let p = category.parent_id;
    while (p) {
      const parent = cats.rows.find((c) => c.id === p);
      if (!parent) break;
      parents.unshift(parent);
      p = parent.parent_id;
    }

    // Dynamic filters — driven by the Admin Panel (no hardcoded lists).
    const realCategoryId = category.id.startsWith("placeholder-") ? null : category.id;
    const filters = await getCategoryFilters({
      data: {
        category_id: realCategoryId,
        product_ids: categoryProducts.map((pp) => pp.id),
      },
    });

    return {
      store, category, subcategories, parents,
      products: categoryProducts, allProducts: prods.rows,
      categories: cats.rows, brands: brands.rows,
      filters: filters.groups, productAttrs: filters.productAttrs,
    };
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

function toFilterGroups(
  dynamic: StorefrontFilterGroup[],
  selected: Record<string, Set<string>>,
): FilterGroup[] {
  return dynamic.map((g) => ({
    key: g.code,
    title: g.name,
    options: g.values.map((v) => ({
      label: v.label,
      count: v.count || undefined,
      swatch: v.swatch ?? undefined,
      // Encoded id used by the click handler — kept on label is acceptable because
      // SidebarFilter is read-only today; selection state is mirrored in URL.
      // (selection state isn't read here; chips below handle clicks)
      ...{ id: v.id, selected: selected[g.code]?.has(v.id) ?? false },
    })),
  }));
}

function CategoryPage() {
  const { store, category, subcategories, parents, products, allProducts, categories, brands, filters, productAttrs } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/categoria/$slug" });
  const storeName = store?.name ?? "Layout";

  const sort = search.sort ?? "relevance";
  const setSort = (s: string) =>
    navigate({ search: (prev: SearchParams) => ({ ...prev, sort: s === "relevance" ? undefined : s }) });

  const selected = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    const attr = search.attr ?? {};
    for (const [code, csv] of Object.entries(attr)) {
      map[code] = new Set(String(csv).split(",").filter(Boolean));
    }
    return map;
  }, [search.attr]);

  const filtered = useMemo(() => {
    const activeCodes = Object.keys(selected).filter((c) => selected[c].size > 0);
    if (activeCodes.length === 0) return products;
    return products.filter((p: { id: string }) => {
      const owned = new Set(productAttrs[p.id] ?? []);
      for (const code of activeCodes) {
        const group = (filters as StorefrontFilterGroup[]).find((g) => g.code === code);
        if (!group) continue;
        const required = selected[code];
        const has = group.values.some((v: { id: string }) => required.has(v.id) && owned.has(v.id));
        if (!has) return false;
      }
      return true;
    });
  }, [products, productAttrs, filters, selected]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "new") arr.sort((a, b) => Number(b.new_product) - Number(a.new_product));
    if (sort === "best") arr.sort((a, b) => Number(b.best_seller) - Number(a.best_seller));
    return arr;
  }, [filtered, sort]);

  const groups = useMemo(() => toFilterGroups(filters, selected), [filters, selected]);

  const toggleValue = (code: string, valueId: string) => {
    navigate({
      search: (prev: SearchParams) => {
        const prevAttr = prev.attr ?? {};
        const cur = new Set(String(prevAttr[code] ?? "").split(",").filter(Boolean));
        if (cur.has(valueId)) cur.delete(valueId); else cur.add(valueId);
        const attr: Record<string, string> = { ...prevAttr };
        if (cur.size === 0) delete attr[code];
        else attr[code] = Array.from(cur).join(",");
        return { ...prev, attr: Object.keys(attr).length ? attr : undefined };
      },
    });
  };

  const clearAll = () =>
    navigate({ search: () => ({}) });

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

          <div className="mt-8">
            <SectionHeader
              eyebrow={(parents[0]?.name ?? "Categoria").toUpperCase()}
              title={category.name}
              description={category.seo_description ?? undefined}
            />
          </div>

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

          <div className={cn("mt-10 grid grid-cols-1 gap-10 lg:gap-14", groups.length > 0 && "lg:grid-cols-[260px_minmax(0,1fr)]")}>
            {groups.length > 0 && (
              <div className="space-y-2">
                <SidebarFilter groups={groups} onClear={clearAll} />
                {/* Active value chips: clickable to toggle. Sits below the
                    read-only SidebarFilter without altering its component. */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {(filters as StorefrontFilterGroup[]).flatMap((g) =>
                    g.values.map((v) => {
                      const isSelected = selected[g.code]?.has(v.id) ?? false;
                      if (g.values.length > 24 && !isSelected) return null;
                      return (
                        <button
                          key={`${g.code}:${v.id}`}
                          type="button"
                          onClick={() => toggleValue(g.code, v.id)}
                          className={cn(
                            "px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] border transition-colors",
                            isSelected
                              ? "bg-neutral-900 text-white border-neutral-900"
                              : "border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900",
                          )}
                        >
                          {g.is_color && v.swatch && (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle border border-white/40"
                              style={{ background: v.swatch }}
                            />
                          )}
                          {v.label}
                        </button>
                      );
                    }),
                  )}
                </div>
              </div>
            )}
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
