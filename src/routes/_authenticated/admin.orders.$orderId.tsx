import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOrder, getOrderTimeline, getOrderAudit,
  cancelOrder, addOrderNote, addOrderTag, removeOrderTag,
} from "@/lib/business/orders.functions";
import { Can } from "@/hooks/use-permissions";
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorState } from "@/components/admin/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, X, MessageSquare, Tag as TagIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/orders/$orderId")({
  head: ({ params }) => ({ meta: [{ title: `Pedido ${params.orderId.slice(0, 8)} — Admin` }] }),
  component: OrderDetailPage,
});

const STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Rascunho", tone: "muted" },
  pending_payment: { label: "Aguardando pagamento", tone: "warning" },
  authorized: { label: "Autorizado", tone: "info" },
  paid: { label: "Pago", tone: "success" },
  on_hold: { label: "Em espera", tone: "warning" },
  awaiting_fulfillment: { label: "Aguardando separação", tone: "info" },
  partially_fulfilled: { label: "Parc. separado", tone: "info" },
  fulfilled: { label: "Separado", tone: "info" },
  awaiting_shipment: { label: "Aguardando envio", tone: "info" },
  partially_shipped: { label: "Parc. enviado", tone: "info" },
  shipped: { label: "Enviado", tone: "info" },
  delivered: { label: "Entregue", tone: "success" },
  completed: { label: "Concluído", tone: "success" },
  cancelled: { label: "Cancelado", tone: "danger" },
  refunded: { label: "Reembolsado", tone: "danger" },
  partially_refunded: { label: "Parc. reembolsado", tone: "warning" },
  returned: { label: "Devolvido", tone: "danger" },
};

