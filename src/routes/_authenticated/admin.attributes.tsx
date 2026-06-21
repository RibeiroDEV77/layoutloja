import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/admin/master-crud-page";
import { FormField, FormRow } from "@/components/admin/form-field";
import { SelectField } from "@/components/admin/select-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { listAttributes, createAttribute, updateAttribute, deleteAttribute } from "@/lib/business/attributes.functions";

export const Route = createFileRoute("/_authenticated/admin/attributes")({
  head: () => ({ meta: [{ title: "Atributos — Admin" }] }),
  component: AttributesPage,
});

type Attribute = {
  id: string; store_id: string; code: string; name: string;
  input_type: "select" | "text" | "number" | "boolean";
  is_color: boolean; is_size: boolean; unit: string | null; description: string | null;
  is_filterable: boolean; filter_ui: "checkbox" | "color" | "size" | "range"; filter_order: number;
};

function AttributesPage() {
  return (
    <MasterCrudPage<Attribute>
      title="Atributos e Filtros"
      description="Características que viram filtros na Loja Pública e podem gerar variações de produto."
      breadcrumbs={[{ label: "Catálogo" }, { label: "Atributos e Filtros" }]}
      resourceName="atributo"
      queryKey="attributes"
      list={listAttributes} create={createAttribute} update={updateAttribute} remove={deleteAttribute}
      searchPlaceholder="Buscar por nome ou código"
      columns={[
        { key: "name", header: "Nome", accessor: (r) => <span className="font-medium">{r.name}</span> },
        { key: "code", header: "Código", accessor: (r) => <code className="text-xs text-muted-foreground">{r.code}</code> },
        { key: "input_type", header: "Tipo", accessor: (r) => <StatusBadge label={r.input_type} tone="info" /> },
        { key: "filter", header: "Filtro",
          accessor: (r) => r.is_filterable
            ? <StatusBadge label={r.filter_ui} tone="success" />
            : <span className="text-muted-foreground text-xs">Oculto</span> },
        { key: "axis", header: "Eixo",
          accessor: (r) => (
            <div className="flex gap-1">
              {r.is_color && <StatusBadge label="Cor" tone="warning" />}
              {r.is_size && <StatusBadge label="Tamanho" tone="warning" />}
            </div>
          ) },
        { key: "filter_order", header: "Ordem", align: "right", accessor: (r) => r.filter_order ?? 0 },
      ]}
      itemLabel={(r) => r.name}
      emptyForm={() => ({ code: "", name: "", input_type: "select", is_color: false, is_size: false, unit: "", description: "", is_filterable: true, filter_ui: "checkbox", filter_order: 0 })}
      toForm={(r) => ({ ...r })}
      renderForm={(form, setForm) => (
        <>
          <FormRow>
            <FormField label="Código" required hint="Identificador interno único na loja.">
              <Input value={(form.code as string) ?? ""} onChange={(e) => setForm({ code: e.target.value.toLowerCase() })} />
            </FormField>
            <FormField label="Nome" required>
              <Input value={(form.name as string) ?? ""} onChange={(e) => setForm({ name: e.target.value })} />
            </FormField>
          </FormRow>
          <FormRow>
            <SelectField label="Tipo de entrada" value={(form.input_type as string) ?? "select"}
              onChange={(v) => setForm({ input_type: v })}
              options={[
                { value: "select", label: "Lista (select)" },
                { value: "text", label: "Texto" },
                { value: "number", label: "Número" },
                { value: "boolean", label: "Sim / Não" },
              ]} />
            <FormField label="Unidade" hint="Ex: cm, kg.">
              <Input value={(form.unit as string) ?? ""} onChange={(e) => setForm({ unit: e.target.value })} />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Eixo de variação — Cor">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_color} onCheckedChange={(v) => setForm({ is_color: v })} />
                <span className="text-sm text-muted-foreground">Gera variantes por cor</span>
              </div>
            </FormField>
            <FormField label="Eixo de variação — Tamanho">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_size} onCheckedChange={(v) => setForm({ is_size: v })} />
                <span className="text-sm text-muted-foreground">Gera variantes por tamanho</span>
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
