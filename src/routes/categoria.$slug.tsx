import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  StorefrontShell, StorefrontNavbar, StorefrontFooter,
  Breadcrumb, CategoryToolbar, ProductGrid,
} from "@/components/storefront/storefront";
import {
  getStorefrontStore, listStorefrontCategories, listStorefrontProducts,
  listStorefrontBrands,
  type StorefrontCategory,
} from "@/lib/business/storefront.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/categoria/$slug")({
  loader: async ({ params }) => {
    const { store } = await getStorefrontStore();
    const store_id = store?.id;
    const [cats, brands, prods] = await Promise.all([
      listStorefrontCategories({ data: { store_id } }),
      listStorefrontBrands({ data: { store_id } }),
      listStorefrontProducts({ data: { store_id, limit: 24 } }),
    ]);
    const category = cats.rows.find((c) => c.slug === params.slug);
    if (!category) throw notFound();
    const subcategories = cats.rows.filter((c) => c.parent_id === category.id);
    const parents: typeof cats.rows = [];
    let p = category.parent_id;
    while (p) {
      const parent = cats.rows.find((c) => c.id === p);
      if (!parent) break;
      parents.unshift(parent);
      p = parent.parent_id;
    }
    return { store, category, subcategories, parents, products: prods.rows, categories: cats.rows, brands: brands.rows };
  },

  head: ({ loaderData }) => {
    const name = loaderData?.category.name ?? "Categoria";
    return {
      meta: [
        { title: `${name} — Layout` },
        { property: "og:title", content: `${name} — Layout` },
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

function CategoryPage() {
  const { store, category, subcategories, parents, products, categories, brands } = Route.useLoaderData();
  const storeName = store?.name ?? "Layout";
  const [sort, setSort] = useState("relevance");

  const sorted = useMemo(() => {
    const arr = [...products];
    if (sort === "new") arr.sort((a, b) => Number(b.new_product) - Number(a.new_product));
    if (sort === "best") arr.sort((a, b) => Number(b.best_seller) - Number(a.best_seller));
    return arr;
  }, [products, sort]);

  return (
    <StorefrontShell>
      <div className="min-h-screen flex flex-col bg-white">
        <StorefrontNavbar categories={categories} brands={brands} />

        <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 lg:px-10 pt-8 pb-24">
          <Breadcrumb
            items={[
              { label: "Início", to: "/" },
              ...parents.map((p: StorefrontCategory) => ({ label: p.name, to: `/categoria/${p.slug}` })),
              { label: category.name },
            ]}
          />

          <header className="mt-8 mb-8 max-w-3xl">
            <h1 className="font-storefront-display text-4xl md:text-5xl font-light tracking-tight text-neutral-900">
              {category.name}
            </h1>
          </header>

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

          <div className="mt-10">
            {sorted.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-sm font-light text-neutral-500">
                  Nenhum produto cadastrado nesta categoria.
                </p>
              </div>
            ) : (
              <ProductGrid products={sorted} />
            )}
          </div>
        </main>
        <StorefrontFooter storeName={storeName} categories={categories} />
      </div>
    </StorefrontShell>
  );
}
