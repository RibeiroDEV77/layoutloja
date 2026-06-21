import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CrudDrawer } from "@/components/admin/crud-drawer";
import { FormField, FormRow, FormSection } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { runAction } from "@/components/admin/notify";
import { inviteUser, listRoles } from "@/lib/business/users.functions";
import { listStores } from "@/lib/business/stores.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess?: () => void;
};

export function InviteDrawer({ open, onOpenChange, onSuccess }: Props) {
  const invite = useServerFn(inviteUser);
  const listRolesFn = useServerFn(listRoles);
  const listStoresFn = useServerFn(listStores);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "", full_name: "", phone: "", job_title: "", role_id: "", store_id: "",
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

  const submit = async () => {
    setSaving(true);
    try {
      const ok = await runAction(
        () => invite({ data: {
          email: form.email,
          full_name: form.full_name || undefined,
          phone: form.phone || undefined,
          job_title: form.job_title || undefined,
          role_id: form.role_id || undefined,
          store_id: form.store_id || undefined,
        } }),
        { loading: "Enviando convite...", success: "Convite enviado" },
      );
      if (ok) {
        setForm({ email: "", full_name: "", phone: "", job_title: "", role_id: "", store_id: "" });
        onOpenChange(false);
        onSuccess?.();
      }
    } finally { setSaving(false); }
  };

  return (
    <CrudDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Convidar usuário"
      description="O usuário recebe um e-mail com link para definir senha. Ao acessar pela primeira vez, será obrigado a trocá-la."
      loading={saving}
      onSubmit={submit}
      submitLabel="Enviar convite"
      submitDisabled={!form.email.trim()}
    >
      <FormSection title="Dados do usuário">
        <FormField label="E-mail" required>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </FormField>
        <FormRow>
          <FormField label="Nome completo">
            <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </FormField>
          <FormField label="Cargo">
            <Input value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
          </FormField>
        </FormRow>
        <FormField label="Telefone">
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </FormField>
      </FormSection>
      <FormSection title="Papel inicial (opcional)">
        <FormRow>
          <FormField label="Papel">
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={form.role_id} onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}>
              <option value="">— sem papel —</option>
              {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </FormField>
          <FormField label="Loja">
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={form.store_id} onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}>
              <option value="">— selecionar —</option>
              {(stores.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
        </FormRow>
      </FormSection>
    </CrudDrawer>
  );
}
