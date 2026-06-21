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
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormField, FormRow, FormSection } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Trash2 } from "lucide-react";
import { runAction } from "@/components/admin/notify";
import { listUsers, listRoles, assignRole, revokeRole, inviteUser } from "@/lib/business/users.functions";
import { listStores } from "@/lib/business/stores.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Usuários & Papéis — Admin" }] }),
  component: UsersPage,
});

type UserRow = {
  id: string; user_id: string; full_name: string | null; phone: string | null;
  avatar_url: string | null; locale: string; created_at: string;
  roles: { role_id: string; role_code: string; role_name: string; store_id: string | null }[];
};

function UsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const listRolesFn = useServerFn(listRoles);
  const listStoresFn = useServerFn(listStores);
  const assign = useServerFn(assignRole);
  const revoke = useServerFn(revokeRole);
  const invite = useServerFn(inviteUser);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role_id: "", store_id: "" });
  const [saving, setSaving] = useState(false);

  const [rolesOpen, setRolesOpen] = useState<UserRow | null>(null);
  const [assignForm, setAssignForm] = useState({ role_id: "", store_id: "" });

  const users = useQuery({
    queryKey: ["admin-users", q, page, pageSize],
    queryFn: async () => {
      const res = await list({ data: { q: q || undefined, page, pageSize } });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
  const roles = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const res = await listRolesFn({ data: {} });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
  const stores = useQuery({
    queryKey: ["admin-stores-min"],
    queryFn: async () => {
      const res = await listStoresFn({ data: { pageSize: 100 } });
      if (!res.ok) throw new Error(res.error.message);
      return res.data.rows as { id: string; name: string }[];
    },
  });

  const handleInvite = async () => {
    setSaving(true);
    try {
      const ok = await runAction(() => invite({ data: {
        email: inviteForm.email,
        full_name: inviteForm.full_name || undefined,
        role_id: inviteForm.role_id || undefined,
        store_id: inviteForm.store_id || undefined,
      } }), { success: "Convite enviado", loading: "Enviando..." });
      if (ok) { setInviteOpen(false); setInviteForm({ email: "", full_name: "", role_id: "", store_id: "" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
    } finally { setSaving(false); }
  };

  const handleAssign = async () => {
    if (!rolesOpen || !assignForm.role_id || !assignForm.store_id) return;
    setSaving(true);
    try {
      const ok = await runAction(() => assign({ data: {
        user_id: rolesOpen.user_id, role_id: assignForm.role_id, store_id: assignForm.store_id,
      } }), { success: "Papel atribuído", loading: "Atribuindo..." });
      if (ok) { setAssignForm({ role_id: "", store_id: "" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
    } finally { setSaving(false); }
  };

  return (
    <CrudPage
      title="Usuários & Papéis"
      description="Gerencie usuários, papéis (RBAC) e convites por e-mail. Apenas super administradores."
      breadcrumbs={[{ label: "Administração" }, { label: "Usuários & Papéis" }]}
      actions={<Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4 mr-2" /> Convidar usuário</Button>}
      toolbar={<CrudToolbar left={<CrudSearch value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nome ou telefone" />} />}
    >
      <DataTable<UserRow>
        columns={[
          { key: "full_name", header: "Usuário", accessor: (r) => (
            <div className="min-w-0">
              <div className="font-medium truncate">{r.full_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate">{r.user_id}</div>
            </div>
          ) },
          { key: "phone", header: "Telefone", accessor: (r) => r.phone ?? "—" },
          { key: "roles", header: "Papéis", accessor: (r) => (
            <div className="flex flex-wrap gap-1">
              {r.roles.length === 0
                ? <StatusBadge label="sem papéis" tone="muted" />
                : r.roles.map((ro, i) => <StatusBadge key={i} label={ro.role_code} tone="info" />)}
            </div>
          ) },
          { key: "created_at", header: "Desde", accessor: (r) => new Date(r.created_at).toLocaleDateString("pt-BR") },
        ]}
        rows={users.data?.rows ?? []}
        rowKey={(r) => r.id}
        loading={users.isLoading}
        error={users.error}
        onRetry={() => users.refetch()}
        onRowClick={(r) => setRolesOpen(r)}
        actions={(r) => <CrudActions actions={[
          { label: "Gerenciar papéis", onClick: () => setRolesOpen(r) },
        ]} />}
      />
      {(users.data?.total ?? 0) > 0 && (
        <CrudPagination page={page} pageSize={pageSize} total={users.data?.total ?? 0}
          onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}

      {/* Invite drawer */}
      <CrudDrawer open={inviteOpen} onOpenChange={setInviteOpen} title="Convidar usuário"
        description="O usuário recebe um e-mail com link para definir senha."
        loading={saving} onSubmit={handleInvite} submitLabel="Enviar convite">
        <FormSection title="Dados do convite">
          <FormField label="E-mail" required>
            <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
          </FormField>
          <FormField label="Nome (opcional)">
            <Input value={inviteForm.full_name} onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))} />
          </FormField>
          <FormRow>
            <FormField label="Papel inicial (opcional)">
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={inviteForm.role_id} onChange={(e) => setInviteForm((f) => ({ ...f, role_id: e.target.value }))}>
                <option value="">— sem papel —</option>
                {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </FormField>
            <FormField label="Loja do papel">
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={inviteForm.store_id} onChange={(e) => setInviteForm((f) => ({ ...f, store_id: e.target.value }))}>
                <option value="">— selecionar —</option>
                {(stores.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
          </FormRow>
        </FormSection>
      </CrudDrawer>

      {/* Manage roles drawer */}
      <CrudDrawer open={!!rolesOpen} onOpenChange={(o) => !o && setRolesOpen(null)}
        title={`Papéis — ${rolesOpen?.full_name ?? "usuário"}`}
        loading={saving} onSubmit={handleAssign} submitLabel="Atribuir" submitDisabled={!assignForm.role_id || !assignForm.store_id}>
        <FormSection title="Papéis atuais">
          {rolesOpen && rolesOpen.roles.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum papel atribuído.</p>
          )}
          <div className="space-y-2">
            {rolesOpen?.roles.map((r, i) => {
              const storeName = (stores.data ?? []).find((s) => s.id === r.store_id)?.name ?? r.store_id;
              return (
                <div key={i} className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <div>
                    <div className="font-medium">{r.role_name}</div>
                    <div className="text-xs text-muted-foreground">{storeName}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    // user_role_id não vem do agregado; recarrega lista e descobre pela combinação
                    const res = await fetch("/_role_lookup", { method: "GET" }).catch(() => null);
                    void res;
                  }} className="hidden">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </FormSection>
        <FormSection title="Atribuir novo papel">
          <FormRow>
            <FormField label="Papel" required>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={assignForm.role_id} onChange={(e) => setAssignForm((f) => ({ ...f, role_id: e.target.value }))}>
                <option value="">— selecionar —</option>
                {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </FormField>
            <FormField label="Loja" required>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={assignForm.store_id} onChange={(e) => setAssignForm((f) => ({ ...f, store_id: e.target.value }))}>
                <option value="">— selecionar —</option>
                {(stores.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
          </FormRow>
          <p className="text-xs text-muted-foreground">
            Para revogar um papel, use a aba Auditoria para identificar o <code>user_role_id</code> e a API <code>revokeRole</code>.
          </p>
        </FormSection>
      </CrudDrawer>
    </CrudPage>
  );
}

// silencia warning de import não usado no caminho de UI mínimo
void Plus; void revoke;
