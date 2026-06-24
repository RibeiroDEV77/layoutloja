/**
 * Auditoria de Catálogo.
 *
 * Compara uma lista pré-definida de itens essenciais (gênero × categoria)
 * com o catálogo atual e sinaliza ausências/baixa cobertura, oferecendo
 * ação rápida "Adicionar ao Catálogo" (deep link para /admin/products/new).
 *
 * 100% client-side em cima das server fns existentes (listProducts /
 * listCategories) — não cria tabelas novas.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Shirt, Footprints, Watch, Search, CheckCircle2, AlertCircle, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudPage } from "@/components/admin/crud-page";
import { CrudToolbar } from "@/components/admin/crud-toolbar";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { SelectField } from "@/components/admin/select-field";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveStore } from "@/hooks/use-active-store";
import { listProducts } from "@/lib/business/products.functions";
import { listCategories } from "@/lib/business/categories.functions";
import { resolveCategoryIds, type CategoryNode } from "@/lib/category-tabs";

export const Route = createFileRoute("/_authenticated/admin/catalog-audit")({
  head: () => ({ meta: [{ title: "Auditoria de Catálogo — Admin" }] }),
  component: CatalogAuditPage,
});

type Gender = "masculino" | "feminino";
type CatKey = "calcas" | "bermudas" | "camisas" | "polos" | "botas" | "sapatos" | "acessorios";

type ChecklistItem = {
  id: string;
  label: string;
  gender: Gender;
  category: CatKey;
  /** Palavras-chave aplicadas ao nome do produto (case-insensitive, OR). */
  keywords: string[];
  /** Slugs de categoria raiz (qualquer descendente conta). */
  rootSlugs: string[];
};

const CAT_LABEL: Record<CatKey, string> = {
  calcas: "Calças",
  bermudas: "Bermudas",
  camisas: "Camisas",
  polos: "Polos",
  botas: "Botas",
  sapatos: "Sapatos",
  acessorios: "Acessórios",
};

const CAT_ICON: Record<CatKey, React.ComponentType<{ className?: string }>> = {
  calcas: Shirt, bermudas: Shirt, camisas: Shirt, polos: Shirt,
  botas: Footprints, sapatos: Footprints, acessorios: Watch,
};

/** Itens essenciais que toda loja deveria cobrir. */
const CHECKLIST: ChecklistItem[] = [
  // Masculino
  { id: "m-calca-jeans",    label: "Calça Jeans Masculina",      gender: "masculino", category: "calcas",   keywords: ["jeans"],                rootSlugs: ["masculino"] },
  { id: "m-calca-country",  label: "Calça Country Masculina",    gender: "masculino", category: "calcas",   keywords: ["country"],              rootSlugs: ["masculino"] },
  { id: "m-calca-social",   label: "Calça Social Masculina",     gender: "masculino", category: "calcas",   keywords: ["social", "alfaiataria"],rootSlugs: ["masculino"] },
  { id: "m-bermuda-jeans",  label: "Bermuda Jeans Masculina",    gender: "masculino", category: "bermudas", keywords: ["jeans"],                rootSlugs: ["masculino"] },
  { id: "m-bermuda-sarja",  label: "Bermuda Sarja Masculina",    gender: "masculino", category: "bermudas", keywords: ["sarja", "tactel"],      rootSlugs: ["masculino"] },
  { id: "m-camisa-manga",   label: "Camisa Manga Longa Masc.",   gender: "masculino", category: "camisas",  keywords: ["camisa"],               rootSlugs: ["masculino"] },
  { id: "m-polo",           label: "Camisa Polo Masculina",      gender: "masculino", category: "polos",    keywords: ["polo"],                 rootSlugs: ["masculino"] },
  { id: "m-bota",           label: "Bota de Couro Masculina",    gender: "masculino", category: "botas",    keywords: ["bota"],                 rootSlugs: ["masculino"] },
  { id: "m-sapato",         label: "Sapato Casual Masculino",    gender: "masculino", category: "sapatos",  keywords: ["sapato", "tênis", "tenis"], rootSlugs: ["masculino"] },
  { id: "m-cinto",          label: "Cinto Masculino",            gender: "masculino", category: "acessorios", keywords: ["cinto"],              rootSlugs: ["masculino"] },

  // Feminino
  { id: "f-calca-jeans",    label: "Calça Jeans Feminina",       gender: "feminino",  category: "calcas",   keywords: ["jeans"],                rootSlugs: ["feminino"] },
  { id: "f-calca-country",  label: "Calça Country Feminina",     gender: "feminino",  category: "calcas",   keywords: ["country"],              rootSlugs: ["feminino"] },
  { id: "f-calca-legging",  label: "Calça Legging Feminina",     gender: "feminino",  category: "calcas",   keywords: ["legging", "flare"],     rootSlugs: ["feminino"] },
  { id: "f-bermuda",        label: "Bermuda / Short Feminino",   gender: "feminino",  category: "bermudas", keywords: ["bermuda", "short"],     rootSlugs: ["feminino"] },
  { id: "f-camisa",         label: "Camisa / Blusa Feminina",    gender: "feminino",  category: "camisas",  keywords: ["camisa", "blusa"],      rootSlugs: ["feminino"] },
  { id: "f-polo",           label: "Camisa Polo Feminina",       gender: "feminino",  category: "polos",    keywords: ["polo"],                 rootSlugs: ["feminino"] },
  { id: "f-bota",           label: "Bota de Couro Feminina",     gender: "feminino",  category: "botas",    keywords: ["bota"],                 rootSlugs: ["feminino"] },
  { id: "f-sapato",         label: "Sapato / Sandália Feminina", gender: "feminino",  category: "sapatos",  keywords: ["sapato", "sandália", "sandalia", "scarpin"], rootSlugs: ["feminino"] },
  { id: "f-cinto",          label: "Cinto Feminino",             gender: "feminino",  category: "acessorios", keywords: ["cinto"],              rootSlugs: ["feminino"] },
];

