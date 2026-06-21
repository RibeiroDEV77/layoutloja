/**
 * Fase 6.1 — Etapa 3 (Inventory MVP)
 * Detalhe de um nível de estoque (SKU × armazém) com abas:
 * Resumo, Movimentações, Reservas, Histórico (timeline derivada de movimentações).
 *
 * Apenas Server Functions; nada de Supabase direto.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminStock,
  getStockMovements,
  getStockReservations,
  bulkAdjustStock,
} from "@/lib/business/inventory.functions";
import { Can } from "@/hooks/use-permissions";
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorState } from "@/components/admin/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/inventory/$stockLevelId")({
  head: () => ({ meta: [{ title: "Detalhe de estoque — Admin" }] }),
  component: InventoryDetailPage,
});

function fmtNumber(n: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR").format(Number(n ?? 0));
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const MOVEMENT_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  adjustment_in: { label: "Ajuste +", tone: "info" },
  adjustment_out: { label: "Ajuste −", tone: "warning" },
  loss: { label: "Perda", tone: "danger" },
  production: { label: "Produção", tone: "success" },
  reservation: { label: "Reserva", tone: "muted" },
  release: { label: "Liberação", tone: "muted" },
  transfer_in: { label: "Transferência ↓", tone: "info" },
  transfer_out: { label: "Transferência ↑", tone: "info" },
  inventory_count: { label: "Inventário", tone: "default" },
};

const STATUS_TONES: Record<string, { label: string; tone: StatusTone }> = {
  in_stock: { label: "Em estoque", tone: "success" },
  low_stock: { label: "Estoque baixo", tone: "warning" },
  out_of_stock: { label: "Esgotado", tone: "danger" },
};

const RESERVATION_TONES: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Ativa", tone: "info" },
  released: { label: "Liberada", tone: "muted" },
  consumed: { label: "Consumida", tone: "success" },
  expired: { label: "Expirada", tone: "warning" },
};

function InventoryDetailPage() {
  const { stockLevelId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getAdminStock);
  const movFn = useServerFn(getStockMovements);
  const resFn = useServerFn(getStockReservations);
  const adjustFn = useServerFn(bulkAdjustStock);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustQty, setAdjustQty] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");

  const detail = useQuery({
    queryKey: ["admin", "inventory", "detail", stockLevelId],
    queryFn: () => getFn({ data: { id: stockLevelId } }),
  });

  const movements = useQuery({
    queryKey: ["admin", "inventory", "movements", stockLevelId],
    queryFn: () => movFn({ data: { id: stockLevelId, limit: 200 } }),
  });

  const reservations = useQuery({
    queryKey: ["admin", "inventory", "reservations", stockLevelId],
    queryFn: () => resFn({ data: { id: stockLevelId, limit: 200 } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "inventory"] });

  const adjustMut = useMutation({
    mutationFn: async () => {
      const newQuantity = Number(adjustQty);
      if (!Number.isFinite(newQuantity) || newQuantity < 0) throw new Error("Quantidade inválida");
      return adjustFn({
        data: {
          items: [{ stock_level_id: stockLevelId, new_quantity: newQuantity, reason: adjustReason }],
        },
      });
    },
    onSuccess: (res) => {
      if (res?.ok && res.data.ok_count > 0) {
        toast.success("Ajuste registrado");
        setAdjustOpen(false);
        setAdjustReason("");
        refresh();
      } else {
        toast.error(res?.ok ? (res.data.results[0]?.error ?? "Erro") : (res?.error?.message ?? "Erro"));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (detail.error) {
    return <ErrorState title="Falha ao carregar" description={(detail.error as Error).message} onRetry={() => detail.refetch()} />;
  }
  if (detail.data && !detail.data.ok) {
    return <ErrorState title="Erro" description={detail.data.error.message} onRetry={() => detail.refetch()} />;
  }
  const row = detail.data?.ok ? detail.data.data : null;
  if (!row) return <EmptyState title="Não encontrado" description="Este nível de estoque não existe." />;

  const status = STATUS_TONES[row.stock_status ?? ""] ?? { label: row.stock_status ?? "—", tone: "default" as StatusTone };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/inventory" })}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{row.product_name ?? "—"}</h1>
          <p className="text-sm text-muted-foreground font-mono">{row.sku ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={status.tone} label={status.label} dot />
          <Can permission="inventory.manage">
            <Button onClick={() => { setAdjustQty(String(row.quantity_on_hand ?? 0)); setAdjustOpen(true); }}>
              Ajustar saldo
            </Button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Em mãos" value={fmtNumber(row.quantity_on_hand)} />
        <SummaryCard label="Reservado" value={fmtNumber(row.quantity_reserved)} />
        <SummaryCard label="Disponível" value={fmtNumber(row.quantity_available)} highlight />
        <SummaryCard label="A receber" value={fmtNumber(row.quantity_incoming)} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Resumo</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="reservations">Reservas</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Produto">
                <Link
                  to="/admin/products/$id/edit"
                  params={{ id: row.product_id! }}
                  className="text-primary hover:underline"
                >
                  {row.product_name ?? "—"}
                </Link>
              </Field>
              <Field label="SKU raiz">{row.sku_root ?? "—"}</Field>
              <Field label="SKU variante" mono>{row.sku ?? "—"}</Field>
              <Field label="Código de barras" mono>{row.barcode ?? "—"}</Field>
              <Field label="Referência interna" mono>{row.internal_reference ?? "—"}</Field>
              <Field label="Status do produto">{row.product_status ?? "—"}</Field>
              <Field label="Armazém">{row.warehouse_name ?? row.warehouse_code ?? "—"}</Field>
              <Field label="Última movimentação">{fmtDate(row.last_movement_at)}</Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Política de reabastecimento</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Ponto de reposição">{row.reorder_point != null ? fmtNumber(row.reorder_point) : "—"}</Field>
              <Field label="Quantidade de reposição">{row.reorder_quantity != null ? fmtNumber(row.reorder_quantity) : "—"}</Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <MovementsTable
            loading={movements.isLoading}
            error={movements.error as Error | null}
            data={movements.data?.ok ? movements.data.data : []}
            onRetry={() => movements.refetch()}
          />
        </TabsContent>

        <TabsContent value="reservations">
          <ReservationsTable
            loading={reservations.isLoading}
            error={reservations.error as Error | null}
            data={reservations.data?.ok ? reservations.data.data : []}
            onRetry={() => reservations.refetch()}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTimeline
            loading={movements.isLoading}
            data={movements.data?.ok ? movements.data.data : []}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar saldo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Novo saldo (em mãos)</label>
              <Input type="number" min={0} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Motivo</label>
              <Textarea rows={3} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Ex.: conferência operacional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)}>Voltar</Button>
            <Button disabled={adjustMut.isPending} onClick={() => adjustMut.mutate()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl tabular-nums font-semibold mt-1 ${highlight ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{children}</div>
    </div>
  );
}

function MovementsTable({
  loading, error, data, onRetry,
}: {
  loading: boolean; error: Error | null;
  data: Array<{ id: string; movement_type: string; quantity: number; unit_cost: number | null; reference_type: string | null; reference_id: string | null; notes: string | null; occurred_at: string | null; created_at: string }>;
  onRetry: () => void;
}) {
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error) return <ErrorState title="Falha ao carregar movimentações" description={error.message} onRetry={onRetry} />;
  if (!data.length) return <EmptyState title="Sem movimentações" description="Ainda não há movimentações registradas para este SKU neste armazém." />;
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Qtd.</TableHead>
            <TableHead className="text-right">Custo unit.</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Notas</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((m) => {
            const info = MOVEMENT_LABELS[m.movement_type] ?? { label: m.movement_type, tone: "default" as StatusTone };
            return (
              <TableRow key={m.id}>
                <TableCell><StatusBadge tone={info.tone} label={info.label} /></TableCell>
                <TableCell className="text-right tabular-nums">{fmtNumber(m.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{m.unit_cost != null ? fmtNumber(m.unit_cost) : "—"}</TableCell>
                <TableCell className="text-xs">{m.reference_type ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">{m.notes ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(m.occurred_at ?? m.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ReservationsTable({
  loading, error, data, onRetry,
}: {
  loading: boolean; error: Error | null;
  data: Array<{ id: string; status: string; qty: number; cart_id: string | null; order_id: string | null; expires_at: string | null; created_at: string }>;
  onRetry: () => void;
}) {
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error) return <ErrorState title="Falha ao carregar reservas" description={error.message} onRetry={onRetry} />;
  if (!data.length) return <EmptyState title="Sem reservas" description="Nenhuma reserva ativa ou histórica para este SKU neste armazém." />;
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Qtd.</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Expira em</TableHead>
            <TableHead>Criada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => {
            const info = RESERVATION_TONES[r.status] ?? { label: r.status, tone: "default" as StatusTone };
            return (
              <TableRow key={r.id}>
                <TableCell><StatusBadge tone={info.tone} label={info.label} dot /></TableCell>
                <TableCell className="text-right tabular-nums">{fmtNumber(r.qty)}</TableCell>
                <TableCell className="text-xs">
                  {r.order_id ? `Pedido` : r.cart_id ? `Carrinho` : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(r.expires_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function HistoryTimeline({
  loading, data,
}: {
  loading: boolean;
  data: Array<{ id: string; movement_type: string; quantity: number; notes: string | null; occurred_at: string | null; created_at: string }>;
}) {
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!data.length) return <EmptyState title="Sem histórico" description="Nada registrado." />;
  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {data.map((m) => {
        const info = MOVEMENT_LABELS[m.movement_type] ?? { label: m.movement_type, tone: "default" as StatusTone };
        return (
          <li key={m.id} className="ml-4">
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
            <div className="flex items-center gap-2">
              <StatusBadge tone={info.tone} label={info.label} />
              <span className="text-sm tabular-nums">{fmtNumber(m.quantity)}</span>
              <span className="text-xs text-muted-foreground ml-auto">{fmtDate(m.occurred_at ?? m.created_at)}</span>
            </div>
            {m.notes && <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>}
          </li>
        );
      })}
    </ol>
  );
}
