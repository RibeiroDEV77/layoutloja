import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPurchaseOrder, getPurchaseOrderTimeline, getPurchaseOrderAudit,
  approvePurchaseOrder, cancelPurchaseOrder, receivePurchaseOrder,
} from "@/lib/business/purchases.functions";
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge";
import { ErrorState } from "@/components/admin/error-state";
import { EmptyState } from "@/components/admin/empty-state";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/purchases/$poId")({
  head: ({ params }) => ({ meta: [{ title: `OC ${params.poId.slice(0, 8)} — Admin` }] }),
  component: PurchaseDetailPage,
});

const STATUS_TONE: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Rascunho", tone: "muted" },
  sent: { label: "Enviada", tone: "info" },
  confirmed: { label: "Confirmada", tone: "info" },
  partially_received: { label: "Parc. recebida", tone: "warning" },
  received: { label: "Recebida", tone: "success" },
  closed: { label: "Encerrada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
};

function fmtMoney(n: unknown, c = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(Number(n ?? 0));
}
function fmtDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleString("pt-BR") : "—";
}

function PurchaseDetailPage() {
  const { poId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getPurchaseOrder);
  const getTimelineFn = useServerFn(getPurchaseOrderTimeline);
  const getAuditFn = useServerFn(getPurchaseOrderAudit);
  const approveFn = useServerFn(approvePurchaseOrder);
  const cancelFn = useServerFn(cancelPurchaseOrder);
  const receiveFn = useServerFn(receivePurchaseOrder);

  const detail = useQuery({
    queryKey: ["admin", "purchases", "detail", poId],
    queryFn: () => getFn({ data: { id: poId } }),
  });
  const timeline = useQuery({
    queryKey: ["admin", "purchases", "timeline", poId],
    queryFn: () => getTimelineFn({ data: { id: poId } }),
  });
  const audit = useQuery({
    queryKey: ["admin", "purchases", "audit", poId],
    queryFn: () => getAuditFn({ data: { id: poId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "purchases"] });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [receiveItems, setReceiveItems] = useState<Record<string, { received: number; accepted: number }>>({});

  const approveMut = useMutation({
    mutationFn: () => approveFn({ data: { id: poId } }),
    onSuccess: (r: any) => {
      if (r?.ok) { toast.success("OC aprovada"); refresh(); }
      else toast.error(r?.error?.message ?? "Erro ao aprovar");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { id: poId, reason: cancelReason } }),
    onSuccess: (r: any) => {
      if (r?.ok) { toast.success("OC cancelada"); setCancelOpen(false); setCancelReason(""); refresh(); }
      else toast.error(r?.error?.message ?? "Erro ao cancelar");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const receiveMut = useMutation({
    mutationFn: async () => {
      const items = Object.entries(receiveItems)
        .filter(([, v]) => v.received > 0)
        .map(([id, v]) => ({
          purchase_order_item_id: id,
          quantity_received: v.received,
          quantity_accepted: v.accepted,
        }));
      if (!items.length) throw new Error("Informe ao menos um item recebido");
      if (!warehouseId.trim()) throw new Error("Depósito obrigatório");
      if (!receiptNumber.trim()) throw new Error("Número do recebimento obrigatório");
      return receiveFn({ data: { purchase_order_id: poId, warehouse_id: warehouseId.trim(), receipt_number: receiptNumber.trim(), items } });
    },
    onSuccess: (r: any) => {
      if (r?.ok) {
        toast.success("Recebimento registrado");
        setReceiveOpen(false); setReceiveItems({}); setReceiptNumber(""); setWarehouseId("");
        refresh();
      } else toast.error(r?.error?.message ?? "Erro");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = useMemo(() => (detail.data && (detail.data as any).ok ? (detail.data as any).data : null), [detail.data]);

  if (detail.isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (detail.error) return <ErrorState title="Falha" description={(detail.error as Error).message} onRetry={() => detail.refetch()} />;
  if (detail.data && !(detail.data as any).ok) {
    return <ErrorState title="Falha" description={(detail.data as any).error.message} onRetry={() => detail.refetch()} />;
  }
  if (!data) return <EmptyState title="OC não encontrada" />;

  const { po, items, receipts, supplier } = data;
  const statusInfo = STATUS_TONE[po.status] ?? { label: po.status, tone: "default" as StatusTone };
  const canApprove = po.status === "draft";
  const canCancel = !["received", "cancelled", "closed"].includes(po.status);
  const canReceive = ["sent", "confirmed", "partially_received"].includes(po.status);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/purchases" })} className="mb-2 -ml-2">
            <ArrowLeft className="size-4 mr-1" /> Compras
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">OC {po.po_number}</h1>
            <StatusBadge label={statusInfo.label} tone={statusInfo.tone} dot />
          </div>
          <p className="text-sm text-muted-foreground">
            {supplier?.trade_name ?? supplier?.legal_name ?? "—"} • emitida em {fmtDate(po.order_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission="purchases.manage">
            {canApprove && (
              <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                Aprovar
              </Button>
            )}
            {canReceive && (
              <Button variant="default" onClick={() => {
                setReceiveOpen(true);
                setReceiveItems(Object.fromEntries(items.map((i: any) => {
                  const remaining = Number(i.quantity_ordered) - Number(i.quantity_received ?? 0);
                  return [i.id, { received: remaining, accepted: remaining }];
                })));
              }}>Receber</Button>
            )}
            {canCancel && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>Cancelar</Button>
            )}
          </Can>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{fmtMoney(po.total_amount, po.currency)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Itens</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{items.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Prevista</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{fmtDate(po.expected_date)}</CardContent></Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Itens</TabsTrigger>
          <TabsTrigger value="receipts">Recebimentos ({receipts.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Custo unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.variant_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-right">{Number(i.quantity_ordered)}</TableCell>
                    <TableCell className="text-right">{Number(i.quantity_received ?? 0)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(i.unit_cost, po.currency)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(i.total_amount, po.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="receipts">
          {receipts.length === 0 ? (
            <EmptyState title="Nenhum recebimento registrado" />
          ) : (
            <div className="space-y-3">
              {receipts.map((gr: any) => (
                <Card key={gr.id}>
                  <CardHeader>
                    <CardTitle className="text-base">#{gr.receipt_number} <span className="text-xs font-normal text-muted-foreground">{fmtDate(gr.received_at)}</span></CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Variante</TableHead>
                        <TableHead className="text-right">Recebido</TableHead>
                        <TableHead className="text-right">Aceito</TableHead>
                        <TableHead className="text-right">Rejeitado</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {(gr.goods_receipt_items ?? []).map((it: any) => (
                          <TableRow key={it.id}>
                            <TableCell className="font-mono text-xs">{it.variant_id.slice(0, 8)}</TableCell>
                            <TableCell className="text-right">{Number(it.quantity_received)}</TableCell>
                            <TableCell className="text-right">{Number(it.quantity_accepted)}</TableCell>
                            <TableCell className="text-right">{Number(it.quantity_rejected ?? 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          {timeline.isLoading ? <Skeleton className="h-32 w-full" /> :
           !timeline.data || !(timeline.data as any).ok ? <EmptyState title="Sem eventos" /> :
           (timeline.data as any).data.length === 0 ? <EmptyState title="Sem eventos" /> :
           <Card><CardContent className="p-4 space-y-2">
             {(timeline.data as any).data.map((e: any) => (
               <div key={e.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
                 <code className="text-xs text-muted-foreground shrink-0">{fmtDate(e.occurred_at)}</code>
                 <span className="font-medium">{e.event_type}</span>
               </div>
             ))}
           </CardContent></Card>}
        </TabsContent>

        <TabsContent value="audit">
          {audit.isLoading ? <Skeleton className="h-32 w-full" /> :
           !audit.data || !(audit.data as any).ok ? <EmptyState title="Sem auditoria" /> :
           (audit.data as any).data.length === 0 ? <EmptyState title="Sem auditoria" /> :
           <Card><CardContent className="p-4 space-y-2">
             {(audit.data as any).data.map((e: any) => (
               <div key={e.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
                 <code className="text-xs text-muted-foreground shrink-0">{fmtDate(e.created_at)}</code>
                 <span className="font-medium">{e.action}</span>
               </div>
             ))}
           </CardContent></Card>}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar OC?"
        description="Esta ação é irreversível."
        confirmLabel="Cancelar OC"
        destructive
        loading={cancelMut.isPending}
        onConfirm={() => cancelMut.mutate()}
      >
        <Textarea placeholder="Motivo (opcional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </ConfirmDialog>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
            <DialogDescription>Confirme as quantidades recebidas e aceitas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nº recebimento *" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
            <Input placeholder="ID do depósito *" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} />
            <Table>
              <TableHeader><TableRow>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Aceito</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((i: any) => {
                  const v = receiveItems[i.id] ?? { received: 0, accepted: 0 };
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.variant_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-right">{Number(i.quantity_ordered)}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} className="w-24 ml-auto" value={v.received}
                          onChange={(e) => setReceiveItems((s) => ({ ...s, [i.id]: { ...v, received: Number(e.target.value) } }))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} className="w-24 ml-auto" value={v.accepted}
                          onChange={(e) => setReceiveItems((s) => ({ ...s, [i.id]: { ...v, accepted: Number(e.target.value) } }))} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Fechar</Button>
            <Button onClick={() => receiveMut.mutate()} disabled={receiveMut.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
