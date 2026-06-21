import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CrudPage } from "@/components/admin/crud-page";
import { CrudToolbar } from "@/components/admin/crud-toolbar";
import { CrudSearch } from "@/components/admin/crud-search";
import { CrudPagination } from "@/components/admin/crud-pagination";
import { CrudActions } from "@/components/admin/crud-actions";
import { CrudDrawer } from "@/components/admin/crud-drawer";
import { CrudDeleteDialog } from "@/components/admin/crud-delete-dialog";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormField, FormRow, FormSection } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { runAction } from "@/components/admin/notify";
import { listStores, createStore, updateStore, archiveStore } from "@/lib/business/stores.functions";

export const Route = createFileRoute("/_authenticated/admin/stores")({
  head: () => ({ meta: [{ title: "Lojas — Admin" }] }),
  component: StoresPage,
});

type Store = {
  id: string; name: string; slug: string; legal_name: string | null; cnpj: string | null;
  status: string; default_currency: string; timezone: string; logo_url: string | null;
  deleted_at: string | null;
};

function StoresPage() {
  const qc = useQueryClient();
  const list = useServerFn(listStores);
  const create = useServerFn(createStore);
  const update = useServerFn(updateStore);
  const archive = useServerFn(archiveStore);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [deleting, setDeleting] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["stores", q, page, pageSize],
    queryFn: async () => {
      const res = await list({ data: { q: q || undefined, page, pageSize } });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", slug: "", legal_name: "", cnpj: "", default_currency: "BRL", timezone: "America/Sao_Paulo", logo_url: "" });
    setDrawerOpen(true);
  };
  const openEdit = (s: Store) => {
    setEditing(s);
    setForm({
      name: s.name, slug: s.slug, legal_name: s.legal_name ?? "", cnpj: s.cnpj ?? "",
      default_currency: s.default_currency, timezone: s.timezone, logo_url: s.logo_url ?? "",
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        const ok = await runAction(() => update({ data: { id: editing.id, patch: form } }), { success: "Loja atualizada", loading: "Salvando..." });
        if (ok) { setDrawerOpen(false); qc.invalidateQueries({ queryKey: ["stores"] }); }
      } else {
        const ok = await runAction(() => create({ data: form as never }), { success: "Loja criada", loading: "Criando..." });
        if (ok) { setDrawerOpen(false); qc.invalidateQueries({ queryKey: ["stores"] }); }
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const ok = await runAction(() => archive({ data: { id: deleting.id } }), { success: "Loja arquivada", loading: "Arquivando..." });
    if (ok) { setDeleting(null); qc.invalidateQueries({ queryKey: ["stores"] }); }
  };

  return (
    <CrudPage
      title="Lojas"
      description="Cadastro de lojas. Apenas super administradores podem criar ou arquivar."
      breadcrumbs={[{ label: "Administração" }, { label: "Lojas" }]}
      actions={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nova loja</Button>}
      toolbar={<CrudToolbar left={<CrudSearch value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nome, slug, CNPJ" />} />}
    >
      <DataTable<Store>
        columns={[
          { key: "name", header: "Loja", accessor: (r) => (
            <div className="min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground truncate">/{r.slug}</div>
            </div>
          ) },
          { key: "legal_name", header: "Razão social", accessor: (r) => r.legal_name ?? "—" },
          { key: "cnpj", header: "CNPJ", accessor: (r) => <code className="text-xs">{r.cnpj ?? "—"}</code> },
          { key: "default_currency", header: "Moeda", accessor: (r) => r.default_currency },
          { key: "status", header: "Status", accessor: (r) =>
            <StatusBadge label={r.status} tone={r.status === "active" ? "success" : "muted"} dot /> },
        ]}
        rows={query.data?.rows ?? []}
        rowKey={(r) => r.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={openEdit}
        actions={(row) => <CrudActions actions={[
          { label: "Editar", onClick: () => openEdit(row) },
          { label: "Arquivar", onClick: () => setDeleting(row), destructive: true },
        ]} />}
      />
      {(query.data?.total ?? 0) > 0 && (
        <CrudPagination page={page} pageSize={pageSize} total={query.data?.total ?? 0}
          onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}

      <CrudDrawer open={drawerOpen} onOpenChange={setDrawerOpen}
        title={editing ? "Editar loja" : "Nova loja"} loading={saving} onSubmit={handleSave} width="sm:max-w-2xl">
        <FormSection title="Identificação">
          <FormRow>
            <FormField label="Nome" required><Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></FormField>
            <FormField label="Slug" required><Input value={form.slug ?? ""} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} /></FormField>
          </FormRow>
          <FormRow>
            <FormField label="Razão social"><Input value={form.legal_name ?? ""} onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))} /></FormField>
            <FormField label="CNPJ"><Input value={form.cnpj ?? ""} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} /></FormField>
          </FormRow>
        </FormSection>
        <FormSection title="Operação">
          <FormRow>
            <FormField label="Moeda"><Input value={form.default_currency ?? "BRL"} onChange={(e) => setForm((f) => ({ ...f, default_currency: e.target.value }))} /></FormField>
            <FormField label="Timezone"><Input value={form.timezone ?? "America/Sao_Paulo"} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} /></FormField>
          </FormRow>
          <FormField label="Logo URL"><Input type="url" value={form.logo_url ?? ""} onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))} /></FormField>
        </FormSection>
      </CrudDrawer>

      <CrudDeleteDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        resourceName="loja" itemLabel={deleting?.name} onConfirm={handleDelete} />
    </CrudPage>
  );
}
