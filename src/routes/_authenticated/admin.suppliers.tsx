import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/admin/master-crud-page";
import { FormField, FormRow, FormSection } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/lib/business/suppliers.functions";

export const Route = createFileRoute("/_authenticated/admin/suppliers")({
  head: () => ({ meta: [{ title: "Fornecedores — Admin" }] }),
  component: SuppliersPage,
});

type Supplier = {
  id: string; store_id: string; legal_name: string; trade_name: string | null;
  code: string | null; tax_id: string | null; email: string | null; phone: string | null;
  website: string | null; payment_terms: string | null; lead_time_days: number | null;
  notes: string | null; is_active: boolean;
};

function SuppliersPage() {
  return (
    <MasterCrudPage<Supplier>
      title="Fornecedores"
      description="Cadastro mestre de fornecedores da operação."
      breadcrumbs={[{ label: "Estoque & Compras" }, { label: "Fornecedores" }]}
      resourceName="fornecedor"
      queryKey="suppliers"
      list={listSuppliers} create={createSupplier as never} update={updateSupplier as never} remove={deleteSupplier}
      searchPlaceholder="Buscar por razão, fantasia, CNPJ ou código"
      columns={[
        { key: "legal_name", header: "Razão social",
          accessor: (r) => (
            <div className="min-w-0">
              <div className="font-medium truncate">{r.legal_name}</div>
              {r.trade_name && <div className="text-xs text-muted-foreground truncate">{r.trade_name}</div>}
            </div>
          ) },
        { key: "code", header: "Código", accessor: (r) => r.code ?? "—" },
        { key: "tax_id", header: "CNPJ/Doc", accessor: (r) => <code className="text-xs">{r.tax_id ?? "—"}</code> },
        { key: "email", header: "Contato",
          accessor: (r) => (
            <div className="text-xs text-muted-foreground">
              {r.email ?? "—"}{r.phone ? <><br />{r.phone}</> : null}
            </div>
          ) },
        { key: "lead_time_days", header: "Lead time", align: "right",
          accessor: (r) => r.lead_time_days ? `${r.lead_time_days} d` : "—" },
        { key: "is_active", header: "Status",
          accessor: (r) => <StatusBadge label={r.is_active ? "Ativo" : "Inativo"} tone={r.is_active ? "success" : "muted"} dot /> },
      ]}
      itemLabel={(r) => r.legal_name}
      emptyForm={() => ({
        legal_name: "", trade_name: "", code: "", tax_id: "", email: "", phone: "",
        website: "", payment_terms: "", lead_time_days: 0, notes: "", is_active: true,
      })}
      toForm={(r) => ({ ...r })}
      formWidth="sm:max-w-2xl"
      renderForm={(form, setForm) => (
        <>
          <FormSection title="Identificação">
            <FormRow>
              <FormField label="Razão social" required>
                <Input value={(form.legal_name as string) ?? ""} onChange={(e) => setForm({ legal_name: e.target.value })} />
              </FormField>
              <FormField label="Nome fantasia">
                <Input value={(form.trade_name as string) ?? ""} onChange={(e) => setForm({ trade_name: e.target.value })} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Código interno">
                <Input value={(form.code as string) ?? ""} onChange={(e) => setForm({ code: e.target.value })} />
              </FormField>
              <FormField label="CNPJ / Documento">
                <Input value={(form.tax_id as string) ?? ""} onChange={(e) => setForm({ tax_id: e.target.value })} />
              </FormField>
            </FormRow>
          </FormSection>
          <FormSection title="Contato">
            <FormRow>
              <FormField label="E-mail">
                <Input type="email" value={(form.email as string) ?? ""} onChange={(e) => setForm({ email: e.target.value })} />
              </FormField>
              <FormField label="Telefone">
                <Input value={(form.phone as string) ?? ""} onChange={(e) => setForm({ phone: e.target.value })} />
              </FormField>
            </FormRow>
            <FormField label="Website">
              <Input type="url" value={(form.website as string) ?? ""} onChange={(e) => setForm({ website: e.target.value })} />
            </FormField>
          </FormSection>
          <FormSection title="Comercial">
            <FormRow>
              <FormField label="Condições de pagamento" hint="Ex: 30/60/90 dias.">
                <Input value={(form.payment_terms as string) ?? ""} onChange={(e) => setForm({ payment_terms: e.target.value })} />
              </FormField>
              <FormField label="Lead time (dias)">
                <Input type="number" value={(form.lead_time_days as number) ?? 0}
                  onChange={(e) => setForm({ lead_time_days: Number(e.target.value) })} />
              </FormField>
            </FormRow>
            <FormField label="Observações">
              <Textarea rows={3} value={(form.notes as string) ?? ""} onChange={(e) => setForm({ notes: e.target.value })} />
            </FormField>
            <FormField label="Ativo">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ is_active: v })} />
                <span className="text-sm text-muted-foreground">{form.is_active ? "Disponível para compras" : "Bloqueado"}</span>
              </div>
            </FormField>
          </FormSection>
        </>
      )}
    />
  );
}