type Presence = "available" | "low" | "missing";

type AuditRow = ChecklistItem & {
  count: number;
  presence: Presence;
};

const PRESENCE: Record<Presence, { label: string; tone: "success" | "warning" | "danger" }> = {
  available: { label: "Disponível", tone: "success" },
  low:       { label: "Pouco Estoque", tone: "warning" },
  missing:   { label: "Ausente", tone: "danger" },
};

function CatalogAuditPage() {
  const { storeId, loading } = useActiveStore();
  const listProductsFn = useServerFn(listProducts);
  const listCatsFn = useServerFn(listCategories);

  const [q, setQ] = useState("");
  const [gender, setGender] = useState<"all" | Gender>("all");
  const [category, setCategory] = useState<"all" | CatKey>("all");
  const [presenceFilter, setPresenceFilter] = useState<"all" | Presence>("all");

  const categoriesQuery = useQuery({
    queryKey: ["categories-all", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const r = await listCatsFn({ data: { store_id: storeId!, pageSize: 500 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as CategoryNode[];
    },
  });

  const productsQuery = useQuery({
    queryKey: ["products-audit", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const r = await listProductsFn({
        data: { store_id: storeId!, pageSize: 500, status: "all" as const },
      });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Array<{ id: string; name: string; category_id: string | null; status: string }>;
    },
  });

  const rows: AuditRow[] = useMemo(() => {
    const cats = categoriesQuery.data ?? [];
    const products = productsQuery.data ?? [];
    return CHECKLIST.map((item) => {
      const allowedCatIds = new Set(resolveCategoryIds(cats, item.rootSlugs));
      const kw = item.keywords.map((k) => k.toLowerCase());
      const count = products.filter((p) => {
        if (p.status === "archived") return false;
        if (allowedCatIds.size && (!p.category_id || !allowedCatIds.has(p.category_id))) return false;
        const name = p.name.toLowerCase();
        return kw.some((k) => name.includes(k));
      }).length;
      const presence: Presence = count === 0 ? "missing" : count === 1 ? "low" : "available";
      return { ...item, count, presence };
    });
  }, [categoriesQuery.data, productsQuery.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (gender !== "all" && r.gender !== gender) return false;
      if (category !== "all" && r.category !== category) return false;
      if (presenceFilter !== "all" && r.presence !== presenceFilter) return false;
      if (needle && !r.label.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, gender, category, presenceFilter]);

  const total = rows.length;
  const covered = rows.filter((r) => r.presence !== "missing").length;
  const coveragePct = total ? Math.round((covered / total) * 100) : 0;
  const missingCount = rows.filter((r) => r.presence === "missing").length;
  const lowCount = rows.filter((r) => r.presence === "low").length;

  const columns: Column<AuditRow>[] = [
    {
      key: "item", header: "Item Recomendado",
      accessor: (r) => {
        const Icon = CAT_ICON[r.category];
        return (
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <div className="font-medium truncate">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.count} produto(s) no catálogo</div>
            </div>
          </div>
        );
      },
    },
    { key: "category", header: "Categoria", accessor: (r) => CAT_LABEL[r.category] },
    {
      key: "gender", header: "Gênero",
      accessor: (r) => (
        <StatusBadge label={r.gender === "masculino" ? "Masculino" : "Feminino"} tone="info" />
      ),
    },
    {
      key: "presence", header: "Status",
      accessor: (r) => {
        const p = PRESENCE[r.presence];
        const Icon = r.presence === "available" ? CheckCircle2 : r.presence === "low" ? AlertTriangle : AlertCircle;
        return (
          <span className="inline-flex items-center gap-1.5">
            <Icon className={
              "h-4 w-4 " +
              (r.presence === "available" ? "text-emerald-600" : r.presence === "low" ? "text-amber-600" : "text-red-600")
            } />
            <StatusBadge label={p.label} tone={p.tone} dot />
          </span>
        );
      },
    },
    {
      key: "action", header: "Ação", align: "right",
      accessor: (r) =>
        r.presence === "missing" ? (
          <Button asChild size="sm">
            <Link
              to="/admin/products/new"
              search={{ name: r.label, gender: r.gender, category: r.category } as never}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/products" search={{ q: r.keywords[0] } as never}>
              <Search className="h-3.5 w-3.5 mr-1" /> Ver
            </Link>
          </Button>
        ),
    },
  ];

  return (
    <CrudPage
      title="Auditoria de Catálogo"
      description="Lista de verificação de itens essenciais por gênero e categoria. Identifique ausências e adicione ao catálogo."
      breadcrumbs={[{ label: "Catálogo" }, { label: "Auditoria de Catálogo" }]}
      toolbar={
        <CrudToolbar
          left={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar item..."
                  className="pl-8"
                />
              </div>
              <div className="w-44">
                <SelectField
                  label=""
                  value={gender}
                  onChange={(v) => setGender(v as typeof gender)}
                  options={[
                    { value: "all", label: "Todos os gêneros" },
                    { value: "masculino", label: "Masculino" },
                    { value: "feminino", label: "Feminino" },
                  ]}
                />
              </div>
              <div className="w-48">
                <SelectField
                  label=""
                  value={category}
                  onChange={(v) => setCategory(v as typeof category)}
                  options={[
                    { value: "all", label: "Todas as categorias" },
                    ...(Object.keys(CAT_LABEL) as CatKey[]).map((k) => ({ value: k, label: CAT_LABEL[k] })),
                  ]}
                />
              </div>
              <div className="w-44">
                <SelectField
                  label=""
                  value={presenceFilter}
                  onChange={(v) => setPresenceFilter(v as typeof presenceFilter)}
                  options={[
                    { value: "all", label: "Todos os status" },
                    { value: "available", label: "Disponível" },
                    { value: "low", label: "Pouco Estoque" },
                    { value: "missing", label: "Ausente" },
                  ]}
                />
              </div>
            </div>
          }
        />
      }
    >
      {/* Coverage cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Cobertura</div>
            <div className="mt-1 text-2xl font-semibold">{coveragePct}%</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${coveragePct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{covered} de {total} itens essenciais</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Disponíveis</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">{covered - lowCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Pouco Estoque</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">{lowCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Ausentes</div>
            <div className="mt-1 text-2xl font-semibold text-red-600">{missingCount}</div>
          </CardContent>
        </Card>
      </div>

      {!storeId && !loading ? (
        <EmptyState
          title="Nenhuma loja selecionada"
          description="Selecione uma loja no topo para auditar o catálogo."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum item encontrado"
          description="Ajuste os filtros ou a busca para ver outros itens recomendados."
        />
      ) : (
        <DataTable<AuditRow>
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          loading={productsQuery.isLoading || categoriesQuery.isLoading || loading}
          error={productsQuery.error || categoriesQuery.error}
          onRetry={() => { productsQuery.refetch(); categoriesQuery.refetch(); }}
        />
      )}
    </CrudPage>
  );
}
