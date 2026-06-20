import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/admin/master-crud-page";
import { FormField, FormRow } from "@/components/admin/form-field";
import { SelectField } from "@/components/admin/select-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  listCustomerGroups, createCustomerGroup, updateCustomerGroup, deleteCustomerGroup,
} from "@/lib/business/customer-groups.functions";

export const Route = createFileRoute("/_authenticated/admin/customer-groups")({
  head: () => ({ meta: [{ title: "Grupos de Clientes — Admin" }] }),
  component: CustomerGroupsPage,
});

type CustomerGroup = {
  id: string; store_id: string; code: string; name: string;
  kind: "varejo" | "atacado" | "vip" | "representante" | "distribuidor" | "revendedor";
  default_discount_pct: number; requires_approval: boolean; description: string | null; is_active: boolean;
};

function CustomerGroupsPage() {
  return (
    <MasterCrudPage<CustomerGroup>
      title="Grupos de Clientes"
      description="Segmentação para preços e regras comerciais."
      breadcrumbs={[{ label: "Vendas" }, { label: "Grupos de Clientes" }]}
      resourceName="grupo"
      queryKey="customer-groups"
      list={listCustomerGroups} create={createCustomerGroup} update={updateCustomerGroup} remove={deleteCustomerGroup}
      searchPlaceholder="Buscar por nome ou código"
      columns={[
        { key: "name", header: "Nome", accessor: (r) => <span className="font-medium">{r.name}</span> },
        { key: "code", header: "Código", accessor: (r) => <code className="text-xs text-muted-foreground">{r.code}</code> },
        { key: "kind", header: "Tipo", accessor: (r) => <StatusBadge label={r.kind} tone="info" /> },
        { key: "discount", header: "Desconto", align: "right", accessor: (r) => `${r.default_discount_pct}%` },
        { key: "approval", header: "Aprovação",
          accessor: (r) => r.requires_approval ? <StatusBadge label="Requer" tone="warning" /> : <span className="text-muted-foreground">—</span> },
        { key: "is_active", header: "Status",
          accessor: (r) => <StatusBadge label={r.is_active ? "Ativo" : "Inativo"} tone={r.is_active ? "success" : "muted"} dot /> },
      ]}
      itemLabel={(r) => r.name}
      emptyForm={() => ({
        code: "", name: "", kind: "varejo", default_discount_pct: 0,
        requires_approval: false, description: "", is_active: true,
      })}
      toForm={(r) => ({ ...r })}
      renderForm={(form, setForm) => (
        <>
          <FormRow>
            <FormField label="Código" required>
              <Input value={(form.code as string) ?? ""} onChange={(e) => setForm({ code: e.target.value.toLowerCase() })} />
            </FormField>
            <FormField label="Nome" required>
              <Input value={(form.name as string) ?? ""} onChange={(e) => setForm({ name: e.target.value })} />
            </FormField>
          </FormRow>
          <FormRow>
            <SelectField label="Tipo" value={(form.kind as string) ?? "varejo"}
              onChange={(v) => setForm({ kind: v })}
              options={[
                { value: "varejo", label: "Varejo" },
                { value: "atacado", label: "Atacado" },
                { value: "vip", label: "VIP" },
                { value: "representante", label: "Representante" },
                { value: "distribuidor", label: "Distribuidor" },
                { value: "revendedor", label: "Revendedor" },
              ]} />
            <FormField label="Desconto padrão (%)">
              <Input type="number" step="0.01" value={(form.default_discount_pct as number) ?? 0}
                onChange={(e) => setForm({ default_discount_pct: Number(e.target.value) })} />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Requer aprovação">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.requires_approval} onCheckedChange={(v) => setForm({ requires_approval: v })} />
                <span className="text-sm text-muted-foreground">Novos clientes ficam pendentes</span>
              </div>
            </FormField>
            <FormField label="Ativo">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ is_active: v })} />
                <span className="text-sm text-muted-foreground">{form.is_active ? "Em uso" : "Desativado"}</span>
              </div>
            </FormField>
          </FormRow>
          <FormField label="Descrição">
            <Textarea rows={3} value={(form.description as string) ?? ""}
              onChange={(e) => setForm({ description: e.target.value })} />
          </FormField>
        </>
      )}
    />
  );
}
