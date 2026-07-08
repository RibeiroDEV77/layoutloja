/**
 * P6 — Painel de pendências de preço atacado.
 *
 * Lista variantes ativas de produtos wholesale/ambos que ainda NÃO têm
 * `price_list_item` na tabela `WHOLESALE-{store_id}`. Serve como relatório
 * para preenchimento manual — não inventa nem copia preços.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWholesalePriceGaps } from "@/lib/business/wholesale-pricing-gaps.functions";
import { useActiveStore } from "@/hooks/use-active-store";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/wholesale-price-gaps")({
  head: () => ({ meta: [{ title: "Preços atacado faltantes — Admin" }] }),
  component: WholesalePriceGapsPage,
});

type Row = { ok: boolean; data?: unknown; error?: { message?: string } };

function unwrap<T>(v: unknown): T {
  if (v && typeof v === "object" && "ok" in v) {
    const r = v as Row;
    if (!r.ok) throw new Error(r.error?.message ?? "Falha na consulta");
    return r.data as T;
  }
  return v as T;
}

function WholesalePriceGapsPage() {
  const { storeId } = useActiveStore();
  const fn = useServerFn(listWholesalePriceGaps);

  const q = useQuery({
    queryKey: ["wholesale-price-gaps", storeId],
    enabled: !!storeId,
    queryFn: async () => unwrap<{
      wholesale_price_list_id: string | null;
      products_missing: number;
      variants_missing: number;
      rows: Array<{
        product_id: string; product_name: string; product_slug: string;
        sale_channel: string; variant_id: string; variant_sku: string | null;
      }>;
    }>(await fn({ data: { store_id: storeId! } })),
  });

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Preços atacado faltantes</h1>
        <p className="text-sm text-muted-foreground">
          Variantes ativas de produtos <code>ambos</code> ou <code>atacado</code> sem entrada na tabela WHOLESALE.
          Sem preço, o carrinho e o checkout wholesale bloqueiam o item automaticamente.
        </p>
      </header>

      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      {q.data && (
        <>
          {!q.data.wholesale_price_list_id && (
            <div className="flex items-center gap-2 border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-3 py-2 rounded text-sm">
              <AlertTriangle className="h-4 w-4" />
              A loja não possui lista <code>WHOLESALE-{`{store_id}`}</code> ativa. Crie-a em Listas de Preço.
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Produtos com pendência" value={q.data.products_missing} tone={q.data.products_missing ? "warn" : "ok"} />
            <Stat label="Variantes sem preço" value={q.data.variants_missing} tone={q.data.variants_missing ? "warn" : "ok"} />
            <Stat label="Lista wholesale" value={q.data.wholesale_price_list_id ? "OK" : "Ausente"} tone={q.data.wholesale_price_list_id ? "ok" : "warn"} />
          </div>

          {q.data.rows.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground border border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 px-3 py-2 rounded">
              <CheckCircle2 className="h-4 w-4" /> Todas as variantes wholesale-elegíveis têm preço.
            </div>
          ) : (
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Produto</th>
                    <th className="text-left p-2">Canal</th>
                    <th className="text-left p-2">SKU</th>
                    <th className="text-left p-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.rows.map((r) => (
                    <tr key={r.variant_id} className="border-t">
                      <td className="p-2">{r.product_name}</td>
                      <td className="p-2"><code>{r.sale_channel}</code></td>
                      <td className="p-2 font-mono text-xs">{r.variant_sku ?? "—"}</td>
                      <td className="p-2">
                        <Link to="/admin/price-lists" className="text-primary underline text-xs">
                          Editar lista →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "ok" | "warn" }) {
  const cls = tone === "ok"
    ? "border-emerald-500/40 bg-emerald-500/10"
    : "border-amber-500/40 bg-amber-500/10";
  return (
    <div className={`border rounded p-3 ${cls}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
