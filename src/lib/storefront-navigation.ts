import type { StorefrontCategory } from "@/lib/business/storefront.functions";

export type StorefrontNavItem = {
  key: string;
  label: string;
  slug: string;
  match: string[];
  kind?: "category" | "brands";
  accent?: boolean;
};

export const STOREFRONT_NAV_ITEMS: StorefrontNavItem[] = [
  { key: "masculino", label: "Masculino", slug: "masculino", match: ["masculino", "homem"] },
  { key: "feminino", label: "Feminino", slug: "feminino", match: ["feminino", "mulher"] },
  { key: "country", label: "Country", slug: "country", match: ["country"] },
  { key: "sport-fino", label: "Sport Fino", slug: "sport-fino", match: ["sport-fino", "esporte-fino", "masc-esporte-fino"] },
  { key: "social", label: "Social", slug: "social", match: ["social", "masc-social"] },
  { key: "botas", label: "Botas", slug: "botas", match: ["botas", "calc-botas"] },
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
  const bySlug = new Map(categories.map((category) => [normalizeNavText(category.slug), category]));
  for (const slug of item.match) {
    const hit = bySlug.get(normalizeNavText(slug));
    if (hit) return hit;
  }
  return undefined;
}

export function resolveStorefrontCategories(item: StorefrontNavItem, categories: StorefrontCategory[]) {
  const aliases = [item.slug, ...item.match].map(normalizeNavText);
  const seen = new Set<string>();
  const matches: StorefrontCategory[] = [];

  for (const category of categories) {
    const slug = normalizeNavText(category.slug);
    const name = normalizeNavText(category.name);
    const found = aliases.some((alias) => slug === alias || slug.includes(alias) || name === alias || name.includes(alias));
    if (found && !seen.has(category.id)) {
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