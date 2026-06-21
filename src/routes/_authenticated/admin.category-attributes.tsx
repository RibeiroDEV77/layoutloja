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
import { listCategories } from "@/lib/business/categories.functions";
import { listAttributes } from "@/lib/business/attributes.functions";
import {
  listCategoryAttributes, createCategoryAttribute, updateCategoryAttribute, deleteCategoryAttribute,
} from "@/lib/business/category-attributes.functions";

export const Route = createFileRoute("/_authenticated/admin/category-attributes")({
  head: () => ({ meta: [{ title: "Atributos × Categoria — Admin" }] }),
  component: CategoryAttributesPage,
});

type CAttr = {
  id: string; category_id: string; attribute_id: string;
  is_required: boolean; is_variant_axis: boolean; sort_order: number;
  show_in_filters?: boolean; filter_order?: number;
  attribute?: { id: string; name: string; code: string };
};
type Cat = { id: string; name: string };
type Attr = { id: string; name: string; code: string };

function CategoryAttributesPage() {
  const { storeId } = useActiveStore();
  const qc = useQueryClient();
  const listCats = useServerFn(listCategories);
  const listAttrs = useServerFn(listAttributes);
  const listCA = useServerFn(listCategoryAttributes);
  const create = useServerFn(createCategoryAttribute);
  const update = useServerFn(updateCategoryAttribute);
  const remove = useServerFn(deleteCategoryAttribute);

  const [categoryId, setCategoryId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CAttr | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CAttr | null>(null);

  const catsQuery = useQuery({
    queryKey: ["categories-all", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const r = await listCats({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Cat[];
    },
  });
  const attrsQuery = useQuery({
    queryKey: ["attributes-for-pivot", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const r = await listAttrs({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Attr[];
    },
  });
  const caQuery = useQuery({
    queryKey: ["category-attributes", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const r = await listCA({ data: { category_id: categoryId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as CAttr[];
    },
  });

  const catOptions = useMemo(() => (catsQuery.data ?? []).map((c) => ({ value: c.id, label: c.name })), [catsQuery.data]);
  const attrOptions = useMemo(() => {
    const used = new Set((caQuery.data ?? []).map((c) => c.attribute_id));
    return (attrsQuery.data ?? [])
      .filter((a) => editing?.attribute_id === a.id || !used.has(a.id))
      .map((a) => ({ value: a.id, label: `${a.name} (${a.code})` }));
  }, [attrsQuery.data, caQuery.data, editing]);

  const openCreate = () => {
    setEditing(null);
    setForm({ attribute_id: "", is_required: false, is_variant_axis: false, sort_order: 0 });
    setDrawerOpen(true);
  };
  const openEdit = (row: CAttr) => {
    setEditing(row);
    setForm({
      attribute_id: row.attribute_id,
      is_required: row.is_required,
      is_variant_axis: row.is_variant_axis,
      sort_order: row.sort_order,
    });
    setDrawerOpen(true);
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        const ok = await runAction(
          () => update({ data: { id: editing.id, patch: {
            is_required: form.is_required as boolean,
            is_variant_axis: form.is_variant_axis as boolean,
            sort_order: form.sort_order as number,
          } } }),
          { success: "Vínculo atualizado", loading: "Salvando..." },
        );
        if (ok) { setDrawerOpen(false); qc.invalidateQueries({ queryKey: ["category-attributes"] }); }
      } else {
        const ok = await runAction(
          () => create({ data: {
            category_id: categoryId,
            attribute_id: form.attribute_id as string,
            is_required: form.is_required as boolean,
            is_variant_axis: form.is_variant_axis as boolean,
            sort_order: form.sort_order as number,
          } }),
          { success: "Atributo vinculado", loading: "Vinculando..." },
        );
        if (ok) { setDrawerOpen(false); qc.invalidateQueries({ queryKey: ["category-attributes"] }); }
      }
    } finally { setSaving(false); }
  };
  const handleDelete = async () => {
    if (!deleting) return;
    const ok = await runAction(() => remove({ data: { id: deleting.id } }),
      { success: "Vínculo removido", loading: "Removendo..." });
    if (ok) { qc.invalidateQueries({ queryKey: ["category-attributes"] }); setDeleting(null); }
  };

  return (
    <CrudPage
      title="Atributos × Categoria"
      description="Defina quais atributos cada categoria utiliza."
      breadcrumbs={[{ label: "Catálogo" }, { label: "Atributos × Categoria" }]}
      actions={
        <Button onClick={openCreate} disabled={!categoryId}>
          <Plus className="h-4 w-4 mr-2" /> Vincular atributo
        </Button>
      }
      toolbar={
        <CrudToolbar
          left={
            <div className="w-72">
              <SelectField
                value={categoryId} onChange={setCategoryId}
                options={catOptions} placeholder="Selecione uma categoria..."
              />
            </div>
          }
        />
      }
    >
      {!categoryId ? (
        <EmptyState
          title="Selecione uma categoria"
          description="Escolha a categoria para gerenciar seus atributos."
        />
      ) : (
        <DataTable<CAttr>
          columns={[
            { key: "attribute", header: "Atributo",
              accessor: (r) => <span className="font-medium">{r.attribute?.name ?? r.attribute_id}</span> },
            { key: "code", header: "Código",
              accessor: (r) => <code className="text-xs text-muted-foreground">{r.attribute?.code ?? "—"}</code> },
            { key: "is_required", header: "Obrigatório",
              accessor: (r) => r.is_required ? <StatusBadge label="Sim" tone="warning" /> : <span className="text-muted-foreground">—</span> },
            { key: "is_variant_axis", header: "Eixo de variação",
              accessor: (r) => r.is_variant_axis ? <StatusBadge label="Sim" tone="info" /> : <span className="text-muted-foreground">—</span> },
            { key: "sort_order", header: "Ordem", align: "right", accessor: (r) => r.sort_order },
          ]}
          rows={caQuery.data ?? []}
          rowKey={(r) => r.id}
          loading={caQuery.isLoading}
          error={caQuery.error}
          onRetry={() => caQuery.refetch()}
          onRowClick={openEdit}
          actions={(row) => {
            const acts: CrudAction[] = [
              { label: "Editar", onClick: () => openEdit(row) },
              { label: "Remover", onClick: () => setDeleting(row), destructive: true },
            ];
            return <CrudActions actions={acts} />;
          }}
        />
      )}

      <CrudDrawer
        open={drawerOpen} onOpenChange={setDrawerOpen}
        title={editing ? "Editar vínculo" : "Vincular atributo"}
        loading={saving} onSubmit={handleSave}
      >
        <div className="space-y-4">
          {!editing && (
            <SelectField label="Atributo" required value={(form.attribute_id as string) ?? ""}
              onChange={(v) => setForm((p) => ({ ...p, attribute_id: v }))}
              options={attrOptions} placeholder="Selecione..." />
          )}
          <FormRow>
            <FormField label="Obrigatório">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_required} onCheckedChange={(v) => setForm((p) => ({ ...p, is_required: v }))} />
                <span className="text-sm text-muted-foreground">Produto deve informar</span>
              </div>
            </FormField>
            <FormField label="Eixo de variação">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_variant_axis}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, is_variant_axis: v }))} />
                <span className="text-sm text-muted-foreground">Gera SKUs distintos</span>
              </div>
            </FormField>
          </FormRow>
          <FormField label="Ordem">
            <Input type="number" value={(form.sort_order as number) ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))} />
          </FormField>
        </div>
      </CrudDrawer>

      <CrudDeleteDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        resourceName="vínculo"
        itemLabel={deleting?.attribute?.name}
        onConfirm={handleDelete}
      />
    </CrudPage>
  );
}
