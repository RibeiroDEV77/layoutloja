import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { User, Package, MapPin, IdCard, Heart, LogOut } from "lucide-react";

import { StorefrontShell } from "@/components/storefront/storefront";
import { useAuth } from "@/hooks/use-auth";
import { openAccountSheet } from "@/hooks/use-storefront-customer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/minha-conta")({
  ssr: false,
  head: () => ({ meta: [{ title: "Minha conta" }] }),
  component: AccountLayout,
});

const NAV = [
  { to: "/minha-conta", label: "Resumo", icon: User, exact: true },
  { to: "/minha-conta/pedidos", label: "Meus pedidos", icon: Package },
  { to: "/minha-conta/enderecos", label: "Endereços", icon: MapPin },
  { to: "/minha-conta/dados", label: "Dados pessoais", icon: IdCard },
  { to: "/minha-conta/favoritos", label: "Favoritos", icon: Heart },
];

function AccountLayout() {
  const { ctx, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !ctx?.authenticated) {
      navigate({ to: "/", replace: true });
      // abre o modal de login
      setTimeout(() => openAccountSheet(), 100);
    }
  }, [loading, ctx?.authenticated, navigate]);

  if (loading || !ctx?.authenticated) {
    return (
      <StorefrontShell>
        <div className="flex min-h-[60vh] items-center justify-center text-zinc-500">Carregando…</div>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900">Minha conta</h1>
        <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr]">
          <aside className="rounded-lg border border-zinc-200 bg-white p-3 h-fit">
            <nav className="flex flex-col gap-1">
              {NAV.map((it) => {
                const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                      active
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700 hover:bg-zinc-100",
                    )}
                  >
                    <it.icon className="h-4 w-4" />
                    {it.label}
                  </Link>
                );
              })}
              <Button
                variant="ghost"
                className="justify-start gap-3 px-3 text-zinc-700 hover:bg-zinc-100"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </nav>
          </aside>
          <section className="min-w-0">
            <Outlet />
          </section>
        </div>
      </div>
    </StorefrontShell>
  );
}
