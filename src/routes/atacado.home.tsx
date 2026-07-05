/**
 * /atacado/home — Catálogo Atacado (Sprint 10.8).
 *
 * Ponto de entrada do Canal Atacado para clientes aprovados. Exibe uma
 * única grade "Catálogo Atacado" (sem carrosséis de Novidades/Destaques/
 * Mais Vendidos/Todos) para evitar percepção de duplicidade quando o
 * catálogo atacado tem poucos SKUs. Reutiliza `ProductCard` e
 * `StorefrontShell` — nenhum componente do varejo é alterado.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  ProductCard,
  StorefrontShell,
} from "@/components/storefront/storefront";
import { useSalesChannel } from "@/components/storefront/sales-channel-provider";
import { useWholesaleStatus } from "@/hooks/use-wholesale-status";
import { WholesaleBadge, WholesaleMeta } from "@/components/storefront/wholesale-meta";
import {
  getStorefrontStore,
  listStorefrontProducts,
  type StorefrontProduct,
} from "@/lib/business/storefront.functions";

export const Route = createFileRoute("/atacado/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Catálogo Atacado — Layout" },
      {
        name: "description",
        content:
          "Catálogo exclusivo do Canal Atacado da Layout — preços B2B para clientes aprovados.",
      },
    ],
  }),
  component: AtacadoHome,
});

function AtacadoHome() {
  const { channel, setChannel } = useSalesChannel();
  const { authenticated, loading, isApproved } = useWholesaleStatus();

  const [products, setProducts] = useState<StorefrontProduct[] | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!authenticated || !isApproved) return;
    let cancelled = false;
    setLoadingProducts(true);
    (async () => {
      try {
        const { store } = await getStorefrontStore();
        const { rows } = await listStorefrontProducts({
          data: {
            store_id: store?.id,
            limit: 24,
            sales_channel: "wholesale",
          },
        });
        if (!cancelled) setProducts(rows);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, isApproved]);

  if (loading) {
    return (
      <StorefrontShell>
        <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
        </div>
      </StorefrontShell>
    );
  }

  // Hardening (Sprint 10.7): cookie/localStorage não são prova de
  // autorização. Sem autenticação ou aprovação validada no servidor,
  // o canal wholesale é descartado e o usuário é devolvido ao portal.
  if (!authenticated || !isApproved) {
    if (channel === "wholesale") setChannel("retail");
    return <Navigate to="/atacado" />;
  }

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
          Canal ativo: Atacado
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
          Catálogo Atacado
        </h1>
        <p className="mt-3 max-w-2xl text-base text-zinc-600">
          Produtos com preços B2B liberados para sua conta aprovada.
        </p>

        <div className="mt-10">
          {loadingProducts && products === null ? (
            <div className="flex min-h-[30vh] items-center justify-center text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando
              catálogo…
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
              {products.map((p) => (
                <div key={p.id} className="relative">
                  <div className="absolute left-3 top-3 z-20">
                    <WholesaleBadge />
                  </div>
                  <ProductCard p={p} />
                  <WholesaleMeta />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
              Nenhum produto publicado no Canal Atacado no momento.
            </div>
          )}
        </div>
      </section>
    </StorefrontShell>
  );
}
