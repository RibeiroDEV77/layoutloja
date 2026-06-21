import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  StorefrontShell, StorefrontNavbar, StorefrontFooter,
  Breadcrumb, SidebarFilter, CategoryToolbar, ProductGrid,
  type FilterGroup,
} from "@/components/storefront/storefront";
import {
  getStorefrontStore, listStorefrontCategories, listStorefrontProducts,
} from "@/lib/business/storefront.functions";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/categoria/$slug")({
  loader: async ({ params }) => {
    const { store } = await getStorefrontStore();
    const store_id = store?.id;
    const [cats, prods] = await Promise.all([
      listStorefrontCategories({ data: { store_id } }),
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
    return { store, category, subcategories, parents, products: prods.rows };
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

const FILTER_GROUPS: FilterGroup[] = [
  { key: "color", title: "Cor", options: [
    { label: "Preto", swatch: "#111" }, { label: "Branco", swatch: "#fff" },
    { label: "Cinza", swatch: "#9ca3af" }, { label: "Bege", swatch: "#d6c6a8" },
    { label: "Marinho", swatch: "#1e3a5f" }, { label: "Vinho", swatch: "#7a1f2b" },
    { label: "Verde", swatch: "#3f6b3a" }, { label: "Vermelho", swatch: "#c02633" },
  ]},
  { key: "brand", title: "Marca", options: [
    { label: "Layout", count: 42 }, { label: "Layout Premium", count: 18 },
    { label: "Layout Sport", count: 24 }, { label: "Layout Kids", count: 12 },
  ]},
  { key: "size", title: "Tamanho", options: [
    { label: "PP" }, { label: "P" }, { label: "M" }, { label: "G" },
    { label: "GG" }, { label: "XGG" }, { label: "38" }, { label: "40" },
    { label: "42" }, { label: "44" },
  ]},
  { key: "price", title: "Faixa de preço", options: [] },
  { key: "collection", title: "Coleção", options: [
    { label: "Outono Inverno 26" }, { label: "Primavera Verão 26" },
    { label: "Cápsula Atemporal" }, { label: "Edição Limitada" },
  ]},
  { key: "availability", title: "Disponibilidade", options: [
    { label: "Em estoque" }, { label: "Pré-venda" },
  ]},
];

function CategoryPage() {
  const { store, category, subcategories, parents, products } = Route.useLoaderData();
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
        <StorefrontNavbar storeName={storeName} />
        <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 lg:px-10 pt-8 pb-24">
          <Breadcrumb
            items={[
              { label: "Início", to: "/" },
              ...parents.map((p) => ({ label: p.name, to: `/categoria/${p.slug}` })),
              { label: category.name },
            ]}
          />

          {/* Título da categoria — alinhamento à esquerda em páginas internas */}
          <header className="mt-8 mb-6 max-w-3xl">
            <h1 className="font-storefront-display text-4xl md:text-5xl font-light tracking-tight text-neutral-900">
              {category.name}
            </h1>
            <p className="mt-3 text-sm font-light text-neutral-500 max-w-xl">
              Peças cuidadosamente selecionadas para compor o seu estilo.
            </p>
          </header>

          {/* Subcategorias */}
          {subcategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-8">
              {subcategories.map((s) => (
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

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-10 lg:gap-14">
            <SidebarFilter groups={FILTER_GROUPS} onClear={() => setSort("relevance")} />
            <div>
              {sorted.length === 0 ? (
                <div className="py-24 text-center">
                  <p className="text-sm font-light text-neutral-500">
                    Nenhum produto encontrado nesta categoria por enquanto.
                  </p>
                </div>
              ) : (
                <ProductGrid products={sorted} />
              )}
            </div>
          </div>
        </main>
        <StorefrontFooter storeName={storeName} />
      </div>
    </StorefrontShell>
  );
}
