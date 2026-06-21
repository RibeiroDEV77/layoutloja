import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getInvoice, getInvoiceTimeline, getInvoiceAudit,
  cancelInvoice, issueCorrectionLetter, consultInvoice,
  downloadInvoiceXML, downloadInvoiceDANFE,
} from "@/lib/business/fiscal.functions";
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge";
import { ErrorState } from "@/components/admin/error-state";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Can } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, RefreshCcw, X, FilePenLine } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/invoices/$invoiceId")({
  head: ({ params }) => ({ meta: [{ title: `NF ${params.invoiceId.slice(0, 8)} — Admin` }] }),
  component: InvoiceDetailPage,
});

const STATUS_TONE: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Pendente", tone: "muted" },
  processing: { label: "Processando", tone: "info" },
  authorized: { label: "Autorizada", tone: "success" },
  denied: { label: "Rejeitada", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "danger" },
  corrected: { label: "Com CC-e", tone: "warning" },
  error: { label: "Erro", tone: "danger" },
};

function fmtMoney(n: unknown, c = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(Number(n ?? 0));
}
function fmtDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleString("pt-BR") : "—";
}

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getInvoice);
  const getTimelineFn = useServerFn(getInvoiceTimeline);
  const getAuditFn = useServerFn(getInvoiceAudit);
  const cancelFn = useServerFn(cancelInvoice);
  const correctFn = useServerFn(issueCorrectionLetter);
  const consultFn = useServerFn(consultInvoice);
  const xmlFn = useServerFn(downloadInvoiceXML);
  const danfeFn = useServerFn(downloadInvoiceDANFE);

  const detail = useQuery({
    queryKey: ["admin", "invoices", "detail", invoiceId],
    queryFn: () => getFn({ data: { id: invoiceId } }),
  });
  const timeline = useQuery({
    queryKey: ["admin", "invoices", "timeline", invoiceId],
    queryFn: () => getTimelineFn({ data: { id: invoiceId } }),
  });
  const audit = useQuery({
    queryKey: ["admin", "invoices", "audit", invoiceId],
    queryFn: () => getAuditFn({ data: { id: invoiceId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "invoices"] });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [ccOpen, setCcOpen] = useState(false);
  const [ccText, setCcText] = useState("");

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { invoice_id: invoiceId, reason: cancelReason } }),
    onSuccess: () => { toast.success("Cancelamento solicitado"); setCancelOpen(false); setCancelReason(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const correctMut = useMutation({
    mutationFn: () => correctFn({ data: { invoice_id: invoiceId, text: ccText } }),
    onSuccess: () => { toast.success("Carta de correção enviada"); setCcOpen(false); setCcText(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const consultMut = useMutation({
    mutationFn: () => consultFn({ data: { invoice_id: invoiceId } }),
    onSuccess: () => { toast.success("Consulta concluída"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const xmlMut = useMutation({
    mutationFn: () => xmlFn({ data: { invoice_id: invoiceId } }),
    onSuccess: (r: any) => {
      const url = r?.url ?? r?.xml_url ?? r?.data?.url;
      if (url) window.open(url, "_blank");
      else toast.info("XML solicitado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const danfeMut = useMutation({
    mutationFn: () => danfeFn({ data: { invoice_id: invoiceId } }),
    onSuccess: (r: any) => {
      const url = r?.url ?? r?.danfe_url ?? r?.data?.url;
      if (url) window.open(url, "_blank");
      else toast.info("DANFE solicitado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inv = useMemo(() => (detail.data && (detail.data as any).ok ? (detail.data as any).data : detail.data), [detail.data]);

  if (detail.isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (detail.error) return <ErrorState title="Falha" description={(detail.error as Error).message} onRetry={() => detail.refetch()} />;
  if (detail.data && (detail.data as any).ok === false) {
    return <ErrorState title="Falha" description={(detail.data as any).error.message} onRetry={() => detail.refetch()} />;
  }
  if (!inv) return <EmptyState title="Nota não encontrada" />;

  const statusInfo = STATUS_TONE[inv.status] ?? { label: inv.status, tone: "default" as StatusTone };
  const canCancel = ["authorized", "corrected"].includes(inv.status);
  const canCorrect = ["authorized", "corrected"].includes(inv.status);
  const env = inv.fiscal_providers?.environment ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/invoices" })} className="mb-2 -ml-2">
            <ArrowLeft className="size-4 mr-1" /> Notas Fiscais
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">
              NF {inv.number ?? "—"}{inv.series ? "/" + inv.series : ""}
            </h1>
            <StatusBadge label={statusInfo.label} tone={statusInfo.tone} dot />
            {env && <Badge variant={env === "production" ? "default" : "secondary"}>{env}</Badge>}
            <Badge variant="outline">{(inv.document_type ?? "").toUpperCase()}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {inv.fiscal_providers?.display_name ?? "—"} • emitida em {fmtDate(inv.issue_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => consultMut.mutate()} disabled={consultMut.isPending}>
            <RefreshCcw className="size-4 mr-1" /> Consultar
          </Button>
          <Button variant="outline" size="sm" onClick={() => xmlMut.mutate()} disabled={xmlMut.isPending}>
            <Download className="size-4 mr-1" /> XML
          </Button>
          <Button variant="outline" size="sm" onClick={() => danfeMut.mutate()} disabled={danfeMut.isPending}>
            <FileText className="size-4 mr-1" /> DANFE
          </Button>
          <Can permission="fiscal.cancel">
            {canCorrect && (
              <Button variant="outline" size="sm" onClick={() => setCcOpen(true)}>
                <FilePenLine className="size-4 mr-1" /> CC-e
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                <X className="size-4 mr-1" /> Cancelar
              </Button>
            )}
          </Can>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{fmtMoney(inv.total_amount)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Chave</CardTitle></CardHeader>
          <CardContent><code className="text-xs break-all">{inv.access_key ?? "—"}</code></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Protocolo</CardTitle></CardHeader>
          <CardContent><code className="text-xs break-all">{inv.protocol ?? "—"}</code></CardContent></Card>
      </div>

      {inv.rejection_reason && (
        <Card className="border-destructive/40">
          <CardHeader><CardTitle className="text-sm text-destructive">Motivo da rejeição {inv.rejection_code ? `(${inv.rejection_code})` : ""}</CardTitle></CardHeader>
          <CardContent className="text-sm">{inv.rejection_reason}</CardContent>
        </Card>
      )}

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
          <TabsTrigger value="payload">Payload</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          {timeline.isLoading ? <Skeleton className="h-32 w-full" /> :
           !timeline.data || !(timeline.data as any).ok ? <EmptyState title="Sem eventos" /> :
           (timeline.data as any).data.length === 0 ? <EmptyState title="Sem eventos" /> :
            <Card><CardContent className="p-4 space-y-2">
              {(timeline.data as any).data.map((e: any) => {
                const s = STATUS_TONE[e.status] ?? { label: e.status, tone: "default" as StatusTone };
                return (
                  <div key={e.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
                    <code className="text-xs text-muted-foreground shrink-0 w-32">{fmtDate(e.created_at)}</code>
                    <StatusBadge label={s.label} tone={s.tone} />
                    <div className="min-w-0">
                      <div className="font-medium">{e.event_type}</div>
                      {e.message && <div className="text-xs text-muted-foreground">{e.message}</div>}
                    </div>
                  </div>
                );
              })}
            </CardContent></Card>}
        </TabsContent>

        <TabsContent value="audit">
          {audit.isLoading ? <Skeleton className="h-32 w-full" /> :
           !audit.data || !(audit.data as any).ok ? <EmptyState title="Sem auditoria" /> :
           (audit.data as any).data.length === 0 ? <EmptyState title="Sem auditoria" /> :
            <Card><CardContent className="p-4 space-y-2">
              {(audit.data as any).data.map((e: any) => (
                <div key={e.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
                  <code className="text-xs text-muted-foreground shrink-0 w-32">{fmtDate(e.created_at)}</code>
                  <span className="font-medium">{e.action}</span>
                </div>
              ))}
            </CardContent></Card>}
        </TabsContent>

        <TabsContent value="payload">
          <Card><CardContent className="p-4">
            <pre className="text-xs overflow-auto max-h-96 bg-muted p-3 rounded">{JSON.stringify(inv.payload, null, 2)}</pre>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar nota fiscal?</DialogTitle>
            <DialogDescription>Informe a justificativa (mínimo 15 caracteres pela SEFAZ).</DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Justificativa..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending || cancelReason.trim().length < 15}
            >Cancelar nota</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ccOpen} onOpenChange={setCcOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carta de Correção (CC-e)</DialogTitle>
            <DialogDescription>Texto da correção (mínimo 15 caracteres pela SEFAZ).</DialogDescription>
          </DialogHeader>
          <Textarea
            value={ccText}
            onChange={(e) => setCcText(e.target.value)}
            placeholder="Descreva a correção..."
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCcOpen(false)}>Voltar</Button>
            <Button onClick={() => correctMut.mutate()} disabled={correctMut.isPending || ccText.trim().length < 15}>Enviar CC-e</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
