import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPurchaseOrders } from "@/lib/business/purchases.functions";
import { useActiveStore } from "@/hooks/use-active-store";
import { CrudPage } from "@/components/admin/crud-page";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudPagination } from "@/components/admin/crud-pagination";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorState } from "@/components/admin/error-state";
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/purchases")({
  head: () => ({ meta: [{ title: "Compras — Admin" }] }),
  component: PurchasesListPage,
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
  return s ? new Date(s).toLocaleDateString("pt-BR") : "—";
}

type PORow = {
  id: string; po_number: string; status: string; total_amount: number; currency: string;
  order_date: string | null; expected_date: string | null;
  supplier_name: string | null; items_count: number; created_at: string;
};

function PurchasesListPage() {
  const { storeId, loading: storeLoading } = useActiveStore();
  const navigate = useNavigate();
  const listFn = useServerFn(listPurchaseOrders);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const filters = useMemo(
    () => ({ store_id: storeId!, q: q || undefined, status: status !== "all" ? [status] : undefined, page, pageSize }),
    [storeId, q, status, page],
  );

  const query = useQuery({
    queryKey: ["admin", "purchases", "list", storeId, q, status, page],
    queryFn: () => listFn({ data: filters }),
    enabled: !!storeId,
  });

  const columns: Column<PORow>[] = [
    {
      key: "po_number", header: "Nº OC",
      accessor: (r) => (
        <Link to="/admin/purchases/$poId" params={{ poId: r.id }} className="font-medium hover:underline">
          {r.po_number}
        </Link>
      ),
    },
    { key: "supplier_name", header: "Fornecedor", accessor: (r) => r.supplier_name ?? "—" },
    {
      key: "status", header: "Status",
      accessor: (r) => {
        const s = STATUS_TONE[r.status] ?? { label: r.status, tone: "default" as StatusTone };
        return <StatusBadge label={s.label} tone={s.tone} dot />;
      },
    },
    { key: "items_count", header: "Itens", align: "right", accessor: (r) => r.items_count },
    { key: "total_amount", header: "Total", align: "right", accessor: (r) => fmtMoney(r.total_amount, r.currency) },
    { key: "order_date", header: "Emitida", accessor: (r) => fmtDate(r.order_date) },
    { key: "expected_date", header: "Prevista", accessor: (r) => fmtDate(r.expected_date) },
  ];

  if (storeLoading || (!storeId && !query.error)) {
    return <div className="p-6"><Skeleton className="h-48 w-full" /></div>;
  }

  return (
    <CrudPage
      title="Compras"
      description="Ordens de compra, recebimento e integração com estoque."
      breadcrumbs={[{ label: "Estoque & Compras" }, { label: "Compras" }]}
      toolbar={
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por número da OC..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="max-w-sm"
          />
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_TONE).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {query.isLoading && <Skeleton className="h-64 w-full" />}
      {query.error && <ErrorState title="Falha ao carregar" description={(query.error as Error).message} onRetry={() => query.refetch()} />}
      {query.data && !query.data.ok && (
        <ErrorState title="Falha ao carregar" description={query.data.error.message} onRetry={() => query.refetch()} />
      )}
      {query.data?.ok && query.data.data.rows.length === 0 && (
        <EmptyState title="Nenhuma ordem de compra" description="Nenhuma OC encontrada com os filtros atuais." />
      )}
      {query.data?.ok && query.data.data.rows.length > 0 && (
        <>
          <DataTable<PORow>
            rows={query.data.data.rows as PORow[]}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r: PORow) => navigate({ to: "/admin/purchases/$poId", params: { poId: r.id } })}
          />
          <CrudPagination
            page={page}
            pageSize={pageSize}
            total={query.data.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </CrudPage>
  );
}
