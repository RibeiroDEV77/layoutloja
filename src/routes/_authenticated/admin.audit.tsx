import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Download } from "lucide-react";
import { useActiveStore } from "@/hooks/use-active-store";
import { runAction } from "@/components/admin/notify";
import { listAudit, exportAuditCsv } from "@/lib/business/audit.functions";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Auditoria — Admin" }] }),
  component: AuditPage,
});

type AuditRow = {
  id: string; store_id: string | null; actor_user_id: string | null;
  entity_type: string; entity_id: string | null; action: string;
  diff: unknown; created_at: string;
};

function AuditPage() {
  const { storeId } = useActiveStore();
  const list = useServerFn(listAudit);
  const exportCsv = useServerFn(exportAuditCsv);

  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const query = useQuery({
    queryKey: ["admin-audit", storeId, entity, action, page, pageSize],
    enabled: !!storeId,
    queryFn: async () => {
      const res = await list({ data: {
        store_id: storeId!,
        entity_type: entity || undefined,
        action: action || undefined,
        page, pageSize,
      } });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });

  const handleExport = async () => {
    if (!storeId) return;
    await runAction(async () => {
      const res = await exportCsv({ data: { store_id: storeId, entity_type: entity || undefined, action: action || undefined } });
      if (res.ok) {
        const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `audit-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      return res;
    }, { success: "CSV gerado", loading: "Exportando..." });
  };

  return (
    <CrudPage
      title="Auditoria"
      description="Timeline imutável de ações administrativas, com filtros e exportação."
      breadcrumbs={[{ label: "Administração" }, { label: "Auditoria" }]}
      actions={<Button onClick={handleExport} disabled={!storeId} variant="outline">
        <Download className="h-4 w-4 mr-2" /> Exportar CSV
      </Button>}
      toolbar={<CrudToolbar left={
        <div className="flex gap-2 flex-wrap items-center">
          <CrudSearch value={entity} onChange={(v) => { setEntity(v); setPage(1); }} placeholder="Tipo de entidade (ex: store, product)" />
          <Input className="max-w-xs" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="Ação (ex: store.updated)" />
        </div>
      } />}
    >
      {!storeId ? (
        <EmptyState title="Selecione uma loja" description="A auditoria é escopada por loja." />
      ) : (
        <>
          <DataTable<AuditRow>
            columns={[
              { key: "created_at", header: "Quando", accessor: (r) => (
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              ) },
              { key: "action", header: "Ação", accessor: (r) => <StatusBadge label={r.action} tone="info" /> },
              { key: "entity_type", header: "Entidade", accessor: (r) => (
                <div className="min-w-0">
                  <div className="text-sm">{r.entity_type}</div>
                  {r.entity_id && <code className="text-xs text-muted-foreground truncate block max-w-[180px]">{r.entity_id}</code>}
                </div>
              ) },
              { key: "actor_user_id", header: "Autor", accessor: (r) => (
                <code className="text-xs truncate block max-w-[180px]">{r.actor_user_id ?? "sistema"}</code>
              ) },
              { key: "diff", header: "Detalhes", accessor: (r) => (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">ver</summary>
                  <pre className="mt-1 max-w-md overflow-auto bg-muted/40 p-2 rounded">{JSON.stringify(r.diff, null, 2)}</pre>
                </details>
              ) },
            ]}
            rows={query.data?.rows ?? []}
            rowKey={(r) => r.id}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
          />
          {(query.data?.total ?? 0) > 0 && (
            <CrudPagination page={page} pageSize={pageSize} total={query.data?.total ?? 0}
              onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          )}
        </>
      )}
    </CrudPage>
  );
}
