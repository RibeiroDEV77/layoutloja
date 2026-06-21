import { createFileRoute } from "@tanstack/react-router";
import {
  StorefrontShell, StorefrontNavbar, StorefrontHero, LooksSlider,
  CategoryCards, ProductSection, StorefrontFooter,
} from "@/components/storefront/storefront";
import {
  getStorefrontStore, listStorefrontCategories, listStorefrontProducts,
} from "@/lib/business/storefront.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Layout — Loja de moda" },
      { name: "description", content: "Moda autoral: novidades, promoções e looks exclusivos." },
      { property: "og:title", content: "Layout — Loja de moda" },
      { property: "og:description", content: "Moda autoral: novidades, promoções e looks exclusivos." },
    ],
  }),
  loader: async () => {
    const { store } = await getStorefrontStore();
    const store_id = store?.id;
    const [cats, novos, promo, destaque] = await Promise.all([
      listStorefrontCategories({ data: { store_id } }),
      listStorefrontProducts({ data: { store_id, flag: "new", limit: 8 } }),
      listStorefrontProducts({ data: { store_id, flag: "sale", limit: 8 } }),
      listStorefrontProducts({ data: { store_id, flag: "featured", limit: 8 } }),
    ]);
    return {
      store,
      categories: cats.rows,
      novidades: novos.rows,
      promocoes: promo.rows,
      destaques: destaque.rows,
    };
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">{error.message}</div>
  ),
  component: HomePage,
});

function HomePage() {
  const { store, categories, novidades, promocoes, destaques } = Route.useLoaderData();
  const storeName = store?.name ?? "Layout";
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <StorefrontNavbar storeName={storeName} />
      <main className="flex-1">
        <StorefrontHero storeName={storeName} />
        <LooksSlider />
        <CategoryCards categories={categories} />
        <ProductSection
          title="Novidades"
          subtitle="Acabou de chegar"
          products={novidades}
          emptyMessage="Nenhuma novidade publicada ainda."
        />
        <ProductSection
          title="Promoções"
          subtitle="Ofertas por tempo limitado"
          products={promocoes}
          emptyMessage="Nenhum produto em promoção no momento."
        />
        <ProductSection
          title="Produtos em destaque"
          subtitle="Selecionados pela curadoria"
          products={destaques}
          emptyMessage="Nenhum destaque selecionado ainda."
        />
      </main>
      <StorefrontFooter storeName={storeName} />
    </div>
  );
}
