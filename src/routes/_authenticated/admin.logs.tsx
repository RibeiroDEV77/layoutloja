import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CrudPage } from "@/components/admin/crud-page";
import { CrudToolbar } from "@/components/admin/crud-toolbar";
import { CrudSearch } from "@/components/admin/crud-search";
import { CrudPagination } from "@/components/admin/crud-pagination";
import { CrudActions } from "@/components/admin/crud-actions";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runAction } from "@/components/admin/notify";
import { listSystemLogs, listOutbox, listOutboxDLQ, retryOutboxEvent, discardOutboxEvent, reprocessDLQ } from "@/lib/business/logs.functions";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({ meta: [{ title: "Logs — Admin" }] }),
  component: LogsPage,
});

function LogsPage() {
  return (
    <CrudPage
      title="Logs"
      description="Logs técnicos, fila de eventos (Outbox) e mensagens descartadas (DLQ)."
      breadcrumbs={[{ label: "Administração" }, { label: "Logs" }]}
    >
      <Tabs defaultValue="system">
        <TabsList>
          <TabsTrigger value="system">System logs</TabsTrigger>
          <TabsTrigger value="outbox">Outbox</TabsTrigger>
          <TabsTrigger value="dlq">Dead-letter</TabsTrigger>
        </TabsList>
        <TabsContent value="system" className="pt-4"><SystemLogsTab /></TabsContent>
        <TabsContent value="outbox" className="pt-4"><OutboxTab /></TabsContent>
        <TabsContent value="dlq" className="pt-4"><DLQTab /></TabsContent>
      </Tabs>
    </CrudPage>
  );
}

type LogRow = { id: string; level: string; source: string | null; message: string; context: unknown; store_id: string | null; created_at: string };

