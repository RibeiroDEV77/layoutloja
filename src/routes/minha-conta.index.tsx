import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, MapPin, IdCard, Heart } from "lucide-react";
import { useStorefrontCustomer } from "@/hooks/use-storefront-customer";

export const Route = createFileRoute("/minha-conta/")({
  component: AccountIndex,
});

function AccountIndex() {
  const { data, isLoading } = useStorefrontCustomer();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">
          Olá{data?.customer.name ? `, ${data.customer.name.split(" ")[0]}` : ""}!
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          {isLoading ? "Carregando…" : "Acesse os atalhos abaixo para gerenciar sua conta."}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { to: "/minha-conta/pedidos", icon: Package, label: "Meus pedidos", desc: "Acompanhe e revise compras." },
          { to: "/minha-conta/enderecos", icon: MapPin, label: "Endereços", desc: "Cadastros para entrega." },
          { to: "/minha-conta/dados", icon: IdCard, label: "Dados pessoais", desc: "Nome, CPF, telefone." },
          { to: "/minha-conta/favoritos", icon: Heart, label: "Favoritos", desc: "Produtos salvos." },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 transition"
          >
            <div className="flex items-center gap-3">
              <c.icon className="h-5 w-5 text-zinc-600" />
              <span className="text-sm font-medium text-zinc-900">{c.label}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-2">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
