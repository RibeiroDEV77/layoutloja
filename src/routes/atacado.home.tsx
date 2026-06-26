/**
 * /atacado/home — placeholder de destino do Canal Atacado (Sprint 10).
 *
 * Esta rota existe apenas como ponto de entrada estável para clientes
 * aprovados que ativam `sales_channel = wholesale` pela Top Bar ou pelo
 * Portal Atacado. O catálogo, produtos, preços, carrinho e checkout do
 * atacado serão entregues em sprints posteriores.
 */
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorefrontShell } from "@/components/storefront/storefront";
import { useSalesChannel } from "@/components/storefront/sales-channel-provider";
import { useWholesaleStatus } from "@/hooks/use-wholesale-status";

export const Route = createFileRoute("/atacado/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Canal Atacado — Home" },
      {
        name: "description",
        content: "Página inicial do Canal Atacado da Layout.",
      },
    ],
  }),
  component: AtacadoHome,
});

function AtacadoHome() {
  const { channel } = useSalesChannel();
  const { authenticated, loading, isApproved } = useWholesaleStatus();

  if (loading) {
    return (
      <StorefrontShell>
        <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
        </div>
      </StorefrontShell>
    );
  }

  // Sem aprovação → devolve ao Portal Institucional.
  if (!authenticated || !isApproved) {
    return <Navigate to="/atacado" />;
  }

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
          Canal ativo: {channel === "wholesale" ? "Atacado" : "Varejo"}
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">
          Bem-vindo ao Canal Atacado
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-600">
          Seu acesso está liberado. O catálogo, produtos e checkout do Canal
          Atacado serão disponibilizados em breve.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild className="bg-zinc-900 text-white hover:bg-zinc-800">
            <Link to="/">Ir para a loja</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/atacado">Ver portal Atacado</Link>
          </Button>
        </div>
      </section>
    </StorefrontShell>
  );
}
