import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/admin/master-crud-page";
import { FormField, FormRow } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { listBrands, createBrand, updateBrand, deleteBrand } from "@/lib/business/brands.functions";

export const Route = createFileRoute("/_authenticated/admin/brands")({
  head: () => ({ meta: [{ title: "Marcas — Admin" }] }),
  component: BrandsPage,
});

type Brand = {
  id: string; store_id: string; name: string; slug: string;
  description: string | null; logo_url: string | null; sort_order: number; is_active: boolean;
};

const slugify = (s: string) => s.toString().toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

function BrandsPage() {
  return (
    <MasterCrudPage<Brand>
      title="Marcas"
      description="Marcas dos produtos do catálogo."
      breadcrumbs={[{ label: "Catálogo" }, { label: "Marcas" }]}
      resourceName="marca"
      queryKey="brands"
      list={listBrands} create={createBrand} update={updateBrand} remove={deleteBrand}
      searchPlaceholder="Buscar por nome ou slug"
      columns={[
        { key: "logo", header: "", width: 56,
          accessor: (r) => r.logo_url
            ? <img src={r.logo_url} alt="" className="h-8 w-8 rounded object-contain bg-muted" />
            : <div className="h-8 w-8 rounded bg-muted" /> },
        { key: "name", header: "Nome", accessor: (r) => <span className="font-medium">{r.name}</span> },
        { key: "slug", header: "Slug", accessor: (r) => <code className="text-xs text-muted-foreground">{r.slug}</code> },
        { key: "sort_order", header: "Ordem", align: "right", accessor: (r) => r.sort_order },
        { key: "is_active", header: "Status",
          accessor: (r) => <StatusBadge label={r.is_active ? "Ativa" : "Inativa"} tone={r.is_active ? "success" : "muted"} dot /> },
      ]}
      itemLabel={(r) => r.name}
      emptyForm={() => ({ name: "", slug: "", description: "", logo_url: "", sort_order: 0, is_active: true })}
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
            <FormField label="Descrição">
              <Textarea rows={3} value={(form.description as string) ?? ""}
                onChange={(e) => setForm({ description: e.target.value })} />
            </FormField>
            <FormRow>
              <FormField label="URL do logo">
                <Input value={(form.logo_url as string) ?? ""}
                  onChange={(e) => setForm({ logo_url: e.target.value })} />
              </FormField>
              <FormField label="Ordem">
                <Input type="number" value={(form.sort_order as number) ?? 0}
                  onChange={(e) => setForm({ sort_order: Number(e.target.value) })} />
              </FormField>
            </FormRow>
            <FormField label="Ativa">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ is_active: v })} />
                <span className="text-sm text-muted-foreground">{form.is_active ? "Visível" : "Oculta"}</span>
              </div>
            </FormField>
          </>
        );
      }}
    />
  );
}
