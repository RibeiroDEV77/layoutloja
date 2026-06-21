import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInvoices } from "@/lib/business/fiscal.functions";
import { useActiveStore } from "@/hooks/use-active-store";
import { CrudPage } from "@/components/admin/crud-page";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudPagination } from "@/components/admin/crud-pagination";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorState } from "@/components/admin/error-state";
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  head: () => ({ meta: [{ title: "Notas Fiscais — Admin" }] }),
  component: InvoicesListPage,
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

const DOC_LABEL: Record<string, string> = {
  nfe: "NF-e", nfce: "NFC-e", nfse: "NFS-e", cte: "CT-e",
};

function fmtMoney(n: unknown, c = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(Number(n ?? 0));
}
function fmtDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleString("pt-BR") : "—";
}

type Row = {
  id: string; number: string | null; series: string | null; document_type: string;
  status: string; total_amount: number | null; issue_date: string | null;
  access_key: string | null; provider_name: string | null;
  provider_environment: "sandbox" | "production" | null; created_at: string;
};

function InvoicesListPage() {
  const { storeId, loading: storeLoading } = useActiveStore();
  const navigate = useNavigate();
  const listFn = useServerFn(listInvoices);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [env, setEnv] = useState<string>("all");
  const [docType, setDocType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const filters = useMemo(() => ({
    store_id: storeId!,
    q: q || undefined,
    status: status !== "all" ? [status] : undefined,
    document_type: docType !== "all" ? [docType] : undefined,
    environment: env !== "all" ? (env as "sandbox" | "production") : undefined,
    page, pageSize,
  }), [storeId, q, status, env, docType, page]);

  const query = useQuery({
    queryKey: ["admin", "invoices", "list", storeId, q, status, env, docType, page],
    queryFn: () => listFn({ data: filters }),
    enabled: !!storeId,
  });

  const columns: Column<Row>[] = [
    {
      key: "number", header: "Número",
      accessor: (r) => (
        <Link to="/admin/invoices/$invoiceId" params={{ invoiceId: r.id }} className="font-medium hover:underline">
          {r.number ? `${r.number}${r.series ? "/" + r.series : ""}` : "—"}
        </Link>
      ),
    },
    { key: "document_type", header: "Tipo", accessor: (r) => DOC_LABEL[r.document_type] ?? r.document_type },
    {
      key: "status", header: "Status",
      accessor: (r) => {
        const s = STATUS_TONE[r.status] ?? { label: r.status, tone: "default" as StatusTone };
        return <StatusBadge label={s.label} tone={s.tone} dot />;
      },
    },
    {
      key: "provider_environment", header: "Ambiente",
      accessor: (r) => r.provider_environment
        ? <Badge variant={r.provider_environment === "production" ? "default" : "secondary"}>{r.provider_environment}</Badge>
        : "—",
    },
    { key: "provider_name", header: "Provider", accessor: (r) => r.provider_name ?? "—" },
    { key: "total_amount", header: "Total", align: "right", accessor: (r) => fmtMoney(r.total_amount) },
    { key: "issue_date", header: "Emitida", accessor: (r) => fmtDate(r.issue_date) },
    {
      key: "access_key", header: "Chave",
      accessor: (r) => r.access_key ? <code className="text-xs">{r.access_key.slice(-8)}</code> : "—",
    },
  ];

  if (storeLoading || (!storeId && !query.error)) {
    return <div className="p-6"><Skeleton className="h-48 w-full" /></div>;
  }

  return (
    <CrudPage
      title="Notas Fiscais"
      description="Emissão, consulta, cancelamento, CC-e, XML, DANFE e timeline."
      breadcrumbs={[{ label: "Expedição & Fiscal" }, { label: "Notas Fiscais" }]}
      toolbar={
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por número, chave ou ID externo..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="max-w-sm"
          />
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_TONE).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={docType} onValueChange={(v) => { setDocType(v); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(DOC_LABEL).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={env} onValueChange={(v) => { setEnv(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Ambiente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="production">Produção</SelectItem>
              <SelectItem value="sandbox">Sandbox</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      {query.isLoading && <Skeleton className="h-64 w-full" />}
      {query.error && <ErrorState title="Falha" description={(query.error as Error).message} onRetry={() => query.refetch()} />}
      {query.data && !(query.data as any).ok && (
        <ErrorState title="Falha" description={(query.data as any).error.message} onRetry={() => query.refetch()} />
      )}
      {query.data && (query.data as any).ok && (query.data as any).data.rows.length === 0 && (
        <EmptyState title="Nenhuma nota fiscal" description="Nenhuma nota encontrada com os filtros atuais." />
      )}
      {query.data && (query.data as any).ok && (query.data as any).data.rows.length > 0 && (
        <>
          <DataTable<Row>
            rows={(query.data as any).data.rows as Row[]}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r: Row) => navigate({ to: "/admin/invoices/$invoiceId", params: { invoiceId: r.id } })}
          />
          <CrudPagination
            page={page}
            pageSize={pageSize}
            total={(query.data as any).data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </CrudPage>
  );
}
