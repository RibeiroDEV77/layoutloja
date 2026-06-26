import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CrudPage } from "@/components/admin/crud-page";
import { CrudToolbar } from "@/components/admin/crud-toolbar";
import { CrudSearch } from "@/components/admin/crud-search";
import { CrudPagination } from "@/components/admin/crud-pagination";
import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, PlayCircle, History } from "lucide-react";
import { useActiveStore } from "@/hooks/use-active-store";
import { runAction } from "@/components/admin/notify";
import {
  listWholesaleApplications,
  transitionWholesaleApplication,
} from "@/lib/business/wholesale-applications.functions";
import { getWorkflowForAggregate } from "@/lib/foundations/workflow.functions";


export const Route = createFileRoute("/_authenticated/admin/wholesale-applications")({
  head: () => ({ meta: [{ title: "Solicitações de Atacado — Admin" }] }),
  component: WholesaleApplicationsPage,
});

type AdminRow = {
  id: string;
  store_id: string;
  customer_id: string;
  status: "draft" | "submitted" | "in_review" | "approved" | "rejected" | "cancelled";
  workflow_instance_id: string | null;
  requested_group_id: string | null;
  requested_price_list_id: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_reason: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    type: "pf" | "pj";
    name: string;
    trade_name: string | null;
    legal_name: string | null;
    doc_number: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

const STATUS_OPTIONS: { v: AdminRow["status"]; label: string; tone: "muted" | "info" | "warning" | "success" | "danger" }[] = [
  { v: "draft",     label: "Rascunho",   tone: "muted" },
  { v: "submitted", label: "Enviada",    tone: "info" },
  { v: "in_review", label: "Em análise", tone: "warning" },
  { v: "approved",  label: "Aprovada",   tone: "success" },
  { v: "rejected",  label: "Rejeitada",  tone: "danger" },
  { v: "cancelled", label: "Cancelada",  tone: "muted" },
];

function statusBadge(s: AdminRow["status"]) {
  const opt = STATUS_OPTIONS.find((o) => o.v === s);
  return <StatusBadge label={opt?.label ?? s} tone={opt?.tone ?? "muted"} dot />;
}

function fmtDoc(type: "pf" | "pj" | undefined, doc: string | null | undefined) {
  if (!doc) return "—";
  if (type === "pf" && doc.length === 11) return `${doc.slice(0,3)}.${doc.slice(3,6)}.${doc.slice(6,9)}-${doc.slice(9)}`;
  if (type === "pj" && doc.length === 14) return `${doc.slice(0,2)}.${doc.slice(2,5)}.${doc.slice(5,8)}/${doc.slice(8,12)}-${doc.slice(12)}`;
  return doc;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function metaStr(meta: Record<string, unknown>, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

function companyOf(r: AdminRow): string {
  if (r.customer?.type === "pj") {
    return r.customer.trade_name ?? r.customer.legal_name ?? metaStr(r.metadata, "trade_name") ?? metaStr(r.metadata, "legal_name") ?? "—";
  }
  const m = metaStr(r.metadata, "trade_name") || metaStr(r.metadata, "legal_name");
  return m || "—";
}

function WholesaleApplicationsPage() {
  const { storeId } = useActiveStore();
  const list = useServerFn(listWholesaleApplications);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [personType, setPersonType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-wholesale-applications", storeId, search, status, personType, from, to, page, pageSize],
    enabled: !!storeId,
    queryFn: async () => {
      const res = await list({
        data: {
          store_id: storeId!,
          search: search || undefined,
          status: status === "all" ? undefined : (status as AdminRow["status"]),
          customer_type: personType === "all" ? undefined : (personType as "pf" | "pj"),
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
          page, pageSize,
        },
      });
      if (!res.ok) throw new Error(res.error.message);
      return res.data as { rows: AdminRow[]; total: number };
    },
  });

  const rows = query.data?.rows ?? [];
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  return (
    <CrudPage
      title="Solicitações de Atacado"
      description="Consulta somente leitura das solicitações de cadastro para atacado."
      breadcrumbs={[{ label: "Comercial" }, { label: "Atacado" }, { label: "Solicitações" }]}
      toolbar={
        <CrudToolbar
          left={
            <div className="flex flex-wrap gap-2 items-center">
              <CrudSearch
                value={search}
                onChange={(v) => { setSearch(v); setPage(1); }}
                placeholder="Nome, empresa, CPF/CNPJ ou e-mail"
              />
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={personType} onValueChange={(v) => { setPersonType(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">PF e PJ</SelectItem>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date" className="w-[150px]" value={from}
                onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                aria-label="Data inicial"
              />
              <Input
                type="date" className="w-[150px]" value={to}
                onChange={(e) => { setTo(e.target.value); setPage(1); }}
                aria-label="Data final"
              />
            </div>
          }
        />
      }
    >
      {!storeId ? (
        <EmptyState title="Selecione uma loja" description="As solicitações são escopadas por loja." />
      ) : (
        <>
          <DataTable<AdminRow>
            columns={[
              {
                key: "id", header: "Solicitação",
                accessor: (r) => <code className="text-xs">#{r.id.slice(0, 8)}</code>,
              },
              {
                key: "name", header: "Cliente",
                accessor: (r) => (
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.customer?.name ?? metaStr(r.metadata, "name") ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {fmtDoc(r.customer?.type, r.customer?.doc_number ?? metaStr(r.metadata, "cpf") ?? metaStr(r.metadata, "cnpj"))}
                    </div>
                  </div>
                ),
              },
              {
                key: "company", header: "Empresa",
                accessor: (r) => <span className="text-sm">{companyOf(r)}</span>,
              },
              {
                key: "type", header: "Tipo",
                accessor: (r) => (r.customer?.type === "pj" ? "PJ" : r.customer?.type === "pf" ? "PF" : "—"),
              },
              {
                key: "city", header: "Cidade/UF",
                accessor: (r) => {
                  const city = metaStr(r.metadata, "city");
                  const state = metaStr(r.metadata, "state");
                  if (!city && !state) return <span className="text-muted-foreground">—</span>;
                  return <span className="text-sm">{[city, state].filter(Boolean).join(" / ")}</span>;
                },
              },
              {
                key: "created_at", header: "Solicitada em",
                accessor: (r) => <span className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</span>,
              },
              { key: "status", header: "Status", accessor: (r) => statusBadge(r.status) },
              {
                key: "updated_at", header: "Atualizada em",
                accessor: (r) => <span className="text-xs text-muted-foreground">{fmtDateTime(r.updated_at)}</span>,
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            onRowClick={(r) => setSelectedId(r.id)}
          />
          {(query.data?.total ?? 0) > 0 && (
            <CrudPagination
              page={page} pageSize={pageSize} total={query.data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && <DetailsView row={selected} />}
        </SheetContent>
      </Sheet>
    </CrudPage>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function DetailsView({ row }: { row: AdminRow }) {
  const meta = row.metadata ?? {};
  const isPj = row.customer?.type === "pj";
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          Solicitação <code className="text-xs">#{row.id.slice(0, 8)}</code>
          {statusBadge(row.status)}
        </SheetTitle>
        <SheetDescription>Visualização somente leitura.</SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        <section className="grid grid-cols-2 gap-4">
          <Field label="Tipo" value={isPj ? "Pessoa Jurídica" : "Pessoa Física"} />
          <Field label="Status" value={statusBadge(row.status)} />
          <Field label="Solicitada em" value={fmtDateTime(row.created_at)} />
          <Field label="Última atualização" value={fmtDateTime(row.updated_at)} />
          <Field label="Enviada em" value={fmtDateTime(row.submitted_at)} />
          <Field label="Decidida em" value={fmtDateTime(row.decided_at)} />
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">Cliente</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome" value={row.customer?.name ?? metaStr(meta, "name")} />
            <Field label="Documento" value={fmtDoc(row.customer?.type, row.customer?.doc_number ?? metaStr(meta, "cpf") ?? metaStr(meta, "cnpj"))} />
            <Field label="E-mail" value={row.customer?.email} />
            <Field label="Telefone" value={row.customer?.phone ?? metaStr(meta, "whatsapp")} />
            {isPj && <Field label="Razão Social" value={row.customer?.legal_name ?? metaStr(meta, "legal_name")} />}
            {isPj && <Field label="Nome Fantasia" value={row.customer?.trade_name ?? metaStr(meta, "trade_name")} />}
            {isPj && <Field label="Responsável" value={metaStr(meta, "responsavel")} />}
            {isPj && <Field label="Inscrição Estadual" value={metaStr(meta, "state_registration")} />}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">Localização</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cidade" value={metaStr(meta, "city")} />
            <Field label="Estado" value={metaStr(meta, "state")} />
          </div>
        </section>

        {(row.requested_group_id || row.requested_price_list_id) && (
          <section>
            <h3 className="text-sm font-semibold mb-2">Solicitado</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Grupo" value={row.requested_group_id && <code className="text-xs">{row.requested_group_id}</code>} />
              <Field label="Lista de preço" value={row.requested_price_list_id && <code className="text-xs">{row.requested_price_list_id}</code>} />
            </div>
          </section>
        )}

        {row.decision_reason && (
          <section>
            <h3 className="text-sm font-semibold mb-2">Motivo da decisão</h3>
            <p className="text-sm whitespace-pre-wrap">{row.decision_reason}</p>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold mb-2">Metadados</h3>
          <pre className="text-xs bg-muted/40 p-3 rounded overflow-auto max-h-80">
            {JSON.stringify(row.metadata ?? {}, null, 2)}
          </pre>
        </section>
      </div>
    </>
  );
}
