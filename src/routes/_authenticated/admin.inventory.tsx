/**
 * Fase 6.1 — Etapa 3 (Inventory MVP)
 * Lista administrativa de estoque. Consome exclusivamente a Business Layer
 * (Server Functions → InventoryService → InventoryRepository). Nunca toca Supabase direto.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAdminStock,
  listAdminWarehouses,
  bulkAdjustStock,
} from "@/lib/business/inventory.functions";
import { useActiveStore } from "@/hooks/use-active-store";
import { Can } from "@/hooks/use-permissions";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
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
import { ChevronLeft, ChevronRight, Filter, X, Warehouse as WarehouseIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  head: () => ({ meta: [{ title: "Estoque — Admin" }] }),
  component: InventoryListPage,
});

const STATUS_OPTIONS: { value: string; label: string; tone: StatusTone }[] = [
  { value: "in_stock", label: "Em estoque", tone: "success" },
  { value: "low_stock", label: "Estoque baixo", tone: "warning" },
  { value: "out_of_stock", label: "Esgotado", tone: "danger" },
];

function statusInfo(s: string | null | undefined) {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? { value: s ?? "", label: s ?? "—", tone: "default" as StatusTone };
}

function fmtNumber(n: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR").format(Number(n ?? 0));
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function InventoryListPage() {
  const { storeId, loading: storeLoading } = useActiveStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const advancedEnabled = useFeatureFlag("inventory.advanced", false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustQty, setAdjustQty] = useState<string>("0");
  const [adjustReason, setAdjustReason] = useState("");

  const listFn = useServerFn(listAdminStock);
  const whFn = useServerFn(listAdminWarehouses);
  const bulkAdjustFn = useServerFn(bulkAdjustStock);

  const filters = useMemo(
    () => ({
      store_id: storeId!,
      q: q || undefined,
      stock_status:
        status !== "all" ? ([status] as Array<"in_stock" | "low_stock" | "out_of_stock">) : undefined,
      warehouse_id: warehouseId !== "all" ? warehouseId : undefined,
      page,
      pageSize,
    }),
    [storeId, q, status, warehouseId, page, pageSize],
  );

  const query = useQuery({
    queryKey: ["admin", "inventory", "list", storeId, q, status, warehouseId, page, pageSize],
    queryFn: () => listFn({ data: filters }),
    enabled: !!storeId,
  });

  const warehouses = useQuery({
    queryKey: ["admin", "inventory", "warehouses", storeId],
    queryFn: () => whFn({ data: { store_id: storeId! } }),
    enabled: !!storeId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "inventory"] });

  const bulkAdjustMut = useMutation({
    mutationFn: async () => {
      const newQuantity = Number(adjustQty);
      if (!Number.isFinite(newQuantity) || newQuantity < 0) throw new Error("Quantidade inválida");
      return bulkAdjustFn({
        data: {
          items: Array.from(selected).map((id) => ({
            stock_level_id: id,
            new_quantity: newQuantity,
            reason: adjustReason || "Ajuste em lote",
          })),
        },
      });
    },
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success(`Ajustados: ${res.data.ok_count} • Falhas: ${res.data.fail_count}`);
        setSelected(new Set());
        setAdjustOpen(false);
        setAdjustQty("0");
        setAdjustReason("");
        refresh();
      } else {
        toast.error(res?.error?.message ?? "Erro");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = query.data?.ok ? query.data.data.rows : [];
  const total = query.data?.ok ? query.data.data.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id!));
  const whOptions = warehouses.data?.ok ? warehouses.data.data : [];

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) { rows.forEach((r) => prev.delete(r.id!)); return new Set(prev); }
      rows.forEach((r) => prev.add(r.id!)); return new Set(prev);
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Posição de saldo e disponibilidade por SKU × armazém. {total > 0 && `${total} registro(s).`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por SKU, nome, código de barras..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="max-w-md"
        />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-3.5 w-3.5 mr-2" /><SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v); setPage(1); }}>
          <SelectTrigger className="w-[220px]">
            <WarehouseIcon className="h-3.5 w-3.5 mr-2" /><SelectValue placeholder="Armazém" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os armazéns</SelectItem>
            {whOptions.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
            <Can permission="inventory.manage">
              <Button size="sm" variant="secondary" onClick={() => setAdjustOpen(true)}>
                Ajustar saldo
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
        <ErrorState title="Falha ao carregar estoque" description={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : query.data && !query.data.ok ? (
        <ErrorState title="Erro" description={query.data.error.message} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sem registros de estoque"
          description="Nenhum nível de estoque corresponde aos filtros. Recebimentos e movimentações criam níveis automaticamente."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
                </TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Armazém</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Em mãos</TableHead>
                <TableHead className="text-right">Reservado</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                <TableHead>Última movimentação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const info = statusInfo(r.stock_status);
                return (
                  <TableRow
                    key={r.id!}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate({ to: "/admin/inventory/$stockLevelId", params: { stockLevelId: r.id! } })}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(r.id!)} onCheckedChange={() => toggleOne(r.id!)} aria-label="Selecionar" />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.sku ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.product_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.sku_root ?? ""}</div>
                    </TableCell>
                    <TableCell>{r.warehouse_name ?? r.warehouse_code ?? "—"}</TableCell>
                    <TableCell><StatusBadge tone={info.tone} label={info.label} dot /></TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNumber(r.quantity_on_hand)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNumber(r.quantity_reserved)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtNumber(r.quantity_available)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.last_movement_at)}</TableCell>
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

      {advancedEnabled && (
        <p className="text-xs text-muted-foreground">
          Modo avançado ativo: transferências, inventário cíclico e múltiplos CDs estarão disponíveis nas próximas etapas.
        </p>
      )}

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar saldo de {selected.size} nível(is)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Novo saldo (em mãos)</label>
              <Input
                type="number" min={0}
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A diferença será registrada como ajuste positivo ou negativo, com movimentação no Stock Engine.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Motivo</label>
              <Textarea
                rows={3}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Ex.: conferência operacional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)}>Voltar</Button>
            <Button
              disabled={bulkAdjustMut.isPending}
              onClick={() => bulkAdjustMut.mutate()}
            >
              Confirmar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
