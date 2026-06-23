/**
 * Cadastro de Produto — Wizard Full Page (UX refactor).
 *
 * REUSO INTEGRAL — nenhuma regra de negócio alterada:
 *   • Product Engine ............ products.functions.ts (createProductDraft / updateProduct / publishProduct / getProductReadiness)
 *   • Variants Engine ........... product-children.functions.ts (cores / generateVariants / updateVariant)
 *   • Inventory Engine .......... inventory.functions.ts (listAdminStock + bulkAdjustStock)
 *   • Pricing Engine ............ price-lists.functions.ts + setVariantPrice
 *   • DAM ....................... AssetPicker + AssetUploader (dam.functions.ts)
 *   • Color Media ............... addColorMedia / listColorMedia / updateColorMedia / deleteColorMedia
 *   • Audit / Outbox / RBAC / RLS ........... preservados pelas server fns acima
 *
 * Toda I/O via Server Functions. Zero acesso direto ao Supabase.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2, Sparkles, Library, Star, Save, Send,
  Image as ImageIcon, Loader2, GripVertical, CheckCircle2, Circle, AlertTriangle, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { FormField, FormRow } from "@/components/admin/form-field";
import { SelectField } from "@/components/admin/select-field";
import { ColorPicker } from "@/components/admin/color-picker";
import { runAction, notify } from "@/components/admin/notify";
import { usePageBreadcrumbs } from "@/components/admin/breadcrumb-context";
import { AssetPicker } from "@/components/dam/asset-picker";
import type { AssetLike } from "@/components/dam/asset-thumb";

import { useActiveStore } from "@/hooks/use-active-store";
import {
  createProductDraft, updateProduct, publishProduct, getProductReadiness,
} from "@/lib/business/products.functions";
import {
  listProductColors, createProductColor, updateProductColor, deleteProductColor,
  listColorMedia, addColorMedia, deleteColorMedia, updateColorMedia,
  listProductVariants, generateProductVariants, updateProductVariant, deleteProductVariant,
  listProductPrices, setVariantPrice,
} from "@/lib/business/product-children.functions";
import { listCategories } from "@/lib/business/categories.functions";
import { listBrands } from "@/lib/business/brands.functions";
import { listCollections } from "@/lib/business/collections.functions";
import { listAttributes } from "@/lib/business/attributes.functions";
import { listAttributeValues } from "@/lib/business/attribute-values.functions";
import { listCategoryAttributes } from "@/lib/business/category-attributes.functions";
import { listPriceLists } from "@/lib/business/price-lists.functions";
import { listAdminStock, bulkAdjustStock } from "@/lib/business/inventory.functions";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  head: () => ({ meta: [{ title: "Novo Produto — Admin" }] }),
  component: ProductNewWizardPage,
});

type ColorRow = Tables<"product_colors">;
type MediaRow = Tables<"product_color_media">;
type VariantRow = Tables<"product_variants">;
type PriceItemRow = Tables<"price_list_items">;

type Row = { id: string; name: string };

// ── Seções (single-page) ─────────────────────────────────────────────────────
// Catálogo = fotos + cores + tamanhos + preço/estoque, tudo no mesmo lugar.
const SECTIONS = [
  { key: "basic", label: "Dados Básicos" },
  { key: "catalog", label: "Catálogo (fotos, cores, tamanhos e preço)" },
  { key: "organization", label: "Organização" },
  { key: "publish", label: "Publicação" },
] as const;
type StepKey = typeof SECTIONS[number]["key"];

function sanitizeSku(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

// =============================================================================
// Página — single page, seções empilhadas
// =============================================================================
function ProductNewWizardPage() {
  const { storeId } = useActiveStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  usePageBreadcrumbs([
    { label: "Catálogo" },
    { label: "Produtos", to: "/admin/products" },
    { label: "Novo Produto" },
  ]);

  const [productId, setProductId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<StepKey>("basic");

  const fnReadiness = useServerFn(getProductReadiness);
  const readinessQ = useQuery({
    queryKey: ["product", productId, "readiness"],
    enabled: !!productId,
    queryFn: async () => {
      const r = await fnReadiness({ data: { id: productId! } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });
  const progress = readinessQ.data?.progress ?? 0;
  const canPublish = !!readinessQ.data?.canPublish;
  const issues = readinessQ.data?.issues ?? [];
  const steps = readinessQ.data?.steps ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["product", productId] });
    qc.invalidateQueries({ queryKey: ["product", productId, "readiness"] });
    qc.invalidateQueries({ queryKey: ["wizard", productId] });
  };

  // Scroll suave entre seções
  const scrollToSection = (k: StepKey) => {
    setActiveSection(k);
    const el = document.getElementById(`section-${k}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // Observa a seção visível para destacar no nav
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          const k = visible.target.id.replace("section-", "") as StepKey;
          setActiveSection(k);
        }
      },
      { rootMargin: "-160px 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`section-${s.key}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [productId]);

  // Sticky footer actions
  const fnPublish = useServerFn(publishProduct);
  const fnUpdateForFooter = useServerFn(updateProduct);
  const [footerBusy, setFooterBusy] = useState<"draft" | "publish" | null>(null);
  const saveDraftFromFooter = async () => {
    if (!productId) { notify.error("Preencha os dados básicos primeiro"); return; }
    setFooterBusy("draft");
    await runAction(
      () => fnUpdateForFooter({ data: { id: productId, patch: {} } }),
      { loading: "Salvando rascunho...", success: "Rascunho salvo" },
    );
    setFooterBusy(null);
    refresh();
  };
  const publishFromFooter = async () => {
    if (!productId) { notify.error("Preencha os dados básicos primeiro"); return; }
    if (!canPublish) { notify.error("Produto incompleto — veja o checklist"); scrollToSection("publish"); return; }
    setFooterBusy("publish");
    const ok = await runAction(
      () => fnPublish({ data: { id: productId } }),
      { loading: "Publicando...", success: "Produto publicado!" },
    );
    setFooterBusy(null);
    if (ok) navigate({ to: "/admin/products" });
  };

  // Helpers para nav entre seções a partir dos botões dos blocos
  const sectionIdx = (k: StepKey) => SECTIONS.findIndex((s) => s.key === k);
  const nextOf = (k: StepKey): StepKey => SECTIONS[Math.min(SECTIONS.length - 1, sectionIdx(k) + 1)].key;
  const prevOf = (k: StepKey): StepKey => SECTIONS[Math.max(0, sectionIdx(k) - 1)].key;
  const goNext = (from: StepKey) => scrollToSection(nextOf(from));
  const goPrev = (from: StepKey) => scrollToSection(prevOf(from));

  return (
    <div className="-mx-4 sm:-mx-6 -my-4 sm:-my-6 flex flex-col min-h-[calc(100vh-3.5rem)] bg-muted/20">
      {/* Header compacto */}
      <header className="sticky top-14 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link to="/admin/products" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">Novo Produto</h1>
            <p className="text-xs text-muted-foreground truncate">
              Cadastro em página única — preencha as seções abaixo
            </p>
          </div>
          <Badge variant={canPublish ? "default" : "secondary"} className="hidden sm:inline-flex shrink-0">
            {canPublish ? "Pode publicar" : `${progress}% completo`}
          </Badge>
        </div>
      </header>

      {/* Body grid */}
      <div className="flex-1 grid gap-4 sm:gap-6 px-4 sm:px-6 py-4 sm:py-6
        lg:grid-cols-[220px_minmax(0,1fr)_300px] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* Section nav (substitui o wizard sidebar) */}
        <aside className="lg:sticky lg:top-32 lg:self-start hidden lg:block">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Seções
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ol className="space-y-1">
                {SECTIONS.map((s, i) => {
                  const isActive = s.key === activeSection;
                  const disabled = !productId && s.key !== "basic";
                  const done = steps.find((x) => x.key === s.key)?.complete;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => scrollToSection(s.key)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                          isActive && "bg-primary/10 text-primary font-semibold",
                          !isActive && done && "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/5",
                          !isActive && !done && "text-muted-foreground hover:bg-muted hover:text-foreground",
                          disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold transition",
                            isActive ? "bg-primary text-primary-foreground shadow-sm"
                              : done ? "bg-emerald-500 text-white"
                              : "bg-muted text-muted-foreground border",
                          )}
                        >
                          {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span className="truncate flex-1">{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 space-y-6 pb-24 lg:pb-6">
          <section id="section-basic" className="scroll-mt-32">
            <BasicBlock
              storeId={storeId}
              productId={productId}
              onCreated={(id) => { setProductId(id); refresh(); scrollToSection("photos"); }}
              onUpdated={refresh}
              onNext={() => goNext("basic")}
            />
          </section>

          {!productId && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Salve os dados básicos para liberar as próximas seções.
              </CardContent>
            </Card>
          )}

          {productId && (
            <>
              <section id="section-photos" className="scroll-mt-32">
                <PhotosBlock productId={productId} onChange={refresh}
                  onPrev={() => goPrev("photos")} onNext={() => goNext("photos")} />
              </section>
              <section id="section-variations" className="scroll-mt-32">
                <VariationsBlock productId={productId} onChange={refresh}
                  onPrev={() => goPrev("variations")} onNext={() => goNext("variations")} />
              </section>
              <section id="section-stockprice" className="scroll-mt-32">
                <StockPriceBlock productId={productId} onChange={refresh}
                  onPrev={() => goPrev("stockprice")} onNext={() => goNext("stockprice")} />
              </section>
              <section id="section-organization" className="scroll-mt-32">
                <OrganizationBlock productId={productId} onChange={refresh}
                  onPrev={() => goPrev("organization")} onNext={() => goNext("organization")} />
              </section>
              <section id="section-publish" className="scroll-mt-32">
                <PublishBlock
                  productId={productId}
                  canPublish={canPublish}
                  issues={issues}
                  onPrev={() => goPrev("publish")}
                  onDone={() => navigate({ to: "/admin/products" })}
                />
              </section>
            </>
          )}
        </main>

        <aside className="lg:sticky lg:top-32 lg:self-start space-y-4">
          <ReadinessCard
            enabled={!!productId}
            loading={readinessQ.isLoading}
            progress={progress}
            canPublish={canPublish}
            issues={issues}
            steps={steps}
          />
        </aside>
      </div>

      <StickyFooter
        productId={productId}
        canPublish={canPublish}
        busy={footerBusy}
        updatedAt={readinessQ.dataUpdatedAt}
        onSaveDraft={saveDraftFromFooter}
        onPublish={publishFromFooter}
      />
    </div>
  );
}


