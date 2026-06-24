/**
 * Lista de Produtos — Central de Produtos (Fase 4.2).
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudPage } from "@/components/admin/crud-page";
import { CrudToolbar } from "@/components/admin/crud-toolbar";
import { CrudSearch } from "@/components/admin/crud-search";
import { CrudPagination } from "@/components/admin/crud-pagination";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { SelectField } from "@/components/admin/select-field";
import { useActiveStore } from "@/hooks/use-active-store";
import { listProducts } from "@/lib/business/products.functions";
import { listCategories } from "@/lib/business/categories.functions";
import { ProductOperationsMenu, type ProductLite } from "@/components/admin/products/product-operations-menu";
import { CATEGORY_TABS, resolveCategoryIds, type CategoryNode } from "@/lib/category-tabs";

export const Route = createFileRoute("/_authenticated/admin/products/")({
  head: () => ({ meta: [{ title: "Produtos — Admin" }] }),
  component: ProductsPage,
});

type Row = {
  id: string; name: string; sku_root: string; slug: string;
  status: "draft" | "published" | "archived"; visibility: string;
  category_id: string | null; brand_id: string | null;
  featured: boolean; on_sale: boolean;
  published_at: string | null; updated_at: string;
};

const STATUS_TONE: Record<string, "success" | "warning" | "muted"> = {
  published: "success", draft: "warning", archived: "muted",
};
const STATUS_LABEL: Record<string, string> = {
  published: "Publicado", draft: "Rascunho", archived: "Arquivado",
};

function ProductsPage() {
  const { storeId, loading } = useActiveStore();
  const fn = useServerFn(listProducts);
  const listCatsFn = useServerFn(listCategories);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published" | "archived">("all");
  const [catTab, setCatTab] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const categoriesQuery = useQuery({
    queryKey: ["categories-all", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const r = await listCatsFn({ data: { store_id: storeId!, pageSize: 200 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows as Array<{ id: string; slug: string }>;
    },
  });

  const tabCategoryIds = (() => {
    if (catTab === "all" || !categoriesQuery.data) return undefined;
    const slugs = new Set(CATEGORY_TABS.find((t) => t.key === catTab)?.slugs ?? []);
    const ids = categoriesQuery.data.filter((c) => slugs.has(c.slug)).map((c) => c.id);
    return ids.length ? ids : ["__none__"];
  })();

  const query = useQuery({
    queryKey: ["products", storeId, q, status, page, pageSize, catTab, tabCategoryIds],
    enabled: !!storeId && (catTab === "all" || !!categoriesQuery.data),
    queryFn: async () => {
      const r = await fn({
        data: { store_id: storeId!, q: q || undefined, status, page, pageSize, category_ids: tabCategoryIds },
      });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });

  const columns: Column<Row>[] = [
    {
      key: "name", header: "Produto",
      accessor: (r) => (
        <div className="min-w-0">
          <Link to="/admin/products/$id/edit" params={{ id: r.id }} className="font-medium hover:underline truncate block">
            {r.name}
          </Link>
          <code className="text-xs text-muted-foreground">{r.sku_root}</code>
        </div>
      ),
    },
    {
      key: "status", header: "Status",
      accessor: (r) => <StatusBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} dot />,
    },
    {
      key: "flags", header: "Destaques",
      accessor: (r) => (
        <div className="flex gap-1 text-xs">
          {r.featured && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">Destaque</span>}
          {r.on_sale && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">Promo</span>}
        </div>
      ),
    },
    {
      key: "updated_at", header: "Atualizado", align: "right",
      accessor: (r) => <span className="text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleDateString("pt-BR")}</span>,
    },
  ];

  return (
    <CrudPage
      title="Produtos"
      description="Central de produtos. Crie, configure e publique todo o catálogo."
      breadcrumbs={[{ label: "Catálogo" }, { label: "Produtos" }]}
      actions={
        <Button asChild disabled={!loading && !storeId}>
          <Link to="/admin/products/new">
            <Plus className="h-4 w-4 mr-2" /> Novo Produto
          </Link>
        </Button>
      }
      toolbar={
        <CrudToolbar
          left={
            <>
              <CrudSearch
                value={q}
                onChange={(v) => { setQ(v); setPage(1); }}
                placeholder="Buscar por nome, SKU ou slug"
              />
              <div className="w-48">
                <SelectField
                  label=""
                  value={status}
                  onChange={(v) => { setStatus(v as typeof status); setPage(1); }}
                  options={[
                    { value: "all", label: "Todos os status" },
                    { value: "draft", label: "Rascunho" },
                    { value: "published", label: "Publicados" },
                    { value: "archived", label: "Arquivados" },
                  ]}
                />
              </div>
            </>
          }
        />
      }
    >
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border" role="tablist" aria-label="Filtrar por categoria">
        {CATEGORY_TABS.map((tab) => {
          const isActive = tab.key === catTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => { setCatTab(tab.key); setPage(1); }}
              className={
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
                (isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {!storeId && !loading ? (
        <EmptyState
          title="Nenhuma loja selecionada"
          description="Selecione uma loja no topo para visualizar os produtos."
        />
      ) : (
        <>
          <DataTable<Row>
            columns={columns}
            rows={(query.data?.rows ?? []) as Row[]}
            rowKey={(r) => r.id}
            loading={query.isLoading || loading}
            error={query.error}
            onRetry={() => query.refetch()}
            actions={(row) => (
              <ProductOperationsMenu
                product={row as unknown as ProductLite}
                storeId={storeId}
                compact
              />
            )}
          />
          {(query.data?.total ?? 0) > 0 && (
            <CrudPagination
              page={page}
              pageSize={pageSize}
              total={query.data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </>
      )}

      
    </CrudPage>
  );
}
