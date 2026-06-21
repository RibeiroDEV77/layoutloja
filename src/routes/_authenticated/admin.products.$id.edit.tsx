/**
 * Wizard de Configuração de Produto — Fase 4.2B.
 * Layout: stepper + checklist | etapa ativa | preview em tempo real.
 *
 * Toda I/O passa por Server Functions. Zero acesso direto ao Supabase.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, Sparkles, ImagePlus, Star, Save, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormField, FormRow } from "@/components/admin/form-field";
import { SelectField } from "@/components/admin/select-field";
import { FullPageLoading } from "@/components/admin/loading";
import { ColorPicker } from "@/components/admin/color-picker";
import { runAction, notify } from "@/components/admin/notify";
import { usePageBreadcrumbs } from "@/components/admin/breadcrumb-context";
import { ProductWizardStepper } from "@/components/admin/products/product-wizard-stepper";
import { ProductPreview } from "@/components/admin/products/product-preview";
import { ProductOperationsMenu } from "@/components/admin/products/product-operations-menu";

import {
  getProduct, updateProduct, publishProduct, unpublishProduct, getProductReadiness, listProducts,
} from "@/lib/business/products.functions";
import {
  listProductRelations, addProductRelation, removeProductRelation,
} from "@/lib/business/product-relations.functions";
import {
  listProductColors, createProductColor, updateProductColor, deleteProductColor,
  listColorMedia, addColorMedia, deleteColorMedia, updateColorMedia,
  listProductAttributes, setProductAttribute,
  listProductVariants, generateProductVariants, deleteProductVariant,
  listProductPrices, setVariantPrice,
} from "@/lib/business/product-children.functions";
import { listCategories } from "@/lib/business/categories.functions";
import { listBrands } from "@/lib/business/brands.functions";
import { listAttributes } from "@/lib/business/attributes.functions";
import { listAttributeValues } from "@/lib/business/attribute-values.functions";
import { listCategoryAttributes } from "@/lib/business/category-attributes.functions";
import { listPriceLists } from "@/lib/business/price-lists.functions";
import { useActiveStore } from "@/hooks/use-active-store";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/products/$id/edit")({
  head: () => ({ meta: [{ title: "Configurar Produto — Admin" }] }),
  component: ProductWizardPage,
});

type ProductRow = Tables<"products">;
type ColorRow = Tables<"product_colors">;
type MediaRow = Tables<"product_color_media">;
type VariantRow = Tables<"product_variants">;
type AttrValRow = Tables<"product_attribute_values">;
type PriceItemRow = Tables<"price_list_items">;

const STEP_KEYS = ["general", "attributes", "colors", "gallery", "variants", "prices", "seo", "related", "publish"] as const;
type StepKey = typeof STEP_KEYS[number];

function ProductWizardPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { storeId } = useActiveStore();

  usePageBreadcrumbs([
    { label: "Catálogo" },
    { label: "Produtos", to: "/admin/products" },
    { label: "Configurar" },
  ]);

  const fnGet = useServerFn(getProduct);
  const fnReadiness = useServerFn(getProductReadiness);
  const fnPublish = useServerFn(publishProduct);
  const fnUnpublish = useServerFn(unpublishProduct);

  const productQ = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const r = await fnGet({ data: { id } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });

  const readinessQ = useQuery({
    queryKey: ["product", id, "readiness"],
    queryFn: async () => {
      const r = await fnReadiness({ data: { id } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
    refetchInterval: false,
  });

  const [activeStep, setActiveStep] = useState<StepKey>("general");

  if (productQ.isLoading) return <FullPageLoading />;
  if (productQ.error || !productQ.data) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive mb-4">{(productQ.error as Error)?.message ?? "Produto não encontrado"}</p>
        <Button onClick={() => navigate({ to: "/admin/products" })}>Voltar</Button>
      </div>
    );
  }

  const { product, colors } = productQ.data;
  const steps = readinessQ.data?.steps ?? [];
  const progress = readinessQ.data?.progress ?? 0;
  const canPublish = !!readinessQ.data?.canPublish;

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["product", id] });
    qc.invalidateQueries({ queryKey: ["product", id, "readiness"] });
  };

  const onPublish = async () => {
    const ok = await runAction(
      () => fnPublish({ data: { id } }),
      { loading: "Publicando...", success: "Produto publicado!" },
    );
    if (ok) refreshAll();
  };
  const onUnpublish = async () => {
    const ok = await runAction(
      () => fnUnpublish({ data: { id } }),
      { loading: "Despublicando...", success: "Produto despublicado" },
    );
    if (ok) refreshAll();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0 flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/products"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{product.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs text-muted-foreground">{product.sku_root}</code>
              <StatusBadge
                label={product.status === "published" ? "Publicado" : product.status === "archived" ? "Arquivado" : "Rascunho"}
                tone={product.status === "published" ? "success" : product.status === "archived" ? "muted" : "warning"}
                dot
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {product.status === "published" ? (
            <Button variant="outline" onClick={onUnpublish}>Despublicar</Button>
          ) : (
            <Button onClick={onPublish} disabled={!canPublish} className="gap-2">
              <Send className="h-4 w-4" /> Publicar
            </Button>
          )}
          <ProductOperationsMenu
            product={{ id: product.id, name: product.name, slug: product.slug, status: product.status }}
            storeId={storeId}
          />
        </div>
      </div>

      {/* Grid: stepper | step | preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_300px] gap-4">
        <Card className="lg:sticky lg:top-4 self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Wizard</CardTitle>
            <CardDescription className="text-xs">Conclua todas as etapas para publicar.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductWizardStepper
              steps={steps}
              activeKey={activeStep}
              onSelect={(k) => setActiveStep(k as StepKey)}
              progress={progress}
              canPublish={canPublish}
            />
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Card>
            <CardContent className="p-6">
              {activeStep === "general" && <GeneralStep product={product} onSaved={refreshAll} />}
              {activeStep === "attributes" && <AttributesStep product={product} onSaved={refreshAll} />}
              {activeStep === "colors" && <ColorsStep productId={id} colors={colors as ColorRow[]} onSaved={refreshAll} />}
              {activeStep === "gallery" && <GalleryStep productId={id} colors={colors as ColorRow[]} onSaved={refreshAll} />}
              {activeStep === "variants" && <VariantsStep productId={id} categoryId={product.category_id} onSaved={refreshAll} />}
              {activeStep === "prices" && <PricesStep productId={id} storeId={storeId} onSaved={refreshAll} />}
              {activeStep === "seo" && <SeoStep product={product} onSaved={refreshAll} />}
              {activeStep === "related" && <RelatedStep productId={id} storeId={storeId} />}
              {activeStep === "publish" && (
                <PublishStep canPublish={canPublish} issues={readinessQ.data?.issues ?? []} onPublish={onPublish} status={product.status} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 self-start">
          <p className="text-xs uppercase font-medium text-muted-foreground mb-2 px-1">Preview</p>
          <PreviewPanel productId={id} product={product} colors={colors as ColorRow[]} />
        </div>
      </div>
    </div>
  );
}

// ============== Step 1: Geral ==============

function GeneralStep({ product, onSaved }: { product: ProductRow; onSaved: () => void }) {
  const fn = useServerFn(updateProduct);
  const fnCats = useServerFn(listCategories);
  const fnBrands = useServerFn(listBrands);
  const { storeId } = useActiveStore();
  const [form, setForm] = useState({
    name: product.name,
    short_description: product.short_description ?? "",
    description: product.description ?? "",
    category_id: product.category_id ?? "",
    brand_id: product.brand_id ?? "",
    sale_channel: product.sale_channel,
    featured: product.featured,
    on_sale: product.on_sale,
    new_product: product.new_product,
    best_seller: product.best_seller,
  });
  const [saving, setSaving] = useState(false);

  const cats = useQuery({
    queryKey: ["wizard-cats", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnCats({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as { id: string; name: string }[];
    },
  });
  const brands = useQuery({
    queryKey: ["wizard-brands", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnBrands({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as { id: string; name: string }[];
    },
  });

  const save = async () => {
    setSaving(true);
    const ok = await runAction(
      () => fn({ data: { id: product.id, patch: {
        name: form.name,
        short_description: form.short_description || null,
        description: form.description || null,
        category_id: form.category_id || null,
        brand_id: form.brand_id || null,
        sale_channel: form.sale_channel,
        featured: form.featured,
        on_sale: form.on_sale,
        new_product: form.new_product,
        best_seller: form.best_seller,
      } } }),
      { loading: "Salvando...", success: "Informações salvas" },
    );
    setSaving(false);
    if (ok) onSaved();
  };

  const patch = (p: Partial<typeof form>) => setForm((s) => ({ ...s, ...p }));

  return (
    <StepShell title="Informações Gerais" description="Dados que aparecem na ficha do produto." onSave={save} saving={saving}>
      <FormField label="Nome" required>
        <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} />
      </FormField>
      <FormRow>
        <SelectField
          label="Categoria" required
          value={form.category_id}
          onChange={(v) => patch({ category_id: v })}
          options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
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
      <FormField label="Descrição curta" hint="Aparece em listagens.">
        <Textarea rows={2} value={form.short_description} onChange={(e) => patch({ short_description: e.target.value })} />
      </FormField>
      <FormField label="Descrição completa">
        <Textarea rows={6} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
      </FormField>
      <SelectField
        label="Canal de venda"
        value={form.sale_channel}
        onChange={(v) => patch({ sale_channel: v as ProductRow["sale_channel"] })}
        options={[
          { value: "ambos", label: "Varejo + Atacado" },
          { value: "varejo", label: "Apenas Varejo" },
          { value: "atacado", label: "Apenas Atacado" },
        ]}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t">
        {([
          ["featured", "Destaque"],
          ["on_sale", "Em promoção"],
          ["new_product", "Novidade"],
          ["best_seller", "Mais vendido"],
        ] as const).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between rounded-md border p-2">
            <Label className="text-xs">{label}</Label>
            <Switch checked={form[k] as boolean} onCheckedChange={(v) => patch({ [k]: v } as Partial<typeof form>)} />
          </div>
        ))}
      </div>
    </StepShell>
  );
}

// ============== Step 2: Atributos ==============

function AttributesStep({ product, onSaved }: { product: ProductRow; onSaved: () => void }) {
  const { storeId } = useActiveStore();
  const fnList = useServerFn(listProductAttributes);
  const fnSet = useServerFn(setProductAttribute);
  const fnCatAttrs = useServerFn(listCategoryAttributes);
  const fnAttrs = useServerFn(listAttributes);
  const fnVals = useServerFn(listAttributeValues);

  const valsQ = useQuery({
    queryKey: ["wizard-attr", product.id, product.category_id],
    enabled: !!product.category_id && !!storeId,
    queryFn: async () => {
      const [cat, prod, attrsAll] = await Promise.all([
        fnCatAttrs({ data: { category_id: product.category_id! } }),
        fnList({ data: { product_id: product.id } }),
        fnAttrs({ data: { store_id: storeId!, pageSize: 100 } }),
      ]);
      if (!cat.ok) throw new Error(cat.error.message);
      if (!prod.ok) throw new Error(prod.error.message);
      if (!attrsAll.ok) throw new Error(attrsAll.error.message);

      const catAttrs = cat.data.rows as Array<{ attribute_id: string; is_required: boolean }>;
      const attrsMap = new Map(
        (attrsAll.data.rows as Array<{ id: string; name: string; input_type: string }>).map((a) => [a.id, a]),
      );
      const productValues = new Map(
        (prod.data as AttrValRow[]).map((p) => [p.attribute_id, p]),
      );

      const valuesMap = new Map<string, Array<{ id: string; label: string }>>();
      for (const ca of catAttrs) {
        const r = await fnVals({ data: { attribute_id: ca.attribute_id, pageSize: 100 } });
        if (r.ok) valuesMap.set(ca.attribute_id, r.data.rows as Array<{ id: string; label: string }>);
      }

      return catAttrs.map((ca) => ({
        attribute_id: ca.attribute_id,
        required: ca.is_required,
        name: attrsMap.get(ca.attribute_id)?.name ?? "—",
        type: attrsMap.get(ca.attribute_id)?.input_type ?? "text",
        values: valuesMap.get(ca.attribute_id) ?? [],
        current: productValues.get(ca.attribute_id) ?? null,
      }));
    },
  });

  if (!product.category_id) {
    return <p className="text-sm text-muted-foreground">Defina a categoria na etapa anterior para configurar atributos.</p>;
  }

  const setValue = async (attributeId: string, payload: Parameters<typeof fnSet>[0]["data"]) => {
    const ok = await runAction(
      () => fnSet({ data: payload }),
      { success: "Atributo salvo" },
    );
    if (ok) { onSaved(); valsQ.refetch(); }
    void attributeId;
  };

  return (
    <StepShell title="Atributos" description="Atributos herdados da categoria selecionada.">
      {valsQ.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {valsQ.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum atributo vinculado a esta categoria.</p>
      )}
      <div className="space-y-3">
        {valsQ.data?.map((a) => (
          <div key={a.attribute_id} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-medium">{a.name}{a.required && <span className="text-destructive ml-1">*</span>}</Label>
              <Badge variant="outline" className="text-xs">{a.type}</Badge>
            </div>
            {a.values.length > 0 ? (
              <SelectField
                label=""
                value={a.current?.attribute_value_id ?? "__none__"}
                onChange={(v) =>
                  setValue(a.attribute_id, {
                    product_id: product.id,
                    attribute_id: a.attribute_id,
                    attribute_value_id: v === "__none__" ? null : v,
                  })
                }
                options={[
                  { value: "__none__", label: "— Não definido —" },
                  ...a.values.map((v) => ({ value: v.id, label: v.label })),
                ]}
              />
            ) : (
              <Input
                defaultValue={a.current?.value_text ?? ""}
                placeholder="Digite o valor"
                onBlur={(e) =>
                  setValue(a.attribute_id, {
                    product_id: product.id,
                    attribute_id: a.attribute_id,
                    value_text: e.target.value || null,
                  })
                }
              />
            )}
          </div>
        ))}
      </div>
    </StepShell>
  );
}

// ============== Step 3: Cores ==============

function ColorsStep({ productId, colors, onSaved }: { productId: string; colors: ColorRow[]; onSaved: () => void }) {
  const fnCreate = useServerFn(createProductColor);
  const fnUpdate = useServerFn(updateProductColor);
  const fnDelete = useServerFn(deleteProductColor);

  const [name, setName] = useState("");
  const [hex, setHex] = useState("#000000");

  const addColor = async () => {
    if (!name.trim()) return;
    const ok = await runAction(
      () => fnCreate({ data: { product_id: productId, name: name.trim(), hex, is_default: colors.length === 0 } }),
      { success: "Cor adicionada" },
    );
    if (ok) { setName(""); onSaved(); }
  };

  const setDefault = async (id: string) => {
    const ok = await runAction(
      () => fnUpdate({ data: { id, patch: { is_default: true } } }),
      { success: "Cor padrão definida" },
    );
    if (ok) onSaved();
  };

  const remove = async (id: string) => {
    const ok = await runAction(
      () => fnDelete({ data: { id } }),
      { success: "Cor removida" },
    );
    if (ok) onSaved();
  };

  return (
    <StepShell title="Cores" description="Cada cor terá sua própria galeria de mídia.">
      <div className="rounded-md border p-3 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase">Adicionar cor</p>
        <FormRow>
          <FormField label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Azul Marinho" />
          </FormField>
          <ColorPicker label="Cor" value={hex} onChange={setHex} />
        </FormRow>
        <Button onClick={addColor} disabled={!name.trim()} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {colors.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma cor cadastrada.</p>}
        {colors.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-md border p-3">
            <span className="h-8 w-8 rounded-full border-2 border-white shadow ring-1 ring-border" style={{ background: c.hex ?? "#ccc" }} />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{c.name}</p>
              <code className="text-xs text-muted-foreground">{c.hex}</code>
            </div>
            {c.is_default ? (
              <Badge variant="default" className="gap-1"><Star className="h-3 w-3" />Padrão</Badge>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setDefault(c.id)}>Tornar padrão</Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </StepShell>
  );
}

// ============== Step 4: Galeria ==============

function GalleryStep({ productId, colors, onSaved }: { productId: string; colors: ColorRow[]; onSaved: () => void }) {
  void productId;
  const [activeColorId, setActiveColorId] = useState(colors[0]?.id ?? "");
  const fnList = useServerFn(listColorMedia);
  const fnAdd = useServerFn(addColorMedia);
  const fnDel = useServerFn(deleteColorMedia);
  const fnUpd = useServerFn(updateColorMedia);
  const qc = useQueryClient();

  const media = useQuery({
    queryKey: ["color-media", activeColorId],
    enabled: !!activeColorId,
    queryFn: async () => {
      const r = await fnList({ data: { color_id: activeColorId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as MediaRow[];
    },
  });

  const [url, setUrl] = useState("");

  const addImage = async () => {
    if (!activeColorId || !url.trim()) return;
    const isYoutube = /youtube\.com|youtu\.be/.test(url);
    const isVimeo = /vimeo\.com/.test(url);
    const isCover = (media.data?.length ?? 0) === 0;
    const ok = await runAction(
      () => fnAdd({ data: {
        color_id: activeColorId,
        media_type: isYoutube ? "youtube" : isVimeo ? "vimeo" : "image",
        external_url: isYoutube || isVimeo ? url : url,
        external_id: isYoutube ? extractYoutubeId(url) : isVimeo ? extractVimeoId(url) : null,
        storage_path: isYoutube || isVimeo ? null : url,
        is_cover: isCover,
        sort_order: media.data?.length ?? 0,
      } }),
      { success: "Mídia adicionada" },
    );
    if (ok) { setUrl(""); qc.invalidateQueries({ queryKey: ["color-media", activeColorId] }); onSaved(); }
  };

  const remove = async (id: string) => {
    const ok = await runAction(() => fnDel({ data: { id } }), { success: "Mídia removida" });
    if (ok) { qc.invalidateQueries({ queryKey: ["color-media", activeColorId] }); onSaved(); }
  };

  const setCover = async (id: string) => {
    const ok = await runAction(
      () => fnUpd({ data: { id, patch: { is_cover: true } } }),
      { success: "Capa definida" },
    );
    if (ok) { qc.invalidateQueries({ queryKey: ["color-media", activeColorId] }); onSaved(); }
  };

  if (colors.length === 0) {
    return <p className="text-sm text-muted-foreground">Adicione ao menos uma cor antes de configurar a galeria.</p>;
  }

  return (
    <StepShell title="Galeria por cor" description="Cada cor tem uma galeria independente. Suporta imagens (URL), YouTube e Vimeo.">
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {colors.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveColorId(c.id)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${activeColorId === c.id ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
          >
            <span className="h-3 w-3 rounded-full ring-1 ring-border" style={{ background: c.hex ?? "#ccc" }} />
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole a URL da imagem ou link do YouTube/Vimeo"
        />
        <Button onClick={addImage} disabled={!url.trim()} className="gap-2">
          <ImagePlus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(media.data ?? []).map((m) => {
          const src = m.thumbnail_url || m.external_url || m.storage_path || "";
          return (
            <div key={m.id} className="relative aspect-square rounded-md overflow-hidden border bg-muted group">
              {src ? <img src={src} alt={m.alt ?? ""} className="w-full h-full object-cover" /> : null}
              {m.is_cover && (
                <Badge className="absolute top-1 left-1 text-xs"><Star className="h-3 w-3 mr-1" />Capa</Badge>
              )}
              <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                {!m.is_cover && (
                  <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => setCover(m.id)}>
                    Definir como capa
                  </Button>
                )}
                <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => remove(m.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
        {!media.isLoading && !(media.data?.length) && (
          <p className="col-span-full text-sm text-muted-foreground text-center py-8">Nenhuma mídia ainda.</p>
        )}
      </div>
    </StepShell>
  );
}

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}
function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m?.[1] ?? null;
}

// ============== Step 5: Variantes ==============

function VariantsStep({ productId, categoryId, onSaved }: { productId: string; categoryId: string | null; onSaved: () => void }) {
  const { storeId } = useActiveStore();
  const fnList = useServerFn(listProductVariants);
  const fnGen = useServerFn(generateProductVariants);
  const fnDel = useServerFn(deleteProductVariant);
  const fnCatAttrs = useServerFn(listCategoryAttributes);
  const fnAttrs = useServerFn(listAttributes);
  const fnVals = useServerFn(listAttributeValues);
  const qc = useQueryClient();

  const variantsQ = useQuery({
    queryKey: ["variants", productId],
    queryFn: async () => {
      const r = await fnList({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as VariantRow[];
    },
  });

  // Find size attribute via category
  const sizeAttrQ = useQuery({
    queryKey: ["size-attr", categoryId, storeId],
    enabled: !!categoryId && !!storeId,
    queryFn: async () => {
      const [ca, attrs] = await Promise.all([
        fnCatAttrs({ data: { category_id: categoryId! } }),
        fnAttrs({ data: { store_id: storeId!, pageSize: 100 } }),
      ]);
      if (!ca.ok || !attrs.ok) return null;
      const attrList = attrs.data.rows as Array<{ id: string; name: string; code?: string; is_size?: boolean }>;
      const catList = ca.data.rows as Array<{ attribute_id: string }>;
      const candidate = attrList.find((a) =>
        catList.some((c) => c.attribute_id === a.id) &&
        (a.is_size || /tamanho|size/i.test(a.name)),
      );
      if (!candidate) return { attribute: null, values: [] as Array<{ id: string; label: string; code: string | null }> };
      const v = await fnVals({ data: { attribute_id: candidate.id, pageSize: 100 } });
      return {
        attribute: candidate,
        values: v.ok ? (v.data.rows as Array<{ id: string; label: string; code: string | null }>) : [],
      };
    },
  });

  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const generate = async () => {
    const ok = await runAction(
      () => fnGen({ data: { product_id: productId, size_attribute_value_ids: selected } }),
      { loading: "Gerando variantes...", success: "Variantes geradas" },
    );
    if (ok) {
      qc.invalidateQueries({ queryKey: ["variants", productId] });
      onSaved();
    }
  };

  const remove = async (id: string) => {
    const ok = await runAction(() => fnDel({ data: { id } }), { success: "Variante removida" });
    if (ok) { qc.invalidateQueries({ queryKey: ["variants", productId] }); onSaved(); }
  };

  const values = sizeAttrQ.data?.values ?? [];

  return (
    <StepShell title="Geração de variantes" description="Combina automaticamente cores × tamanhos. Idempotente.">
      <div className="rounded-md border p-3 space-y-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <p className="text-sm">
            Tamanhos disponíveis na categoria
            {sizeAttrQ.data?.attribute && <span className="font-medium ml-1">({sizeAttrQ.data.attribute.name})</span>}
          </p>
          <Button size="sm" onClick={generate} disabled={!values.length && selected.length === 0} className="gap-2">
            <Sparkles className="h-4 w-4" /> Gerar variantes
          </Button>
        </div>
        {!values.length ? (
          <p className="text-xs text-muted-foreground">
            Nenhum atributo de tamanho vinculado a esta categoria — será gerada uma variante única por cor.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {values.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                className={`px-3 py-1.5 rounded-full border text-sm ${selected.includes(v.id) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <div className="p-3 border-b flex items-center justify-between">
          <p className="font-medium">Variantes ({variantsQ.data?.length ?? 0})</p>
        </div>
        {(variantsQ.data ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma variante gerada.</p>
        ) : (
          <div className="divide-y">
            {(variantsQ.data ?? []).map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 text-sm">
                <code className="font-mono">{v.sku}</code>
                <Button size="icon" variant="ghost" onClick={() => remove(v.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </StepShell>
  );
}

// ============== Step 6: Preços ==============

function PricesStep({ productId, storeId, onSaved }: { productId: string; storeId: string | null; onSaved: () => void }) {
  const fnList = useServerFn(listProductPrices);
  const fnSet = useServerFn(setVariantPrice);
  const fnLists = useServerFn(listPriceLists);
  const fnVar = useServerFn(listProductVariants);
  const qc = useQueryClient();

  const variants = useQuery({
    queryKey: ["variants", productId],
    queryFn: async () => {
      const r = await fnVar({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as VariantRow[];
    },
  });
  const prices = useQuery({
    queryKey: ["product-prices", productId],
    queryFn: async () => {
      const r = await fnList({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as PriceItemRow[];
    },
  });
  const lists = useQuery({
    queryKey: ["price-lists", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnLists({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Array<{ id: string; name: string }>;
    },
  });

  const [activeListId, setActiveListId] = useState<string>("");
  const effectiveListId = activeListId || lists.data?.[0]?.id || "";

  const priceFor = (variantId: string) =>
    prices.data?.find((p) => p.variant_id === variantId && p.price_list_id === effectiveListId);

  const save = async (variantId: string, value: number) => {
    if (!effectiveListId) return;
    const ok = await runAction(
      () => fnSet({ data: { variant_id: variantId, price_list_id: effectiveListId, price: value } }),
      { success: "Preço salvo" },
    );
    if (ok) { qc.invalidateQueries({ queryKey: ["product-prices", productId] }); onSaved(); }
  };

  if (!variants.data?.length) {
    return <p className="text-sm text-muted-foreground">Gere variantes na etapa anterior antes de definir preços.</p>;
  }
  if (!lists.data?.length) {
    return <p className="text-sm text-muted-foreground">Cadastre uma lista de preços antes de continuar.</p>;
  }

  return (
    <StepShell title="Preços" description="Defina o preço de cada variante por lista de preços.">
      <SelectField
        label="Lista de preços"
        value={effectiveListId}
        onChange={setActiveListId}
        options={lists.data.map((l) => ({ value: l.id, label: l.name }))}
      />
      <div className="rounded-md border divide-y">
        {variants.data.map((v) => {
          const current = priceFor(v.id);
          return (
            <PriceRow
              key={v.id}
              sku={v.sku}
              initial={current?.price ? Number(current.price) : null}
              onSave={(val) => save(v.id, val)}
            />
          );
        })}
      </div>
    </StepShell>
  );
}

function PriceRow({ sku, initial, onSave }: { sku: string; initial: number | null; onSave: (v: number) => void }) {
  const [val, setVal] = useState<string>(initial?.toString() ?? "");
  return (
    <div className="flex items-center gap-3 p-3 text-sm">
      <code className="font-mono flex-1 min-w-0 truncate">{sku}</code>
      <Input
        type="number"
        step="0.01"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-32"
        placeholder="0,00"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => { const n = Number(val); if (!Number.isNaN(n)) onSave(n); }}
        disabled={!val.trim()}
      >
        <Save className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ============== Step 7: SEO ==============

function SeoStep({ product, onSaved }: { product: ProductRow; onSaved: () => void }) {
  const fn = useServerFn(updateProduct);
  const [form, setForm] = useState({
    slug: product.slug,
    seo_title: product.seo_title ?? "",
    seo_description: product.seo_description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const ok = await runAction(
      () => fn({ data: { id: product.id, patch: form } }),
      { success: "SEO salvo" },
    );
    setSaving(false);
    if (ok) onSaved();
  };
  return (
    <StepShell title="SEO" description="Como o produto aparece em buscadores e redes sociais." onSave={save} saving={saving}>
      <FormField label="Slug (URL)" required>
        <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
      </FormField>
      <FormField label="Título SEO" hint={`${form.seo_title.length}/60`}>
        <Input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} maxLength={70} />
      </FormField>
      <FormField label="Descrição SEO" hint={`${form.seo_description.length}/160`}>
        <Textarea
          rows={3}
          value={form.seo_description}
          onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
          maxLength={170}
        />
      </FormField>
    </StepShell>
  );
}

// ============== Step 8: Produtos Relacionados ==============

type RelationType = "related" | "cross_sell" | "up_sell";
const RELATION_LABEL: Record<RelationType, string> = {
  related: "Relacionado",
  cross_sell: "Cross-sell",
  up_sell: "Up-sell",
};

function RelatedStep({ productId, storeId }: { productId: string; storeId: string | null }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listProductRelations);
  const fnAdd = useServerFn(addProductRelation);
  const fnRemove = useServerFn(removeProductRelation);
  const fnSearch = useServerFn(listProducts);

  const [type, setType] = useState<RelationType>("related");
  const [search, setSearch] = useState("");

  const relationsQ = useQuery({
    queryKey: ["product-relations", productId],
    queryFn: async () => {
      const r = await fnList({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });

  const searchQ = useQuery({
    queryKey: ["product-relations-search", storeId, search],
    enabled: !!storeId && search.trim().length >= 2,
    queryFn: async () => {
      const r = await fnSearch({
        data: { store_id: storeId!, q: search.trim(), status: "all", page: 1, pageSize: 10 },
      });
      if (!r.ok) throw new Error(r.error.message);
      return (r.data?.rows ?? []).filter((p: { id: string }) => p.id !== productId);
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["product-relations", productId] });

  const handleAdd = async (relatedId: string) => {
    const ok = await runAction(
      () => fnAdd({ data: { product_id: productId, related_product_id: relatedId, relation_type: type } }),
      { success: "Produto relacionado adicionado" },
    );
    if (ok) { setSearch(""); invalidate(); }
  };

  const handleRemove = async (id: string) => {
    const ok = await runAction(
      () => fnRemove({ data: { id } }),
      { success: "Relação removida" },
    );
    if (ok) invalidate();
  };

  const rows = (relationsQ.data ?? []) as unknown as Array<{
    id: string;
    related_product_id: string;
    relation_type: RelationType;
    position: number;
    related: { id: string; name: string; sku_root: string; status: string } | null;
  }>;

  return (
    <StepShell
      title="Produtos Relacionados"
      description="Vincule produtos para recomendações, cross-sell e up-sell. Etapa opcional."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
          <SelectField
            label="Tipo de relação"
            value={type}
            onChange={(v) => setType(v as RelationType)}
            options={[
              { value: "related", label: "Relacionado" },
              { value: "cross_sell", label: "Cross-sell" },
              { value: "up_sell", label: "Up-sell" },
            ]}
          />
          <FormField label="Buscar produto" hint="Digite ao menos 2 caracteres (nome, SKU ou slug)">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar para adicionar..."
            />
          </FormField>
        </div>

        {search.trim().length >= 2 && (
          <Card>
            <CardContent className="p-3 space-y-2">
              {searchQ.isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
              {searchQ.data && searchQ.data.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
              )}
              {(searchQ.data ?? []).map((p: { id: string; name: string; sku_root: string; status: string }) => (
                <div key={p.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku_root} · {p.status}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAdd(p.id)} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {(["related", "cross_sell", "up_sell"] as RelationType[]).map((t) => {
            const items = rows.filter((r) => r.relation_type === t);
            return (
              <div key={t}>
                <p className="text-xs uppercase font-medium text-muted-foreground mb-2">
                  {RELATION_LABEL[t]} <span className="text-muted-foreground/60">({items.length})</span>
                </p>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3">
                    Nenhum produto {RELATION_LABEL[t].toLowerCase()} vinculado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((r) => (
                      <div key={r.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {r.related?.name ?? "(produto removido)"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.related?.sku_root} · {r.related?.status}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleRemove(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </StepShell>
  );
}

// ============== Step 9: Publicação ==============

function PublishStep({ canPublish, issues, onPublish, status }: { canPublish: boolean; issues: string[]; onPublish: () => void; status: string }) {
  return (
    <StepShell title="Publicação" description="Validação final e ativação na loja.">
      {status === "published" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <p className="font-medium text-emerald-900 dark:text-emerald-200">Produto publicado</p>
          <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1">O produto está visível no catálogo.</p>
        </div>
      ) : canPublish ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">Tudo pronto para publicar 🎉</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1">Todas as etapas obrigatórias foram concluídas.</p>
          </div>
          <Button onClick={onPublish} size="lg" className="gap-2">
            <Send className="h-4 w-4" /> Publicar agora
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4">
            <p className="font-medium text-amber-900 dark:text-amber-200">Há pendências antes de publicar</p>
            <ul className="mt-2 text-sm text-amber-800 dark:text-amber-300 list-disc pl-5 space-y-0.5">
              {issues.slice(0, 8).map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          </div>
        </div>
      )}
    </StepShell>
  );
}

// ============== Helpers ==============

function StepShell({
  title, description, children, onSave, saving,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
      {onSave && (
        <div className="flex justify-end pt-2 border-t">
          <Button onClick={onSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar etapa"}
          </Button>
        </div>
      )}
    </div>
  );
}

function PreviewPanel({
  productId, product, colors,
}: { productId: string; product: ProductRow; colors: ColorRow[] }) {
  const fnList = useServerFn(listColorMedia);
  // Fetch media for all colors in parallel via individual queries
  const mediaQueries = useQuery({
    queryKey: ["preview-media", productId, colors.map((c) => c.id).join(",")],
    enabled: colors.length > 0,
    queryFn: async () => {
      const map: Record<string, MediaRow[]> = {};
      await Promise.all(
        colors.map(async (c) => {
          const r = await fnList({ data: { color_id: c.id } });
          if (r.ok) map[c.id] = r.data as MediaRow[];
        }),
      );
      return map;
    },
  });
  return (
    <ProductPreview product={product} colors={colors} mediaByColor={mediaQueries.data ?? {}} />
  );
}
