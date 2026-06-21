import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CrudDrawer } from "@/components/admin/crud-drawer";
import { FormField, FormRow, FormSection } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Trash2, KeyRound, ShieldAlert, ShieldOff, UserCheck, UserX, Plus, Copy } from "lucide-react";
import { runAction } from "@/components/admin/notify";
import {
  getUser, updateProfile, assignRole, revokeRole, setUserActive, blockUser, unblockUser,
  forcePasswordChange, resetPassword, revokeSession, listUserAudit, listRoles,
} from "@/lib/business/users.functions";
import { listStores } from "@/lib/business/stores.functions";

type Props = { userId: string | null; onClose: () => void };

export function UserDetailDrawer({ userId, onClose }: Props) {
  const qc = useQueryClient();
  const getUserFn = useServerFn(getUser);
  const listRolesFn = useServerFn(listRoles);
  const listStoresFn = useServerFn(listStores);
  const listAuditFn = useServerFn(listUserAudit);
  const updateProfileFn = useServerFn(updateProfile);
  const assignFn = useServerFn(assignRole);
  const revokeFn = useServerFn(revokeRole);
  const setActiveFn = useServerFn(setUserActive);
  const blockFn = useServerFn(blockUser);
  const unblockFn = useServerFn(unblockUser);
  const forceFn = useServerFn(forcePasswordChange);
  const resetFn = useServerFn(resetPassword);
  const revokeSessFn = useServerFn(revokeSession);

  const open = !!userId;
  const detail = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      const r = await getUserFn({ data: { user_id: userId! } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
    enabled: open,
  });
  const roles = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const r = await listRolesFn({ data: {} });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
    enabled: open,
  });
  const stores = useQuery({
    queryKey: ["admin-stores-min"],
    queryFn: async () => {
      const r = await listStoresFn({ data: { pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as { id: string; name: string }[];
    },
    enabled: open,
  });
  const audit = useQuery({
    queryKey: ["admin-user-audit", userId],
    queryFn: async () => {
      const r = await listAuditFn({ data: { user_id: userId! } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
    enabled: open,
  });

  // ===== Profile form state =====
  const [profile, setProfile] = useState({ full_name: "", phone: "", job_title: "", avatar_url: "", locale: "pt-BR", default_store_id: "" });
  useEffect(() => {
    if (detail.data?.profile) {
      const p = detail.data.profile;
      setProfile({
        full_name: p.full_name ?? "",
        phone: p.phone ?? "",
        job_title: (p as { job_title?: string | null }).job_title ?? "",
        avatar_url: p.avatar_url ?? "",
        locale: p.locale ?? "pt-BR",
        default_store_id: (p as { default_store_id?: string | null }).default_store_id ?? "",
      });
    }
  }, [detail.data?.profile]);

  // ===== Assign role form =====
  const [assignForm, setAssignForm] = useState({ role_id: "", store_id: "" });
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    qc.invalidateQueries({ queryKey: ["admin-user-audit", userId] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-users-dashboard"] });
  };

  if (!userId) return null;
  const p = detail.data?.profile;
  const isBlocked = !!p?.is_blocked;
  const isActive = !!p?.is_active;

  const handleSaveProfile = async () => {
    setBusy(true);
    try {
      const ok = await runAction(() => updateProfileFn({ data: { user_id: userId, ...profile, default_store_id: profile.default_store_id || null } }),
        { loading: "Salvando...", success: "Perfil atualizado" });
      if (ok) refresh();
    } finally { setBusy(false); }
  };

  const handleAssign = async () => {
    if (!assignForm.role_id || !assignForm.store_id) return;
    setBusy(true);
    try {
      const ok = await runAction(() => assignFn({ data: { user_id: userId, ...assignForm } }),
        { loading: "Atribuindo...", success: "Papel atribuído" });
      if (ok) { setAssignForm({ role_id: "", store_id: "" }); refresh(); }
    } finally { setBusy(false); }
  };

  const handleRevoke = async (user_role_id: string) => {
    setBusy(true);
    try {
      const ok = await runAction(() => revokeFn({ data: { user_role_id } }),
        { loading: "Revogando...", success: "Papel revogado" });
      if (ok) refresh();
    } finally { setBusy(false); }
  };

  const handleToggleActive = async () => {
    setBusy(true);
    try {
      const ok = await runAction(() => setActiveFn({ data: { user_id: userId, active: !isActive } }),
        { loading: "Aplicando...", success: isActive ? "Usuário desativado" : "Usuário ativado" });
      if (ok) refresh();
    } finally { setBusy(false); }
  };

  const handleBlock = async () => {
    setBusy(true);
    try {
      const ok = await runAction(() => blockFn({ data: { user_id: userId, reason: blockReason } }),
        { loading: "Bloqueando...", success: "Usuário bloqueado" });
      if (ok) { setBlockOpen(false); setBlockReason(""); refresh(); }
    } finally { setBusy(false); }
  };
  const handleUnblock = async () => {
    setBusy(true);
    try {
      const ok = await runAction(() => unblockFn({ data: { user_id: userId } }),
        { loading: "Desbloqueando...", success: "Usuário desbloqueado" });
      if (ok) refresh();
    } finally { setBusy(false); }
  };

  const handleForcePassword = async (force: boolean) => {
    setBusy(true);
    try {
      const ok = await runAction(() => forceFn({ data: { user_id: userId, force } }),
        { loading: "Aplicando...", success: force ? "Troca de senha exigida no próximo login" : "Exigência removida" });
      if (ok) refresh();
    } finally { setBusy(false); }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      const r = await resetFn({ data: { user_id: userId } });
      if (r.ok) {
        setResetLink(r.data.action_link ?? null);
        runAction(async () => ({ ok: true as const, data: null }), { success: "Link de redefinição gerado" });
      } else {
        runAction(async () => r, { success: "" });
      }
    } finally { setBusy(false); }
  };

  const handleRevokeSession = async (session_id: string) => {
    setBusy(true);
    try {
      const ok = await runAction(() => revokeSessFn({ data: { session_id } }),
        { loading: "Revogando...", success: "Sessão revogada" });
      if (ok) refresh();
    } finally { setBusy(false); }
  };

  const initials = (p?.full_name ?? p?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <>
      <CrudDrawer
        open={open}
        onOpenChange={(o) => !o && onClose()}
        width="sm:max-w-3xl"
        title={
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10">
              {p?.avatar_url && <AvatarImage src={p.avatar_url} alt="" />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate">{p?.full_name ?? "Sem nome"}</div>
              <div className="text-xs font-normal text-muted-foreground truncate">{p?.email ?? "—"}</div>
            </div>
            <div className="ml-auto flex gap-1">
              {isBlocked && <StatusBadge label="Bloqueado" tone="danger" />}
              {!isActive && <StatusBadge label="Inativo" tone="warning" />}
              {isActive && !isBlocked && <StatusBadge label="Ativo" tone="success" />}
            </div>
          </div>
        }
      >
        {detail.isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="roles">Papéis</TabsTrigger>
              <TabsTrigger value="permissions">Permissões</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
              <TabsTrigger value="sessions">Sessões</TabsTrigger>
              <TabsTrigger value="audit">Auditoria</TabsTrigger>
            </TabsList>

            {/* PROFILE */}
            <TabsContent value="profile" className="pt-4">
              <FormSection title="Dados pessoais">
                <FormRow>
                  <FormField label="Nome completo">
                    <Input value={profile.full_name} onChange={(e) => setProfile((f) => ({ ...f, full_name: e.target.value }))} />
                  </FormField>
                  <FormField label="Cargo">
                    <Input value={profile.job_title} onChange={(e) => setProfile((f) => ({ ...f, job_title: e.target.value }))} />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Telefone">
                    <Input value={profile.phone} onChange={(e) => setProfile((f) => ({ ...f, phone: e.target.value }))} />
                  </FormField>
                  <FormField label="Idioma">
                    <Input value={profile.locale} onChange={(e) => setProfile((f) => ({ ...f, locale: e.target.value }))} />
                  </FormField>
                </FormRow>
                <FormField label="Avatar (URL)">
                  <Input value={profile.avatar_url} onChange={(e) => setProfile((f) => ({ ...f, avatar_url: e.target.value }))} />
                </FormField>
                <FormField label="Loja padrão">
                  <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={profile.default_store_id} onChange={(e) => setProfile((f) => ({ ...f, default_store_id: e.target.value }))}>
                    <option value="">— nenhuma —</option>
                    {(stores.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </FormField>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar perfil
                  </Button>
                </div>
              </FormSection>
            </TabsContent>

            {/* ROLES */}
            <TabsContent value="roles" className="pt-4 space-y-4">
              <FormSection title="Papéis atribuídos">
                {detail.data?.roles.length === 0 && <p className="text-sm text-muted-foreground">Nenhum papel atribuído.</p>}
                <div className="space-y-2">
                  {detail.data?.roles.map((r) => (
                    <div key={r.user_role_id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">{r.role_name} <span className="text-xs text-muted-foreground">({r.role_code})</span></div>
                        <div className="text-xs text-muted-foreground truncate">Loja: {r.store_name ?? "—"}</div>
                      </div>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleRevoke(r.user_role_id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
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
                <div className="flex justify-end">
                  <Button onClick={handleAssign} disabled={busy || !assignForm.role_id || !assignForm.store_id}>
                    <Plus className="h-4 w-4 mr-2" />Atribuir
                  </Button>
                </div>
              </FormSection>
            </TabsContent>

            {/* PERMISSIONS */}
            <TabsContent value="permissions" className="pt-4">
              <FormSection title="Permissões efetivas" description="Calculadas a partir dos papéis atribuídos.">
                {detail.data?.permissions.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma permissão. Atribua um papel.</p>
                )}
                <div className="border rounded-md divide-y">
                  {detail.data?.permissions.map((perm) => (
                    <div key={perm.code} className="flex items-center justify-between p-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-mono text-xs">{perm.code}</div>
                        <div className="text-xs text-muted-foreground truncate">{perm.description ?? perm.module}</div>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {perm.source_roles.map((src) => <StatusBadge key={src} label={src} tone="info" />)}
                      </div>
                    </div>
                  ))}
                </div>
              </FormSection>
            </TabsContent>

            {/* SECURITY */}
            <TabsContent value="security" className="pt-4 space-y-4">
              <FormSection title="Status da conta">
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {isActive ? <UserCheck className="h-4 w-4 text-emerald-600" /> : <UserX className="h-4 w-4 text-amber-600" />}
                      Conta {isActive ? "ativa" : "inativa"}
                    </div>
                    <div className="text-xs text-muted-foreground">Usuários inativos não podem fazer login.</div>
                  </div>
                  <Switch checked={isActive} onCheckedChange={handleToggleActive} disabled={busy} />
                </div>

                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <ShieldAlert className={`h-4 w-4 ${isBlocked ? "text-red-600" : "text-muted-foreground"}`} />
                      {isBlocked ? "Bloqueado" : "Não bloqueado"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isBlocked ? `Motivo: ${p?.blocked_reason ?? "—"}` : "Bloqueia login e encerra sessões ativas."}
                    </div>
                  </div>
                  {isBlocked
                    ? <Button size="sm" variant="outline" onClick={handleUnblock} disabled={busy}><ShieldOff className="h-4 w-4 mr-2" />Desbloquear</Button>
                    : <Button size="sm" variant="destructive" onClick={() => setBlockOpen(true)} disabled={busy}><ShieldAlert className="h-4 w-4 mr-2" />Bloquear</Button>}
                </div>
              </FormSection>

              <FormSection title="Senha">
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <div className="font-medium text-sm">Forçar troca no próximo login</div>
                    <div className="text-xs text-muted-foreground">Usuário precisará definir nova senha ao entrar.</div>
                  </div>
                  <Switch checked={!!p?.must_change_password} onCheckedChange={(v) => handleForcePassword(v)} disabled={busy} />
                </div>
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" />Redefinir senha</div>
                    <div className="text-xs text-muted-foreground">Gera link de recuperação (também enviado por e-mail).</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleReset} disabled={busy}>Gerar link</Button>
                </div>
                {resetLink && (
                  <div className="border rounded-md p-3 bg-muted/40 text-xs space-y-2">
                    <div className="font-medium">Link gerado (válido por curto período):</div>
                    <div className="flex gap-2 items-start">
                      <code className="flex-1 break-all">{resetLink}</code>
                      <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(resetLink)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </FormSection>
            </TabsContent>

            {/* SESSIONS */}
            <TabsContent value="sessions" className="pt-4">
              <FormSection title="Sessões registradas">
                {detail.data?.sessions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>}
                <div className="space-y-2">
                  {detail.data?.sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{String(s.ip ?? "—")}</div>
                        <div className="text-xs text-muted-foreground truncate">{s.user_agent ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          Última atividade: {s.last_seen_at ? new Date(s.last_seen_at).toLocaleString("pt-BR") : "—"}
                        </div>
                      </div>
                      {s.revoked_at
                        ? <StatusBadge label="revogada" tone="muted" />
                        : <Button size="sm" variant="ghost" onClick={() => handleRevokeSession(s.id)} disabled={busy}>Revogar</Button>}
                    </div>
                  ))}
                </div>
              </FormSection>
            </TabsContent>

            {/* AUDIT */}
            <TabsContent value="audit" className="pt-4">
              <FormSection title="Histórico de auditoria">
                {audit.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
                {audit.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>}
                <div className="space-y-2">
                  {audit.data?.map((a) => (
                    <div key={a.id} className="border rounded-md p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <StatusBadge label={a.action} tone="info" />
                        <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      {a.diff && Object.keys(a.diff as object).length > 0 && (
                        <pre className="text-xs mt-2 bg-muted/40 rounded p-2 overflow-x-auto">{JSON.stringify(a.diff, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </FormSection>
            </TabsContent>
          </Tabs>
        )}
      </CrudDrawer>

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title="Bloquear usuário"
        description={
          <div className="space-y-3">
            <p>O usuário não conseguirá mais acessar o sistema e suas sessões serão encerradas.</p>
            <FormField label="Motivo do bloqueio" required>
              <Textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} rows={3} />
            </FormField>
          </div>
        }
        confirmLabel="Bloquear"
        destructive
        onConfirm={handleBlock}
      />
    </>
  );
}
