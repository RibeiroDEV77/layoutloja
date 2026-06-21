import { createFileRoute } from "@tanstack/react-router";
import { CategoriesTreeView } from "@/components/admin/categories-tree-view";
import { usePageBreadcrumbs } from "@/components/admin/breadcrumb-context";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Categorias — Admin" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  usePageBreadcrumbs([{ label: "Catálogo" }, { label: "Categorias" }]);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          Estrutura hierárquica do catálogo. Arraste para reorganizar a árvore.
        </p>
      </header>
      <CategoriesTreeView />
    </div>
  );
}
