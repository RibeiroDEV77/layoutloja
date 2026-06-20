/**
 * Assistente de Produto — Fase 4.2A.
 *
 * Cria o produto base (categoria, marca, coleção, nome, SKU root)
 * e redireciona para o Wizard de configuração.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CrudDrawer } from "@/components/admin/crud-drawer";
import { FormField, FormRow } from "@/components/admin/form-field";
import { SelectField } from "@/components/admin/select-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActiveStore } from "@/hooks/use-active-store";
import { runAction } from "@/components/admin/notify";
import { listCategories } from "@/lib/business/categories.functions";
import { listBrands } from "@/lib/business/brands.functions";
import { listCollections } from "@/lib/business/collections.functions";
import { createProductDraft } from "@/lib/business/products.functions";

function sanitizeSku(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

type Row = { id: string; name: string };

export function ProductAssistantDrawer({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { storeId } = useActiveStore();
  const navigate = useNavigate();
  const fnCats = useServerFn(listCategories);
  const fnBrands = useServerFn(listBrands);
  const fnCols = useServerFn(listCollections);
  const fnCreate = useServerFn(createProductDraft);

  const [form, setForm] = useState({
    name: "", sku_root: "", category_id: "", brand_id: "",
    collection_id: "", short_description: "",
  });
  const [saving, setSaving] = useState(false);

  const cats = useQuery({
    queryKey: ["pa-cats", storeId], enabled: !!storeId && open,
    queryFn: async () => {
      const r = await fnCats({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Row[];
    },
  });
  const brands = useQuery({
    queryKey: ["pa-brands", storeId], enabled: !!storeId && open,
    queryFn: async () => {
      const r = await fnBrands({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Row[];
    },
  });
  const cols = useQuery({
    queryKey: ["pa-cols", storeId], enabled: !!storeId && open,
    queryFn: async () => {
      const r = await fnCols({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Row[];
    },
  });

  const patch = (p: Partial<typeof form>) => setForm((s) => ({ ...s, ...p }));

  const handleSubmit = async () => {
    if (!storeId) return;
    if (!form.name.trim() || !form.sku_root.trim() || !form.category_id) return;
    setSaving(true);
    const created = await runAction(
      () => fnCreate({
        data: {
          store_id: storeId,
          name: form.name.trim(),
          sku_root: form.sku_root.trim(),
          category_id: form.category_id || null,
          brand_id: form.brand_id || null,
          collection_id: form.collection_id || null,
          short_description: form.short_description || null,
        },
      }),
      { loading: "Criando produto...", success: "Produto criado" },
    );
    setSaving(false);
    if (created) {
      onOpenChange(false);
      navigate({ to: "/admin/products/$id/edit", params: { id: created.id } });
    }
  };

  const canSubmit = !!form.name.trim() && !!form.sku_root.trim() && !!form.category_id;

  return (
    <CrudDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Novo Produto"
      description="Etapa 1 — Dados básicos. Você poderá refinar tudo no Wizard logo em seguida."
      onSubmit={handleSubmit}
      submitLabel="Criar e configurar"
      loading={saving}
      submitDisabled={!canSubmit}
    >
      <div className="space-y-4">
        <FormField label="Nome do produto" required>
          <Input
            value={form.name}
            onChange={(e) => patch({
              name: e.target.value,
              sku_root: form.sku_root || sanitizeSku(e.target.value),
            })}
            placeholder="Ex.: Camiseta Básica"
          />
        </FormField>
        <FormField label="SKU Root" required hint="Prefixo único usado para gerar todos os SKUs das variantes.">
          <Input
            value={form.sku_root}
            onChange={(e) => patch({ sku_root: sanitizeSku(e.target.value) })}
            placeholder="CAM-BASIC"
          />
        </FormField>
        <FormRow>
          <SelectField
            label="Categoria"
            required
            value={form.category_id}
            onChange={(v) => patch({ category_id: v })}
            options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder={cats.isLoading ? "Carregando..." : "Selecione"}
          />
          <SelectField
            label="Marca"
            value={form.brand_id || "__none__"}
            onChange={(v) => patch({ brand_id: v === "__none__" ? "" : v })}
            options={[
              { value: "__none__", label: "— Sem marca —" },
              ...(brands.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </FormRow>
        <SelectField
          label="Coleção"
          value={form.collection_id || "__none__"}
          onChange={(v) => patch({ collection_id: v === "__none__" ? "" : v })}
          options={[
            { value: "__none__", label: "— Nenhuma —" },
            ...(cols.data ?? []).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FormField label="Descrição curta" hint="Aparece em listagens e na meta-descrição inicial.">
          <Textarea
            rows={3}
            value={form.short_description}
            onChange={(e) => patch({ short_description: e.target.value })}
          />
        </FormField>
      </div>
    </CrudDrawer>
  );
}
