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
    <StorefrontShell>
      <div className="min-h-screen flex flex-col bg-white">
        <StorefrontNavbar storeName={storeName} />
        <main className="flex-1">
          <StorefrontHero storeName={storeName} />
          <LooksSlider />
          <CategoryCards categories={categories} />
          <ProductSection
            title="Novidades"
            subtitle="Acaba de chegar"
            products={novidades}
            emptyMessage="Em breve, novas peças."
          />
          <ProductSection
            title="Seleção em oferta"
            subtitle="Por tempo limitado"
            products={promocoes}
            emptyMessage="Nenhuma peça em oferta no momento."
            tone="soft"
          />
          <ProductSection
            title="Destaques"
            subtitle="Curadoria"
            products={destaques}
            emptyMessage="Em breve, peças em destaque."
          />
        </main>
        <StorefrontFooter storeName={storeName} />
      </div>
    </StorefrontShell>
  );
}