function fmtMoney(n: number | null | undefined, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(n ?? 0));
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getOrderFn = useServerFn(getOrder);
  const getTimelineFn = useServerFn(getOrderTimeline);
  const getAuditFn = useServerFn(getOrderAudit);
  const cancelFn = useServerFn(cancelOrder);
  const addNoteFn = useServerFn(addOrderNote);
  const addTagFn = useServerFn(addOrderTag);
  const removeTagFn = useServerFn(removeOrderTag);

  const orderQ = useQuery({
    queryKey: ["admin", "orders", "detail", orderId],
    queryFn: () => getOrderFn({ data: { id: orderId } }),
  });
  const timelineQ = useQuery({
    queryKey: ["admin", "orders", "timeline", orderId],
    queryFn: () => getTimelineFn({ data: { id: orderId } }),
  });
  const auditQ = useQuery({
    queryKey: ["admin", "orders", "audit", orderId],
    queryFn: () => getAuditFn({ data: { id: orderId } }),
  });

  const refreshAll = () => qc.invalidateQueries({ queryKey: ["admin", "orders"] });

  const [noteBody, setNoteBody] = useState("");
  const [notePinned, setNotePinned] = useState(false);
  const [notePublic, setNotePublic] = useState(false);
  const [newTag, setNewTag] = useState("");

  const noteMut = useMutation({
    mutationFn: () => addNoteFn({ data: { order_id: orderId, body: noteBody, pinned: notePinned, visibility: notePublic ? "public" : "internal" } }),
    onSuccess: (r) => {
      if (r?.ok) { toast.success("Nota adicionada"); setNoteBody(""); setNotePinned(false); setNotePublic(false); refreshAll(); }
      else toast.error(r?.error?.message ?? "Erro");
    },
  });
  const addTagMut = useMutation({
    mutationFn: () => addTagFn({ data: { order_id: orderId, tag: newTag } }),
    onSuccess: (r) => { if (r?.ok) { toast.success("Tag adicionada"); setNewTag(""); refreshAll(); } else toast.error(r?.error?.message ?? "Erro"); },
  });
  const removeTagMut = useMutation({
    mutationFn: (tag: string) => removeTagFn({ data: { order_id: orderId, tag } }),
    onSuccess: (r) => { if (r?.ok) { toast.success("Tag removida"); refreshAll(); } else toast.error(r?.error?.message ?? "Erro"); },
  });
  const cancelMut = useMutation({
    mutationFn: (reason: string) => cancelFn({ data: { order_id: orderId, reason } }),
    onSuccess: (r) => { if (r?.ok) { toast.success("Pedido cancelado"); refreshAll(); } else toast.error(r?.error?.message ?? "Erro"); },
  });

  if (orderQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (orderQ.error) return <ErrorState title="Erro" description={(orderQ.error as Error).message} onRetry={() => orderQ.refetch()} />;
  if (!orderQ.data?.ok) return <ErrorState title="Erro" description={orderQ.data?.error?.message ?? "Falha ao carregar"} onRetry={() => orderQ.refetch()} />;

  const { order, summary, items, payments, fulfillments, shipments, holds, notes, assignments } = orderQ.data.data;
  const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, tone: "default" as StatusTone };
  const canCancel = !["cancelled", "delivered", "completed", "refunded", "returned", "shipped"].includes(order.status);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/admin/orders" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Pedido {order.order_number}</h1>
            <StatusBadge tone={statusInfo.tone} label={statusInfo.label} dot />
            {holds.filter((h) => h.status === "active").length > 0 && (
              <StatusBadge tone="warning" label={`${holds.filter((h) => h.status === "active").length} hold(s) ativo(s)`} />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Criado em {fmtDate(order.created_at)} • Canal {order.channel} • {order.items_count} item(ns)
          </p>
        </div>
        <Can permission="orders.cancel">
          {canCancel && (
            <Button
              variant="destructive"
              onClick={() => {
                const reason = window.prompt("Motivo do cancelamento:");
                if (reason) cancelMut.mutate(reason);
              }}
            >
              Cancelar pedido
            </Button>
          )}
        </Can>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Total</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">{fmtMoney(order.total, order.currency)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Pago</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">{fmtMoney(Number(summary?.paid_amount ?? 0), order.currency)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Reembolsado</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">{fmtMoney(Number(summary?.refunded_amount ?? 0), order.currency)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Envios</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">{summary?.shipments_count ?? 0}</CardContent></Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="items">Itens ({items.length})</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos ({payments.length})</TabsTrigger>
          <TabsTrigger value="fulfillments">Separação ({fulfillments.length})</TabsTrigger>
          <TabsTrigger value="shipments">Envios ({shipments.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notas ({notes.length})</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Cliente</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="font-medium">{summary?.customer_name ?? "—"}</div>
                <div className="text-muted-foreground">{summary?.customer_email ?? ""}</div>
                <div className="text-muted-foreground">{summary?.customer_phone ?? ""}</div>
                {order.customer_id && (
                  <Link to="/admin/customers/$customerId" params={{ customerId: order.customer_id }} className="text-primary underline text-sm">
                    Ver perfil do cliente
                  </Link>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(order.tags ?? []).length === 0 && <span className="text-sm text-muted-foreground">Sem tags</span>}
                  {(order.tags ?? []).map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <Can permission="orders.write">
                        <button onClick={() => removeTagMut.mutate(t)} aria-label={`Remover ${t}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </Can>
                    </Badge>
                  ))}
                </div>
                <Can permission="orders.write">
                  <div className="flex gap-2">
                    <Input placeholder="Nova tag..." value={newTag} onChange={(e) => setNewTag(e.target.value)} className="h-9" />
                    <Button size="sm" disabled={!newTag || addTagMut.isPending} onClick={() => addTagMut.mutate()}>
                      <TagIcon className="h-3.5 w-3.5 mr-1" />Adicionar
                    </Button>
                  </div>
                </Can>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Totais</CardTitle></CardHeader>
            <CardContent className="text-sm grid grid-cols-2 md:grid-cols-3 gap-3">
              <Row label="Subtotal" value={fmtMoney(order.subtotal, order.currency)} />
              <Row label="Descontos" value={fmtMoney(order.discount_total, order.currency)} />
              <Row label="Frete" value={fmtMoney(order.shipping_total, order.currency)} />
              <Row label="Impostos" value={fmtMoney(order.tax_total, order.currency)} />
              <Row label="Taxas" value={fmtMoney(order.fees_total, order.currency)} />
              <Row label="Total" value={fmtMoney(order.total, order.currency)} bold />
            </CardContent>
          </Card>
          {assignments.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Atribuições</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                {assignments.filter((a) => !a.unassigned_at).map((a) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span>{a.role}</span>
                    <span className="font-mono text-xs">{a.user_id.slice(0, 8)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="items">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>SKU</TableHead><TableHead>Nome</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Unit.</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState title="Sem itens" /></TableCell></TableRow> : items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-xs">{it.sku ?? "—"}</TableCell>
                    <TableCell>{it.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(it.qty)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(Number(it.unit_price), order.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(Number(it.line_total), order.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Método</TableHead><TableHead>Status</TableHead><TableHead>Gateway</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Reembolsado</TableHead><TableHead>Data</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState title="Sem pagamentos" /></TableCell></TableRow> : payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.method}</TableCell>
                    <TableCell><StatusBadge label={p.status} tone="info" /></TableCell>
                    <TableCell className="text-xs">{p.gateway ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(Number(p.amount), p.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(Number(p.refunded_amount ?? 0), p.currency)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="fulfillments">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>ID</TableHead><TableHead>Status</TableHead><TableHead>Separado em</TableHead><TableHead>Empacotado em</TableHead><TableHead>Pronto em</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {fulfillments.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState title="Sem separações" /></TableCell></TableRow> : fulfillments.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.id.slice(0, 8)}</TableCell>
                    <TableCell><StatusBadge label={f.status} tone="info" /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(f.picked_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(f.packed_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(f.ready_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="shipments">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Transportadora</TableHead><TableHead>Serviço</TableHead><TableHead>Rastreio</TableHead><TableHead>Status</TableHead><TableHead>Enviado</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {shipments.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState title="Sem envios" /></TableCell></TableRow> : shipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.carrier ?? "—"}</TableCell>
                    <TableCell>{s.service ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{s.tracking_code ?? "—"}</TableCell>
                    <TableCell><StatusBadge label={s.status} tone="info" /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(s.shipped_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          {timelineQ.isLoading ? <Skeleton className="h-64 w-full" /> :
            !timelineQ.data?.ok ? <ErrorState title="Erro" description={timelineQ.data?.error?.message ?? ""} /> :
            timelineQ.data.data.length === 0 ? <EmptyState title="Sem eventos" /> : (
            <div className="rounded-lg border bg-card divide-y">
              {timelineQ.data.data.map((e) => (
                <div key={`${e.source}-${e.id}`} className="px-4 py-3 flex items-start gap-3">
                  <Badge variant="outline" className="capitalize">{e.source}</Badge>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{e.title ?? e.event_type}</div>
                    <div className="text-xs text-muted-foreground">{e.event_type} • {fmtDate(e.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Can permission="orders.write">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" />Nova nota</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} placeholder="Escreva uma nota..." />
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2"><Switch checked={notePinned} onCheckedChange={setNotePinned} /> Fixar</label>
                    <label className="flex items-center gap-2"><Switch checked={notePublic} onCheckedChange={setNotePublic} /> Pública (visível ao cliente)</label>
                  </div>
                  <Button disabled={!noteBody.trim() || noteMut.isPending} onClick={() => noteMut.mutate()}>Adicionar nota</Button>
                </div>
              </CardContent>
            </Card>
          </Can>
          <div className="space-y-2">
            {notes.length === 0 ? <EmptyState title="Sem notas" /> : notes.map((n) => (
              <Card key={n.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{n.visibility}</Badge>
                    {n.pinned && <Badge variant="secondary">Fixada</Badge>}
                    <span>{fmtDate(n.created_at)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          {auditQ.isLoading ? <Skeleton className="h-64 w-full" /> :
            !auditQ.data?.ok ? <ErrorState title="Erro" description={auditQ.data?.error?.message ?? ""} /> :
            auditQ.data.data.length === 0 ? <EmptyState title="Sem auditoria" /> : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>Entidade</TableHead><TableHead>Autor</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {auditQ.data.data.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{fmtDate(a.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{a.action}</TableCell>
                      <TableCell>{a.entity}</TableCell>
                      <TableCell className="font-mono text-xs">{a.actor_user_id?.slice(0, 8) ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between border-b pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
    </div>
  );
}
