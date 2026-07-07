import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  StorefrontShell, StorefrontNavbar, StorefrontFooter,
  Breadcrumb, CategoryToolbar, ProductGrid, SectionHeader,
} from "@/components/storefront/storefront";
import { BackButton } from "@/components/storefront/back-button";
import {
  getStorefrontStore, listStorefrontCategories, listStorefrontProducts,
  listStorefrontBrands,
} from "@/lib/business/storefront.functions";
import { STOREFRONT_NAV_ITEMS } from "@/lib/storefront-navigation";
import { cn } from "@/lib/utils";

type SearchParams = { sort?: string; page?: number; cat?: string; dep?: string };

const PAGE_SIZE = 12;

// Categorias que aparecem como checkbox na sidebar de filtros.
// Slugs devem existir no cadastro (ou casar por alias) — a filtragem é
// resolvida via árvore de categorias (inclui descendentes).
const FILTER_CATEGORIES: { label: string; slug: string }[] = [
  { label: "Masculino", slug: "masculino" },
  { label: "Feminino", slug: "feminino" },
  { label: "Botas", slug: "botas" },
  { label: "Sapatos", slug: "calc-sapatos" },
  { label: "Tênis", slug: "calc-tenis" },
  { label: "Sapatênis", slug: "calc-sapatenis" },
  { label: "Sandálias", slug: "calc-sandalias" },
  { label: "Chinelos", slug: "calc-chinelos" },
  { label: "Acessórios", slug: "acessorios" },
];

export const Route = createFileRoute("/produtos")({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const out: SearchParams = {};
    if (typeof search.sort === "string") out.sort = search.sort;
    if (typeof search.page === "number" && search.page > 0) out.page = search.page;
    if (typeof search.cat === "string" && search.cat.length) out.cat = search.cat;
    if (typeof search.dep === "string" && search.dep.length) out.dep = search.dep;
    return out;
  },
  loader: async () => {
    const { store } = await getStorefrontStore();
    const store_id = store?.id;
    const [cats, brands, prods] = await Promise.all([
      listStorefrontCategories({ data: { store_id } }),
      listStorefrontBrands({ data: { store_id } }),
      listStorefrontProducts({ data: { store_id, limit: 100 } }),
    ]);
    return { store, categories: cats.rows, brands: brands.rows, products: prods.rows };
  },
  head: () => ({
    meta: [
      { title: "Todos os Produtos — Layout" },
      { name: "description", content: "Confira todos os produtos disponíveis da Layout." },
      { property: "og:title", content: "Todos os Produtos — Layout" },
      { property: "og:description", content: "Confira todos os produtos disponíveis da Layout." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <Link to="/" className="text-xs uppercase tracking-[0.2em]">← Voltar à home</Link>
    </div>
  ),
  component: AllProductsPage,
});

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Dado um slug (ou alias) de categoria, retorna o conjunto de IDs
 * dessa categoria + todos os descendentes na árvore.
 */
function resolveCategorySubtreeIds(slug: string, categories: { id: string; slug: string; name: string; parent_id: string | null }[]): Set<string> {
  const target = normalize(slug);
  const roots = categories.filter(
    (c) => normalize(c.slug) === target || normalize(c.name) === target || normalize(c.slug).includes(target),
  );
  const ids = new Set(roots.map((c) => c.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id);
        changed = true;
      }
    }
  }
  return ids;
}

