/**
 * Cadastro de Produto — Tabs (refactor inspirado em Mercado Livre / Shopify / Nuvemshop).
 *
 * 9 abas: Geral · Organização · Variantes · Galeria · Preços · SEO · Relacionados · Publicação · Histórico.
 *
 * REUSO INTEGRAL — nenhum engine novo, nenhuma tabela nova:
 *   • Product Engine ............ products.functions.ts
 *   • Variants/Colors/Media ...... product-children.functions.ts (+ updateProductVariant)
 *   • Inventory Engine ........... inventory.functions.ts (listAdminStock + bulkAdjustStock)
 *   • Pricing Engine ............. price-lists.functions.ts + setVariantPrice
 *   • DAM ........................ dam.functions.ts via AssetPicker
 *   • Audit / Outbox / Telemetria  ../audit + ../events/dispatcher + useTelemetry
 *   • RBAC / RLS ................. has_permission('products.update', store_id) escopado por loja
 *
 * Toda I/O via Server Functions. Zero acesso direto ao Supabase.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, Sparkles, ImagePlus, Star, Save, Send, GripVertical, Library,
  CheckCircle2, AlertCircle, History as HistoryIcon, Eye, EyeOff, Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { AssetPicker } from "@/components/dam/asset-picker";
import type { AssetLike } from "@/components/dam/asset-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormField, FormRow } from "@/components/admin/form-field";
import { SelectField } from "@/components/admin/select-field";
import { FullPageLoading } from "@/components/admin/loading";
import { ColorPicker } from "@/components/admin/color-picker";
import { runAction, notify } from "@/components/admin/notify";
import { usePageBreadcrumbs } from "@/components/admin/breadcrumb-context";
import { ProductOperationsMenu } from "@/components/admin/products/product-operations-menu";

import {
  getProduct, updateProduct, publishProduct, unpublishProduct, getProductReadiness, listProducts,
  listProductHistory, listProductAudit,
} from "@/lib/business/products.functions";
import {
  listProductRelations, addProductRelation, removeProductRelation,
} from "@/lib/business/product-relations.functions";
import {
  listProductColors, createProductColor, updateProductColor, deleteProductColor,
  listColorMedia, addColorMedia, deleteColorMedia, updateColorMedia,
  listProductAttributes, setProductAttribute,
  listProductVariants, generateProductVariants, deleteProductVariant, updateProductVariant,
  listProductPrices, setVariantPrice,
} from "@/lib/business/product-children.functions";
import { listCategories } from "@/lib/business/categories.functions";
import { listProductCategoryIds, setProductCategories } from "@/lib/business/product-categories.functions";
import { listBrands } from "@/lib/business/brands.functions";
import { listAttributes } from "@/lib/business/attributes.functions";
import { createAttributeValue, listAttributeValues } from "@/lib/business/attribute-values.functions";
import { listCategoryAttributes } from "@/lib/business/category-attributes.functions";
import { listPriceLists } from "@/lib/business/price-lists.functions";
import { listAdminStock, bulkAdjustStock } from "@/lib/business/inventory.functions";
import { useActiveStore } from "@/hooks/use-active-store";
import { useTelemetry } from "@/hooks/use-telemetry";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/products/$id/edit")({
  head: () => ({ meta: [{ title: "Configurar Produto — Admin" }] }),
  component: ProductEditPage,
});

type ProductRow = Tables<"products">;
type ColorRow = Tables<"product_colors">;
type MediaRow = Tables<"product_color_media">;
type VariantRow = Tables<"product_variants">;
type AttrValRow = Tables<"product_attribute_values">;
type PriceItemRow = Tables<"price_list_items">;

const TABS = [
  { key: "general", label: "Produto" },
  { key: "variants", label: "Variantes + fotos" },
  { key: "organization", label: "Organização" },
  { key: "publish", label: "Publicar" },
  { key: "advanced", label: "Avançado" },
] as const;
type TabKey = typeof TABS[number]["key"];

function sizeCodeFromLabel(label: string) {
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "TAM";
}

function parseSizeTags(raw: string) {
  return Array.from(new Set(raw.split(/[;,\n]/).map((s) => s.trim()).filter(Boolean))).slice(0, 40);
}

function ProductEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { storeId } = useActiveStore();
  const { record } = useTelemetry();

  usePageBreadcrumbs([
    { label: "Catálogo" },
    { label: "Produtos", to: "/admin/products" },
    { label: "Cadastro" },
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

  const [tab, setTab] = useState<TabKey>("general");
  useEffect(() => { record({ name: "product.tab.viewed", tags: { tab } }); }, [tab, record]);

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
  const progress = readinessQ.data?.progress ?? 0;
  const canPublish = !!readinessQ.data?.canPublish;
  const issues = readinessQ.data?.issues ?? [];

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["product", id] });
    qc.invalidateQueries({ queryKey: ["product", id, "readiness"] });
    if (product?.slug) {
      qc.invalidateQueries({ queryKey: ["storefront", "product", product.slug] });
    }
    qc.invalidateQueries({ queryKey: ["storefront"] });
  };

  const onPublish = async () => {
    const ok = await runAction(
      () => fnPublish({ data: { id } }),
      { loading: "Publicando...", success: "Produto publicado!" },
    );
    if (ok) { record({ name: "product.published", tags: { product_id: id } }); refreshAll(); }
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden md:flex flex-col items-end min-w-[180px]">
            <span className="text-xs text-muted-foreground mb-1">Pronto p/ publicar: {progress}%</span>
            <Progress value={progress} className="w-44 h-2" />
          </div>
          {product.status === "published" ? (
            <Button variant="outline" onClick={onUnpublish} className="gap-2"><EyeOff className="h-4 w-4" />Despublicar</Button>
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="flex-wrap h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <TabsContent value="general" className="m-0">
              <GeneralTab product={product} onSaved={refreshAll} />
            </TabsContent>
            <TabsContent value="variants" className="m-0">
              <VariantsTab productId={id} product={product} colors={colors as ColorRow[]} onSaved={refreshAll} />
            </TabsContent>
            <TabsContent value="organization" className="m-0">
              <OrganizationTab product={product} onSaved={refreshAll} />
            </TabsContent>
            <TabsContent value="publish" className="m-0">
              <PublishTab canPublish={canPublish} issues={issues} onPublish={onPublish} onUnpublish={onUnpublish} status={product.status} />
            </TabsContent>
            <TabsContent value="advanced" className="m-0">
              <AdvancedTab productId={id} product={product} storeId={storeId} onSaved={refreshAll} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Aba 1 — Geral (dados de identidade, sem organização nem flags de catálogo)
// ============================================================================

function GeneralTab({ product, onSaved }: { product: ProductRow; onSaved: () => void }) {
  const fn = useServerFn(updateProduct);
  const [form, setForm] = useState({
    name: product.name,
    short_description: product.short_description ?? "",
    description: product.description ?? "",
    sale_channel: product.sale_channel,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ok = await runAction(
      () => fn({ data: { id: product.id, patch: {
        name: form.name,
        short_description: form.short_description || null,
        description: form.description || null,
        sale_channel: form.sale_channel,
      } } }),
      { loading: "Salvando...", success: "Informações salvas" },
    );
    setSaving(false);
    if (ok) onSaved();
  };

  return (
    <TabShell title="Informações Gerais" description="Dados de identidade do produto." onSave={save} saving={saving}>
      <FormField label="Nome" required>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </FormField>
      <FormField label="Descrição curta" hint="Aparece em listagens e cartões.">
        <Textarea rows={2} value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
      </FormField>
      <FormField label="Descrição completa">
        <Textarea rows={8} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </FormField>
      <SelectField
        label="Canal de venda"
        value={form.sale_channel}
        onChange={(v) => setForm({ ...form, sale_channel: v as ProductRow["sale_channel"] })}
        options={[
          { value: "ambos", label: "Varejo + Atacado" },
          { value: "varejo", label: "Apenas Varejo" },
          { value: "atacado", label: "Apenas Atacado" },
        ]}
      />
    </TabShell>
  );
}

// ============================================================================
// Aba 2 — Organização (categoria, marca, atributos do produto-pai, flags de catálogo)
// ============================================================================

function OrganizationTab({ product, onSaved }: { product: ProductRow; onSaved: () => void }) {
  const { storeId } = useActiveStore();
  const fnUpd = useServerFn(updateProduct);
  const fnCats = useServerFn(listCategories);
  const fnBrands = useServerFn(listBrands);
  const fnList = useServerFn(listProductAttributes);
  const fnSet = useServerFn(setProductAttribute);
  const fnCatAttrs = useServerFn(listCategoryAttributes);
  const fnAttrs = useServerFn(listAttributes);
  const fnVals = useServerFn(listAttributeValues);
  const fnGetSections = useServerFn(listProductCategoryIds);
  const fnSetSections = useServerFn(setProductCategories);

  const [form, setForm] = useState({
    category_id: product.category_id ?? "",
    brand_id: product.brand_id ?? "",
    featured: product.featured,
    on_sale: product.on_sale,
    new_product: product.new_product,
    best_seller: product.best_seller,
  });
  const [saving, setSaving] = useState(false);
  const [sectionIds, setSectionIds] = useState<Set<string>>(new Set());

  const cats = useQuery({
    queryKey: ["org-cats", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnCats({ data: { store_id: storeId!, pageSize: 500 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as { id: string; name: string; parent_id: string | null }[];
    },
  });
  const brands = useQuery({
    queryKey: ["org-brands", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnBrands({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    let cancelled = false;
    fnGetSections({ data: { product_id: product.id } })
      .then((r) => { if (!cancelled) setSectionIds(new Set(r.ids)); })
      .catch(() => { /* keep empty */ });
    return () => { cancelled = true; };
  }, [fnGetSections, product.id]);


  const valsQ = useQuery({
    queryKey: ["org-attrs", product.id, form.category_id],
    enabled: !!form.category_id && !!storeId,
    queryFn: async () => {
      const [cat, prod, attrsAll] = await Promise.all([
        fnCatAttrs({ data: { category_id: form.category_id } }),
        fnList({ data: { product_id: product.id } }),
        fnAttrs({ data: { store_id: storeId!, pageSize: 100 } }),
      ]);
      if (!cat.ok || !prod.ok || !attrsAll.ok) throw new Error("Falha ao carregar atributos");
      const catAttrs = cat.data.rows as Array<{ attribute_id: string; is_required: boolean }>;
      const attrsMap = new Map(
        (attrsAll.data.rows as Array<{ id: string; name: string; input_type: string }>).map((a) => [a.id, a]),
      );
      const productValues = new Map((prod.data as AttrValRow[]).map((p) => [p.attribute_id, p]));
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

  const save = async () => {
    setSaving(true);
    const ok = await runAction(
      () => fnUpd({ data: { id: product.id, patch: {
        category_id: form.category_id || null,
        brand_id: form.brand_id || null,
        featured: form.featured,
        on_sale: form.on_sale,
        new_product: form.new_product,
        best_seller: form.best_seller,
      } } }),
      { loading: "Salvando...", success: "Organização salva" },
    );
    setSaving(false);
    if (ok) onSaved();
  };

  const setAttr = async (payload: Parameters<typeof fnSet>[0]["data"]) => {
    const ok = await runAction(() => fnSet({ data: payload }), { success: "Atributo salvo" });
    if (ok) { onSaved(); valsQ.refetch(); }
  };

  return (
    <TabShell title="Organização" description="Categoria, marca, atributos e destaque no catálogo." onSave={save} saving={saving}>
      <FormRow>
        <SelectField
          label="Categoria" required
          value={form.category_id}
          onChange={(v) => setForm({ ...form, category_id: v })}
          options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectField
          label="Marca"
          value={form.brand_id || "__none__"}
          onChange={(v) => setForm({ ...form, brand_id: v === "__none__" ? "" : v })}
          options={[
            { value: "__none__", label: "— Sem marca —" },
            ...(brands.data ?? []).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </FormRow>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          ["featured", "Destaque"],
          ["on_sale", "Em promoção"],
          ["new_product", "Novidade"],
          ["best_seller", "Mais vendido"],
        ] as const).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between rounded-md border p-2">
            <Label className="text-xs">{label}</Label>
            <Switch checked={form[k] as boolean} onCheckedChange={(v) => setForm({ ...form, [k]: v })} />
          </div>
        ))}
      </div>

      {form.category_id && (
        <div className="space-y-3 pt-4 border-t">
          <p className="text-sm font-medium">Atributos da categoria</p>
          {valsQ.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {valsQ.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum atributo vinculado a esta categoria.</p>
          )}
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
                  onChange={(v) => setAttr({
                    product_id: product.id,
                    attribute_id: a.attribute_id,
                    attribute_value_id: v === "__none__" ? null : v,
                  })}
                  options={[
                    { value: "__none__", label: "— Não definido —" },
                    ...a.values.map((v) => ({ value: v.id, label: v.label })),
                  ]}
                />
              ) : (
                <Input
                  defaultValue={a.current?.value_text ?? ""}
                  placeholder="Digite o valor"
                  onBlur={(e) => setAttr({
                    product_id: product.id,
                    attribute_id: a.attribute_id,
                    value_text: e.target.value || null,
                  })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </TabShell>
  );
}

// ============================================================================
// Aba 3 — Variantes (centro do sistema): cores + gerador + matriz editável
// ============================================================================

function VariantsTab({
  productId, product, colors, onSaved,
}: { productId: string; product: ProductRow; colors: ColorRow[]; onSaved: () => void }) {
  const { storeId } = useActiveStore();
  const { record } = useTelemetry();
  const qc = useQueryClient();

  const fnCreate = useServerFn(createProductColor);
  const fnUpdColor = useServerFn(updateProductColor);
  const fnDelColor = useServerFn(deleteProductColor);
  const fnListVar = useServerFn(listProductVariants);
  const fnGen = useServerFn(generateProductVariants);
  const fnDelVar = useServerFn(deleteProductVariant);
  const fnUpdVar = useServerFn(updateProductVariant);
  const fnCatAttrs = useServerFn(listCategoryAttributes);
  const fnAttrs = useServerFn(listAttributes);
  const fnVals = useServerFn(listAttributeValues);
  const fnCreateSize = useServerFn(createAttributeValue);
  const fnStock = useServerFn(listAdminStock);
  const fnBulkStock = useServerFn(bulkAdjustStock);
  const fnPrices = useServerFn(listProductPrices);
  const fnPriceLists = useServerFn(listPriceLists);
  const fnSetPrice = useServerFn(setVariantPrice);

  const variantsQ = useQuery({
    queryKey: ["variants", productId],
    queryFn: async () => {
      const r = await fnListVar({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as VariantRow[];
    },
  });

  const sizeAttrQ = useQuery({
    queryKey: ["size-attr", product.category_id, storeId],
    enabled: !!product.category_id && !!storeId,
    queryFn: async () => {
      const [ca, attrs] = await Promise.all([
        fnCatAttrs({ data: { category_id: product.category_id! } }),
        fnAttrs({ data: { store_id: storeId!, pageSize: 100 } }),
      ]);
      if (!ca.ok || !attrs.ok) return null;
      const attrList = attrs.data.rows as Array<{ id: string; name: string; is_size?: boolean }>;
      const catList = ca.data.rows as Array<{ attribute_id: string }>;
      const candidate = attrList.find((a) =>
        catList.some((c) => c.attribute_id === a.id) && (a.is_size || /tamanho|size/i.test(a.name)),
      );
      if (!candidate) return { attribute: null, values: [] as Array<{ id: string; label: string; code: string | null }> };
      const v = await fnVals({ data: { attribute_id: candidate.id, pageSize: 100 } });
      return {
        attribute: candidate,
        values: v.ok ? (v.data.rows as Array<{ id: string; label: string; code: string | null }>) : [],
      };
    },
  });

  // Stock por variante (loja ativa) — vem do Inventory Engine
  const stockQ = useQuery({
    queryKey: ["product-stock", productId, storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const r = await fnStock({ data: { store_id: storeId!, product_id: productId, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Array<{ id: string; variant_id: string; quantity_on_hand: number; warehouse_id: string }>;
    },
  });

  // Preços por variante (lista padrão)
  const priceListsQ = useQuery({
    queryKey: ["price-lists", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnPriceLists({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Array<{ id: string; name: string; is_default?: boolean }>;
    },
  });
  const defaultPriceListId = priceListsQ.data?.find((l) => l.is_default)?.id ?? priceListsQ.data?.[0]?.id ?? "";
  const pricesQ = useQuery({
    queryKey: ["product-prices", productId],
    queryFn: async () => {
      const r = await fnPrices({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as PriceItemRow[];
    },
  });

  // ---------- Cores ----------
  const [newColor, setNewColor] = useState({ name: "", hex: "#000000" });
  const addColor = async () => {
    if (!newColor.name.trim()) return;
    const ok = await runAction(
      () => fnCreate({ data: {
        product_id: productId, name: newColor.name.trim(), hex: newColor.hex,
        is_default: colors.length === 0,
      } }),
      { success: "Cor adicionada" },
    );
    if (ok) { setNewColor({ name: "", hex: "#000000" }); onSaved(); }
  };
  const removeColor = async (id: string) => {
    const ok = await runAction(() => fnDelColor({ data: { id } }), { success: "Cor removida" });
    if (ok) onSaved();
  };
  const setColorDefault = async (id: string) => {
    const ok = await runAction(
      () => fnUpdColor({ data: { id, patch: { is_default: true } } }),
      { success: "Cor padrão definida" },
    );
    if (ok) onSaved();
  };

  // ---------- Gerar variantes ----------
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sizeTagInput, setSizeTagInput] = useState("");
  const [creatingSizes, setCreatingSizes] = useState(false);
  const toggleSize = (id: string) =>
    setSelectedSizes((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  useEffect(() => {
    const used = Array.from(new Set((variantsQ.data ?? []).map((v) => v.size_attribute_value_id).filter(Boolean) as string[]));
    if (used.length) setSelectedSizes((prev) => prev.length ? prev : used);
  }, [variantsQ.data]);

  const addCustomSizes = async (options: { generateAfter?: boolean } = {}) => {
    const attributeId = sizeAttrQ.data?.attribute?.id;
    const labels = parseSizeTags(sizeTagInput);
    if (!attributeId) { notify.error("A categoria precisa ter um atributo de tamanho"); return; }
    if (!labels.length) return;
    setCreatingSizes(true);
    const selected = new Set(selectedSizes);
    try {
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const code = sizeCodeFromLabel(label);
        const existing = sizeValues.find((v) => v.label.trim().toLowerCase() === label.toLowerCase() || sizeCodeFromLabel(v.label) === code);
        if (existing) { selected.add(existing.id); continue; }
        const r = await fnCreateSize({ data: { attribute_id: attributeId, code, label, sort_order: sizeValues.length + i } });
        if (r.ok) selected.add(r.data.id);
        else if (r.error.code === "CONFLICT") {
          const fresh = await fnVals({ data: { attribute_id: attributeId, pageSize: 100 } });
          const match = fresh.ok
            ? (fresh.data.rows as Array<{ id: string; label: string; code: string | null }>).find((v) => v.code === code || v.label.trim().toLowerCase() === label.toLowerCase())
            : null;
          if (match) selected.add(match.id);
        } else throw new Error(r.error.message);
      }
      const nextSizes = Array.from(selected);
      setSelectedSizes(nextSizes);
      setSizeTagInput("");
      await sizeAttrQ.refetch();
      notify.success("Tamanhos adicionados e selecionados");
      if (options.generateAfter) await generate(nextSizes);
    } catch (e) {
      notify.error((e as Error).message || "Falha ao adicionar tamanho");
    } finally {
      setCreatingSizes(false);
    }
  };

  const generate = async (sizeIds = selectedSizes) => {
    const ok = await runAction(
      () => fnGen({ data: { product_id: productId, size_attribute_value_ids: sizeIds } }),
      { loading: "Gerando variantes...", success: "Variantes geradas" },
    );
    if (ok) {
      record({
        name: "product.variants.generated",
        tags: { product_id: productId, colors: colors.length, sizes: selectedSizes.length || 1 },
      });
      qc.invalidateQueries({ queryKey: ["variants", productId] });
      qc.invalidateQueries({ queryKey: ["product-stock", productId, storeId] });
      qc.invalidateQueries({ queryKey: ["storefront"] });
      onSaved();
    }
  };

  const removeVariant = async (id: string) => {
    const ok = await runAction(() => fnDelVar({ data: { id } }), { success: "Variante removida" });
    if (ok) {
      qc.invalidateQueries({ queryKey: ["variants", productId] });
      qc.invalidateQueries({ queryKey: ["storefront"] });
      onSaved();
    }
  };

  // ---------- Edição inline ----------
  const saveVariantField = async (
    id: string,
    patch: Parameters<typeof fnUpdVar>[0]["data"]["patch"],
  ) => {
    const ok = await runAction(
      () => fnUpdVar({ data: { id, patch } }),
      { success: "Variante atualizada" },
    );
    if (ok) {
      record({ name: "product.variant.edited", tags: { variant_id: id, fields: Object.keys(patch).join(",") } });
      qc.invalidateQueries({ queryKey: ["variants", productId] });
      qc.invalidateQueries({ queryKey: ["storefront"] });
      onSaved();
    }
  };

  const saveStock = async (stockLevelId: string, newQty: number) => {
    const ok = await runAction(
      () => fnBulkStock({ data: { items: [{ stock_level_id: stockLevelId, new_quantity: newQty, reason: "Ajuste via cadastro de produto" }] } }),
      { success: "Estoque ajustado" },
    );
    if (ok) { qc.invalidateQueries({ queryKey: ["product-stock", productId, storeId] }); qc.invalidateQueries({ queryKey: ["storefront"] }); onSaved(); }
  };

  const savePrice = async (variantId: string, price: number, salePrice: number | null) => {
    if (!defaultPriceListId) {
      notify.error("Cadastre ao menos uma lista de preços");
      return;
    }
    const ok = await runAction(
      () => fnSetPrice({ data: {
        variant_id: variantId, price_list_id: defaultPriceListId,
        price, compare_at_price: salePrice,
      } }),
      { success: "Preço salvo" },
    );
    if (ok) { qc.invalidateQueries({ queryKey: ["product-prices", productId] }); qc.invalidateQueries({ queryKey: ["storefront"] }); onSaved(); }
  };

  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [bulkSaving, setBulkSaving] = useState<"price" | "stock" | null>(null);

  const applyBulkPrice = async () => {
    const value = Number(bulkPrice.replace(",", "."));
    if (Number.isNaN(value) || value < 0) { notify.error("Informe um preço válido"); return; }
    setBulkSaving("price");
    try {
      for (const v of variantsQ.data ?? []) await savePrice(v.id, value, null);
      notify.success("Preço aplicado em todas as variantes");
      setBulkPrice("");
    } finally {
      setBulkSaving(null);
    }
  };

  const applyBulkStock = async () => {
    const value = Number(bulkStock);
    if (Number.isNaN(value) || value < 0) { notify.error("Informe um estoque válido"); return; }
    setBulkSaving("stock");
    try {
      for (const v of variantsQ.data ?? []) {
        const stock = stockByVariant.get(v.id);
        if (stock?.id) await saveStock(stock.id, value);
      }
      notify.success("Estoque aplicado em todas as variantes");
      setBulkStock("");
    } finally {
      setBulkSaving(null);
    }
  };

  // ---------- Lookups ----------
  const colorById = useMemo(() => new Map(colors.map((c) => [c.id, c])), [colors]);
  const sizeById = useMemo(() => {
    const m = new Map<string, string>();
    (sizeAttrQ.data?.values ?? []).forEach((v) => m.set(v.id, v.label));
    return m;
  }, [sizeAttrQ.data]);
  const stockByVariant = useMemo(() => {
    const m = new Map<string, { id: string; qty: number }>();
    (stockQ.data ?? []).forEach((s) => m.set(s.variant_id, { id: s.id, qty: s.quantity_on_hand }));
    return m;
  }, [stockQ.data]);
  const priceByVariant = useMemo(() => {
    const m = new Map<string, { price: number; compare: number | null }>();
    (pricesQ.data ?? []).filter((p) => p.price_list_id === defaultPriceListId).forEach((p) =>
      m.set(p.variant_id!, { price: Number(p.price), compare: p.compare_at_price != null ? Number(p.compare_at_price) : null }),
    );
    return m;
  }, [pricesQ.data, defaultPriceListId]);

  const sizeValues = sizeAttrQ.data?.values ?? [];
  const variants = variantsQ.data ?? [];
  const sizesByColor = useMemo(() => {
    const m = new Map<string, string[]>();
    variants.forEach((v) => {
      if (!v.product_color_id) return;
      const label = v.size_attribute_value_id ? sizeById.get(v.size_attribute_value_id) ?? null : null;
      if (!label) return;
      const arr = m.get(v.product_color_id) ?? [];
      if (!arr.includes(label)) arr.push(label);
      m.set(v.product_color_id, arr);
    });
    return m;
  }, [variants, sizeById]);

  return (
    <TabShell
      title="Variantes e fotos"
      description="Crie cores, vincule fotos e ajuste os SKUs no mesmo lugar."
    >
      {/* CORES — formam o eixo principal das variantes e a chave da galeria */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">1. Cores e fotos</h3>
          <p className="text-xs text-muted-foreground">Cada cor pode ter sua própria galeria.</p>
        </div>
        <div className="rounded-md border p-3 space-y-3 bg-muted/30">
          <FormRow>
            <FormField label="Nome">
              <Input value={newColor.name} onChange={(e) => setNewColor({ ...newColor, name: e.target.value })} placeholder="Ex.: Vermelho" />
            </FormField>
            <ColorPicker label="Cor" value={newColor.hex} onChange={(v) => setNewColor({ ...newColor, hex: v })} />
            <div className="flex items-end">
              <Button onClick={addColor} disabled={!newColor.name.trim()} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar cor
              </Button>
            </div>
          </FormRow>
        </div>
        {colors.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {colors.map((c) => (
              <div key={c.id} className="rounded-lg border bg-background p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full ring-1 ring-border shrink-0" style={{ background: c.hex ?? "#ccc" }} />
                    <span className="font-medium truncate">{c.name}</span>
                    {c.is_default && <Badge className="h-5 text-[10px] gap-1"><Star className="h-2.5 w-2.5" />Padrão</Badge>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!c.is_default && (
                      <Button size="sm" variant="ghost" onClick={() => setColorDefault(c.id)} className="h-8 text-xs">
                        Tornar padrão
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => removeColor(c.id)} className="h-8 w-8">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <ColorMediaQuickManager color={c} onSaved={onSaved} />
                {(() => {
                  const sizes = sizesByColor.get(c.id) ?? [];
                  if (!sizes.length) return (
                    <p className="text-[11px] text-muted-foreground border-t pt-2">Nenhum tamanho gerado para esta cor ainda.</p>
                  );
                  return (
                    <div className="border-t pt-2 space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tamanhos disponíveis ({sizes.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {sizes.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded-full border bg-muted text-[11px]">{s}</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* GERADOR */}
      <section className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">2. Tamanhos e geração</h3>
          <Button
            size="sm"
            onClick={() => generate()}
            disabled={!colors.length || (!sizeValues.length && !selectedSizes.length && !sizeAttrQ.data)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" /> Gerar variantes
          </Button>
        </div>
        <div className="rounded-md border p-3 bg-muted/30 space-y-3">
          {!colors.length && (
            <p className="text-sm text-amber-700 dark:text-amber-300">Adicione ao menos uma cor para gerar variantes.</p>
          )}
          <div>
            <p className="text-xs uppercase font-medium text-muted-foreground mb-2">
              Tamanhos
              {sizeAttrQ.data?.attribute && (
                <span className="normal-case ml-1 text-muted-foreground/70">({sizeAttrQ.data.attribute.name})</span>
              )}
            </p>
            {!sizeAttrQ.data?.attribute ? (
              <p className="text-xs text-muted-foreground">
                Categoria sem atributo de tamanho — será gerada 1 variante por cor.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Os tamanhos marcados serão criados em <strong>todas</strong> as cores (mesmos tamanhos para todas).
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedSizes(sizeValues.map((v) => v.id))}>Selecionar todos</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedSizes([])}>Limpar</Button>
                </div>
                {(() => {
                  const presets: Array<{ label: string; match: RegExp }> = [
                    { label: "PP–GG", match: /^(PP|P|M|G|GG|XGG)$/i },
                    { label: "P–G", match: /^(P|M|G)$/i },
                    { label: "Numéricos", match: /^\d{2}$/ },
                  ];
                  const applicable = presets.filter((p) => sizeValues.some((v) => p.match.test(v.label.trim())));
                  if (!applicable.length) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Presets:</span>
                      {applicable.map((p) => (
                        <Button key={p.label} size="sm" variant="secondary" className="h-7 text-xs"
                          onClick={() => setSelectedSizes(sizeValues.filter((v) => p.match.test(v.label.trim())).map((v) => v.id))}>
                          {p.label}
                        </Button>
                      ))}
                    </div>
                  );
                })()}
                <div className="flex flex-wrap gap-2">
                  {sizeValues.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleSize(v.id)}
                      className={`px-3 py-1.5 rounded-full border text-sm ${selectedSizes.includes(v.id) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <Label className="text-xs font-medium">Adicionar tamanhos por tag</Label>
                    <Input
                      value={sizeTagInput}
                      onChange={(e) => setSizeTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addCustomSizes(); } }}
                      placeholder="Ex.: 54, G, GG"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" disabled={creatingSizes || !sizeTagInput.trim()} onClick={() => addCustomSizes()} className="gap-2">
                      {creatingSizes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Adicionar
                    </Button>
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      disabled={creatingSizes || !sizeTagInput.trim() || !colors.length}
                      onClick={() => addCustomSizes({ generateAfter: true })}
                      className="w-full gap-2"
                    >
                      {creatingSizes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Adicionar tamanhos e gerar para todas as cores
                    </Button>
                  </div>
                </div>
                {selectedSizes.length > 0 && colors.length > 0 && (
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    Ao gerar: <strong>{selectedSizes.length}</strong> tamanho(s) × <strong>{colors.length}</strong> cor(es) ={" "}
                    <strong>{selectedSizes.length * colors.length}</strong> variante(s).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MATRIZ EDITÁVEL */}
      <section className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">3. Ajustes por variante ({variants.length})</h3>
        </div>
        {variants.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma variante. Adicione cores e clique em <strong>Gerar variantes</strong>.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium mb-3">Ações rápidas</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <Input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} type="number" step="0.01" placeholder="Mesmo preço para todas" />
                  <Button variant="outline" disabled={bulkSaving === "price" || !bulkPrice.trim()} onClick={applyBulkPrice} className="shrink-0">
                    Aplicar preço
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} type="number" min={0} placeholder="Mesmo estoque para todas" />
                  <Button variant="outline" disabled={bulkSaving === "stock" || !bulkStock.trim()} onClick={applyBulkStock} className="shrink-0">
                    Aplicar estoque
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {variants.map((v) => {
                const color = colorById.get(v.product_color_id);
                const sizeLabel = v.size_attribute_value_id ? sizeById.get(v.size_attribute_value_id) ?? "—" : "Único";
                const stock = stockByVariant.get(v.id);
                const price = priceByVariant.get(v.id);
                return (
                  <VariantRow
                    key={v.id}
                    variant={v}
                    colorName={color?.name ?? "—"}
                    colorHex={color?.hex ?? null}
                    sizeLabel={sizeLabel}
                    stockLevelId={stock?.id ?? null}
                    stockQty={stock?.qty ?? null}
                    price={price?.price ?? null}
                    salePrice={price?.compare ?? null}
                    onChangeVariant={(patch) => saveVariantField(v.id, patch)}
                    onChangeStock={(qty) => stock?.id && saveStock(stock.id, qty)}
                    onChangePrice={(p, sale) => savePrice(v.id, p, sale)}
                    onDelete={() => removeVariant(v.id)}
                  />
                );
              })}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Campos salvam ao sair do input. Preço usa a lista padrão da loja; estoque usa o controle de inventário.
        </p>
      </section>
    </TabShell>
  );
}

function ColorMediaQuickManager({ color, onSaved }: { color: ColorRow; onSaved: () => void }) {
  const fnList = useServerFn(listColorMedia);
  const fnAdd = useServerFn(addColorMedia);
  const fnDel = useServerFn(deleteColorMedia);
  const fnUpd = useServerFn(updateColorMedia);
  const qc = useQueryClient();

  const media = useQuery({
    queryKey: ["variant-color-media", color.id],
    queryFn: async () => {
      const r = await fnList({ data: { color_id: color.id } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as MediaRow[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["variant-color-media", color.id] });

  const onPicked = async (assets: AssetLike[]) => {
    if (assets.length === 0) return;
    const baseOrder = media.data?.length ?? 0;
    const hasCover = (media.data ?? []).some((m) => m.is_cover);
    const ok = await runAction(
      async () => {
        let i = 0;
        for (const a of assets) {
          const mediaType: "image" | "video" | "youtube" | "vimeo" =
            a.kind === "youtube" ? "youtube"
            : a.kind === "vimeo" ? "vimeo"
            : a.kind === "video" ? "video"
            : "image";
          const previewUrl = a.preview_url ?? a.external_url ?? null;
          const res = await fnAdd({ data: {
            color_id: color.id,
            media_type: mediaType,
            external_url: a.storage_path ? null : previewUrl,
            external_id: a.external_id ?? null,
            storage_path: a.storage_path ?? null,
            thumbnail_url: previewUrl,
            alt: a.alt_text ?? null,
            title: a.title ?? a.original_filename ?? null,
            is_cover: !hasCover && i === 0,
            sort_order: baseOrder + i,
          } });
          if (!res.ok) throw new Error(res.error.message);
          i++;
        }
        return { ok: true as const, data: { added: assets.length } };
      },
      { loading: "Vinculando fotos...", success: `${assets.length} foto(s) adicionada(s)` },
    );
    if (ok) { invalidate(); onSaved(); }
  };
  const setCover = async (id: string) => {
    const ok = await runAction(() => fnUpd({ data: { id, patch: { is_cover: true } } }), { success: "Capa definida" });
    if (ok) { invalidate(); onSaved(); }
  };
  const remove = async (id: string) => {
    const ok = await runAction(() => fnDel({ data: { id } }), { success: "Foto removida" });
    if (ok) { invalidate(); onSaved(); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{media.data?.length ?? 0} foto(s)</span>
        <AssetPicker context="product" multiple onSelect={onPicked}>
          <Button size="sm" variant="outline" className="gap-2"><ImagePlus className="h-4 w-4" />Adicionar fotos</Button>
        </AssetPicker>
      </div>
      {(media.data?.length ?? 0) === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Fotos desta cor aparecerão aqui.
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {(media.data ?? []).slice(0, 10).map((m) => {
            const src = m.thumbnail_url || m.external_url || m.storage_path || "";
            return (
              <div key={m.id} className="relative aspect-square rounded-md border bg-muted overflow-hidden group">
                {src ? <img src={src} alt={m.alt ?? color.name} className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 m-auto text-muted-foreground" />}
                {m.is_cover && <Badge className="absolute left-1 top-1 h-5 text-[10px]"><Star className="h-2.5 w-2.5 mr-0.5" />Capa</Badge>}
                <div className="absolute inset-x-0 bottom-0 hidden group-hover:flex gap-1 p-1 bg-background/90">
                  {!m.is_cover && <Button size="sm" variant="secondary" className="h-6 text-[10px] flex-1" onClick={() => setCover(m.id)}>Capa</Button>}
                  <Button size="icon" variant="destructive" className="h-6 w-6" onClick={() => remove(m.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VariantRow({
  variant, colorName, colorHex, sizeLabel, stockLevelId, stockQty, price, salePrice,
  onChangeVariant, onChangeStock, onChangePrice, onDelete,
}: {
  variant: VariantRow;
  colorName: string;
  colorHex: string | null;
  sizeLabel: string;
  stockLevelId: string | null;
  stockQty: number | null;
  price: number | null;
  salePrice: number | null;
  onChangeVariant: (patch: { sku?: string; barcode?: string | null; weight_grams?: number | null; is_active?: boolean }) => void;
  onChangeStock: (qty: number) => void;
  onChangePrice: (price: number, sale: number | null) => void;
  onDelete: () => void;
}) {
  const [sku, setSku] = useState(variant.sku);
  const [barcode, setBarcode] = useState(variant.barcode ?? "");
  const [weight, setWeight] = useState(variant.weight_grams != null ? String(variant.weight_grams) : "");
  const [stock, setStock] = useState(stockQty != null ? String(stockQty) : "");
  const [priceInput, setPriceInput] = useState(price != null ? String(price) : "");
  const [saleInput, setSaleInput] = useState(salePrice != null ? String(salePrice) : "");

  useEffect(() => { setSku(variant.sku); }, [variant.sku]);
  useEffect(() => { setBarcode(variant.barcode ?? ""); }, [variant.barcode]);
  useEffect(() => { setWeight(variant.weight_grams != null ? String(variant.weight_grams) : ""); }, [variant.weight_grams]);
  useEffect(() => { setStock(stockQty != null ? String(stockQty) : ""); }, [stockQty]);
  useEffect(() => { setPriceInput(price != null ? String(price) : ""); }, [price]);
  useEffect(() => { setSaleInput(salePrice != null ? String(salePrice) : ""); }, [salePrice]);

  const onBlurNumber = (raw: string, cb: (n: number) => void) => {
    const n = Number(raw.replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) cb(n);
  };

  return (
    <div className={`rounded-lg border bg-background p-3 space-y-3 ${!variant.is_active ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {colorHex && <span className="h-3 w-3 rounded-full ring-1 ring-border shrink-0" style={{ background: colorHex }} />}
            <span className="font-semibold truncate">{colorName}</span>
            <Badge variant="secondary" className="shrink-0">{sizeLabel}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{variant.sku}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={variant.is_active} onCheckedChange={(v) => onChangeVariant({ is_active: v })} />
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <FormField label="SKU">
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            onBlur={() => sku !== variant.sku && onChangeVariant({ sku })}
            className="font-mono"
          />
        </FormField>
        <FormField label="Estoque">
          {stockLevelId ? (
            <Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} onBlur={() => onBlurNumber(stock, onChangeStock)} />
          ) : (
            <Input disabled value="Sem nível" />
          )}
        </FormField>
        <FormField label="Preço">
          <Input
            type="number" min={0} step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
            onBlur={() => {
              const p = Number(priceInput.replace(",", "."));
              const s = saleInput ? Number(saleInput.replace(",", ".")) : null;
              if (!Number.isNaN(p) && p !== price) onChangePrice(p, s);
            }}
            placeholder="0,00"
          />
        </FormField>
        <FormField label="Promoção">
          <Input
            type="number" min={0} step="0.01" value={saleInput} onChange={(e) => setSaleInput(e.target.value)}
            onBlur={() => {
              const p = priceInput ? Number(priceInput.replace(",", ".")) : price;
              const s = saleInput ? Number(saleInput.replace(",", ".")) : null;
              if (p != null && !Number.isNaN(p)) onChangePrice(p, s);
            }}
            placeholder="—"
          />
        </FormField>
      </div>

      <details className="rounded-md bg-muted/30 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Campos avançados</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
          <FormField label="Código de barras">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onBlur={() => (barcode || "") !== (variant.barcode ?? "") && onChangeVariant({ barcode: barcode || null })}
              className="font-mono"
              placeholder="EAN/UPC"
            />
          </FormField>
          <FormField label="Peso (g)">
            <Input
              type="number" min={0} step={1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={() => {
                const n = weight ? Number(weight) : null;
                if (n !== variant.weight_grams) onChangeVariant({ weight_grams: n });
              }}
            />
          </FormField>
        </div>
      </details>
    </div>
  );
}

// ============================================================================
// Aba 4 — Galeria (por COR — imagens NÃO pertencem à variante)
// ============================================================================

function GalleryTab({ productId, colors, onSaved }: { productId: string; colors: ColorRow[]; onSaved: () => void }) {
  void productId;
  const [activeColorId, setActiveColorId] = useState(colors[0]?.id ?? "");
  const { record } = useTelemetry();
  const fnList = useServerFn(listColorMedia);
  const fnAdd = useServerFn(addColorMedia);
  const fnDel = useServerFn(deleteColorMedia);
  const fnUpd = useServerFn(updateColorMedia);
  const qc = useQueryClient();

  // Reset active color when colors set changes
  useEffect(() => {
    if (!colors.find((c) => c.id === activeColorId)) {
      setActiveColorId(colors[0]?.id ?? "");
    }
  }, [colors, activeColorId]);

  const media = useQuery({
    queryKey: ["color-media", activeColorId],
    enabled: !!activeColorId,
    queryFn: async () => {
      const r = await fnList({ data: { color_id: activeColorId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as MediaRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["color-media", activeColorId] });

  const onAssetsPicked = async (assets: AssetLike[]) => {
    if (!activeColorId || assets.length === 0) return;
    const baseOrder = media.data?.length ?? 0;
    const hasCover = (media.data ?? []).some((m) => m.is_cover);
    const ok = await runAction(
      async () => {
        let i = 0;
        for (const a of assets) {
          const kind = a.kind;
          const mediaType: "image" | "video" | "youtube" | "vimeo" =
            kind === "youtube" ? "youtube"
            : kind === "vimeo" ? "vimeo"
            : kind === "video" ? "video"
            : "image";
          const previewUrl = a.preview_url ?? a.external_url ?? null;
          const res = await fnAdd({
            data: {
              color_id: activeColorId,
              media_type: mediaType,
              external_url: a.storage_path ? null : previewUrl,
              external_id: a.external_id ?? null,
              storage_path: a.storage_path ?? null,
              thumbnail_url: previewUrl,
              alt: a.alt_text ?? null,
              title: a.title ?? a.original_filename ?? null,
              is_cover: !hasCover && i === 0,
              sort_order: baseOrder + i,
            },
          });
          if (!res.ok) throw new Error(res.error.message);
          i++;
        }
        return { ok: true as const, data: { added: assets.length } };
      },
      { loading: "Vinculando mídia…", success: `${assets.length} mídia(s) adicionada(s)` },
    );
    if (ok) {
      record({ name: "product.color.media.uploaded", tags: { color_id: activeColorId, count: assets.length } });
      invalidate(); onSaved();
    }
  };

  const remove = async (id: string) => {
    const ok = await runAction(() => fnDel({ data: { id } }), { success: "Mídia removida" });
    if (ok) { invalidate(); onSaved(); }
  };
  const setCover = async (id: string) => {
    const ok = await runAction(
      () => fnUpd({ data: { id, patch: { is_cover: true } } }),
      { success: "Capa definida" },
    );
    if (ok) { invalidate(); onSaved(); }
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const persistOrder = async (orderedIds: string[]) => {
    qc.setQueryData<MediaRow[]>(["color-media", activeColorId], (prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.map((m) => [m.id, m]));
      return orderedIds.map((id, idx) => ({ ...(byId.get(id) as MediaRow), sort_order: idx }));
    });
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        const r = await fnUpd({ data: { id: orderedIds[i], patch: { sort_order: i } } });
        if (!r.ok) throw new Error(r.error.message);
      }
      notify.success("Ordem atualizada"); onSaved();
    } catch { notify.error("Falha ao reordenar"); invalidate(); }
  };
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const list = (media.data ?? []).map((m) => m.id);
    const from = list.indexOf(dragId);
    const to = list.indexOf(targetId);
    if (from < 0 || to < 0) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    setDragId(null); setOverId(null);
    void persistOrder(list);
  };

  if (colors.length === 0) {
    return (
      <TabShell title="Galeria" description="Imagens pertencem à cor, não à variante.">
        <p className="text-sm text-muted-foreground">Cadastre ao menos uma cor na aba <strong>Variantes</strong> para gerenciar a galeria.</p>
      </TabShell>
    );
  }

  return (
    <TabShell
      title="Galeria por cor"
      description="As imagens pertencem à cor. Na storefront, ao selecionar uma cor a galeria troca automaticamente."
    >
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

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {(media.data?.length ?? 0)} mídia(s) nesta cor. Arraste para reordenar.
        </p>
        <AssetPicker context="product" multiple onSelect={onAssetsPicked}>
          <Button className="gap-2"><Library className="h-4 w-4" /> Selecionar do DAM</Button>
        </AssetPicker>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {(media.data ?? []).map((m) => {
          const src = m.thumbnail_url || m.external_url || m.storage_path || "";
          const isOver = overId === m.id && dragId !== m.id;
          return (
            <div
              key={m.id}
              draggable
              onDragStart={(e) => { setDragId(m.id); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { e.preventDefault(); if (overId !== m.id) setOverId(m.id); }}
              onDragLeave={() => { if (overId === m.id) setOverId(null); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(m.id); }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              className={`relative aspect-square rounded-md overflow-hidden border bg-muted group cursor-grab active:cursor-grabbing transition ${isOver ? "ring-2 ring-primary" : ""} ${dragId === m.id ? "opacity-50" : ""}`}
            >
              {src ? <img src={src} alt={m.alt ?? ""} className="w-full h-full object-cover pointer-events-none" /> : null}
              <div className="absolute top-1 left-1 flex items-center gap-1">
                {m.is_cover && <Badge className="text-xs"><Star className="h-3 w-3 mr-1" />Capa</Badge>}
              </div>
              <div className="absolute top-1 right-1 opacity-70 group-hover:opacity-100">
                <div className="bg-background/80 rounded p-1"><GripVertical className="h-3 w-3" /></div>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                {!m.is_cover && (
                  <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => setCover(m.id)}>
                    Capa
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
          <div className="col-span-full">
            <div className="flex flex-col items-center justify-center text-center py-10 border border-dashed rounded-md text-muted-foreground">
              <ImagePlus className="h-8 w-8 mb-2 opacity-60" />
              <p className="text-sm">Nenhuma mídia ainda nesta cor.</p>
              <AssetPicker context="product" multiple onSelect={onAssetsPicked}>
                <Button variant="outline" className="mt-3 gap-2">
                  <Library className="h-4 w-4" /> Abrir biblioteca DAM
                </Button>
              </AssetPicker>
            </div>
          </div>
        )}
      </div>
    </TabShell>
  );
}

// ============================================================================
// Aba 5 — Preços (todas as listas, por variante)
// ============================================================================

function PricesTab({ productId, storeId, onSaved }: { productId: string; storeId: string | null; onSaved: () => void }) {
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

  const save = async (variantId: string, value: number, compare: number | null) => {
    if (!effectiveListId) return;
    const ok = await runAction(
      () => fnSet({ data: { variant_id: variantId, price_list_id: effectiveListId, price: value, compare_at_price: compare } }),
      { success: "Preço salvo" },
    );
    if (ok) { qc.invalidateQueries({ queryKey: ["product-prices", productId] }); onSaved(); }
  };

  if (!variants.data?.length) {
    return <TabShell title="Preços"><p className="text-sm text-muted-foreground">Gere variantes antes de definir preços.</p></TabShell>;
  }
  if (!lists.data?.length) {
    return <TabShell title="Preços"><p className="text-sm text-muted-foreground">Cadastre uma lista de preços antes de continuar.</p></TabShell>;
  }

  return (
    <TabShell title="Preços" description="Defina o preço (e o preço promocional) de cada variante por lista.">
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
            <PriceRowEditor
              key={v.id}
              sku={v.sku}
              initialPrice={current?.price ? Number(current.price) : null}
              initialSale={current?.compare_at_price ? Number(current.compare_at_price) : null}
              onSave={(p, s) => save(v.id, p, s)}
            />
          );
        })}
      </div>
    </TabShell>
  );
}

function PriceRowEditor({
  sku, initialPrice, initialSale, onSave,
}: { sku: string; initialPrice: number | null; initialSale: number | null; onSave: (p: number, s: number | null) => void }) {
  const [price, setPrice] = useState<string>(initialPrice?.toString() ?? "");
  const [sale, setSale] = useState<string>(initialSale?.toString() ?? "");
  return (
    <div className="flex items-center gap-3 p-3 text-sm">
      <code className="font-mono flex-1 min-w-0 truncate">{sku}</code>
      <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" placeholder="Preço" />
      <Input type="number" step="0.01" value={sale} onChange={(e) => setSale(e.target.value)} className="w-28" placeholder="Promo" />
      <Button
        size="sm" variant="outline"
        onClick={() => {
          const p = Number(price); if (Number.isNaN(p)) return;
          const s = sale ? Number(sale) : null;
          onSave(p, s);
        }}
        disabled={!price.trim()}
      >
        <Save className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ============================================================================
// Aba 6 — SEO
// ============================================================================

function SeoTab({ product, onSaved }: { product: ProductRow; onSaved: () => void }) {
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
    <TabShell title="SEO" description="Como o produto aparece em buscadores e redes sociais." onSave={save} saving={saving}>
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
    </TabShell>
  );
}

function AdvancedTab({
  productId, product, storeId, onSaved,
}: { productId: string; product: ProductRow; storeId: string | null; onSaved: () => void }) {
  return (
    <TabShell title="Configurações avançadas" description="Itens usados com menos frequência ficam separados para não atrapalhar o cadastro principal.">
      <Tabs defaultValue="seo" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="prices">Listas de preço</TabsTrigger>
            <TabsTrigger value="related">Relacionados</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="seo" className="m-0"><SeoTab product={product} onSaved={onSaved} /></TabsContent>
        <TabsContent value="prices" className="m-0"><PricesTab productId={productId} storeId={storeId} onSaved={onSaved} /></TabsContent>
        <TabsContent value="related" className="m-0"><RelatedTab productId={productId} storeId={storeId} /></TabsContent>
        <TabsContent value="history" className="m-0"><HistoryTab productId={productId} /></TabsContent>
      </Tabs>
    </TabShell>
  );
}

// ============================================================================
// Aba 7 — Relacionados
// ============================================================================

type RelationType = "related" | "cross_sell" | "up_sell";
const RELATION_LABEL: Record<RelationType, string> = {
  related: "Relacionado",
  cross_sell: "Cross-sell",
  up_sell: "Up-sell",
};

function RelatedTab({ productId, storeId }: { productId: string; storeId: string | null }) {
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
      { success: "Relação adicionada" },
    );
    if (ok) { setSearch(""); invalidate(); }
  };
  const handleRemove = async (id: string) => {
    const ok = await runAction(() => fnRemove({ data: { id } }), { success: "Relação removida" });
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
    <TabShell title="Produtos relacionados" description="Cross-sell, up-sell e relacionados para recomendações.">
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
        <SelectField
          label="Tipo"
          value={type}
          onChange={(v) => setType(v as RelationType)}
          options={[
            { value: "related", label: "Relacionado" },
            { value: "cross_sell", label: "Cross-sell" },
            { value: "up_sell", label: "Up-sell" },
          ]}
        />
        <FormField label="Buscar produto" hint="Mínimo 2 caracteres (nome, SKU ou slug)">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
        </FormField>
      </div>

      {search.trim().length >= 2 && (
        <Card>
          <CardContent className="p-3 space-y-2">
            {searchQ.isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
            {searchQ.data?.length === 0 && <p className="text-sm text-muted-foreground">Nada encontrado.</p>}
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
                <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3">Sem vínculos.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.related?.name ?? "(produto removido)"}</p>
                        <p className="text-xs text-muted-foreground">{r.related?.sku_root} · {r.related?.status}</p>
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
    </TabShell>
  );
}

// ============================================================================
// Aba 8 — Publicação (readiness + ações)
// ============================================================================

function PublishTab({
  canPublish, issues, onPublish, onUnpublish, status,
}: { canPublish: boolean; issues: string[]; onPublish: () => void; onUnpublish: () => void; status: string }) {
  return (
    <TabShell title="Publicação" description="Validação final e ativação no catálogo.">
      {status === "published" ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-medium text-emerald-900 dark:text-emerald-200">Produto publicado</p>
              <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1">Visível no catálogo da loja.</p>
            </div>
          </div>
          <Button onClick={onUnpublish} variant="outline" className="gap-2"><EyeOff className="h-4 w-4" /> Despublicar</Button>
        </div>
      ) : canPublish ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-medium text-emerald-900 dark:text-emerald-200">Pronto para publicar</p>
              <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1">Todas as etapas obrigatórias foram concluídas.</p>
            </div>
          </div>
          <Button onClick={onPublish} size="lg" className="gap-2">
            <Send className="h-4 w-4" /> Publicar agora
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-amber-900 dark:text-amber-200">Pendências antes de publicar</p>
            <ul className="mt-2 text-sm text-amber-800 dark:text-amber-300 list-disc pl-5 space-y-0.5">
              {issues.slice(0, 8).map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          </div>
        </div>
      )}
    </TabShell>
  );
}

// ============================================================================
// Aba 9 — Histórico (domain_events + audit_log)
// ============================================================================

function HistoryTab({ productId }: { productId: string }) {
  const fnHist = useServerFn(listProductHistory);
  const fnAudit = useServerFn(listProductAudit);

  const histQ = useQuery({
    queryKey: ["product-history", productId],
    queryFn: async () => {
      const r = await fnHist({ data: { id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as Array<{ id: string; event_type: string; payload: unknown; actor_user_id: string | null; created_at: string }>;
    },
  });
  const auditQ = useQuery({
    queryKey: ["product-audit", productId],
    queryFn: async () => {
      const r = await fnAudit({ data: { id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as Array<{ id: string; action: string; actor_user_id: string | null; diff: unknown; created_at: string }>;
    },
  });

  return (
    <TabShell title="Histórico" description="Eventos de domínio e trilha de auditoria deste produto.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><HistoryIcon className="h-4 w-4" /> Eventos de domínio</CardTitle>
            <CardDescription className="text-xs">Outbox / Event Store — últimos 100 eventos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {histQ.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {histQ.data?.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento.</p>}
            {(histQ.data ?? []).map((e) => (
              <div key={e.id} className="text-xs border rounded-md p-2">
                <div className="flex items-center justify-between">
                  <code className="font-mono text-[11px]">{e.event_type}</code>
                  <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                {!!e.payload && Object.keys(e.payload as object).length > 0 && (
                  <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                    {JSON.stringify(e.payload, null, 0).slice(0, 200)}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> Auditoria</CardTitle>
            <CardDescription className="text-xs">audit_log — quem alterou o quê.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {auditQ.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {auditQ.data?.length === 0 && <p className="text-xs text-muted-foreground">Sem registros.</p>}
            {(auditQ.data ?? []).map((a) => (
              <div key={a.id} className="text-xs border rounded-md p-2">
                <div className="flex items-center justify-between">
                  <code className="font-mono text-[11px]">{a.action}</code>
                  <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                {!!a.diff && (
                  <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                    {JSON.stringify(a.diff, null, 0).slice(0, 200)}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </TabShell>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function TabShell({
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
      <div className="space-y-5">{children}</div>
      {onSave && (
        <div className="flex justify-end pt-2 border-t">
          <Button onClick={onSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar aba"}
          </Button>
        </div>
      )}
    </div>
  );
}
