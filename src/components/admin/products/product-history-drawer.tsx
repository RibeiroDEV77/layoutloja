/**
 * Histórico de eventos e auditoria do produto (Fase 4.2C).
 * Lê via Server Functions — sem acesso direto ao banco.
 */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { listProductHistory, listProductAudit } from "@/lib/business/products.functions";

export function ProductHistoryDrawer({
  productId, mode, onClose,
}: { productId: string; mode: "history" | "audit" | null; onClose: () => void }) {
  const open = mode !== null;
  const fnHist = useServerFn(listProductHistory);
  const fnAudit = useServerFn(listProductAudit);

  const query = useQuery({
    queryKey: ["product-history", productId, mode],
    enabled: open,
    queryFn: async () => {
      if (mode === "history") {
        const r = await fnHist({ data: { id: productId } });
        if (!r.ok) throw new Error(r.error.message);
        return r.data;
      } else {
        const r = await fnAudit({ data: { id: productId } });
        if (!r.ok) throw new Error(r.error.message);
        return r.data;
      }
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>{mode === "audit" ? "Auditoria" : "Histórico de eventos"}</SheetTitle>
          <SheetDescription>
            {mode === "audit"
              ? "Alterações registradas automaticamente para este produto."
              : "Eventos de domínio emitidos por este produto."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto mt-4 space-y-2">
          {query.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !query.data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-12">Sem registros.</p>
          ) : (
            (query.data as Array<Record<string, unknown>>).map((raw) => {
              const e = raw as { id: string; event_type?: string; action?: string; created_at: string; payload?: unknown; diff?: unknown };
              const label = mode === "history" ? e.event_type : e.action;
              const body = mode === "history" ? e.payload : e.diff;
              return (
                <div key={e.id} className="rounded-md border p-3 text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <code className="font-mono text-xs text-primary">{label}</code>
                    <span className="text-xs text-muted-foreground">{fmt(e.created_at)}</span>
                  </div>
                  {body != null && Object.keys(body as object).length > 0 && (
                    <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-40 overflow-auto">
                      {JSON.stringify(body, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function fmt(s: string) {
  try { return new Date(s).toLocaleString("pt-BR"); } catch { return s; }
}
