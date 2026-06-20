import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/admin/master-crud-page";
import { FormField, FormRow } from "@/components/admin/form-field";
import { SelectField } from "@/components/admin/select-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { listCategories, createCategory, updateCategory, deleteCategory } from "@/lib/business/categories.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useActiveStore } from "@/hooks/use-active-store";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Categorias — Admin" }] }),
  component: CategoriesPage,
});

type Category = {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

function slugify(s: string) {
  return s.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function CategoriesPage() {
  const { storeId } = useActiveStore();
  const list = useServerFn(listCategories);
  const parentsQuery = useQuery({
    queryKey: ["categories-parents", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const r = await list({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Category[];
    },
  });
  const parentOptions = [
    { value: "__none__", label: "— Sem categoria pai —" },
    ...(parentsQuery.data ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <MasterCrudPage<Category>
      title="Categorias"
      description="Estrutura hierárquica do catálogo."
      breadcrumbs={[{ label: "Catálogo" }, { label: "Categorias" }]}
      resourceName="categoria"
      queryKey="categories"
      list={listCategories}
      create={createCategory}
      update={updateCategory}
      remove={deleteCategory}
      searchPlaceholder="Buscar por nome ou slug"
      columns={[
        { key: "name", header: "Nome", accessor: (r) => <span className="font-medium">{r.name}</span> },
        { key: "slug", header: "Slug", accessor: (r) => <code className="text-xs text-muted-foreground">{r.slug}</code> },
        { key: "sort_order", header: "Ordem", align: "right", accessor: (r) => r.sort_order },
        { key: "is_active", header: "Status",
          accessor: (r) => <StatusBadge label={r.is_active ? "Ativa" : "Inativa"} tone={r.is_active ? "success" : "muted"} dot /> },
      ]}
      itemLabel={(r) => r.name}
      emptyForm={() => ({ name: "", slug: "", parent_id: "__none__", description: "", image_url: "", sort_order: 0, is_active: true })}
      toForm={(r) => ({ ...r, parent_id: r.parent_id ?? "__none__" })}
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
              <FormField label="Slug" required hint="Identificador na URL.">
                <Input value={slug} onChange={(e) => setForm({ slug: slugify(e.target.value) })} />
              </FormField>
            </FormRow>
            <SelectField
              label="Categoria pai"
              value={(form.parent_id as string) ?? "__none__"}
              onChange={(v) => setForm({ parent_id: v === "__none__" ? null : v })}
              options={parentOptions}
            />
            <FormField label="Descrição">
              <Textarea rows={3} value={(form.description as string) ?? ""}
                onChange={(e) => setForm({ description: e.target.value })} />
            </FormField>
            <FormRow>
              <FormField label="URL da imagem" hint="Cole o link da imagem de capa.">
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
                <span className="text-sm text-muted-foreground">{form.is_active ? "Visível no catálogo" : "Oculta"}</span>
              </div>
            </FormField>
          </>
        );
      }}
    />
  );
}
