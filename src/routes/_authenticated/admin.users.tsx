import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CrudPage } from "@/components/admin/crud-page";
import { CrudToolbar } from "@/components/admin/crud-toolbar";
import { CrudSearch } from "@/components/admin/crud-search";
import { CrudPagination } from "@/components/admin/crud-pagination";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { StatWidget, WidgetGrid } from "@/components/admin/widget";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, UserPlus, ShieldCheck, UserX, ShieldAlert, Crown } from "lucide-react";
import { runAction } from "@/components/admin/notify";
import { listUsers, usersDashboard, bootstrapStatus, claimSuperAdmin } from "@/lib/business/users.functions";
import { useAuth } from "@/hooks/use-auth";
import { InviteDrawer } from "@/components/admin/users/invite-drawer";
import { UserDetailDrawer } from "@/components/admin/users/user-detail-drawer";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Usuários & Papéis — Admin" }] }),
  component: UsersPage,
});

type UserRow = {
  id: string; user_id: string; full_name: string | null; email: string | null; phone: string | null;
  avatar_url: string | null; job_title: string | null; is_active: boolean; is_blocked: boolean;
  last_login_at: string | null; created_at: string;
  roles: { user_role_id: string; role_id: string; role_code: string; role_name: string; store_id: string | null }[];
};

function UsersPage() {
  const qc = useQueryClient();
  const { ctx, isSuperAdmin, refresh: refreshAuth } = useAuth();
  const list = useServerFn(listUsers);
  const dashFn = useServerFn(usersDashboard);
  const bootFn = useServerFn(bootstrapStatus);
  const claimFn = useServerFn(claimSuperAdmin);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "blocked">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const superAdmin = isSuperAdmin();

  const boot = useQuery({
    queryKey: ["admin-users-bootstrap"],
    queryFn: async () => {
      const r = await bootFn({ data: {} });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });

  const users = useQuery({
    queryKey: ["admin-users", q, status, page, pageSize],
    queryFn: async () => {
      const r = await list({ data: { q: q || undefined, status, page, pageSize } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
    enabled: superAdmin,
  });

  const dashboard = useQuery({
    queryKey: ["admin-users-dashboard"],
    queryFn: async () => {
      const r = await dashFn({ data: {} });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
    enabled: superAdmin,
  });

  const handleClaim = async () => {
    const ok = await runAction(() => claimFn({ data: {} }),
      { loading: "Solicitando privilégios...", success: "Você agora é Super Administrador" });
    if (ok) {
      await refreshAuth();
      qc.invalidateQueries({ queryKey: ["admin-users-bootstrap"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-users-dashboard"] });
    }
  };

  const showBootstrap = boot.data?.has_super_admin === false && !superAdmin;

  const columns = useMemo(() => [
    {
      key: "name", header: "Usuário", accessor: (r: UserRow) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-8 w-8">
            {r.avatar_url && <AvatarImage src={r.avatar_url} alt="" />}
            <AvatarFallback>{(r.full_name ?? r.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium truncate">{r.full_name ?? "—"}</div>
            <div className="text-xs text-muted-foreground truncate">{r.email ?? r.user_id}</div>
          </div>
        </div>
      ),
    },
    { key: "job_title", header: "Cargo", accessor: (r: UserRow) => r.job_title ?? "—" },
    {
      key: "roles", header: "Papéis", accessor: (r: UserRow) => (
        <div className="flex flex-wrap gap-1">
          {r.roles.length === 0
            ? <StatusBadge label="sem papéis" tone="muted" />
            : r.roles.slice(0, 3).map((ro) => <StatusBadge key={ro.user_role_id} label={ro.role_code} tone="info" />)}
          {r.roles.length > 3 && <StatusBadge label={`+${r.roles.length - 3}`} tone="muted" />}
        </div>
      ),
    },
    {
      key: "status", header: "Status", accessor: (r: UserRow) =>
        r.is_blocked ? <StatusBadge label="bloqueado" tone="danger" />
          : !r.is_active ? <StatusBadge label="inativo" tone="warning" />
          : <StatusBadge label="ativo" tone="success" />,
    },
    { key: "last_login_at", header: "Último login",
      accessor: (r: UserRow) => r.last_login_at ? new Date(r.last_login_at).toLocaleDateString("pt-BR") : "—" },
  ], []);

  return (
    <CrudPage
      title="Usuários & Papéis"
      description="Gerencie usuários, papéis (RBAC), convites por e-mail e segurança da conta."
      breadcrumbs={[{ label: "Administração" }, { label: "Usuários & Papéis" }]}
      actions={superAdmin && (
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Convidar usuário
        </Button>
      )}
      toolbar={superAdmin && (
        <CrudToolbar
          left={<CrudSearch value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nome, e-mail ou telefone" />}
          right={
            <select className="h-10 rounded-md border bg-background px-3 text-sm"
              value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="blocked">Bloqueados</option>
            </select>
          }
        />
      )}
    >
      {showBootstrap && (
        <Alert className="mb-4">
          <Crown className="h-4 w-4" />
          <AlertTitle>Nenhum super administrador configurado</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>
              O sistema ainda não tem um super administrador. Como você é o primeiro usuário autenticado, pode
              reivindicar esse papel agora.
            </span>
            <Button onClick={handleClaim} size="sm">Tornar-me super admin</Button>
          </AlertDescription>
        </Alert>
      )}

      {!superAdmin && !showBootstrap && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            Apenas super administradores podem acessar este módulo.
            {ctx?.user_id && <span className="block text-xs mt-1">Usuário atual: {ctx.user_id}</span>}
          </AlertDescription>
        </Alert>
      )}

      {superAdmin && (
        <>
          <WidgetGrid className="mb-4">
            <StatWidget title="Usuários ativos" value={dashboard.data?.active ?? "—"}
              icon={<Users className="h-4 w-4" />} loading={dashboard.isLoading} />
            <StatWidget title="Super admins" value={dashboard.data?.super_admins ?? "—"}
              icon={<ShieldCheck className="h-4 w-4" />} loading={dashboard.isLoading} />
            <StatWidget title="Inativos" value={dashboard.data?.inactive ?? "—"}
              icon={<UserX className="h-4 w-4" />} loading={dashboard.isLoading} />
            <StatWidget title="Bloqueados" value={dashboard.data?.blocked ?? "—"}
              icon={<ShieldAlert className="h-4 w-4" />} loading={dashboard.isLoading} />
          </WidgetGrid>

          <DataTable<UserRow>
            columns={columns}
            rows={(users.data?.rows as UserRow[]) ?? []}
            rowKey={(r) => r.id}
            loading={users.isLoading}
            error={users.error}
            onRetry={() => users.refetch()}
            onRowClick={(r) => setOpenUserId(r.user_id)}
          />
          {(users.data?.total ?? 0) > 0 && (
            <CrudPagination page={page} pageSize={pageSize} total={users.data?.total ?? 0}
              onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          )}
        </>
      )}

      <InviteDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["admin-users"] });
          qc.invalidateQueries({ queryKey: ["admin-users-dashboard"] });
        }}
      />
      <UserDetailDrawer userId={openUserId} onClose={() => setOpenUserId(null)} />
    </CrudPage>
  );
}