function SystemLogsTab() {
  const list = useServerFn(listSystemLogs);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const query = useQuery({
    queryKey: ["system-logs", q, level, page, pageSize],
    queryFn: async () => {
      const res = await list({ data: { q: q || undefined, level: level || undefined, page, pageSize } });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });

  return (
    <>
      <CrudToolbar left={
        <div className="flex gap-2 flex-wrap">
          <CrudSearch value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar mensagem" />
          <select className="h-10 px-3 rounded-md border bg-background text-sm" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
            <option value="">Todos os níveis</option>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </div>
      } />
      <div className="mt-4">
        <DataTable<LogRow>
          columns={[
            { key: "created_at", header: "Quando", accessor: (r) => <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span> },
            { key: "level", header: "Nível", accessor: (r) => <StatusBadge label={r.level} tone={r.level === "error" ? "danger" : r.level === "warn" ? "warning" : "muted"} dot /> },
            { key: "source", header: "Fonte", accessor: (r) => <code className="text-xs">{r.source ?? "—"}</code> },
            { key: "message", header: "Mensagem", accessor: (r) => <span className="text-sm">{r.message}</span> },
            { key: "context", header: "Contexto", accessor: (r) => (
              <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">ver</summary>
                <pre className="mt-1 max-w-md overflow-auto bg-muted/40 p-2 rounded">{JSON.stringify(r.context, null, 2)}</pre>
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
      </div>
    </>
  );
}

type OutboxRow = {
  id: string; event_type: string; aggregate_type: string; aggregate_id: string;
  status: string; attempts: number; max_attempts: number; last_error: string | null;
  occurred_at: string; available_at: string; published_at: string | null;
};

function OutboxTab() {
  const qc = useQueryClient();
  const list = useServerFn(listOutbox);
  const retry = useServerFn(retryOutboxEvent);
  const discard = useServerFn(discardOutboxEvent);

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const query = useQuery({
    queryKey: ["outbox", status, page, pageSize],
    queryFn: async () => {
      const res = await list({ data: { status: status || undefined, page, pageSize } });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });

  return (
    <>
      <CrudToolbar left={
        <select className="h-10 px-3 rounded-md border bg-background text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Todos os status</option>
          <option value="pending">pending</option>
          <option value="processing">processing</option>
          <option value="published">published</option>
          <option value="failed">failed</option>
        </select>
      } />
      <div className="mt-4">
        <DataTable<OutboxRow>
          columns={[
            { key: "occurred_at", header: "Quando", accessor: (r) => <span className="text-xs">{new Date(r.occurred_at).toLocaleString("pt-BR")}</span> },
            { key: "event_type", header: "Evento", accessor: (r) => <code className="text-xs">{r.event_type}</code> },
            { key: "aggregate_type", header: "Agregado", accessor: (r) => <span className="text-xs">{r.aggregate_type}</span> },
            { key: "status", header: "Status", accessor: (r) => <StatusBadge label={r.status} tone={r.status === "published" ? "success" : r.status === "failed" ? "danger" : "muted"} dot /> },
            { key: "attempts", header: "Tentativas", align: "right", accessor: (r) => `${r.attempts}/${r.max_attempts}` },
            { key: "last_error", header: "Último erro", accessor: (r) => r.last_error ? <span className="text-xs text-destructive truncate block max-w-[260px]">{r.last_error}</span> : "—" },
          ]}
          rows={query.data?.rows ?? []}
          rowKey={(r) => r.id}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
          actions={(row) => <CrudActions actions={[
            { label: "Reagendar", onClick: async () => {
              const ok = await runAction(() => retry({ data: { id: row.id } }), { success: "Evento reagendado", loading: "..." });
              if (ok) qc.invalidateQueries({ queryKey: ["outbox"] });
            } },
            { label: "Descartar", destructive: true, onClick: async () => {
              const ok = await runAction(() => discard({ data: { id: row.id } }), { success: "Evento descartado", loading: "..." });
              if (ok) qc.invalidateQueries({ queryKey: ["outbox"] });
            } },
          ]} />}
        />
        {(query.data?.total ?? 0) > 0 && (
          <CrudPagination page={page} pageSize={pageSize} total={query.data?.total ?? 0}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        )}
      </div>
    </>
  );
}

type DLQRow = {
  id: string; event_type: string; aggregate_type: string; aggregate_id: string;
  attempts: number; last_error: string | null; failed_at: string; reprocessed_at: string | null;
};

function DLQTab() {
  const qc = useQueryClient();
  const list = useServerFn(listOutboxDLQ);
  const reprocess = useServerFn(reprocessDLQ);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const query = useQuery({
    queryKey: ["outbox-dlq", page, pageSize],
    queryFn: async () => {
      const res = await list({ data: { page, pageSize } });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });

  return (
    <>
      <DataTable<DLQRow>
        columns={[
          { key: "failed_at", header: "Falhou em", accessor: (r) => <span className="text-xs">{new Date(r.failed_at).toLocaleString("pt-BR")}</span> },
          { key: "event_type", header: "Evento", accessor: (r) => <code className="text-xs">{r.event_type}</code> },
          { key: "aggregate_type", header: "Agregado", accessor: (r) => <span className="text-xs">{r.aggregate_type}</span> },
          { key: "attempts", header: "Tentativas", align: "right", accessor: (r) => r.attempts },
          { key: "last_error", header: "Último erro", accessor: (r) => r.last_error ? <span className="text-xs text-destructive truncate block max-w-[300px]">{r.last_error}</span> : "—" },
          { key: "reprocessed_at", header: "Reprocessado", accessor: (r) => r.reprocessed_at ? <StatusBadge label="sim" tone="success" dot /> : <StatusBadge label="não" tone="muted" dot /> },
        ]}
        rows={query.data?.rows ?? []}
        rowKey={(r) => r.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        actions={(row) => <CrudActions actions={[
          { label: "Reprocessar", disabled: !!row.reprocessed_at, onClick: async () => {
            const ok = await runAction(() => reprocess({ data: { id: row.id } }), { success: "Evento reagendado", loading: "..." });
            if (ok) qc.invalidateQueries({ queryKey: ["outbox-dlq"] });
          } },
        ]} />}
      />
      {(query.data?.total ?? 0) > 0 && (
        <CrudPagination page={page} pageSize={pageSize} total={query.data?.total ?? 0}
          onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}
    </>
  );
}
