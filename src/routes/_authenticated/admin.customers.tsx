import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/admin/master-crud-page";
import { FormField, FormRow, FormSection } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listCustomers, createCustomer, updateCustomer, deleteCustomer,
} from "@/lib/business/customers.functions";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({ meta: [{ title: "Clientes — Admin" }] }),
  component: CustomersPage,
});

type Customer = {
  id: string;
  store_id: string;
  type: "pf" | "pj";
  status: "active" | "inactive" | "blocked";
  segment: string;
  code: string | null;
  name: string;
  legal_name: string | null;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  doc_number: string | null;
  credit_limit: number;
  marketing_opt_in: boolean;
  notes: string | null;
};

const SEGMENTS: { v: string; label: string }[] = [
  { v: "retail", label: "Varejo" },
  { v: "wholesale", label: "Atacado" },
  { v: "rep", label: "Representante" },
  { v: "distributor", label: "Distribuidor" },
  { v: "reseller", label: "Revendedor" },
  { v: "vip", label: "VIP" },
];

const STATUS_LABELS: Record<string, { label: string; tone: "success" | "warning" | "muted" | "danger" }> = {
  active: { label: "Ativo", tone: "success" },
  inactive: { label: "Inativo", tone: "muted" },
  blocked: { label: "Bloqueado", tone: "danger" },
};

function formatDoc(type: string, doc: string | null) {
  if (!doc) return "—";
  if (type === "pf" && doc.length === 11) return `${doc.slice(0,3)}.${doc.slice(3,6)}.${doc.slice(6,9)}-${doc.slice(9)}`;
  if (type === "pj" && doc.length === 14) return `${doc.slice(0,2)}.${doc.slice(2,5)}.${doc.slice(5,8)}/${doc.slice(8,12)}-${doc.slice(12)}`;
  return doc;
}

function CustomersPage() {
  return (
    <MasterCrudPage<Customer>
      title="Clientes"
      description="Cadastro mestre de clientes PF e PJ."
      breadcrumbs={[{ label: "Vendas" }, { label: "Clientes" }]}
      resourceName="cliente"
      queryKey="customers"
      list={listCustomers}
      create={createCustomer as never}
      update={updateCustomer as never}
      remove={deleteCustomer}
      searchPlaceholder="Buscar por nome, documento, e-mail ou código"
      columns={[
        {
          key: "name", header: "Nome / Razão",
          accessor: (r) => (
            <div className="min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              {r.trade_name && <div className="text-xs text-muted-foreground truncate">{r.trade_name}</div>}
            </div>
          ),
        },
        { key: "type", header: "Tipo", accessor: (r) => (r.type === "pf" ? "PF" : "PJ") },
        { key: "doc_number", header: "Documento", accessor: (r) => <code className="text-xs">{formatDoc(r.type, r.doc_number)}</code> },
        {
          key: "email", header: "Contato",
          accessor: (r) => (
            <div className="text-xs text-muted-foreground">
              {r.email ?? "—"}{r.phone ? <><br />{r.phone}</> : null}
            </div>
          ),
        },
        { key: "segment", header: "Segmento", accessor: (r) => SEGMENTS.find((s) => s.v === r.segment)?.label ?? r.segment },
        {
          key: "status", header: "Status",
          accessor: (r) => {
            const s = STATUS_LABELS[r.status] ?? STATUS_LABELS.inactive;
            return <StatusBadge label={s.label} tone={s.tone} dot />;
          },
        },
      ]}
      itemLabel={(r) => r.name}
      emptyForm={() => ({
        type: "pf", name: "", code: "", legal_name: "", trade_name: "",
        email: "", phone: "", doc_number: "", segment: "retail",
        credit_limit: 0, marketing_opt_in: false, notes: "", status: "active",
      })}
      toForm={(r) => ({ ...r })}
      formWidth="sm:max-w-2xl"
      renderForm={(form, setForm, mode) => (
        <>
          <FormSection title="Identificação">
            <FormRow>
              <FormField label="Tipo" required>
                <Select
                  value={(form.type as string) ?? "pf"}
                  onValueChange={(v) => setForm({ type: v })}
                  disabled={mode === "edit"}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pf">Pessoa Física</SelectItem>
                    <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Status">
                <Select value={(form.status as string) ?? "active"} onValueChange={(v) => setForm({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label={form.type === "pj" ? "Razão social" : "Nome completo"} required>
                <Input value={(form.name as string) ?? ""} onChange={(e) => setForm({ name: e.target.value })} />
              </FormField>
              <FormField label="Código interno">
                <Input value={(form.code as string) ?? ""} onChange={(e) => setForm({ code: e.target.value })} />
              </FormField>
            </FormRow>
            {form.type === "pj" && (
              <FormRow>
                <FormField label="Nome fantasia">
                  <Input value={(form.trade_name as string) ?? ""} onChange={(e) => setForm({ trade_name: e.target.value })} />
                </FormField>
                <FormField label="Razão social oficial">
                  <Input value={(form.legal_name as string) ?? ""} onChange={(e) => setForm({ legal_name: e.target.value })} />
                </FormField>
              </FormRow>
            )}
            <FormRow>
              <FormField label={form.type === "pj" ? "CNPJ" : "CPF"}>
                <Input
                  value={(form.doc_number as string) ?? ""}
                  onChange={(e) => setForm({ doc_number: e.target.value.replace(/\D/g, "") })}
                  placeholder={form.type === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
                />
              </FormField>
              <FormField label="Segmento">
                <Select value={(form.segment as string) ?? "retail"} onValueChange={(v) => setForm({ segment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          </FormSection>

          <FormSection title="Comercial">
            <FormRow>
              <FormField label="Limite de crédito" hint="R$">
                <Input
                  type="number" step="0.01" min={0}
                  value={(form.credit_limit as number) ?? 0}
                  onChange={(e) => setForm({ credit_limit: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="Aceita marketing">
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={!!form.marketing_opt_in} onCheckedChange={(v) => setForm({ marketing_opt_in: v })} />
                  <span className="text-sm text-muted-foreground">{form.marketing_opt_in ? "Sim" : "Não"}</span>
                </div>
              </FormField>
            </FormRow>
            <FormField label="Observações">
              <Textarea rows={3} value={(form.notes as string) ?? ""} onChange={(e) => setForm({ notes: e.target.value })} />
            </FormField>
          </FormSection>
        </>
      )}
    />
  );
}
