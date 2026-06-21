import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listOrders, cancelOrder, bulkCancelOrders, bulkAddOrderTag,
} from "@/lib/business/orders.functions";
import { useActiveStore } from "@/hooks/use-active-store";
import { Can } from "@/hooks/use-permissions";
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorState } from "@/components/admin/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Filter, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({ meta: [{ title: "Pedidos — Admin" }] }),
  component: OrdersListPage,
});

const STATUS_OPTIONS: { value: string; label: string; tone: StatusTone }[] = [
  { value: "draft", label: "Rascunho", tone: "muted" },
  { value: "pending_payment", label: "Aguardando pagamento", tone: "warning" },
  { value: "authorized", label: "Autorizado", tone: "info" },
  { value: "paid", label: "Pago", tone: "success" },
  { value: "on_hold", label: "Em espera", tone: "warning" },
  { value: "awaiting_fulfillment", label: "Aguardando separação", tone: "info" },
  { value: "partially_fulfilled", label: "Parc. separado", tone: "info" },
  { value: "fulfilled", label: "Separado", tone: "info" },
  { value: "awaiting_shipment", label: "Aguardando envio", tone: "info" },
  { value: "partially_shipped", label: "Parc. enviado", tone: "info" },
  { value: "shipped", label: "Enviado", tone: "info" },
  { value: "delivered", label: "Entregue", tone: "success" },
  { value: "completed", label: "Concluído", tone: "success" },
  { value: "cancelled", label: "Cancelado", tone: "danger" },
  { value: "refunded", label: "Reembolsado", tone: "danger" },
  { value: "partially_refunded", label: "Parc. reembolsado", tone: "warning" },
  { value: "returned", label: "Devolvido", tone: "danger" },
];

function statusInfo(s: string) {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? { value: s, label: s, tone: "default" as StatusTone };
}

function fmtMoney(n: number | null | undefined, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n ?? 0);
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function OrdersListPage() {
  const { storeId, loading: storeLoading } = useActiveStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [bulkTag, setBulkTag] = useState("");

  const listFn = useServerFn(listOrders);
  const cancelFn = useServerFn(cancelOrder);
  const bulkCancelFn = useServerFn(bulkCancelOrders);
  const bulkTagFn = useServerFn(bulkAddOrderTag);

  const filters = useMemo(
    () => ({
      store_id: storeId!,
      q: q || undefined,
      status: status !== "all" ? [status] : undefined,
      page,
      pageSize,
    }),
    [storeId, q, status, page, pageSize],
  );

  const query = useQuery({
    queryKey: ["admin", "orders", "list", storeId, q, status, page, pageSize],
    queryFn: () => listFn({ data: filters }),
    enabled: !!storeId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "orders"] });

  const cancelMut = useMutation({
    mutationFn: async (vars: { order_id: string; reason: string }) => cancelFn({ data: vars }),
    onSuccess: (res) => {
      if (res?.ok) { toast.success("Pedido cancelado"); refresh(); }
      else toast.error(res?.error?.message ?? "Falha ao cancelar");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkCancelMut = useMutation({
    mutationFn: async () => bulkCancelFn({ data: { order_ids: Array.from(selected), reason: cancelReason } }),
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success(`Cancelados: ${res.data.ok_count} • Falhas: ${res.data.fail_count}`);
        setSelected(new Set());
        setCancelDialogOpen(false);
        setCancelReason("");
        refresh();
      } else toast.error(res?.error?.message ?? "Erro");
    },
  });

  const bulkTagMut = useMutation({
    mutationFn: async () => bulkTagFn({ data: { order_ids: Array.from(selected), tag: bulkTag } }),
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success(`Tag aplicada em ${res.data.ok_count} pedidos`);
        setSelected(new Set());
        setBulkTag("");
        refresh();
      } else toast.error(res?.error?.message ?? "Erro");
    },
  });

  const rows = query.data?.ok ? query.data.data.rows : [];
  const total = query.data?.ok ? query.data.data.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) { rows.forEach((r) => prev.delete(r.id)); return new Set(prev); }
      rows.forEach((r) => prev.add(r.id)); return new Set(prev);
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gestão de pedidos da loja. {total > 0 && `${total} registro(s).`}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Input
            placeholder="Buscar por número, cliente, email ou telefone..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="max-w-md"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[220px]"><Filter className="h-3.5 w-3.5 mr-2" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
            <Can permission="orders.write">
              <Input
                placeholder="Aplicar tag..."
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                className="w-[160px] h-9"
              />
              <Button size="sm" variant="secondary" disabled={!bulkTag || bulkTagMut.isPending} onClick={() => bulkTagMut.mutate()}>
                Aplicar tag
              </Button>
            </Can>
            <Can permission="orders.cancel">
              <Button size="sm" variant="destructive" onClick={() => setCancelDialogOpen(true)}>
                Cancelar selecionados
              </Button>
            </Can>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {storeLoading || query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : query.error ? (
        <ErrorState title="Falha ao carregar pedidos" description={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : query.data && !query.data.ok ? (
        <ErrorState title="Erro" description={query.data.error.message} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Sem pedidos" description="Nenhum pedido corresponde aos filtros atuais." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
                </TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const info = statusInfo(o.status);
                return (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/admin/orders/$orderId", params: { orderId: o.id } })}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleOne(o.id)} aria-label="Selecionar" />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{o.customer_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{o.customer_email ?? ""}</div>
                    </TableCell>
                    <TableCell><StatusBadge tone={info.tone} label={info.label} dot /></TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(Number(o.total), o.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.items_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(o.placed_at ?? o.created_at)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Can permission="orders.cancel">
                        {!["cancelled", "delivered", "completed", "refunded", "returned", "shipped"].includes(o.status) && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              const reason = window.prompt("Motivo do cancelamento:");
                              if (reason) cancelMut.mutate({ order_id: o.id, reason });
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                      </Can>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
            <span className="text-muted-foreground">Página {page} de {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar {selected.size} pedido(s)</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo</label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder="Ex.: solicitação do cliente" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" disabled={!cancelReason.trim() || bulkCancelMut.isPending} onClick={() => bulkCancelMut.mutate()}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