// =============================================================================
// BLOCO 1 — Dados Básicos
// =============================================================================
function BasicBlock({
  storeId, productId, onCreated, onUpdated, onNext,
}: {
  storeId: string | null;
  productId: string | null;
  onCreated: (id: string) => void;
  onUpdated: () => void;
  onNext: () => void;
}) {
  const fnCreate = useServerFn(createProductDraft);
  const fnUpdate = useServerFn(updateProduct);
  const fnCats = useServerFn(listCategories);
  const fnBrands = useServerFn(listBrands);
  const fnCols = useServerFn(listCollections);

  const [form, setForm] = useState({
    name: "", sku_root: "",
    department_id: "", category_id: "", subcategory_id: "",
    brand_id: "", collection_id: "",
    short_description: "", description: "",
  });
  const [saving, setSaving] = useState(false);
  const [skuTouched, setSkuTouched] = useState(false);

  const cats = useQuery({
    queryKey: ["wizard-cats", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnCats({ data: { store_id: storeId!, pageSize: 200 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Row[];
    },
  });
  const brands = useQuery({
    queryKey: ["wizard-brands", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnBrands({ data: { store_id: storeId!, pageSize: 200 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Row[];
    },
  });
  const cols = useQuery({
    queryKey: ["wizard-cols", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnCols({ data: { store_id: storeId!, pageSize: 200 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Row[];
    },
  });

  const patch = (p: Partial<typeof form>) => setForm((s) => ({ ...s, ...p }));

  const canSubmit = !!form.name.trim() && !!form.sku_root.trim() && !!form.category_id && !!storeId;

  const submit = async () => {
    if (!storeId || !canSubmit) return;
    setSaving(true);
    if (!productId) {
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
      if (created) {
        // Salva descrição completa em seguida se preenchida
        if (form.description.trim()) {
          await fnUpdate({ data: { id: created.id, patch: { description: form.description } } });
        }
        onCreated(created.id);
      }
    } else {
      const ok = await runAction(
        () => fnUpdate({
          data: {
            id: productId,
            patch: {
              name: form.name.trim(),
              category_id: form.category_id || null,
              brand_id: form.brand_id || null,
              short_description: form.short_description || null,
              description: form.description || null,
            },
          },
        }),
        { loading: "Salvando...", success: "Dados básicos salvos" },
      );
      if (ok) { onUpdated(); onNext(); }
    }
    setSaving(false);
  };

  return (
    <BlockCard
      title="Dados Básicos"
      description="Identifique o produto. Categoria, marca e coleção alimentam navegação e filtros."
    >
      <FormRow>
        <FormField label="Nome do produto" required>
          <Input
            value={form.name}
            onChange={(e) => patch({
              name: e.target.value,
              sku_root: skuTouched ? form.sku_root : sanitizeSku(e.target.value),
            })}
            placeholder="Ex.: Camiseta Oversized Premium"
          />
        </FormField>
        <FormField
          label="SKU Root"
          required
          hint={skuTouched ? "Sincronização automática desativada (você editou)." : "Gerado automaticamente a partir do nome — edite para personalizar."}
        >
          <Input
            value={form.sku_root}
            onChange={(e) => { setSkuTouched(true); patch({ sku_root: sanitizeSku(e.target.value) }); }}
            placeholder="CAMISETA-OVERSIZED-PREMIUM"
          />
        </FormField>
      </FormRow>

      <div className="rounded-md border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Hierarquia</h3>
          <span className="text-[11px] text-muted-foreground">Departamento → Categoria → Subcategoria</span>
        </div>
        <FormRow>
          <SelectField
            label="Departamento"
            value={form.department_id || "__none__"}
            onChange={(v) => patch({ department_id: v === "__none__" ? "" : v, category_id: "", subcategory_id: "" })}
            options={[
              { value: "__none__", label: "— Selecionar —" },
              ...(cats.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
            hint="Estrutura em cascata será habilitada em breve."
          />
          <SelectField
            label="Categoria" required
            value={form.category_id}
            onChange={(v) => patch({ category_id: v, subcategory_id: "" })}
            options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder={cats.isLoading ? "Carregando..." : "Selecione"}
          />
        </FormRow>
        <FormRow>
          <SelectField
            label="Subcategoria"
            value={form.subcategory_id || "__none__"}
            onChange={(v) => patch({ subcategory_id: v === "__none__" ? "" : v })}
            disabled={!form.category_id}
            options={[
              { value: "__none__", label: form.category_id ? "— Opcional —" : "— Escolha a categoria primeiro —" },
              ...(cats.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <SelectField
            label="Marca"
            value={form.brand_id || "__none__"}
            onChange={(v) => patch({ brand_id: v === "__none__" ? "" : v })}
            options={[
              { value: "__none__", label: "— Sem marca —" },
              ...(brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </FormRow>
      </div>

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
          rows={2}
          value={form.short_description}
          onChange={(e) => patch({ short_description: e.target.value })}
        />
      </FormField>

      <FormField label="Descrição completa">
        <Textarea
          rows={6}
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Detalhe materiais, dimensões, cuidados, diferenciais..."
        />
      </FormField>

      <BlockFooter
        right={
          <Button onClick={submit} disabled={!canSubmit || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {productId ? "Salvar e avançar" : "Criar e avançar"}
          </Button>
        }
      />
    </BlockCard>
  );
}

// =============================================================================
// BLOCO 2 — Fotos (galeria do produto, vinculada a cor "Padrão" quando necessário)
//   Também renderiza galerias por COR caso o produto já tenha múltiplas cores.
// =============================================================================
function PhotosBlock({
  productId, onChange, onPrev, onNext,
}: { productId: string; onChange: () => void; onPrev: () => void; onNext: () => void }) {
  const fnListColors = useServerFn(listProductColors);
  const fnCreateColor = useServerFn(createProductColor);

  const colorsQ = useQuery({
    queryKey: ["wizard", productId, "colors"],
    queryFn: async () => {
      const r = await fnListColors({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as ColorRow[];
    },
  });

  // Garante ao menos uma cor para anexar mídias (cor "Padrão" se não houver nenhuma).
  const [ensured, setEnsured] = useState(false);
  useEffect(() => {
    if (ensured) return;
    if (colorsQ.isLoading || colorsQ.isError) return;
    if ((colorsQ.data ?? []).length > 0) { setEnsured(true); return; }
    setEnsured(true);
    void fnCreateColor({
      data: { product_id: productId, name: "Padrão", hex: "#000000", is_default: true },
    }).then((r) => {
      if (r.ok) { colorsQ.refetch(); onChange(); }
    });
  }, [colorsQ.isLoading, colorsQ.isError, colorsQ.data, ensured, fnCreateColor, productId, colorsQ, onChange]);

  const colors = colorsQ.data ?? [];

  return (
    <BlockCard
      title="Fotos do Produto"
      description="Selecione mídias do DAM ou envie novas. As fotos pertencem a uma cor — usamos 'Padrão' enquanto você não cadastra variações."
    >
      {colorsQ.isLoading || colors.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparando galeria...
        </div>
      ) : (
        <div className="space-y-6">
          {colors.map((c) => (
            <ColorGallerySection
              key={c.id}
              color={c}
              onChange={onChange}
              compact={colors.length === 1}
            />
          ))}
        </div>
      )}

      <BlockFooter
        left={<Button variant="outline" onClick={onPrev} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>}
        right={<Button onClick={onNext} className="gap-2">Avançar <ArrowRight className="h-4 w-4" /></Button>}
      />
    </BlockCard>
  );
}



function ColorGallerySection({
  color, onChange, compact,
}: { color: ColorRow; onChange: () => void; compact?: boolean }) {
  const fnList = useServerFn(listColorMedia);
  const fnAdd = useServerFn(addColorMedia);
  const fnDel = useServerFn(deleteColorMedia);
  const fnUpd = useServerFn(updateColorMedia);
  const qc = useQueryClient();

  const media = useQuery({
    queryKey: ["wizard-media", color.id],
    queryFn: async () => {
      const r = await fnList({ data: { color_id: color.id } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as MediaRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["wizard-media", color.id] });

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
          const url = a.preview_url ?? a.external_url ?? null;
          const r = await fnAdd({
            data: {
              color_id: color.id,
              media_type: mediaType,
              external_url: url,
              external_id: a.external_id ?? null,
              storage_path: null,
              thumbnail_url: url,
              alt: a.alt_text ?? null,
              title: a.title ?? a.original_filename ?? null,
              is_cover: !hasCover && i === 0,
              sort_order: baseOrder + i,
            },
          });
          if (!r.ok) throw new Error(r.error.message);
          i++;
        }
        return { ok: true as const, data: { added: assets.length } };
      },
      { loading: "Vinculando mídia...", success: `${assets.length} mídia(s) adicionada(s)` },
    );
    if (ok) { invalidate(); onChange(); }
  };

  const remove = async (id: string) => {
    const ok = await runAction(() => fnDel({ data: { id } }), { success: "Removida" });
    if (ok) { invalidate(); onChange(); }
  };
  const setCover = async (id: string) => {
    const ok = await runAction(() => fnUpd({ data: { id, patch: { is_cover: true } } }), { success: "Capa definida" });
    if (ok) { invalidate(); onChange(); }
  };

  // Reorder via drag
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const persistOrder = async (ids: string[]) => {
    qc.setQueryData<MediaRow[]>(["wizard-media", color.id], (prev) => {
      if (!prev) return prev;
      const map = new Map(prev.map((m) => [m.id, m]));
      return ids.map((id, idx) => ({ ...(map.get(id) as MediaRow), sort_order: idx }));
    });
    try {
      for (let i = 0; i < ids.length; i++) {
        const r = await fnUpd({ data: { id: ids[i], patch: { sort_order: i } } });
        if (!r.ok) throw new Error(r.error.message);
      }
      notify.success("Ordem atualizada"); onChange();
    } catch { notify.error("Falha ao reordenar"); invalidate(); }
  };
  const handleDrop = (target: string) => {
    if (!dragId || dragId === target) { setDragId(null); setOverId(null); return; }
    const list = (media.data ?? []).map((m) => m.id);
    const from = list.indexOf(dragId);
    const to = list.indexOf(target);
    if (from < 0 || to < 0) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    setDragId(null); setOverId(null);
    void persistOrder(list);
  };

  return (
    <div className={cn(compact ? "space-y-3" : "rounded-lg border p-4 space-y-3 bg-muted/20")}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {!compact && <span className="h-4 w-4 rounded-full ring-1 ring-border shrink-0" style={{ background: color.hex ?? "#ccc" }} />}
          <span className="font-medium truncate">{compact ? "Fotos" : `Cor: ${color.name}`}</span>
          {!compact && color.is_default && <Badge variant="secondary" className="text-[10px]">Padrão</Badge>}
          <span className="text-xs text-muted-foreground">· {media.data?.length ?? 0} mídia(s)</span>
        </div>
        <AssetPicker context="product" multiple onSelect={onPicked}>
          <Button size="sm" className="gap-2"><Library className="h-4 w-4" /> Adicionar Fotos</Button>
        </AssetPicker>
      </div>

      {(media.data?.length ?? 0) === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma mídia. Use o botão acima.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
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
                className={cn(
                  "relative aspect-square rounded-md overflow-hidden border bg-muted group cursor-grab active:cursor-grabbing transition",
                  isOver && "ring-2 ring-primary",
                  dragId === m.id && "opacity-50",
                )}
              >
                {src ? <img src={src} alt={m.alt ?? ""} className="w-full h-full object-cover pointer-events-none" /> : <ImageIcon className="h-6 w-6 m-auto" />}
                {m.is_cover && (
                  <Badge className="absolute top-1 left-1 text-[10px] h-5"><Star className="h-2.5 w-2.5 mr-0.5" />Capa</Badge>
                )}
                <div className="absolute top-1 right-1 opacity-70 group-hover:opacity-100">
                  <div className="bg-background/80 rounded p-0.5"><GripVertical className="h-3 w-3" /></div>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition">
                  {!m.is_cover && (
                    <Button size="sm" variant="secondary" className="h-6 text-[10px] flex-1" onClick={() => setCover(m.id)}>
                      Principal
                    </Button>
                  )}
                  <Button size="icon" variant="destructive" className="h-6 w-6" onClick={() => remove(m.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BLOCO 3 — Variações (cores + tamanhos + gerar) + galerias por cor
// =============================================================================
function VariationsBlock({
  productId, onChange, onPrev, onNext,
}: { productId: string; onChange: () => void; onPrev: () => void; onNext: () => void }) {
  const { storeId } = useActiveStore();
  const qc = useQueryClient();

  const fnListColors = useServerFn(listProductColors);
  const fnCreateColor = useServerFn(createProductColor);
  const fnUpdColor = useServerFn(updateProductColor);
  const fnDelColor = useServerFn(deleteProductColor);
  const fnCatAttrs = useServerFn(listCategoryAttributes);
  const fnAttrs = useServerFn(listAttributes);
  const fnVals = useServerFn(listAttributeValues);
  const fnGen = useServerFn(generateProductVariants);

  const colorsQ = useQuery({
    queryKey: ["wizard", productId, "colors"],
    queryFn: async () => {
      const r = await fnListColors({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as ColorRow[];
    },
  });
  const colors = colorsQ.data ?? [];

  // descobre product.category_id (precisa para tamanhos)
  const productQ = useQuery({
    queryKey: ["wizard-product", productId],
    queryFn: async () => {
      // reuse readiness loader: but we need category — pull from getProduct via existing fn
      const { getProduct } = await import("@/lib/business/products.functions");
      const fn = getProduct;
      const r = await fn({ data: { id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.product as Tables<"products">;
    },
  });

  const sizeAttrQ = useQuery({
    queryKey: ["wizard-size-attr", productQ.data?.category_id, storeId],
    enabled: !!productQ.data?.category_id && !!storeId,
    queryFn: async () => {
      const [ca, attrs] = await Promise.all([
        fnCatAttrs({ data: { category_id: productQ.data!.category_id! } }),
        fnAttrs({ data: { store_id: storeId!, pageSize: 100 } }),
      ]);
      if (!ca.ok || !attrs.ok) return null;
      const attrList = attrs.data.rows as Array<{ id: string; name: string; is_size?: boolean }>;
      const catList = ca.data.rows as Array<{ attribute_id: string }>;
      const cand = attrList.find((a) =>
        catList.some((c) => c.attribute_id === a.id) && (a.is_size || /tamanho|size/i.test(a.name)),
      );
      if (!cand) return { attribute: null, values: [] as Array<{ id: string; label: string }> };
      const v = await fnVals({ data: { attribute_id: cand.id, pageSize: 100 } });
      return { attribute: cand, values: v.ok ? (v.data.rows as Array<{ id: string; label: string }>) : [] };
    },
  });

  const [hasVariations, setHasVariations] = useState<"no" | "yes">("no");
  useEffect(() => {
    // se já existir cor que não seja "Padrão" → assume sim
    if (colors.some((c) => c.name !== "Padrão")) setHasVariations("yes");
  }, [colors]);

  const fnListMediaForMigration = useServerFn(listColorMedia);
  const fnAddMediaForMigration = useServerFn(addColorMedia);
  const fnDelMediaForMigration = useServerFn(deleteColorMedia);

  const [newColor, setNewColor] = useState({ name: "", hex: "#000000" });
  const [migration, setMigration] = useState<null | {
    padraoId: string;
    media: MediaRow[];
    pendingName: string;
    pendingHex: string;
  }>(null);
  const [migrating, setMigrating] = useState(false);

  const createColorRaw = async (name: string, hex: string, isDefault: boolean) => {
    return runAction(
      () => fnCreateColor({ data: { product_id: productId, name, hex, is_default: isDefault } }),
      { success: "Cor adicionada" },
    );
  };

  const addColor = async () => {
    const name = newColor.name.trim();
    if (!name) return;
    // Padrão-only migration: única cor existente é "Padrão" e tem mídias.
    const onlyPadrao = colors.length === 1 && colors[0].name === "Padrão";
    if (onlyPadrao) {
      const padrao = colors[0];
      try {
        const r = await fnListMediaForMigration({ data: { color_id: padrao.id } });
        const media = r.ok ? (r.data as MediaRow[]) : [];
        if (media.length > 0) {
          setMigration({ padraoId: padrao.id, media, pendingName: name, pendingHex: newColor.hex });
          return;
        }
      } catch { /* ignore — segue fluxo padrão */ }
    }
    const ok = await createColorRaw(name, newColor.hex, colors.length === 0);
    if (ok) { setNewColor({ name: "", hex: "#000000" }); colorsQ.refetch(); onChange(); }
  };

  const runMigration = async (mode: "move" | "duplicate") => {
    if (!migration) return;
    setMigrating(true);
    try {
      const createdResp = await fnCreateColor({ data: {
        product_id: productId, name: migration.pendingName, hex: migration.pendingHex, is_default: mode === "move",
      } });
      if (!createdResp.ok) throw new Error(createdResp.error.message);
      const created = createdResp.data as ColorRow;
      if (!created?.id) throw new Error("Falha ao criar cor");

      for (const m of migration.media) {
        await fnAddMediaForMigration({ data: {
          color_id: created.id,
          media_type: m.media_type as 'image'|'video'|'youtube'|'vimeo',
          storage_path: m.storage_path,
          external_url: m.external_url,
          external_id: m.external_id,
          thumbnail_url: m.thumbnail_url,
          alt: m.alt,
          title: m.title,
          sort_order: m.sort_order ?? 0,
          is_cover: !!m.is_cover,
          is_hover_media: !!m.is_hover_media,
        } });
      }

      if (mode === "move") {
        for (const m of migration.media) {
          await fnDelMediaForMigration({ data: { id: m.id } });
        }
        await fnDelColor({ data: { id: migration.padraoId } });
        notify.success("Imagens movidas para " + migration.pendingName);
      } else {
        notify.success("Imagens duplicadas em " + migration.pendingName);
      }

      setMigration(null);
      setNewColor({ name: "", hex: "#000000" });
      colorsQ.refetch();
      onChange();
    } catch (e) {
      notify.error((e as Error).message || "Falha ao migrar imagens");
    } finally {
      setMigrating(false);
    }
  };

  const removeColor = async (id: string) => {
    const ok = await runAction(() => fnDelColor({ data: { id } }), { success: "Cor removida" });
    if (ok) { colorsQ.refetch(); onChange(); }
  };
  const setDefault = async (id: string) => {
    const ok = await runAction(() => fnUpdColor({ data: { id, patch: { is_default: true } } }), { success: "Padrão atualizada" });
    if (ok) { colorsQ.refetch(); onChange(); }
  };

  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const toggleSize = (id: string) =>
    setSelectedSizes((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const generate = async () => {
    if (!colors.length) { notify.error("Adicione ao menos uma cor"); return; }
    const ok = await runAction(
      () => fnGen({ data: { product_id: productId, size_attribute_value_ids: selectedSizes } }),
      { loading: "Gerando variantes...", success: "Variantes geradas" },
    );
    if (ok) {
      qc.invalidateQueries({ queryKey: ["wizard", productId] });
      onChange();
    }
  };

  const sizeValues = sizeAttrQ.data?.values ?? [];

  return (
    <BlockCard
      title="Variações"
      description="Configure cores e tamanhos. As variantes (SKU + estoque + preço) são geradas automaticamente."
    >
      <FormField label="Este produto possui variações?">
        <RadioGroup value={hasVariations} onValueChange={(v) => setHasVariations(v as "no" | "yes")} className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="no" id="vno" />
            <span>Não (produto simples)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="yes" id="vyes" />
            <span>Sim, possui cores/tamanhos</span>
          </label>
        </RadioGroup>
      </FormField>

      {hasVariations === "no" && (
        <div className="rounded-md border p-4 bg-muted/30 text-sm space-y-2">
          <p>
            Produto simples — clique em <strong>Gerar variantes</strong> abaixo para criar uma única variante
            (usa a cor "Padrão"). Você poderá ajustar SKU, peso, código de barras, estoque e preço na próxima etapa.
          </p>
          <Button size="sm" onClick={generate} className="gap-2">
            <Sparkles className="h-4 w-4" /> Gerar variante única
          </Button>
        </div>
      )}

      {hasVariations === "yes" && (
        <>
          <section className="space-y-3">
            <h3 className="font-medium text-sm">Cores</h3>
            <div className="rounded-md border p-3 bg-muted/30">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {colors.map((c) => (
                  <div key={c.id} className="rounded-lg border bg-background p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full ring-1 ring-border shrink-0" style={{ background: c.hex ?? "#ccc" }} />
                        <span className="font-medium truncate">{c.name}</span>
                        {c.is_default && <Badge variant="secondary" className="h-5 text-[10px] gap-1"><Star className="h-2.5 w-2.5" />Padrão</Badge>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!c.is_default && (
                          <Button size="sm" variant="ghost" onClick={() => setDefault(c.id)} className="h-8 text-xs">
                            Tornar padrão
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => removeColor(c.id)} className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <ColorGallerySection color={c} onChange={onChange} compact />
                  </div>
                ))}
              </div>
            )}
          </section>

          <AlertDialog open={!!migration} onOpenChange={(o) => { if (!o && !migrating) setMigration(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  As imagens existentes pertencem à cor {migration?.pendingName}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Você cadastrou {migration?.media.length ?? 0} imagem(ns) na cor temporária "Padrão".
                  Escolha o que fazer ao criar a cor <strong>{migration?.pendingName}</strong>:
                  <br /><br />
                  • <strong>Mover</strong>: transfere todas as imagens para {migration?.pendingName} e remove a cor "Padrão".<br />
                  • <strong>Duplicar</strong>: copia as imagens para {migration?.pendingName} e mantém a cor "Padrão".<br />
                  • <strong>Cancelar</strong>: não cria a cor agora.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={migrating}>Cancelar</AlertDialogCancel>
                <Button variant="outline" disabled={migrating} onClick={() => runMigration("duplicate")} className="gap-2">
                  {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Duplicar imagens
                </Button>
                <AlertDialogAction disabled={migrating} onClick={(e) => { e.preventDefault(); runMigration("move"); }}>
                  {migrating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Mover imagens
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>


          <section className="space-y-3 pt-2 border-t">
            <h3 className="font-medium text-sm">
              Tamanhos
              {sizeAttrQ.data?.attribute && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">({sizeAttrQ.data.attribute.name})</span>
              )}
            </h3>
            {!sizeValues.length ? (
              <p className="text-xs text-muted-foreground">
                A categoria selecionada não possui atributo de tamanho. Será gerada 1 variante por cor.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedSizes(sizeValues.map((v) => v.id))}>Selecionar todos</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedSizes([])}>Limpar</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizeValues.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleSize(v.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-sm transition",
                        selectedSizes.includes(v.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="pt-2 border-t flex justify-end">
            <Button onClick={generate} className="gap-2" disabled={!colors.length}>
              <Sparkles className="h-4 w-4" /> Gerar Variantes
            </Button>
          </div>

          {/* Fotos por cor agora ficam dentro de cada card de cor acima. */}
        </>
      )}

      <BlockFooter
        left={<Button variant="outline" onClick={onPrev} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>}
        right={<Button onClick={onNext} className="gap-2">Avançar <ArrowRight className="h-4 w-4" /></Button>}
      />
    </BlockCard>
  );
}

// =============================================================================
// BLOCO 4 — Variantes / Estoque e Preços (matriz editável)
// =============================================================================
function StockPriceBlock({
  productId, onChange, onPrev, onNext,
}: { productId: string; onChange: () => void; onPrev: () => void; onNext: () => void }) {
  const { storeId } = useActiveStore();
  const qc = useQueryClient();

  const fnVariants = useServerFn(listProductVariants);
  const fnColors = useServerFn(listProductColors);
  const fnUpdVar = useServerFn(updateProductVariant);
  const fnDelVar = useServerFn(deleteProductVariant);
  const fnStock = useServerFn(listAdminStock);
  const fnBulkStock = useServerFn(bulkAdjustStock);
  const fnPrices = useServerFn(listProductPrices);
  const fnPriceLists = useServerFn(listPriceLists);
  const fnSetPrice = useServerFn(setVariantPrice);
  const fnAttrVals = useServerFn(listAttributeValues);

  const variantsQ = useQuery({
    queryKey: ["wizard-variants", productId],
    queryFn: async () => {
      const r = await fnVariants({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as VariantRow[];
    },
  });
  const colorsQ = useQuery({
    queryKey: ["wizard", productId, "colors"],
    queryFn: async () => {
      const r = await fnColors({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as ColorRow[];
    },
  });
  const stockQ = useQuery({
    queryKey: ["wizard-stock", productId, storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnStock({ data: { store_id: storeId!, product_id: productId, pageSize: 200 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Array<{ id: string; variant_id: string; quantity_on_hand: number }>;
    },
  });
  const priceListsQ = useQuery({
    queryKey: ["wizard-price-lists", storeId], enabled: !!storeId,
    queryFn: async () => {
      const r = await fnPriceLists({ data: { store_id: storeId!, pageSize: 100 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Array<{ id: string; name: string; is_default?: boolean }>;
    },
  });
  const pricesQ = useQuery({
    queryKey: ["wizard-prices", productId],
    queryFn: async () => {
      const r = await fnPrices({ data: { product_id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data as PriceItemRow[];
    },
  });

  const defaultPriceListId =
    priceListsQ.data?.find((l) => l.is_default)?.id ?? priceListsQ.data?.[0]?.id ?? "";

  const variants = variantsQ.data ?? [];
  const colors = colorsQ.data ?? [];

  // resolve labels de tamanho (lookup por id → label)
  const sizeIds = useMemo(
    () => Array.from(new Set(variants.map((v) => v.size_attribute_value_id).filter(Boolean) as string[])),
    [variants],
  );
  const sizeLabelsQ = useQuery({
    queryKey: ["wizard-size-labels", productId, sizeIds.join(",")],
    enabled: sizeIds.length > 0,
    queryFn: async () => {
      // como não temos endpoint por ids, listamos por attribute_id; usamos o primeiro variant
      const first = variants.find((v) => v.size_attribute_value_id);
      if (!first?.size_attribute_value_id) return new Map<string, string>();
      // não temos attribute_id direto — buscamos via category attrs? Simplificamos: mostramos id curto fallback
      // tentativa: já temos variantes com label opcional; deixa "—"
      void fnAttrVals;
      return new Map<string, string>();
    },
  });

  const colorById = useMemo(() => new Map(colors.map((c) => [c.id, c])), [colors]);

  // Capa por cor — busca a galeria de cada cor e pega a mídia marcada como cover
  const fnListMedia = useServerFn(listColorMedia);
  const coversQ = useQuery({
    queryKey: ["wizard-color-covers", productId, colors.map((c) => c.id).join(",")],
    enabled: colors.length > 0,
    queryFn: async () => {
      const map = new Map<string, string>();
      await Promise.all(colors.map(async (c) => {
        const r = await fnListMedia({ data: { color_id: c.id } });
        if (!r.ok) return;
        const list = r.data as MediaRow[];
        const cover = list.find((m) => m.is_cover) ?? list[0];
        const src = cover?.thumbnail_url || cover?.external_url || cover?.storage_path || "";
        if (src) map.set(c.id, src);
      }));
      return map;
    },
  });
  const colorThumbById = coversQ.data ?? new Map<string, string>();
  const stockByVariant = useMemo(() => {
    const m = new Map<string, { id: string; qty: number }>();
    (stockQ.data ?? []).forEach((s) => m.set(s.variant_id, { id: s.id, qty: s.quantity_on_hand }));
    return m;
  }, [stockQ.data]);
  const priceByVariant = useMemo(() => {
    const m = new Map<string, { price: number; compare: number | null }>();
    (pricesQ.data ?? [])
      .filter((p) => p.price_list_id === defaultPriceListId)
      .forEach((p) => m.set(p.variant_id!, {
        price: Number(p.price),
        compare: p.compare_at_price != null ? Number(p.compare_at_price) : null,
      }));
    return m;
  }, [pricesQ.data, defaultPriceListId]);

  const saveVariant = async (id: string, patch: Parameters<typeof fnUpdVar>[0]["data"]["patch"]) => {
    const ok = await runAction(() => fnUpdVar({ data: { id, patch } }), { success: "Variante salva" });
    if (ok) qc.invalidateQueries({ queryKey: ["wizard-variants", productId] });
  };
  const saveStock = async (stockLevelId: string, qty: number) => {
    const ok = await runAction(
      () => fnBulkStock({ data: { items: [{ stock_level_id: stockLevelId, new_quantity: qty, reason: "Cadastro de produto" }] } }),
      { success: "Estoque ajustado" },
    );
    if (ok) qc.invalidateQueries({ queryKey: ["wizard-stock", productId, storeId] });
  };
  const savePrice = async (variantId: string, price: number, compare: number | null) => {
    if (!defaultPriceListId) { notify.error("Cadastre uma lista de preços antes"); return; }
    const ok = await runAction(
      () => fnSetPrice({ data: { variant_id: variantId, price_list_id: defaultPriceListId, price, compare_at_price: compare } }),
      { success: "Preço salvo" },
    );
    if (ok) qc.invalidateQueries({ queryKey: ["wizard-prices", productId] });
  };
  const removeVariant = async (id: string) => {
    const ok = await runAction(() => fnDelVar({ data: { id } }), { success: "Variante removida" });
    if (ok) {
      qc.invalidateQueries({ queryKey: ["wizard-variants", productId] });
      onChange();
    }
  };

  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [bulkSaving, setBulkSaving] = useState<"price" | "stock" | null>(null);
  const applyBulkPrice = async () => {
    const value = Number(bulkPrice.replace(",", "."));
    if (Number.isNaN(value) || value < 0) { notify.error("Informe um preço válido"); return; }
    setBulkSaving("price");
    try {
      for (const v of variants) await savePrice(v.id, value, null);
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
      for (const v of variants) {
        const stock = stockByVariant.get(v.id);
        if (stock?.id) await saveStock(stock.id, value);
      }
      notify.success("Estoque aplicado em todas as variantes");
      setBulkStock("");
    } finally {
      setBulkSaving(null);
    }
  };

  return (
    <BlockCard
      title="Variantes — Estoque e Preços"
      description="Ajuste cada variação em cards simples ou aplique preço/estoque em massa."
    >
      {variants.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma variante. Volte à etapa <strong>Variações</strong> e clique em <strong>Gerar variantes</strong>.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium mb-3">Ações rápidas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex gap-2">
                <Input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} type="number" step="0.01" placeholder="Mesmo preço para todas" />
                <Button variant="outline" disabled={bulkSaving === "price" || !bulkPrice.trim()} onClick={applyBulkPrice} className="shrink-0">Aplicar preço</Button>
              </div>
              <div className="flex gap-2">
                <Input value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} type="number" min={0} placeholder="Mesmo estoque para todas" />
                <Button variant="outline" disabled={bulkSaving === "stock" || !bulkStock.trim()} onClick={applyBulkStock} className="shrink-0">Aplicar estoque</Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {variants.map((v) => {
                const color = colorById.get(v.product_color_id);
                const sizeLabel =
                  (v.size_attribute_value_id && sizeLabelsQ.data?.get(v.size_attribute_value_id)) || "Único";
                const stock = stockByVariant.get(v.id);
                const price = priceByVariant.get(v.id);
                const thumb = colorThumbById.get(v.product_color_id) ?? null;
                return (
                  <MatrixRow
                    key={v.id}
                    variant={v}
                    thumbnailUrl={thumb}
                    colorName={color?.name ?? "—"}
                    colorHex={color?.hex ?? null}
                    sizeLabel={sizeLabel}
                    stockLevelId={stock?.id ?? null}
                    stockQty={stock?.qty ?? null}
                    price={price?.price ?? null}
                    compare={price?.compare ?? null}
                    onChangeVariant={(p) => saveVariant(v.id, p)}
                    onChangeStock={(q) => stock?.id && saveStock(stock.id, q)}
                    onChangePrice={(p, c) => savePrice(v.id, p, c)}
                    onDelete={() => removeVariant(v.id)}
                  />
                );
              })}
          </div>
        </div>
      )}

      <BlockFooter
        left={<Button variant="outline" onClick={onPrev} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>}
        right={<Button onClick={onNext} className="gap-2">Avançar <ArrowRight className="h-4 w-4" /></Button>}
      />
    </BlockCard>
  );
}

function MatrixRow({
  variant, thumbnailUrl, colorName, colorHex, sizeLabel,
  stockLevelId, stockQty, price, compare,
  onChangeVariant, onChangeStock, onChangePrice, onDelete,
}: {
  variant: VariantRow;
  thumbnailUrl: string | null;
  colorName: string; colorHex: string | null; sizeLabel: string;
  stockLevelId: string | null; stockQty: number | null;
  price: number | null; compare: number | null;
  onChangeVariant: (p: { sku?: string; barcode?: string | null; weight_grams?: number | null }) => void;
  onChangeStock: (q: number) => void;
  onChangePrice: (p: number, c: number | null) => void;
  onDelete: () => void;
}) {
  const [sku, setSku] = useState(variant.sku);
  const [bc, setBc] = useState(variant.barcode ?? "");
  const [wt, setWt] = useState(variant.weight_grams != null ? String(variant.weight_grams) : "");
  const [st, setSt] = useState(stockQty != null ? String(stockQty) : "");
  const [pr, setPr] = useState(price != null ? String(price) : "");
  const [pc, setPc] = useState(compare != null ? String(compare) : "");

  useEffect(() => { setSku(variant.sku); }, [variant.sku]);
  useEffect(() => { setBc(variant.barcode ?? ""); }, [variant.barcode]);
  useEffect(() => { setWt(variant.weight_grams != null ? String(variant.weight_grams) : ""); }, [variant.weight_grams]);
  useEffect(() => { setSt(stockQty != null ? String(stockQty) : ""); }, [stockQty]);
  useEffect(() => { setPr(price != null ? String(price) : ""); }, [price]);
  useEffect(() => { setPc(compare != null ? String(compare) : ""); }, [compare]);

  return (
    <div className="rounded-lg border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div
          className="h-14 w-14 rounded-md border bg-muted overflow-hidden grid place-items-center shrink-0"
          style={!thumbnailUrl && colorHex ? { background: colorHex } : undefined}
        >
          {thumbnailUrl
            ? <img src={thumbnailUrl} alt={colorName} className="w-full h-full object-cover" />
            : !colorHex && <ImageIcon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {colorHex && <span className="h-3 w-3 rounded-full ring-1 ring-border shrink-0" style={{ background: colorHex }} />}
            <span className="font-semibold">{colorName}</span>
            <Badge variant="secondary">{sizeLabel}</Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate mt-1">{variant.sku}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 shrink-0">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <FormField label="SKU">
          <Input value={sku} onChange={(e) => setSku(e.target.value)} onBlur={() => sku !== variant.sku && onChangeVariant({ sku })} className="font-mono" />
        </FormField>
        <FormField label="Estoque">
          {stockLevelId ? (
            <Input type="number" min={0} value={st} onChange={(e) => setSt(e.target.value)} onBlur={() => {
              const n = Number(st); if (!Number.isNaN(n) && n >= 0 && n !== stockQty) onChangeStock(n);
            }} />
          ) : <Input disabled value="Sem nível" />}
        </FormField>
        <FormField label="Preço">
          <Input type="number" min={0} step="0.01" value={pr} onChange={(e) => setPr(e.target.value)} onBlur={() => {
            const p = Number(pr.replace(",", "."));
            const c = pc ? Number(pc.replace(",", ".")) : null;
            if (!Number.isNaN(p) && p !== price) onChangePrice(p, c);
          }} placeholder="0,00" />
        </FormField>
        <FormField label="Promoção">
          <Input type="number" min={0} step="0.01" value={pc} onChange={(e) => setPc(e.target.value)} onBlur={() => {
            const p = pr ? Number(pr.replace(",", ".")) : price;
            const c = pc ? Number(pc.replace(",", ".")) : null;
            if (p != null && !Number.isNaN(p)) onChangePrice(p, c);
          }} placeholder="—" />
        </FormField>
      </div>

      <details className="rounded-md bg-muted/30 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Campos avançados</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
          <FormField label="Código de barras">
            <Input value={bc} onChange={(e) => setBc(e.target.value)} onBlur={() => (bc || "") !== (variant.barcode ?? "") && onChangeVariant({ barcode: bc || null })} className="font-mono" placeholder="EAN/UPC" />
          </FormField>
          <FormField label="Peso (g)">
            <Input type="number" min={0} step={1} value={wt} onChange={(e) => setWt(e.target.value)} onBlur={() => {
              const n = wt ? Number(wt) : null;
              if (n !== variant.weight_grams) onChangeVariant({ weight_grams: n });
            }} />
          </FormField>
        </div>
      </details>
    </div>
  );
}

// =============================================================================
// BLOCO 6 — Organização
// =============================================================================
function OrganizationBlock({
  productId, onChange, onPrev, onNext,
}: { productId: string; onChange: () => void; onPrev: () => void; onNext: () => void }) {
  const fnUpdate = useServerFn(updateProduct);

  const productQ = useQuery({
    queryKey: ["wizard-product", productId],
    queryFn: async () => {
      const { getProduct } = await import("@/lib/business/products.functions");
      const r = await getProduct({ data: { id: productId } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.product as Tables<"products">;
    },
  });

  const [form, setForm] = useState({
    featured: false,
    on_sale: false,
    new_product: false,
  });

  useEffect(() => {
    if (productQ.data) {
      setForm({
        featured: productQ.data.featured,
        on_sale: productQ.data.on_sale,
        new_product: productQ.data.new_product,
      });
    }
  }, [productQ.data]);

  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const ok = await runAction(
      () => fnUpdate({ data: { id: productId, patch: {
        featured: form.featured,
        on_sale: form.on_sale,
        new_product: form.new_product,
      } } }),
      { loading: "Salvando...", success: "Organização salva" },
    );
    setSaving(false);
    if (ok) { onChange(); onNext(); }
  };

  return (
    <BlockCard
      title="Organização"
      description="Destaques, promoções e tags. Departamento, Categoria, Subcategoria e Coleção são definidos em Dados Básicos."
    >
      <FormField label="Tags" hint="Cadastre tags na aba de organização avançada (em breve).">
        <Input disabled placeholder="—" />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          ["featured", "Produto em Destaque", "Exibido nas vitrines principais."],
          ["on_sale", "Produto em Promoção", "Sinaliza preço promocional ativo."],
          ["new_product", "Produto Novo", "Marca como novidade no catálogo."],
        ] as const).map(([k, label, desc]) => (
          <div key={k} className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <Label className="text-sm">{label}</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <Switch checked={form[k] as boolean} onCheckedChange={(v) => setForm({ ...form, [k]: v })} />
          </div>
        ))}
      </div>

      <BlockFooter
        left={<Button variant="outline" onClick={onPrev} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>}
        right={
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar e avançar
          </Button>
        }
      />
    </BlockCard>
  );
}

// =============================================================================
// BLOCO 7 — Publicação
// =============================================================================
function PublishBlock({
  productId, canPublish, issues, onPrev, onDone,
}: {
  productId: string;
  canPublish: boolean;
  issues: string[];
  onPrev: () => void;
  onDone: () => void;
}) {
  const fnPublish = useServerFn(publishProduct);
  const fnUpdate = useServerFn(updateProduct);
  const [status, setStatus] = useState<"draft" | "published" | "scheduled">("draft");
  const [busy, setBusy] = useState(false);

  const saveDraft = async () => {
    setBusy(true);
    const ok = await runAction(
      () => fnUpdate({ data: { id: productId, patch: {} } }),
      { loading: "Salvando...", success: "Rascunho salvo" },
    );
    setBusy(false);
    if (ok) onDone();
  };
  const publish = async () => {
    setBusy(true);
    const ok = await runAction(
      () => fnPublish({ data: { id: productId } }),
      { loading: "Publicando...", success: "Produto publicado!" },
    );
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <BlockCard
      title="Publicação"
      description="Revise antes de publicar. O Readiness Engine bloqueia produtos incompletos."
    >
      <FormField label="Status">
        <RadioGroup value={status} onValueChange={(v) => setStatus(v as typeof status)} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            ["draft", "Rascunho", "Salvar sem publicar."],
            ["published", "Publicado", "Disponível na loja."],
            ["scheduled", "Agendado", "Publica em data futura (em breve)."],
          ] as const).map(([v, label, desc]) => (
            <label key={v} className={cn(
              "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition",
              status === v && "border-primary bg-primary/5",
              v === "scheduled" && "opacity-50 cursor-not-allowed",
            )}>
              <RadioGroupItem value={v} disabled={v === "scheduled"} className="mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </FormField>

      {!canPublish && issues.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
            Pendências para publicar:
          </p>
          <ul className="text-xs space-y-1 text-amber-700 dark:text-amber-300 list-disc pl-5">
            {issues.map((i, k) => <li key={k}>{i}</li>)}
          </ul>
        </div>
      )}

      <BlockFooter
        left={<Button variant="outline" onClick={onPrev} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>}
        right={
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveDraft} disabled={busy} className="gap-2">
              <Save className="h-4 w-4" /> Salvar Rascunho
            </Button>
            <Button onClick={publish} disabled={busy || !canPublish || status !== "published"} className="gap-2">
              <Send className="h-4 w-4" /> Publicar Produto
            </Button>
          </div>
        }
      />
    </BlockCard>
  );
}

// =============================================================================
// Helpers — wrappers de visual
// =============================================================================
function BlockCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-1.5 pb-4 border-b bg-muted/20 rounded-t-xl">
        <CardTitle className="text-xl font-bold tracking-tight">{title}</CardTitle>
        {description && <CardDescription className="text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6 p-6">{children}</CardContent>
    </Card>
  );
}

function BlockFooter({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-5 border-t mt-2">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

// (WizardSidebar removido — substituído pela section nav inline em ProductNewWizardPage)


// =============================================================================
// Readiness Card — checklist em tempo real
// =============================================================================
type ReadinessStepLite = { key: string; label: string; complete: boolean; issues: string[] };
function ReadinessCard({
  enabled, loading, progress, canPublish, issues, steps,
}: {
  enabled: boolean;
  loading: boolean;
  progress: number;
  canPublish: boolean;
  issues: string[];
  steps: ReadinessStepLite[];
}) {
  if (!enabled) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-xs text-muted-foreground">
          Preencha os Dados Básicos para iniciar a verificação automática.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Readiness
          </CardTitle>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("text-3xl font-black tabular-nums", canPublish ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
            {progress}%
          </span>
          <Badge variant={canPublish ? "default" : "secondary"} className={cn(canPublish && "bg-emerald-600 hover:bg-emerald-600")}>
            {canPublish ? "Pode Publicar" : "Não Pode Publicar"}
          </Badge>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all duration-500", canPublish ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <ul className="space-y-1.5">
          {steps.map((s) => (
            <li key={s.key} className="flex items-start gap-2 text-xs">
              {s.complete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium", s.complete ? "text-foreground" : "text-muted-foreground")}>
                  {s.label}
                </p>
                {!s.complete && s.issues.length > 0 && (
                  <p className="text-[11px] text-muted-foreground truncate">{s.issues[0]}</p>
                )}
              </div>
            </li>
          ))}
          {steps.length === 0 && !loading && (
            <li className="flex items-center gap-2 text-xs text-muted-foreground">
              <Circle className="h-4 w-4" /> Aguardando dados...
            </li>
          )}
        </ul>
        {issues.length > 0 && (
          <div className="rounded-md bg-amber-500/5 border border-amber-500/30 p-2.5">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-1">
              {issues.length} pendência(s)
            </p>
            <ul className="text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5 list-disc pl-4">
              {issues.slice(0, 3).map((i, k) => <li key={k} className="truncate">{i}</li>)}
              {issues.length > 3 && <li>+ {issues.length - 3} outras</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Sticky Footer — ações primárias sempre visíveis
// =============================================================================
function StickyFooter({
  productId, canPublish, busy, updatedAt, onSaveDraft, onPublish,
}: {
  productId: string | null;
  canPublish: boolean;
  busy: "draft" | "publish" | null;
  updatedAt: number;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!updatedAt) return;
    const t = setInterval(() => force((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, [updatedAt]);

  const since = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null;
  const sinceLabel = since == null
    ? null
    : since < 5 ? "agora mesmo"
    : since < 60 ? `há ${since}s`
    : since < 3600 ? `há ${Math.floor(since / 60)}min`
    : `há ${Math.floor(since / 3600)}h`;

  return (
    <div className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2 text-xs text-muted-foreground">
          {productId && sinceLabel ? (
            <>
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">Última verificação {sinceLabel}</span>
            </>
          ) : (
            <span className="truncate">Cadastro guiado · alterações persistidas a cada etapa</span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/products" className="gap-2"><X className="h-4 w-4" /> Cancelar</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={!productId || busy !== null}
            className="gap-2"
          >
            {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Rascunho
          </Button>
          <Button
            size="sm"
            onClick={onPublish}
            disabled={!productId || busy !== null}
            className={cn("gap-2", canPublish && "bg-emerald-600 hover:bg-emerald-600/90")}
          >
            {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publicar Produto
          </Button>
        </div>
      </div>
    </div>
  );
}
