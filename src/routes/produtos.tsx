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

type SearchParams = { sort?: string; page?: number };

const PAGE_SIZE = 12;

export const Route = createFileRoute("/produtos")({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const out: SearchParams = {};
    if (typeof search.sort === "string") out.sort = search.sort;
    if (typeof search.page === "number" && search.page > 0) out.page = search.page;
    return out;
  },
  loader: async () => {
    const { store } = await getStorefrontStore();
    const store_id = store?.id;
    const [cats, brands, prods] = await Promise.all([
      listStorefrontCategories({ data: { store_id } }),
      listStorefrontBrands({ data: { store_id } }),
      listStorefrontProducts({ data: { store_id, limit: 24 } }),
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

function AllProductsPage() {
  const { store, categories, brands, products } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/produtos" });
  const storeName = store?.name ?? "Layout";

  const sort = search.sort ?? "relevance";
  const page = search.page ?? 1;

  const setSort = (s: string) =>
    navigate({ search: (prev: SearchParams) => ({ ...prev, sort: s === "relevance" ? undefined : s, page: undefined }) });

  const sorted = useMemo(() => {
    const arr = [...products];
    if (sort === "new") arr.sort((a, b) => Number(b.new_product) - Number(a.new_product));
    if (sort === "best") arr.sort((a, b) => Number(b.best_seller) - Number(a.best_seller));
    return arr;
  }, [products, sort]);

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

          <CategoryToolbar count={sorted.length} sort={sort} onSortChange={setSort} />

          <div className="mt-10">
            <ProductGrid products={paged} minCount={PAGE_SIZE} />
          </div>

          {totalPages > 1 && (
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
        </main>
        <StorefrontFooter storeName={storeName} categories={categories} />
      </div>
    </StorefrontShell>
  );
}