function AllProductsPage() {
  const { store, categories, brands, products } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/produtos" });
  const storeName = store?.name ?? "Layout";

  const sort = search.sort ?? "relevance";
  const page = search.page ?? 1;

  // Filtros ativos (checkbox). `cat` e `dep` na URL entram como filtros pré-selecionados.
  const activeSlugs = useMemo(() => {
    const set = new Set<string>();
    if (search.cat) set.add(search.cat);
    if (search.dep) set.add(search.dep);
    return set;
  }, [search.cat, search.dep]);

  const toggleFilter = (slug: string) => {
    const next = new Set(activeSlugs);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    // Guardamos os dois primeiros filtros em `cat` e `dep` para manter a URL enxuta.
    const arr = Array.from(next);
    navigate({
      search: (prev: SearchParams) => ({
        ...prev,
        cat: arr[0],
        dep: arr[1],
        page: undefined,
      }),
    });
  };

  const clearFilters = () =>
    navigate({ search: (prev: SearchParams) => ({ ...prev, cat: undefined, dep: undefined, page: undefined }) });

  const filtered = useMemo(() => {
    if (activeSlugs.size === 0) return products;
    // Cada filtro deve casar (AND). Para cada slug ativo, resolve a subtree
    // e verifica se o produto pertence a alguma categoria dessa subtree.
    const subtrees = Array.from(activeSlugs).map((slug) => resolveCategorySubtreeIds(slug, categories));
    return products.filter((product) => {
      const assigned = product.category_ids?.length ? product.category_ids : product.category_id ? [product.category_id] : [];
      return subtrees.every((tree) => assigned.some((id) => tree.has(id)));
    });
  }, [products, categories, activeSlugs]);

  const setSort = (s: string) =>
    navigate({ search: (prev: SearchParams) => ({ ...prev, sort: s === "relevance" ? undefined : s, page: undefined }) });

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "new") arr.sort((a, b) => Number(b.new_product) - Number(a.new_product));
    if (sort === "best") arr.sort((a, b) => Number(b.best_seller) - Number(a.best_seller));
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const paged = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <StorefrontShell>
      <div className="min-h-screen flex flex-col bg-white">
        <StorefrontNavbar categories={categories} brands={brands} products={products} />

        <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 lg:px-10 pt-6 pb-24 animate-fade-in">
          <div className="mb-4 -ml-2 md:-ml-3">
            <BackButton fallbackTo="/" />
          </div>
          <Breadcrumb items={[{ label: "Início", to: "/" }, { label: "Todos os Produtos" }]} />

          <div className="mt-8">
            <SectionHeader
              eyebrow="Nosso catálogo"
              title="Todos os Produtos"
              description="Confira todos os produtos disponíveis da Layout."
            />
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
            {/* Sidebar de filtros */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[12px] uppercase tracking-[0.18em] text-[#111] font-semibold">Filtros</p>
                {activeSlugs.size > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[11px] uppercase tracking-[0.14em] text-[#666] hover:text-[var(--brand-red)] transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#999] font-medium mb-2">Categoria</p>
              <ul className="space-y-2">
                {FILTER_CATEGORIES.map((f) => {
                  const checked = activeSlugs.has(f.slug);
                  return (
                    <li key={f.slug}>
                      <label className={cn(
                        "flex items-center gap-2 text-[14px] cursor-pointer transition-colors",
                        checked ? "text-[#111] font-medium" : "text-[#555] hover:text-[#111]",
                      )}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFilter(f.slug)}
                          className="h-4 w-4 accent-[var(--brand-red)]"
                        />
                        {f.label}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Grid + toolbar */}
            <div>
              <CategoryToolbar count={sorted.length} sort={sort} onSortChange={setSort} />

              {sorted.length === 0 ? (
                <div className="mt-16 flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#E5E5E5]">
                  <p className="text-[13px] uppercase tracking-[0.18em] text-[#999]">Sem resultados</p>
                  <p className="mt-3 text-[18px] text-[#111] font-medium">Nenhum produto encontrado</p>
                  <p className="mt-2 text-[14px] text-[#666] max-w-md">
                    Ajuste ou remova os filtros selecionados para ver mais produtos.
                  </p>
                  {activeSlugs.size > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-6 px-5 py-2 text-[12px] uppercase tracking-[0.18em] border border-[#111] text-[#111] hover:bg-[#111] hover:text-white transition-colors"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-10">
                  <ProductGrid products={paged} minCount={PAGE_SIZE} />
                </div>
              )}

              {totalPages > 1 && sorted.length > 0 && (
                <div className="mt-12 flex items-center justify-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => navigate({ search: (prev: SearchParams) => ({ ...prev, page: n === 1 ? undefined : n }) })}
                      className={
                        "h-9 w-9 text-[12px] uppercase tracking-[0.18em] border transition-colors " +
                        (n === current
                          ? "bg-neutral-900 text-white border-neutral-900"
                          : "border-neutral-200 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900")
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
        <StorefrontFooter storeName={storeName} categories={categories} />
      </div>
    </StorefrontShell>
  );
}

// Silence unused warning — STOREFRONT_NAV_ITEMS is exported for future filter linking.
void STOREFRONT_NAV_ITEMS;
