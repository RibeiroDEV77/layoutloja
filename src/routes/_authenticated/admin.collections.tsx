import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/admin/master-crud-page";
import { FormField, FormRow } from "@/components/admin/form-field";
import { SelectField } from "@/components/admin/select-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { listCollections, createCollection, updateCollection, deleteCollection } from "@/lib/business/collections.functions";

export const Route = createFileRoute("/_authenticated/admin/collections")({
  head: () => ({ meta: [{ title: "Coleções — Admin" }] }),
  component: CollectionsPage,
});

type Collection = {
  id: string; store_id: string; name: string; slug: string;
  description: string | null; image_url: string | null; type: "manual" | "smart";
  sort_order: number; is_active: boolean;
};

const slugify = (s: string) => s.toString().toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

function CollectionsPage() {
  return (
    <MasterCrudPage<Collection>
      title="Coleções"
      description="Agrupamentos manuais ou automáticos de produtos."
      breadcrumbs={[{ label: "Catálogo" }, { label: "Coleções" }]}
      resourceName="coleção"
      queryKey="collections"
      list={listCollections} create={createCollection} update={updateCollection} remove={deleteCollection}
      searchPlaceholder="Buscar por nome ou slug"
      columns={[
        { key: "name", header: "Nome", accessor: (r) => <span className="font-medium">{r.name}</span> },
        { key: "slug", header: "Slug", accessor: (r) => <code className="text-xs text-muted-foreground">{r.slug}</code> },
        { key: "type", header: "Tipo",
          accessor: (r) => <StatusBadge label={r.type === "smart" ? "Smart" : "Manual"} tone={r.type === "smart" ? "info" : "default"} /> },
        { key: "sort_order", header: "Ordem", align: "right", accessor: (r) => r.sort_order },
        { key: "is_active", header: "Status",
          accessor: (r) => <StatusBadge label={r.is_active ? "Ativa" : "Inativa"} tone={r.is_active ? "success" : "muted"} dot /> },
      ]}
      itemLabel={(r) => r.name}
      emptyForm={() => ({ name: "", slug: "", type: "manual", description: "", image_url: "", sort_order: 0, is_active: true })}
      toForm={(r) => ({ ...r })}
      renderForm={(form, setForm) => {
        const name = (form.name as string) ?? "";
        const slug = (form.slug as string) ?? "";
        return (
          <>
            <FormRow>
              <FormField label="Nome" required>
                <Input value={name}
                  onChange={(e) => setForm({ name: e.target.value, slug: slug || slugify(e.target.value) })} />
              </FormField>
              <FormField label="Slug" required>
                <Input value={slug} onChange={(e) => setForm({ slug: slugify(e.target.value) })} />
              </FormField>
            </FormRow>
            <SelectField label="Tipo" value={(form.type as string) ?? "manual"}
              onChange={(v) => setForm({ type: v })}
              options={[{ value: "manual", label: "Manual" }, { value: "smart", label: "Smart (regras)" }]} />
            <FormField label="Descrição">
              <Textarea rows={3} value={(form.description as string) ?? ""}
                onChange={(e) => setForm({ description: e.target.value })} />
            </FormField>
            <FormRow>
              <FormField label="URL da imagem">
                <Input value={(form.image_url as string) ?? ""}
                  onChange={(e) => setForm({ image_url: e.target.value })} />
              </FormField>
              <FormField label="Ordem">
                <Input type="number" value={(form.sort_order as number) ?? 0}
                  onChange={(e) => setForm({ sort_order: Number(e.target.value) })} />
              </FormField>
            </FormRow>
            <FormField label="Ativa">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ is_active: v })} />
                <span className="text-sm text-muted-foreground">{form.is_active ? "Publicada" : "Oculta"}</span>
              </div>
            </FormField>
          </>
        );
      }}
    />
  );
}
