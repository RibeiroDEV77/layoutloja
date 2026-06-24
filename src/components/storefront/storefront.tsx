import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, Heart, User, ShoppingBag, Menu, X,
  Star, ChevronDown, ChevronLeft, ChevronRight, Truck, MessageCircle, Tag,
  CreditCard, ShieldCheck, Shirt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import lookCowboy from "@/assets/look-cowboy.jpg";
import lookFeminino from "@/assets/look-feminino.jpg";
import lookSocial from "@/assets/look-social.jpg";
import logoAsset from "@/assets/layout-logo.png.asset.json";
import logoTransparent from "@/assets/layout-logo-transparent.png.asset.json";

import type { StorefrontCategory, StorefrontProduct, StorefrontBrand } from "@/lib/business/storefront.functions";
import { COMPANY, whatsappUrl, mailtoUrl } from "@/lib/company";
import { STOREFRONT_NAV_ITEMS, resolveStorefrontCategory, resolveStorefrontCategories } from "@/lib/storefront-navigation";


// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function StorefrontShell({ children }: { children: ReactNode }) {
  return (
    <div className="font-storefront-sans text-[#111] bg-white antialiased">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navbar — barra preta + navbar branca + mega menu data-driven
// ---------------------------------------------------------------------------

const FALLBACK_MEGA_IMAGES = [lookSocial, lookFeminino, lookCowboy];

type NavbarProps = {
  categories?: StorefrontCategory[];
  brands?: StorefrontBrand[];
  products?: StorefrontProduct[];
};

const MEGA_PRODUCT_COLUMNS = [
  { key: "best", title: "Mais vendidos" },
  { key: "new", title: "Novidades" },
  { key: "sale", title: "Promoções" },
] as const;

type MegaListItem = { id: string; name: string; slug?: string; placeholder?: boolean };
type MegaColumn = { title: string; items: MegaListItem[]; linkToCategory?: boolean };

export function StorefrontNavbar({ categories = [], brands = [], products = [] }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [searchOpen]);

  const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const searchResults = useMemo(() => {
    const q = normalized(searchTerm.trim());
    if (!q) return [] as StorefrontProduct[];
    return products
      .filter((p) => normalized(p.name).includes(q) || normalized(p.short_description ?? "").includes(q))
      .slice(0, 20);
  }, [searchTerm, products]);
  const categoryById = useMemo(() => {
    const m = new Map<string, StorefrontCategory>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);


  const childrenOf = useMemo(() => {
    const m = new Map<string, StorefrontCategory[]>();
    for (const c of categories) {
      if (!c.parent_id) continue;
      const arr = m.get(c.parent_id) ?? [];
      arr.push(c);
      m.set(c.parent_id, arr);
    }
    return m;
  }, [categories]);

  type NavItem = {
    key: string;
    label: string;
    accent?: boolean;
    kind: "cat" | "brands";
    slug: string;
    categoryId?: string;
    image?: string | null;
    categoryIds: string[];
  };

  const navItems: NavItem[] = useMemo(() => {
    return STOREFRONT_NAV_ITEMS.map((entry) => {
      const resolved = resolveStorefrontCategory(entry, categories);
      const resolvedList = resolveStorefrontCategories(entry, categories);
      return {
        key: entry.key,
        label: entry.label,
        accent: entry.accent,
        kind: entry.kind === "brands" ? "brands" as const : "cat" as const,
        slug: entry.slug,
        categoryId: resolved?.id,
        image: resolved?.image_url,
        categoryIds: resolvedList.map((category) => category.id),
      };
    });
  }, [categories]);

  const activeMega = useMemo(() => {
    if (!hover) return null;
    const item = navItems.find((n) => n.key === hover);
    if (!item) return null;
    const categoryIds = new Set<string>(item.categoryIds.length ? item.categoryIds : item.categoryId ? [item.categoryId] : []);
    if (categoryIds.size) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const category of categories) {
          if (category.parent_id && categoryIds.has(category.parent_id) && !categoryIds.has(category.id)) {
            categoryIds.add(category.id);
            changed = true;
          }
        }
      }
    }
    const categoryProducts = categoryIds.size
      ? products.filter((product) => {
          const assigned = product.category_ids?.length ? product.category_ids : product.category_id ? [product.category_id] : [];
          return assigned.some((categoryId) => categoryIds.has(categoryId));
        })
      : products;
    const productPool = categoryProducts.length ? categoryProducts : products;
    const subcategoryItems: MegaListItem[] = item.kind === "brands"
      ? brands.slice(0, 8).map((brand) => ({ id: brand.id, name: brand.name }))
      : (item.categoryId ? (childrenOf.get(item.categoryId) ?? []) : [])
          .slice(0, 8)
          .map((category) => ({ id: category.id, name: category.name, slug: category.slug }));
    const productsFor = (kind: typeof MEGA_PRODUCT_COLUMNS[number]["key"]): MegaListItem[] => {
      const source = kind === "best"
        ? productPool.filter((product) => product.best_seller)
        : kind === "new"
          ? productPool.filter((product) => product.new_product)
          : productPool.filter((product) => product.on_sale);
      const fallback = source.length ? source : productPool;
      return fallback.slice(0, 4).map((product) => ({ id: product.id, name: product.name, slug: product.slug }));
    };
    return {
      tag: item.label,
      cta: `Ver todos`,
      ctaSlug: item.slug,
      image: item.image ?? FALLBACK_MEGA_IMAGES[Math.abs(item.label.length) % FALLBACK_MEGA_IMAGES.length],
      columns: [
        { title: "Subcategorias", items: subcategoryItems, linkToCategory: true },
        ...MEGA_PRODUCT_COLUMNS.map((column) => ({ title: column.title, items: productsFor(column.key), linkToCategory: false })),
      ] satisfies MegaColumn[],
    };
  }, [hover, navItems, childrenOf, categories, brands, products]);


  return (
    <header className="sticky top-0 z-40 bg-white">
      {/* Barra preta institucional */}
      <div className="bg-[#111] text-neutral-300">
        <div className="mx-auto max-w-[1440px] px-5 lg:px-10 h-9 flex items-center justify-between text-[12px] font-normal">
          <div className="flex items-center gap-6">
            <span className="hidden md:inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" strokeWidth={1.5}/> Entrega para todo o Brasil</span>
            <a href={whatsappUrl()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white transition-colors"><MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5}/> WhatsApp {COMPANY.whatsapp.display}</a>
          </div>
          <a href="#" className="inline-flex items-center gap-1.5 text-white hover:opacity-80 transition-opacity">
            <Tag className="h-3.5 w-3.5" strokeWidth={1.5}/>
            <span className="hidden sm:inline">Promoções da semana</span>
            <span className="sm:hidden">Promoções</span>
          </a>
        </div>
      </div>

      {/* Navbar branca */}
      <div
        className="border-b border-[#EFEFEF] bg-white relative"
        onMouseLeave={() => setHover(null)}
      >
        <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
          <div className="flex h-16 items-center gap-6">
            {/* Mobile menu */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden -ml-2 p-2 text-[#111] hover:text-[var(--brand-red)] transition-colors"
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
            </button>

            {/* Categorias centralizadas — desktop sempre visíveis */}
            <nav className="hidden lg:flex flex-1 items-center justify-center gap-7 text-[15px] font-normal text-[#111]">
              {navItems.map((i) => {
                const LinkOrA = (
                  <Link
                    to="/categoria/$slug"
                    params={{ slug: i.slug }}
                    className={cn(
                      "group relative inline-flex items-center py-5 transition-colors duration-200 hover:text-[var(--brand-red)]",
                      i.accent && "text-[var(--brand-red)] font-medium",
                    )}
                  >
                    {i.label}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 right-0 -bottom-px h-0.5 origin-center scale-x-0 bg-[var(--brand-red)] transition-transform duration-300",
                        hover === i.key ? "scale-x-100" : "group-hover:scale-x-100",
                      )}
                    />
                  </Link>
                );
                return (
                  <div
                    key={i.key}
                    onMouseEnter={() => setHover(i.key)}
                    className="relative"
                  >
                    {LinkOrA}
                  </div>
                );
              })}
            </nav>

            {/* Right icons */}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-label="Pesquisar"
                onClick={() => setSearchOpen(true)}
                className="relative p-2.5 text-[#111] hover:text-[var(--brand-red)] transition-colors duration-200"
              >
                <Search className="h-5 w-5" strokeWidth={1.5} />
              </button>

              <button
                type="button"
                aria-label="Minha conta"
                onClick={() => import("@/hooks/use-storefront-customer").then((m) => m.openAccountSheet())}
                className="relative p-2.5 text-[#111] hover:text-[var(--brand-red)] transition-colors duration-200"
              >
                <User className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <IconBtn label="Favoritos"><Heart className="h-5 w-5" strokeWidth={1.5} /></IconBtn>
              <CartIconButton />

            </div>
          </div>
        </div>

        {/* Mega Menu */}
        {activeMega && (
          <div
            className="hidden lg:block absolute left-0 right-0 top-full bg-white border-t border-[#EFEFEF] shadow-[0_24px_40px_-24px_rgba(0,0,0,0.12)] animate-in fade-in duration-200"
            onMouseEnter={() => setHover(hover)}
          >
            <div className="mx-auto max-w-[1440px] px-5 lg:px-10 py-12 grid grid-cols-12 gap-10">
              <div className="col-span-9 grid grid-cols-4 gap-10">
                {activeMega.columns.map((column) => (
                  <div key={column.title}>
                    <p className="text-[13px] uppercase tracking-[0.12em] text-[#111] font-semibold">{column.title}</p>
                    <ul className="mt-4 space-y-3 text-[14px] text-[#666] font-normal">
                      {(column.items.length ? column.items : Array.from({ length: 4 }, (_, idx) => ({ id: `${column.title}-${idx}`, name: "", placeholder: true }) as MegaListItem)).map((it) => (
                        <li key={it.id}>
                          {it.placeholder ? (
                            <div className="h-4 w-4/5 bg-[#F1F1F1] animate-pulse" />
                          ) : column.linkToCategory && it.slug ? (
                            <Link
                              to="/categoria/$slug"
                              params={{ slug: it.slug }}
                              className="hover:text-[var(--brand-red)] transition-colors duration-200"
                            >
                              {it.name}
                            </Link>
                          ) : (
                            <span>{it.name}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="col-span-3">
                <div className="mb-5 flex justify-end">
                  <Link
                    to="/categoria/$slug"
                    params={{ slug: activeMega.ctaSlug }}
                    className="text-[12px] uppercase tracking-[0.18em] text-[#111] hover:text-[var(--brand-red)] transition-colors"
                  >
                    Ver todos
                  </Link>
                </div>
                <Link
                  to="/categoria/$slug"
                  params={{ slug: activeMega.ctaSlug }}
                  className="group block relative overflow-hidden aspect-[4/5] bg-[#F8F8F8]"
                >
                  <MegaImage src={activeMega.image} alt={activeMega.tag} tag={activeMega.tag} cta={activeMega.cta} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="lg:hidden border-t border-[#EFEFEF] bg-white">
          <nav className="px-5 py-4 grid gap-1 text-[15px]">
            {navItems.map((i) =>
              <Link
                key={i.key}
                to="/categoria/$slug"
                params={{ slug: i.slug }}
                onClick={() => setOpen(false)}
                className={cn(
                  "py-2.5 border-b border-[#F8F8F8] text-[#111] hover:text-[var(--brand-red)] transition-colors",
                  i.accent && "text-[var(--brand-red)] font-medium",
                )}
              >
                {i.label}
              </Link>,
            )}
          </nav>
        </div>
      )}

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSearchOpen(false)}>
          <div
            className="absolute inset-x-0 top-0 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-w-[1440px] px-5 lg:px-10 py-6">
              <div className="flex items-center gap-3 border-b border-[#EFEFEF] pb-3">
                <Search className="h-5 w-5 text-[#111]" strokeWidth={1.5} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar produtos…"
                  className="flex-1 bg-transparent outline-none text-[16px] text-[#111] placeholder:text-[#999]"
                />
                <button
                  type="button"
                  aria-label="Fechar busca"
                  onClick={() => { setSearchOpen(false); setSearchTerm(""); }}
                  className="p-1.5 text-[#666] hover:text-[#111] transition-colors"
                >
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="mt-4 max-h-[60vh] overflow-y-auto">
                {searchTerm.trim() === "" ? (
                  <p className="py-6 text-center text-[14px] text-[#666]">Digite para buscar produtos.</p>
                ) : searchResults.length === 0 ? (
                  <p className="py-6 text-center text-[14px] text-[#666]">Nenhum produto encontrado para "{searchTerm}".</p>
                ) : (
                  <ul className="grid gap-1">
                    {searchResults.map((p) => {
                      const cat = p.category_id ? categoryById.get(p.category_id) : undefined;
                      const content = (
                        <div className="flex items-center justify-between gap-3 px-3 py-3 rounded hover:bg-[#F8F8F8] transition-colors">
                          <div className="min-w-0">
                            <p className="text-[14px] text-[#111] truncate">{p.name}</p>
                            {p.short_description && (
                              <p className="text-[12px] text-[#666] truncate">{p.short_description}</p>
                            )}
                          </div>
                          {cat && (
                            <span className="text-[11px] uppercase tracking-[0.12em] text-[#999] whitespace-nowrap">{cat.name}</span>
                          )}
                        </div>
                      );
                      return (
                        <li key={p.id}>
                          {cat ? (
                            <Link
                              to="/categoria/$slug"
                              params={{ slug: cat.slug }}
                              onClick={() => { setSearchOpen(false); setSearchTerm(""); }}
                            >
                              {content}
                            </Link>
                          ) : (
                            <div>{content}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );

}

function MegaImage({ src, alt, tag, cta }: { src: string; alt: string; tag: string; cta: string }) {
  return (
    <>
      <img src={src} alt={alt}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      <div className="absolute inset-x-5 bottom-5 text-white">
        <p className="text-[11px] uppercase tracking-[0.22em] opacity-90">{tag}</p>
        <p className="mt-2 text-[18px] font-medium">{cta} →</p>
      </div>
    </>
  );
}


function IconBtn({ label, children, badge }: { label: string; children: ReactNode; badge?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="relative p-2.5 text-[#111] hover:text-[var(--brand-red)] transition-colors duration-200"
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--brand-red)] text-white text-[10px] font-semibold grid place-items-center">
          {badge}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// LogoStrip — faixa branca institucional (apenas a logo)
// ---------------------------------------------------------------------------

export function StorefrontLogoStrip() {
  return (
    <section className="bg-white" aria-label="Layout — Indústria do vestuário">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10 h-[130px] flex items-center justify-center">
        <img
          src={logoTransparent.url}
          alt="Layout — Indústria do vestuário"
          className="h-16 md:h-[78px] w-auto object-contain select-none"
          draggable={false}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hero — slider em tela cheia, conteúdo de campanha alinhado à esquerda
// ---------------------------------------------------------------------------

export type HeroBanner = {
  image: string;
  tag?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaSlug?: string;
};

import heroCountryAsset from "@/assets/hero-country.png.asset.json";
import heroFemininoAsset from "@/assets/hero-feminino.png.asset.json";
import heroBrasilAsset from "@/assets/hero-brasil.png.asset.json";

const HERO_FALLBACK_IMAGES = [heroCountryAsset.url, heroFemininoAsset.url, heroBrasilAsset.url];

const HERO_SLIDE_MS = 5500;
const HERO_FADE_MS = 1000;

export function StorefrontHero({ banners }: { banners?: HeroBanner[] }) {
  const slides: HeroBanner[] = useMemo(() => {
    const list = (banners ?? []).filter((b) => !!b.image).slice(0, 6);
    if (list.length > 0) return list;
    return HERO_FALLBACK_IMAGES.map((image) => ({ image }));
  }, [banners]);

  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  // Preload all hero images to avoid flicker on slide change.
  useEffect(() => {
    slides.forEach((s) => {
      const img = new Image();
      img.src = s.image;
    });
  }, [slides]);

  // Autoplay: single stable interval; hover pause read via ref to avoid recreating timer.
  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setActive((i) => (i + 1) % slides.length);
    }, HERO_SLIDE_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  // Swipe gesture (mobile)
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      setActive((i) => (dx < 0 ? (i + 1) % slides.length : (i - 1 + slides.length) % slides.length));
    }
    touchStartX.current = null;
  };

  const current = slides[active];
  const hasOverlay = !!(current?.tag || current?.title || current?.subtitle || (current?.ctaSlug && current?.ctaLabel));

  return (
    <section
      className="relative w-full overflow-hidden bg-neutral-100"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >

      <div className="relative w-full h-[45vh] md:h-[52vh] lg:h-[60vh]">
        {slides.map((s, i) => (
          <img
            key={`${s.image}-${i}`}
            src={s.image}
            alt={s.tag ?? ""}
            loading="eager"
            decoding="async"
            fetchPriority={i === 0 ? "high" : "auto"}
            style={{
              transitionDuration: `${HERO_FADE_MS}ms`,
              animation: i === active ? `heroKenBurns ${HERO_SLIDE_MS + HERO_FADE_MS}ms ease-out forwards` : undefined,
            }}
            className={cn(
              "absolute inset-0 block h-full w-full object-cover object-center transition-opacity ease-in-out will-change-[opacity,transform]",
              i === active ? "opacity-100 z-10" : "opacity-0 z-0",
            )}
          />
        ))}
        <style>{`@keyframes heroKenBurns { from { transform: scale(1); } to { transform: scale(1.02); } }`}</style>

        <div className="absolute inset-0 bg-black/20 z-10 pointer-events-none" />
        {hasOverlay && (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-0 flex items-center z-20">
              <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-10">
                <div className="max-w-xl text-white">
                  {current?.tag && (
                    <p className="text-[11px] md:text-[12px] uppercase tracking-[0.32em] font-medium text-white/90">
                      {current.tag}
                    </p>
                  )}
                  {current?.title && (
                    <h1 className="mt-4 text-[40px] md:text-[60px] leading-[1.05] font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
                      {current.title}
                    </h1>
                  )}
                  {current?.subtitle && (
                    <p className="mt-5 text-[15px] md:text-[17px] font-normal text-white/95 max-w-md leading-relaxed">
                      {current.subtitle}
                    </p>
                  )}
                  {current?.ctaSlug && current?.ctaLabel && (
                    <Link
                      to="/categoria/$slug"
                      params={{ slug: current.ctaSlug }}
                      className="mt-8 inline-flex items-center gap-2 bg-white text-[#111] px-8 py-3.5 text-[13px] font-semibold uppercase tracking-[0.18em] hover:bg-[var(--brand-red)] hover:text-white transition-colors duration-300"
                    >
                      {current.ctaLabel}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Banner ${i + 1}`}
                onClick={() => setActive(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === active ? "w-8 bg-white" : "w-3 bg-white/45 hover:bg-white/70",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}



// ---------------------------------------------------------------------------
// Section primitives
// ---------------------------------------------------------------------------

export function Section({ children, tone = "white", id }: {
  children: ReactNode; tone?: "white" | "soft"; id?: string;
}) {
  // Tone "soft" mantido por compatibilidade — toda a Loja Pública usa fundo branco.
  void tone;
  return (
    <section id={id} className="bg-white">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10 py-20 md:py-24">{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow, title, description, action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href?: string };
  /** @deprecated mantido por compatibilidade — todas as seções usam left */
  align?: "left" | "center";
}) {
  return (
    <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="max-w-3xl text-left">
        {eyebrow && (
          <p
            className="text-[12px] md:text-[13px] lg:text-[14px] uppercase tracking-[0.24em] text-[var(--brand-red)]"
            style={{ fontFamily: "Inter, sans-serif", fontWeight: 500 }}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className="text-[34px] md:text-[42px] lg:text-[52px] leading-[1.05] tracking-tight text-[#111111]"
          style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, marginTop: 12 }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="text-[16px] md:text-[18px] lg:text-[20px] leading-[1.5] text-[#6B6B6B] line-clamp-2"
            style={{ fontFamily: "Inter, sans-serif", fontWeight: 400, marginTop: 18 }}
          >
            {description}
          </p>
        )}
      </div>
      {action && (
        <a
          href={action.href ?? "#"}
          className="self-start md:self-end shrink-0 inline-flex items-center gap-2 text-[12px] md:text-[13px] uppercase tracking-[0.22em] text-[#111111] border-b border-[#111111] pb-1.5 hover:text-[var(--brand-red)] hover:border-[var(--brand-red)] transition-colors duration-200"
          style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
        >
          {action.label.toUpperCase()} →
        </a>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Carrossel horizontal
// ---------------------------------------------------------------------------

function ProductCardSkeleton() {
  return (
    <div className="block animate-pulse">
      <div className="relative overflow-hidden bg-[#F0F0F0] aspect-[3/4]">
        <div className="absolute inset-x-3 bottom-3 h-10 bg-[#E8E8E8]" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-1/4 bg-[#F0F0F0]" />
        <div className="h-4 w-4/5 bg-[#EFEFEF]" />
        <div className="h-3 w-1/3 bg-[#F4F4F4]" />
        <div className="h-5 w-2/5 bg-[#E8E8E8] mt-2" />
        <div className="h-3 w-3/5 bg-[#F4F4F4]" />
      </div>
    </div>
  );
}

export function ProductCarousel({ products }: { products: StorefrontProduct[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ active: boolean; startX: number; startLeft: number; moved: boolean }>({
    active: false, startX: 0, startLeft: 0, moved: false,
  });

  const scroll = (dir: 1 | -1) => {
    const el = ref.current; if (!el) return;
    // Avança aproximadamente a largura de um card (~22% do container) por clique.
    const step = Math.max(el.clientWidth * 0.22 + 20, 240);
    el.scrollBy({ left: dir * step * 4, behavior: "smooth" });
  };

  // Mouse drag (desktop). Touch já funciona nativamente via overflow-x.
  const DRAG_THRESHOLD = 6;
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current; if (!el) return;
    // Não capturamos o pointer aqui — só quando o movimento ultrapassar o threshold,
    // caracterizando drag. Isso preserva cliques em Links/Buttons internos.
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved) {
      if (Math.abs(dx) <= DRAG_THRESHOLD) return;
      drag.current.moved = true;
      try { el.setPointerCapture(e.pointerId); } catch {}
    }
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    drag.current.active = false;
  };
  // Evita que o clique seja disparado em um card após arrastar.
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) { e.preventDefault(); e.stopPropagation(); drag.current.moved = false; }
  };

  const items: Array<StorefrontProduct | null> = products.length > 0
    ? products
    : Array.from({ length: 8 }, () => null);

  return (
    <div className="relative group/carousel">
      <button
        type="button" onClick={() => scroll(-1)} aria-label="Anterior"
        className="hidden md:grid absolute -left-5 lg:-left-6 top-[38%] -translate-y-1/2 z-20 h-14 w-14 place-items-center bg-white border border-[#EAEAEA] text-[#111] hover:text-white hover:bg-[var(--brand-red)] hover:border-[var(--brand-red)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] rounded-full transition-colors"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
      </button>
      <button
        type="button" onClick={() => scroll(1)} aria-label="Próximo"
        className="hidden md:grid absolute -right-5 lg:-right-6 top-[38%] -translate-y-1/2 z-20 h-14 w-14 place-items-center bg-white border border-[#EAEAEA] text-[#111] hover:text-white hover:bg-[var(--brand-red)] hover:border-[var(--brand-red)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] rounded-full transition-colors"
      >
        <ChevronRight className="h-6 w-6" strokeWidth={1.75} />
      </button>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className="flex gap-5 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 select-none cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {items.map((p, i) => (
          <div
            key={p?.id ?? `sk-${i}`}
            className="snap-start shrink-0 w-[78%] sm:w-[48%] md:w-[32%] lg:w-[calc((100%-4*1.5rem)/4.4)]"
          >
            {p ? <ProductCard p={p} /> : <ProductCardSkeleton />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid de categorias (cards largos)
// ---------------------------------------------------------------------------

export function CategoryGrid({ categories }: { categories: StorefrontCategory[] }) {
  const roots = categories.filter((c) => !c.parent_id);
  if (roots.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="relative overflow-hidden bg-[#F4F4F4] aspect-square animate-pulse" />
        ))}
      </div>
    );
  }
  return (
    <div
      className="grid gap-3 grid-cols-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-6 lg:gap-5"
      style={{ gridTemplateColumns: `repeat(${roots.length}, minmax(0, 1fr))` }}
    >
      {roots.map((c) => (
        <Link
          key={c.id}
          to="/categoria/$slug"
          params={{ slug: c.slug }}
          className="group relative block overflow-hidden bg-[#F4F4F4] aspect-square cursor-pointer"
        >
          {c.image_url ? (
            <>
              <img
                src={c.image_url}
                alt={c.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent transition-opacity duration-300 group-hover:from-black/65" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <h3 className="text-sm md:text-base font-semibold truncate">{c.name}</h3>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-2 bg-[#F4F4F4] group-hover:bg-[#EFEFEF] transition-colors duration-300">
              <h3 className="text-center text-xs md:text-sm font-semibold text-[#111] uppercase tracking-[0.08em] truncate">
                {c.name}
              </h3>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

export function CategoryCircles({ categories }: { categories: StorefrontCategory[] }) {
  const roots = categories.filter((c) => !c.parent_id);
  if (roots.length === 0) return null;
  return (
    <div className="w-full">
      {/* Mobile: carrossel horizontal */}
      <div className="md:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-4 w-max">
          {roots.map((c) => (
            <li key={c.id} className="snap-start">
              <CategoryCircleItem category={c} />
            </li>
          ))}
        </ul>
      </div>
      {/* Desktop: grid centralizado */}
      <ul className="hidden md:grid gap-4 md:grid-cols-6 lg:grid-cols-8 justify-items-center">
        {roots.map((c) => (
          <li key={c.id}>
            <CategoryCircleItem category={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryCircleItem({ category }: { category: StorefrontCategory }) {
  return (
    <Link
      to="/categoria/$slug"
      params={{ slug: category.slug }}
      className="group flex flex-col items-center gap-2 w-20 md:w-24 transition-all duration-200 hover:-translate-y-1 active:translate-y-0"
    >
      <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-gray-50 overflow-hidden ring-1 ring-black/5 group-hover:shadow-sm transition-all duration-200">
        {category.image_url ? (
          <img
            src={category.image_url}
            alt={category.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {category.name.slice(0, 2)}
          </div>
        )}
      </div>
      <span className="text-xs md:text-sm font-medium text-gray-700 text-center truncate w-full">
        {category.name}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Card de produto (premium e-commerce style)
// ---------------------------------------------------------------------------

function formatBRL(n?: number | null) {
  if (n == null) return null;
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n); }
  catch { return `R$ ${n.toFixed(2)}`; }
}

export function ProductCard({ p }: { p: StorefrontProduct }) {
  const x = p as unknown as {
    brand?: string | null;
    price?: number | null;
    sale_price?: number | null;
    rating?: number | null;
    installments?: { count: number; value: number } | null;
    hover_image_url?: string | null;
  };
  const price = formatBRL(x.price ?? null);
  const salePrice = formatBRL(x.sale_price ?? null);
  const installments = x.installments
    ? `${x.installments.count}x de ${formatBRL(x.installments.value)} sem juros`
    : null;
  const rating = x.rating ?? null;
  const initial = p.name.charAt(0).toUpperCase();
  const imageUrl = (p as StorefrontProduct & { image_url?: string | null }).image_url ?? null;
  const hoverImageUrl = x.hover_image_url ?? null;

  return (
    <div className="group block">
      <Link to="/produto/$slug" params={{ slug: p.slug }} className="block relative overflow-hidden bg-[#F8F8F8] aspect-[3/4]">
        {/* Badges */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
          {p.on_sale && (
            <span className="bg-[var(--brand-red)] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white font-semibold">
              Promoção
            </span>
          )}
          {!p.on_sale && p.new_product && (
            <span className="bg-white px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#111] font-semibold border border-[#EFEFEF]">
              Novo
            </span>
          )}
        </div>

        {/* Favoritar */}
        <button
          type="button"
          aria-label="Favoritar"
          onClick={(e) => { e.preventDefault(); }}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center bg-white text-[#111] opacity-0 hover:text-[var(--brand-red)] group-hover:opacity-100 transition-opacity duration-300 rounded-full shadow-sm"
        >
          <Heart className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {imageUrl ? (
          <>
            <img src={imageUrl} alt={p.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 group-hover:opacity-0" />
            {hoverImageUrl ? (
              <img src={hoverImageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            ) : (
              <img src={imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            )}
          </>
        ) : (
          <>
            <div className="absolute inset-0 grid place-items-center transition-opacity duration-500 group-hover:opacity-0">
              <span className="text-7xl font-semibold text-[#EFEFEF]">{initial}</span>
            </div>
            <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[#EFEFEF]">
              <span className="text-7xl font-semibold text-white">{initial}</span>
            </div>
          </>
        )}

        {/* Botão Adicionar à sacola — aparece no hover */}
        <div className="absolute inset-x-3 bottom-3 z-10 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <AddToBagButton productId={p.id} />
        </div>
      </Link>

      <div className="mt-4 space-y-1.5">
        {x.brand && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#666] font-medium">{x.brand}</p>
        )}
        <h3 className="text-[15px] font-medium text-[#111] line-clamp-2 group-hover:text-[var(--brand-red)] transition-colors duration-200">
          {p.name}
        </h3>
        {rating != null ? (
          <div className="flex items-center gap-1 text-[12px] text-[#666]">
            <Star className="h-3.5 w-3.5 fill-[#111] text-[#111]" strokeWidth={0} />
            <span>{rating.toFixed(1)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 text-[#EFEFEF]">
            {[0,1,2,3,4].map(i => <Star key={i} className="h-3.5 w-3.5 fill-current" strokeWidth={0} />)}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 pt-1">
          {p.on_sale && salePrice ? (
            <>
              <span className="text-[var(--brand-red)] text-lg font-bold">{salePrice}</span>
              {price && <span className="text-gray-400 line-through text-sm">{price}</span>}
            </>
          ) : (
            <span className="text-[#111] text-lg font-bold">{price ?? formatBRL(0)}</span>
          )}
        </div>
        {installments && (
          <p className="text-[12px] text-[#666]">{installments}</p>
        )}
      </div>
    </div>
  );
}

export function ProductGrid({ products, minCount }: { products: StorefrontProduct[]; minCount?: number }) {
  const target = Math.max(minCount ?? 0, products.length > 0 ? products.length : 8);
  const items: Array<StorefrontProduct | null> = Array.from({ length: target }, (_, i) => products[i] ?? null);
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-7 md:gap-y-12">
      {items.map((p, i) => p ? <ProductCard key={p.id} p={p} /> : <ProductCardSkeleton key={`sk-${i}`} />)}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Banner institucional
// ---------------------------------------------------------------------------

export function InstitutionalBanner() {
  // Sem dados institucionais reais cadastrados — não renderiza conteúdo fictício.
  return null;
}

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------

export function NewsletterSection() {
  // Funcionalidade de newsletter ainda não conectada ao Painel Administrativo.
  return null;
}

// ---------------------------------------------------------------------------
// Trust strip (acima do footer)
// ---------------------------------------------------------------------------

export function TrustStrip() {
  const items = [
    { icon: Truck, title: "Enviamos para todo o Brasil" },
    { icon: CreditCard, title: "Parcele no cartão" },
    { icon: ShieldCheck, title: "Compra Segura" },
    { icon: Shirt, title: "Grande variedade de modelos" },
  ];
  return (
    <section aria-label="Benefícios" className="bg-white border-y border-[#ECECEC]">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
        {/* Desktop: linha única (4 colunas) */}
        <ul className="hidden lg:flex items-center justify-between h-[68px] divide-x divide-[#ECECEC]">
          {items.map((it) => (
            <li
              key={it.title}
              className="flex-1 flex items-center justify-center gap-3 px-4 transition-colors hover:bg-[#FAFAFA]"
            >
              <it.icon className="h-[22px] w-[22px] shrink-0 text-[#C91D22]" strokeWidth={1.75} />
              <span className="text-[14px] font-medium text-[#111]">{it.title}</span>
            </li>
          ))}
        </ul>
        {/* Tablet + Mobile: grade 2x2 */}
        <ul className="lg:hidden grid grid-cols-2 gap-x-3 gap-y-2 py-3">
          {items.map((it) => (
            <li key={it.title} className="flex items-center gap-2 px-2 py-1">
              <it.icon className="h-[18px] w-[18px] shrink-0 text-[#C91D22]" strokeWidth={1.75} />
              <span className="text-[12px] font-medium text-[#111] leading-tight">{it.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb / Filters / Toolbar (categoria)
// ---------------------------------------------------------------------------

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-[#666]">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((i, idx) => {
          const last = idx === items.length - 1;
          return (
            <li key={`${i.label}-${idx}`} className="flex items-center gap-2">
              {i.to && !last ? (
                <a href={i.to} className="hover:text-[var(--brand-red)] transition-colors">{i.label}</a>
              ) : (
                <span className={cn(last && "text-[#111] font-medium")}>{i.label}</span>
              )}
              {!last && <span aria-hidden className="text-[#EFEFEF]">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type FilterGroup = {
  key: string;
  title: string;
  options: { label: string; count?: number; swatch?: string }[];
};

export function SidebarFilter({ groups, onClear }: { groups: FilterGroup[]; onClear?: () => void }) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.key, true])),
  );
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  return (
    <aside className="w-full bg-white">
      <div className="flex items-center justify-between pb-4 border-b border-[#EFEFEF]">
        <p className="text-[13px] uppercase tracking-[0.14em] text-[#111] font-semibold">Filtros</p>
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] uppercase tracking-[0.12em] text-[#666] hover:text-[var(--brand-red)] transition-colors"
        >
          Limpar
        </button>
      </div>

      <div className="divide-y divide-[#EFEFEF]">
        {groups.map((g) => {
          const open = openMap[g.key];
          return (
            <div key={g.key} className="py-5">
              <button
                type="button"
                onClick={() => setOpenMap((m) => ({ ...m, [g.key]: !m[g.key] }))}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-[14px] text-[#111] font-medium">{g.title}</span>
                <ChevronDown
                  className={cn("h-4 w-4 text-[#666] transition-transform duration-300", open && "rotate-180")}
                  strokeWidth={1.5}
                />
              </button>

              {open && (
                <div className="mt-4">
                  {g.key === "price" ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number" inputMode="numeric" placeholder="Mín"
                        value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                        className="w-full bg-white border border-[#EFEFEF] px-3 py-2 text-[13px] focus:border-[#111] outline-none transition-colors"
                      />
                      <span className="text-[#666] text-xs">—</span>
                      <input
                        type="number" inputMode="numeric" placeholder="Máx"
                        value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                        className="w-full bg-white border border-[#EFEFEF] px-3 py-2 text-[13px] focus:border-[#111] outline-none transition-colors"
                      />
                    </div>
                  ) : g.key === "color" ? (
                    <div className="flex flex-wrap gap-2.5">
                      {g.options.map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          title={o.label}
                          className="h-7 w-7 rounded-full border border-[#EFEFEF] hover:ring-2 hover:ring-[#111] hover:ring-offset-2 transition-all"
                          style={{ background: o.swatch ?? "#ccc" }}
                        />
                      ))}
                    </div>
                  ) : g.key === "size" ? (
                    <div className="flex flex-wrap gap-2">
                      {g.options.map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          className="min-w-10 h-9 px-2 bg-white border border-[#EFEFEF] text-[13px] text-[#111] hover:border-[#111] transition-colors"
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {g.options.map((o) => (
                        <li key={o.label}>
                          <label className="flex items-center justify-between gap-3 cursor-pointer group">
                            <span className="flex items-center gap-2.5 text-[14px] text-[#666] group-hover:text-[#111] transition-colors">
                              <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--brand-red)]" />
                              {o.label}
                            </span>
                            {o.count != null && (
                              <span className="text-[12px] text-[#666]">{o.count}</span>
                            )}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function CategoryToolbar({
  count, sort, onSortChange,
}: { count: number; sort: string; onSortChange: (s: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-y border-[#EFEFEF] py-4">
      <p className="text-[13px] text-[#666]">
        <span className="text-[#111] font-semibold">{count}</span> {count === 1 ? "produto" : "produtos"}
      </p>
      <label className="flex items-center gap-3 text-[13px] text-[#666]">
        <span className="hidden sm:inline">Ordenar por</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="bg-white border border-[#EFEFEF] py-2 pl-3 pr-8 text-[13px] focus:border-[#111] outline-none transition-colors"
        >
          <option value="relevance">Mais relevantes</option>
          <option value="new">Lançamentos</option>
          <option value="price-asc">Menor preço</option>
          <option value="price-desc">Maior preço</option>
          <option value="best">Mais vendidos</option>
        </select>
      </label>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md text-center py-16">
      <p className="text-[14px] text-[#666]">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

export function StorefrontFooter({
  storeName = "Layout",
  categories = [],
}: { storeName?: string; categories?: StorefrontCategory[] }) {
  const roots = categories.filter((c) => !c.parent_id).slice(0, 6);
  const hasCategories = roots.length > 0;
  return (
    <footer className="bg-white border-t border-[#EFEFEF]">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10 py-16 grid gap-12 md:grid-cols-12">
        <div className={hasCategories ? "md:col-span-4" : "md:col-span-6"}>
          <img src={logoAsset.url} alt={storeName} className="h-12 w-auto object-contain" />
          <p className="mt-5 text-[13px] uppercase tracking-[0.14em] text-[#111] font-semibold">{COMPANY.legalName}</p>
          <dl className="mt-3 space-y-1 text-[13px] text-[#666] leading-relaxed">
            <div><dt className="inline font-medium text-[#111]">CNPJ:</dt> <dd className="inline">{COMPANY.cnpj}</dd></div>
            <div><dt className="inline font-medium text-[#111]">Inscrição Estadual:</dt> <dd className="inline">{COMPANY.stateRegistration}</dd></div>
          </dl>
        </div>

        <div className={hasCategories ? "md:col-span-4" : "md:col-span-6"}>
          <p className="text-[13px] uppercase tracking-[0.14em] text-[#111] font-semibold">Contato</p>
          <ul className="mt-5 space-y-2.5 text-[14px] text-[#666]">
            <li>
              <a href={whatsappUrl()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-[var(--brand-red)] transition-colors">
                <MessageCircle className="h-4 w-4" strokeWidth={1.5} /> WhatsApp {COMPANY.whatsapp.display}
              </a>
            </li>
            <li>
              <a href={mailtoUrl()} className="hover:text-[var(--brand-red)] transition-colors">{COMPANY.email}</a>
            </li>
            <li className="pt-2 text-[13px] leading-relaxed">
              {COMPANY.address.street}, nº {COMPANY.address.number}<br />
              {COMPANY.address.district} — CEP {COMPANY.address.zip}
            </li>
          </ul>
        </div>

        {hasCategories && (
          <div className="md:col-span-4">
            <p className="text-[13px] uppercase tracking-[0.14em] text-[#111] font-semibold">Categorias</p>
            <ul className="mt-5 grid grid-cols-2 gap-y-2.5 text-[14px] text-[#666]">
              {roots.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/categoria/$slug"
                    params={{ slug: c.slug }}
                    className="hover:text-[var(--brand-red)] transition-colors"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="border-t border-[#EFEFEF] bg-[#F8F8F8]">
        <div className="mx-auto max-w-[1440px] px-5 lg:px-10 py-5 text-[12px] text-[#666] flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} {COMPANY.legalName} — CNPJ {COMPANY.cnpj}</span>
          <span>Todos os direitos reservados</span>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Cart count badge + Add-to-bag (storefront-side hooks)
// ---------------------------------------------------------------------------

import { useCart } from "@/components/storefront/cart-provider";

function CartCountBadge() {
  const cart = useCart();
  if (!cart.ready || cart.itemsCount <= 0) return null;
  return (
    <span
      key={cart.itemsCount}
      className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] grid place-items-center rounded-full bg-[var(--brand-red)] text-white text-[10px] font-semibold px-1 animate-scale-in"
    >
      {cart.itemsCount}
    </span>
  );
}

function CartIconButton() {
  const cart = useCart();
  return (
    <button
      type="button"
      onClick={cart.openCart}
      aria-label="Sacola"
      className="relative p-2.5 text-[#111] hover:text-[var(--brand-red)] transition-colors duration-200"
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
      <CartCountBadge />
    </button>
  );
}

export function AddToBagButton({ productId, className = "" }: { productId: string; className?: string }) {
  const cart = useCart();
  const [adding, setAdding] = useState(false);
  return (
    <button
      type="button"
      disabled={adding || !cart.ready}
      onClick={async (e) => {
        e.preventDefault();
        if (!cart.ready) return;
        setAdding(true);
        try {
          await cart.add(productId, 1);
          cart.openCart();
        } finally { setAdding(false); }
      }}
      className={cn(
        "block w-full text-center bg-[#111] text-white py-3 text-[12px] uppercase tracking-[0.18em] font-semibold hover:bg-[var(--brand-red)] transition-colors disabled:opacity-60",
        className,
      )}
    >
      {adding ? "Adicionando…" : "Adicionar à sacola"}
    </button>
  );
}



