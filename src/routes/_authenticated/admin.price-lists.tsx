import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/admin/master-crud-page";
import { FormField, FormRow } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  listPriceLists, createPriceList, updatePriceList, deletePriceList,
} from "@/lib/business/price-lists.functions";

export const Route = createFileRoute("/_authenticated/admin/price-lists")({
  head: () => ({ meta: [{ title: "Listas de Preço — Admin" }] }),
  component: PriceListsPage,
});

type PriceList = {
  id: string; store_id: string; code: string; name: string; currency: string;
  priority: number; starts_at: string | null; ends_at: string | null; is_active: boolean;
};

const fmt = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

function PriceListsPage() {
  return (
    <MasterCrudPage<PriceList>
      title="Listas de Preço"
      description="Tabelas de preços por moeda, prioridade e vigência."
      breadcrumbs={[{ label: "Vendas" }, { label: "Listas de Preço" }]}
      resourceName="lista"
      queryKey="price-lists"
      list={listPriceLists} create={createPriceList} update={updatePriceList} remove={deletePriceList}
      searchPlaceholder="Buscar por nome ou código"
      columns={[
        { key: "name", header: "Nome", accessor: (r) => <span className="font-medium">{r.name}</span> },
        { key: "code", header: "Código", accessor: (r) => <code className="text-xs text-muted-foreground">{r.code}</code> },
        { key: "currency", header: "Moeda", accessor: (r) => <StatusBadge label={r.currency} tone="info" /> },
        { key: "priority", header: "Prioridade", align: "right", accessor: (r) => r.priority },
        { key: "validity", header: "Vigência", accessor: (r) =>
          <span className="text-xs text-muted-foreground">{fmt(r.starts_at)} → {fmt(r.ends_at)}</span> },
        { key: "is_active", header: "Status",
          accessor: (r) => <StatusBadge label={r.is_active ? "Ativa" : "Inativa"} tone={r.is_active ? "success" : "muted"} dot /> },
      ]}
      itemLabel={(r) => r.name}
      emptyForm={() => ({
        code: "", name: "", currency: "BRL", priority: 0, starts_at: null, ends_at: null, is_active: true,
      })}
      toForm={(r) => ({
        ...r,
        starts_at: r.starts_at ? r.starts_at.slice(0, 10) : "",
        ends_at: r.ends_at ? r.ends_at.slice(0, 10) : "",
      })}
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
            <FormField label="Moeda" required hint="ISO 4217 (BRL, USD...).">
              <Input maxLength={3} value={(form.currency as string) ?? "BRL"}
                onChange={(e) => setForm({ currency: e.target.value.toUpperCase() })} />
            </FormField>
            <FormField label="Prioridade" hint="Maior valor vence em conflitos.">
              <Input type="number" value={(form.priority as number) ?? 0}
                onChange={(e) => setForm({ priority: Number(e.target.value) })} />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Início">
              <Input type="date" value={(form.starts_at as string) ?? ""}
                onChange={(e) => setForm({ starts_at: e.target.value || null })} />
            </FormField>
            <FormField label="Fim">
              <Input type="date" value={(form.ends_at as string) ?? ""}
                onChange={(e) => setForm({ ends_at: e.target.value || null })} />
            </FormField>
          </FormRow>
          <FormField label="Ativa">
            <div className="flex items-center gap-2">
              <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ is_active: v })} />
              <span className="text-sm text-muted-foreground">{form.is_active ? "Em uso" : "Desativada"}</span>
            </div>
          </FormField>
        </>
      )}
    />
  );
}
