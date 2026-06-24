/**
 * Helpers compartilhados de filtros por categoria.
 * Resolve "slug raiz" → conjunto de IDs (incluindo todos os descendentes),
 * para que produtos cadastrados em subcategorias folha apareçam nos filtros
 * de nível superior (ex.: "Bermuda Sport Fino" → aba "Masculino").
 */

export type CategoryNode = { id: string; slug: string; parent_id: string | null };

export type CategoryTab = {
  key: string;
  label: string;
  /** Slugs raiz cujas árvores devem aparecer nesta aba. Vazio = "Todos". */
  roots: string[];
};

export const CATEGORY_TABS: CategoryTab[] = [
  { key: "all", label: "Todos", roots: [] },
  { key: "masculino", label: "Masculino", roots: ["masculino"] },
  { key: "feminino", label: "Feminino", roots: ["feminino"] },
  { key: "sapatos", label: "Sapatos", roots: ["calcados", "botas"] },
  { key: "acessorios", label: "Acessórios", roots: ["acessorios"] },
  { key: "roupas", label: "Roupas", roots: ["masculino", "feminino"] },
];

/** Expande slugs raiz para todos os IDs de categoria descendentes. */
export function resolveCategoryIds(
  categories: CategoryNode[],
  roots: string[],
): string[] {
  if (!roots.length) return [];
  const ids = new Set<string>();
  for (const c of categories) {
    if (roots.includes(c.slug)) ids.add(c.id);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id);
        changed = true;
      }
    }
  }
  return [...ids];
}
