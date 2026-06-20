import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CrudPage } from "@/components/admin/crud-page";
import { CrudToolbar } from "@/components/admin/crud-toolbar";
import { CrudSearch } from "@/components/admin/crud-search";
import { CrudPagination } from "@/components/admin/crud-pagination";
import { CrudActions, type CrudAction } from "@/components/admin/crud-actions";
import { CrudDrawer } from "@/components/admin/crud-drawer";
import { CrudDeleteDialog } from "@/components/admin/crud-delete-dialog";
import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { SelectField } from "@/components/admin/select-field";
import { FormField, FormRow } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { runAction } from "@/components/admin/notify";
import { useActiveStore } from "@/hooks/use-active-store";
import { listAttributes } from "@/lib/business/attributes.functions";
import {
  listAttributeValues, createAttributeValue, updateAttributeValue, deleteAttributeValue,
} from "@/lib/business/attribute-values.functions";

export const Route = createFileRoute("/_authenticated/admin/attribute-values")({
  head: () => ({ meta: [{ title: "Valores de Atributos — Admin" }] }),
  component: AttributeValuesPage,
});

type AttrValue = { id: string; attribute_id: string; code: string; label: string; sort_order: number; is_active: boolean };
type Attr = { id: string; name: string; code: string };

function AttributeValuesPage() {
  const { storeId } = useActiveStore();
  const qc = useQueryClient();
  const listAttrs = useServerFn(listAttributes);
  const listVals = useServerFn(listAttributeValues);
  const create = useServerFn(createAttributeValue);
  const update = useServerFn(updateAttributeValue);
  const remove = useServerFn(deleteAttributeValue);

  const [attributeId, setAttributeId] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AttrValue | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AttrValue | null>(null);

  const attrsQuery = useQuery({
    queryKey: ["attributes-all", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const r = await listAttrs({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Attr[];
    },
  });
  const attrOptions = useMemo(
    () => (attrsQuery.data ?? []).map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })),
    [attrsQuery.data],
  );

  const valuesQuery = useQuery({
    queryKey: ["attribute-values", attributeId, q, page, pageSize],
    enabled: !!attributeId,
    queryFn: async () => {
      const r = await listVals({ data: { attribute_id: attributeId, q: q || undefined, page, pageSize } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as { rows: AttrValue[]; total: number };
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", label: "", sort_order: 0, is_active: true });
    setDrawerOpen(true);
  };
  const openEdit = (row: AttrValue) => {
    setEditing(row);
    setForm({ code: row.code, label: row.label, sort_order: row.sort_order, is_active: row.is_active });
    setDrawerOpen(true);
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        const ok = await runAction(() => update({ data: { id: editing.id, patch: form } }),
          { success: "Valor atualizado", loading: "Salvando..." });
        if (ok) { setDrawerOpen(false); qc.invalidateQueries({ queryKey: ["attribute-values"] }); }
      } else {
        const ok = await runAction(
          () => create({ data: { attribute_id: attributeId, ...(form as { code: string; label: string }) } }),
          { success: "Valor criado", loading: "Criando..." });
        if (ok) { setDrawerOpen(false); qc.invalidateQueries({ queryKey: ["attribute-values"] }); }
      }
    } finally { setSaving(false); }
  };
  const handleDelete = async () => {
    if (!deleting) return;
    const ok = await runAction(() => remove({ data: { id: deleting.id } }),
      { success: "Valor excluído", loading: "Excluindo..." });
    if (ok) { qc.invalidateQueries({ queryKey: ["attribute-values"] }); setDeleting(null); }
  };

  return (
    <CrudPage
      title="Valores de Atributos"
      description="Opções disponíveis para atributos do tipo lista."
      breadcrumbs={[{ label: "Catálogo" }, { label: "Valores de Atributos" }]}
      actions={
        <Button onClick={openCreate} disabled={!attributeId}>
          <Plus className="h-4 w-4 mr-2" /> Novo valor
        </Button>
      }
      toolbar={
        <CrudToolbar
          left={
            <>
              <div className="w-72">
                <SelectField
                  value={attributeId}
                  onChange={(v) => { setAttributeId(v); setPage(1); }}
                  options={attrOptions}
                  placeholder="Selecione um atributo..."
                />
              </div>
              <CrudSearch value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por código ou rótulo" />
            </>
          }
        />
      }
    >
      {!attributeId ? (
        <EmptyState
          title="Selecione um atributo"
          description="Escolha o atributo cujos valores você deseja gerenciar."
        />
      ) : (
        <>
          <DataTable<AttrValue>
            columns={[
              { key: "label", header: "Rótulo", accessor: (r) => <span className="font-medium">{r.label}</span> },
              { key: "code", header: "Código", accessor: (r) => <code className="text-xs text-muted-foreground">{r.code}</code> },
              { key: "sort_order", header: "Ordem", align: "right", accessor: (r) => r.sort_order },
              { key: "is_active", header: "Status",
                accessor: (r) => <StatusBadge label={r.is_active ? "Ativo" : "Inativo"} tone={r.is_active ? "success" : "muted"} dot /> },
            ]}
            rows={valuesQuery.data?.rows ?? []}
            rowKey={(r) => r.id}
            loading={valuesQuery.isLoading}
            error={valuesQuery.error}
            onRetry={() => valuesQuery.refetch()}
            onRowClick={openEdit}
            actions={(row) => {
              const acts: CrudAction[] = [
                { label: "Editar", onClick: () => openEdit(row) },
                { label: "Excluir", onClick: () => setDeleting(row), destructive: true },
              ];
              return <CrudActions actions={acts} />;
            }}
          />
          {(valuesQuery.data?.total ?? 0) > 0 && (
            <CrudPagination
              page={page} pageSize={pageSize} total={valuesQuery.data?.total ?? 0}
              onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </>
      )}

      <CrudDrawer
        open={drawerOpen} onOpenChange={setDrawerOpen}
        title={editing ? "Editar valor" : "Novo valor"}
        loading={saving} onSubmit={handleSave}
      >
        <div className="space-y-4">
          <FormRow>
            <FormField label="Código" required>
              <Input value={(form.code as string) ?? ""} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toLowerCase() }))} />
            </FormField>
            <FormField label="Rótulo" required>
              <Input value={(form.label as string) ?? ""} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Ordem">
              <Input type="number" value={(form.sort_order as number) ?? 0}
                onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))} />
            </FormField>
            <FormField label="Ativo">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
                <span className="text-sm text-muted-foreground">{form.is_active ? "Disponível" : "Oculto"}</span>
              </div>
            </FormField>
          </FormRow>
        </div>
      </CrudDrawer>

      <CrudDeleteDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        resourceName="valor" itemLabel={deleting?.label} onConfirm={handleDelete}
      />
    </CrudPage>
  );
}
