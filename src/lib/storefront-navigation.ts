import type { StorefrontCategory } from "@/lib/business/storefront.functions";

export type StorefrontNavExtraLink = {
  label: string;
  /** Slug of a category to pre-select on /produtos (via ?cat=). */
  slug: string;
};

export type StorefrontNavItem = {
  key: string;
  label: string;
  slug: string;
  match: string[];
  kind?: "category" | "brands";
  accent?: boolean;
  /** Curated extra sub-links rendered inside the mega menu + mobile drawer. */
  extraLinks?: StorefrontNavExtraLink[];
};

// Sub-links curados exibidos dentro do mega-menu de Masculino/Feminino/Calçados.
// Apontam para /categoria/<slug> (rota canônica), sem departamento forçado.

const CALCADO_EXTRA_LINKS: StorefrontNavExtraLink[] = [
  { label: "Botas", slug: "botas" },
  { label: "Sapatos", slug: "calc-sapatos" },
  { label: "Tênis", slug: "calc-tenis" },
  { label: "Sapatênis", slug: "calc-sapatenis" },
  { label: "Sandálias", slug: "calc-sandalias" },
  { label: "Chinelos", slug: "calc-chinelos" },
];

export const STOREFRONT_NAV_ITEMS: StorefrontNavItem[] = [
  {
    key: "masculino",
    label: "Masculino",
    slug: "masculino",
    match: ["masculino", "homem"],
    extraLinks: CALCADO_EXTRA_LINKS,
  },
  {
    key: "feminino",
    label: "Feminino",
    slug: "feminino",
    match: ["feminino", "mulher"],
    extraLinks: CALCADO_EXTRA_LINKS,
  },
  { key: "calcados", label: "Calçados", slug: "calcados", match: ["calcados", "calçados"], extraLinks: CALCADO_EXTRA_LINKS },
  { key: "botas", label: "Botas", slug: "botas", match: ["botas"] },
  { key: "acessorios", label: "Acessórios", slug: "acessorios", match: ["acessorios", "acessórios"] },
  { key: "marcas", label: "Marcas", slug: "marcas", match: ["marcas"], kind: "brands" },
  { key: "promocoes", label: "Promoções", slug: "promocoes", match: ["promocoes", "promocao", "promo"], accent: true },
  { key: "novidades", label: "Novidades", slug: "novidades", match: ["novidades", "lancamentos", "lançamentos"] },
];

export function findStorefrontNavItem(slug: string) {
  const normalized = slug.toLowerCase();
  return STOREFRONT_NAV_ITEMS.find((item) => item.slug === normalized || item.match.includes(normalized));
}

export function resolveStorefrontCategory(item: StorefrontNavItem, categories: StorefrontCategory[]) {
  const bySlug = new Map<string, StorefrontCategory>();
  // Prioriza categorias top-level (parent_id=null) quando houver homônimos por slug.
  for (const c of categories) {
    const key = normalizeNavText(c.slug);
    const existing = bySlug.get(key);
    if (!existing || (existing.parent_id !== null && c.parent_id === null)) bySlug.set(key, c);
  }
  for (const slug of item.match) {
    const hit = bySlug.get(normalizeNavText(slug));
    if (hit) return hit;
  }
  return undefined;
}

export function resolveStorefrontCategories(item: StorefrontNavItem, categories: StorefrontCategory[]) {
  // Match EXATO por slug (evita colisão de nomes homônimos como "Botas" top-level x subcategoria).
  const aliases = new Set([item.slug, ...item.match].map(normalizeNavText));
  const seen = new Set<string>();
  const matches: StorefrontCategory[] = [];
  for (const category of categories) {
    const slug = normalizeNavText(category.slug);
    if (aliases.has(slug) && !seen.has(category.id)) {
      seen.add(category.id);
      matches.push(category);
    }
  }
  return matches;
}

export function storefrontCategoryLabel(slug: string) {
  return findStorefrontNavItem(slug)?.label ?? slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeNavText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}