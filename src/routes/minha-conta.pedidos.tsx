import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { listMyOrders } from "@/lib/business/storefront-account.functions";

export const Route = createFileRoute("/minha-conta/pedidos")({
  component: OrdersPage,
});

function OrdersPage() {
  const { ctx } = useAuth();
  const userId = ctx?.authenticated ? ctx.user_id : undefined;
  const fetchOrders = useServerFn(listMyOrders);
  const { data, isLoading } = useQuery({
    queryKey: ["orders", userId ?? "anon", "list"],
    queryFn: () => fetchOrders(),
    enabled: !!userId,
  });

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-900">Meus pedidos</h2>
      <div className="mt-4 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-zinc-500">Carregando…</div>
        ) : !data || data.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            Você ainda não tem pedidos.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Pedido</th>
                <th className="text-left px-4 py-2">Data</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o: any) => (
                <tr key={o.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-medium text-zinc-900">{o.code ?? o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{o.status}</td>
                  <td className="px-4 py-3 text-right text-zinc-900">
                    {Number(o.total_amount ?? 0).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: o.currency ?? "BRL",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
