/**
 * MasterCrudPage — orquestrador genérico de CRUDs simples.
 *
 * Plugar:
 *  - server functions: list / create / update / remove (BizResult-aware)
 *  - columns: Column<T>[]
 *  - emptyForm / toForm / renderForm: define o formulário
 *
 * Não acessa Supabase. Toda I/O passa pelas Server Functions.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useActiveStore } from "@/hooks/use-active-store";
import { CrudPage } from "./crud-page";
import { CrudToolbar } from "./crud-toolbar";
import { CrudSearch } from "./crud-search";
import { CrudPagination } from "./crud-pagination";
import { CrudActions, type CrudAction } from "./crud-actions";
import { CrudDrawer } from "./crud-drawer";
import { CrudDeleteDialog } from "./crud-delete-dialog";
import { DataTable, type Column } from "./data-table";
import { EmptyState } from "./empty-state";
import { type Crumb } from "./breadcrumb-context";
import { runAction, type BizResult } from "./notify";

type Row = { id: string } & Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyServerFn = (args: { data: any }) => Promise<BizResult<any>>;

export interface MasterCrudPageProps<T extends Row> {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  resourceName: string;          // singular pt-BR, lowercase
  queryKey: string;              // unique per entity

  list: AnyServerFn;
  create: AnyServerFn;
  update: AnyServerFn;
  remove: AnyServerFn;

  columns: Column<T>[];
  searchPlaceholder?: string;
  extraFilters?: Record<string, string | number | boolean | null | undefined>;
  extraToolbar?: ReactNode;
  rowActions?: (row: T, helpers: { edit: () => void; remove: () => void }) => CrudAction[];

  emptyForm: () => Record<string, unknown>;
  toForm: (row: T) => Record<string, unknown>;
  renderForm: (
    form: Record<string, unknown>,
    setForm: (patch: Record<string, unknown>) => void,
    mode: "create" | "edit",
  ) => ReactNode;
  itemLabel?: (row: T) => string;
  formWidth?: string;            // tailwind sm:max-w-* class
}

export function MasterCrudPage<T extends Row>(props: MasterCrudPageProps<T>) {
  const { storeId, loading: storeLoading } = useActiveStore();
  const qc = useQueryClient();

  const list = useServerFn(props.list);
  const create = useServerFn(props.create);
  const update = useServerFn(props.update);
  const remove = useServerFn(props.remove);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<T | null>(null);

  const filtersKey = JSON.stringify(props.extraFilters ?? {});
  const queryKey = useMemo(
    () => [props.queryKey, storeId, q, page, pageSize, filtersKey],
    [props.queryKey, storeId, q, page, pageSize, filtersKey],
  );

  const query = useQuery({
    queryKey,
    enabled: !!storeId,
    queryFn: async () => {
      const res = await list({
        data: { store_id: storeId!, q: q || undefined, page, pageSize, filters: props.extraFilters },
      });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(props.emptyForm());
    setDrawerOpen(true);
  };
  const openEdit = (row: T) => {
    setEditing(row);
    setForm(props.toForm(row));
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      if (editing) {
        const ok = await runAction(
          () => update({ data: { id: editing.id, patch: form } }),
          { success: `${capitalize(props.resourceName)} atualizado`, loading: "Salvando..." },
        );
        if (ok) {
          setDrawerOpen(false);
          qc.invalidateQueries({ queryKey: [props.queryKey] });
        }
      } else {
        const ok = await runAction(
          () => create({ data: { ...form, store_id: storeId } as never }),
          { success: `${capitalize(props.resourceName)} criado`, loading: "Criando..." },
        );
        if (ok) {
          setDrawerOpen(false);
          qc.invalidateQueries({ queryKey: [props.queryKey] });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const ok = await runAction(
      () => remove({ data: { id: deleting.id } }),
      { success: `${capitalize(props.resourceName)} excluído`, loading: "Excluindo..." },
    );
    if (ok) {
      qc.invalidateQueries({ queryKey: [props.queryKey] });
      setDeleting(null);
    }
  };

  const setFormPatch = (patch: Record<string, unknown>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  return (
    <CrudPage
      title={props.title}
      description={props.description}
      breadcrumbs={props.breadcrumbs}
      actions={
        <Button onClick={openCreate} disabled={!storeId}>
          <Plus className="h-4 w-4 mr-2" /> Novo
        </Button>
      }
      toolbar={
        <CrudToolbar
          left={
            <>
              <CrudSearch
                value={q}
                onChange={(v) => { setQ(v); setPage(1); }}
                placeholder={props.searchPlaceholder ?? "Buscar..."}
              />
              {props.extraToolbar}
            </>
          }
        />
      }
    >
      {!storeId && !storeLoading ? (
        <EmptyState
          title="Nenhuma loja selecionada"
          description="Selecione uma loja no topo para visualizar os registros."
        />
      ) : (
        <>
          <DataTable<T>
            columns={props.columns}
            rows={query.data?.rows ?? []}
            rowKey={(r) => r.id}
            loading={query.isLoading || storeLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            onRowClick={openEdit}
            actions={(row) => {
              const base: CrudAction[] = [
                { label: "Editar", onClick: () => openEdit(row) },
                { label: "Excluir", onClick: () => setDeleting(row), destructive: true },
              ];
              const custom = props.rowActions
                ? props.rowActions(row, { edit: () => openEdit(row), remove: () => setDeleting(row) })
                : base;
              return <CrudActions actions={custom} />;
            }}
          />
          {(query.data?.total ?? 0) > 0 && (
            <CrudPagination
              page={page}
              pageSize={pageSize}
              total={query.data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </>
      )}

      <CrudDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={editing ? `Editar ${props.resourceName}` : `Novo ${props.resourceName}`}
        loading={saving}
        onSubmit={handleSave}
        width={props.formWidth}
      >
        <div className="space-y-4">
          {props.renderForm(form, setFormPatch, editing ? "edit" : "create")}
        </div>
      </CrudDrawer>

      <CrudDeleteDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        resourceName={props.resourceName}
        itemLabel={deleting && props.itemLabel ? props.itemLabel(deleting) : undefined}
        onConfirm={handleDelete}
      />
    </CrudPage>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
