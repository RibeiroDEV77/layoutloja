import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, Heart, User, ShoppingBag, Menu, X,
  Star, ChevronDown, ChevronLeft, ChevronRight, Truck, MessageCircle, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import lookCowboy from "@/assets/look-cowboy.jpg";
import lookFeminino from "@/assets/look-feminino.jpg";
import lookSocial from "@/assets/look-social.jpg";
import logoAsset from "@/assets/layout-logo.png.asset.json";
import logoTransparent from "@/assets/layout-logo-transparent.png.asset.json";

import type { StorefrontCategory, StorefrontProduct, StorefrontBrand } from "@/lib/business/storefront.functions";


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
};

function chunkColumns<T>(items: T[], maxCols = 4): T[][] {
  if (items.length === 0) return [];
  const cols = Math.min(maxCols, Math.max(1, Math.ceil(items.length / 6)));
  const perCol = Math.ceil(items.length / cols);
  const out: T[][] = [];
  for (let i = 0; i < cols; i++) out.push(items.slice(i * perCol, (i + 1) * perCol));
  return out;
}

export function StorefrontNavbar({ categories = [], brands = [] }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  // Árvore: raízes são categorias sem parent_id (ou level 0/1)
  const roots = useMemo(
    () => categories.filter((c) => !c.parent_id).slice(0, 8),
    [categories],
  );
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

  // Itens do navbar — raízes do admin + "Marcas" se houver + atalhos Promoções/Novidades
  type NavItem = { key: string; label: string; slug?: string; accent?: boolean; kind: "cat" | "brands" | "link" };
  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = roots.map((r) => ({
      key: `c:${r.id}`, label: r.name, slug: r.slug, kind: "cat",
    }));
    if (brands.length > 0) items.push({ key: "brands", label: "Marcas", kind: "brands" });
    items.push({ key: "promo", label: "Promoções", kind: "link", accent: true });
    items.push({ key: "new", label: "Novidades", kind: "link" });
    return items;
  }, [roots, brands.length]);

  const activeMega = useMemo(() => {
    if (!hover) return null;
    const item = navItems.find((n) => n.key === hover);
    if (!item) return null;
    if (item.kind === "cat") {
      const root = roots.find((r) => r.slug === item.slug);
      if (!root) return null;
      const subs = childrenOf.get(root.id) ?? [];
      if (subs.length === 0) return null;
      const groups = subs.slice(0, 16).map((sub) => ({
        title: sub.name,
        slug: sub.slug,
        items: (childrenOf.get(sub.id) ?? []).slice(0, 8),
      }));
      return {
        tag: root.name,
        cta: `Ver tudo de ${root.name}`,
        ctaSlug: root.slug,
        image: root.image_url ?? FALLBACK_MEGA_IMAGES[Math.abs(root.name.length) % FALLBACK_MEGA_IMAGES.length],
        groups,
      };
    }
    if (item.kind === "brands") {
      const cols = chunkColumns(brands, 4);
      return {
        tag: "Nossas marcas",
        cta: "Ver todas as marcas",
        ctaSlug: undefined,
        image: FALLBACK_MEGA_IMAGES[0],
        groups: cols.map((col, i) => ({
          title: i === 0 ? "Marcas" : "\u00A0",
          slug: undefined,
          items: col.map((b) => ({ id: b.id, name: b.name, slug: b.slug })) as unknown as StorefrontCategory[],
        })),
      };
    }
    return null;
  }, [hover, navItems, roots, childrenOf, brands]);

  return (
    <header className="sticky top-0 z-40 bg-white">
      {/* Barra preta institucional */}
      <div className="bg-[#111] text-neutral-300">
        <div className="mx-auto max-w-[1440px] px-5 lg:px-10 h-9 flex items-center justify-between text-[12px] font-normal">
          <div className="flex items-center gap-6">
            <span className="hidden md:inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" strokeWidth={1.5}/> Frete grátis acima de R$ 299</span>
            <a href="#" className="inline-flex items-center gap-1.5 hover:text-white transition-colors"><MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5}/> WhatsApp</a>
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
                const LinkOrA = i.kind === "cat" && i.slug ? (
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
                ) : (
                  <a
                    href="#"
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
                  </a>
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
              <IconBtn label="Pesquisar"><Search className="h-5 w-5" strokeWidth={1.5} /></IconBtn>
              <IconBtn label="Minha conta"><User className="h-5 w-5" strokeWidth={1.5} /></IconBtn>
              <IconBtn label="Favoritos"><Heart className="h-5 w-5" strokeWidth={1.5} /></IconBtn>
              <IconBtn label="Sacola"><ShoppingBag className="h-5 w-5" strokeWidth={1.5} /></IconBtn>
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
              <div className={cn("grid gap-10", activeMega.image ? "col-span-9 grid-cols-4" : "col-span-12 grid-cols-4")}>
                {activeMega.groups.map((g, gi) => (
                  <div key={`${g.title}-${gi}`}>
                    {g.slug ? (
                      <Link
                        to="/categoria/$slug"
                        params={{ slug: g.slug }}
                        className="text-[13px] uppercase tracking-[0.12em] text-[#111] font-semibold hover:text-[var(--brand-red)] transition-colors"
                      >
                        {g.title}
                      </Link>
                    ) : (
                      <p className="text-[13px] uppercase tracking-[0.12em] text-[#111] font-semibold">{g.title}</p>
                    )}
                    <ul className="mt-4 space-y-2.5 text-[14px] text-[#666] font-normal">
                      {(g.items as Array<{ id: string; name: string; slug: string }>).map((it) => (
                        <li key={it.id}>
                          <Link
                            to="/categoria/$slug"
                            params={{ slug: it.slug }}
                            className="hover:text-[var(--brand-red)] transition-colors duration-200"
                          >
                            {it.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {activeMega.image && (
                <div className="col-span-3">
                  {activeMega.ctaSlug ? (
                    <Link
                      to="/categoria/$slug"
                      params={{ slug: activeMega.ctaSlug }}
                      className="group block relative overflow-hidden aspect-[4/5] bg-[#F8F8F8]"
                    >
                      <MegaImage src={activeMega.image} alt={activeMega.tag} tag={activeMega.tag} cta={activeMega.cta} />
                    </Link>
                  ) : (
                    <a href="#" className="group block relative overflow-hidden aspect-[4/5] bg-[#F8F8F8]">
                      <MegaImage src={activeMega.image} alt={activeMega.tag} tag={activeMega.tag} cta={activeMega.cta} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="lg:hidden border-t border-[#EFEFEF] bg-white">
          <nav className="px-5 py-4 grid gap-1 text-[15px]">
            {navItems.map((i) =>
              i.kind === "cat" && i.slug ? (
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
                </Link>
              ) : (
                <a
                  key={i.key}
                  href="#"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "py-2.5 border-b border-[#F8F8F8] text-[#111] hover:text-[var(--brand-red)] transition-colors",
                    i.accent && "text-[var(--brand-red)] font-medium",
                  )}
                >
                  {i.label}
                </a>
              ),
            )}
          </nav>
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

import bannerCountry from "@/assets/banner-country.jpg";
import bannerMasculino from "@/assets/banner-masculino.jpg";
import bannerFeminino from "@/assets/banner-feminino.jpg";
import bannerSportFino from "@/assets/banner-sport-fino.jpg";

const HERO_FALLBACK_IMAGES = [bannerCountry, bannerMasculino, bannerFeminino, bannerSportFino];
// Keep legacy fallback imports referenced to avoid unused-import errors
void lookSocial; void lookFeminino; void lookCowboy;

export function StorefrontHero({ banners }: { banners?: HeroBanner[] }) {
  const slides: HeroBanner[] = useMemo(() => {
    const list = (banners ?? []).filter((b) => !!b.image).slice(0, 6);
    if (list.length > 0) return list;
    // Fallback visual: mantém o Hero presente até que existam banners do Admin.
    return HERO_FALLBACK_IMAGES.map((image) => ({ image }));
  }, [banners]);

  const [active, setActive] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % slides.length), 5500);
    return () => clearInterval(id);
  }, [slides.length]);

  const current = slides[active];
  const hasOverlay = !!(current?.tag || current?.title || current?.subtitle || (current?.ctaSlug && current?.ctaLabel));

  return (
    <section className="relative w-full overflow-hidden bg-[#111]">
      <div className="relative aspect-[16/9] md:aspect-[21/9] min-h-[460px] md:min-h-[600px]">
        {slides.map((s, i) => (
          <img
            key={`${s.image}-${i}`}
            src={s.image}
            alt={s.tag ?? ""}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out",
              i === active ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        <div className="absolute inset-0 bg-black/20" />
        {hasOverlay && (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />
            <div className="absolute inset-0 flex items-center">
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
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
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
    <div className="mb-12 md:mb-16 flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="text-[12px] md:text-[13px] font-medium uppercase tracking-[0.28em] text-[var(--brand-red)]">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-3 text-[44px] md:text-[56px] lg:text-[60px] leading-[1.02] font-bold tracking-tight text-[#111111]">
          {title}
        </h2>
        {description && (
          <p className="mt-4 text-[18px] md:text-[20px] font-normal leading-relaxed text-[#6B6B6B]">
            {description}
          </p>
        )}
      </div>
      {action && (
        <a
          href={action.href ?? "#"}
          className="self-start md:self-end shrink-0 inline-flex items-center gap-2 text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.22em] text-[#111111] border-b border-[#111111] pb-1.5 hover:text-[var(--brand-red)] hover:border-[var(--brand-red)] transition-colors duration-200"
        >
          {action.label} →
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carrossel horizontal
// ---------------------------------------------------------------------------

export function ProductCarousel({ products }: { products: StorefrontProduct[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current; if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 900), behavior: "smooth" });
  };
  if (products.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button" onClick={() => scroll(-1)} aria-label="Anterior"
        className="hidden md:grid absolute -left-4 top-1/3 z-10 h-11 w-11 place-items-center bg-white border border-[#EFEFEF] text-[#111] hover:text-[var(--brand-red)] shadow-sm rounded-full"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <button
        type="button" onClick={() => scroll(1)} aria-label="Próximo"
        className="hidden md:grid absolute -right-4 top-1/3 z-10 h-11 w-11 place-items-center bg-white border border-[#EFEFEF] text-[#111] hover:text-[var(--brand-red)] shadow-sm rounded-full"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <div
        ref={ref}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {products.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-[68%] sm:w-[44%] md:w-[31%] lg:w-[23%]">
            <ProductCard p={p} />
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
  if (roots.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {roots.map((c) => (
        <Link
          key={c.id}
          to="/categoria/$slug"
          params={{ slug: c.slug }}
          className="group relative block overflow-hidden bg-[#F4F4F4] aspect-[4/5] cursor-pointer"
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
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <h3 className="text-xl md:text-2xl font-semibold">{c.name}</h3>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-5 bg-[#F4F4F4] group-hover:bg-[#EFEFEF] transition-colors duration-300">
              <h3 className="text-center text-lg md:text-xl font-semibold text-[#111] uppercase tracking-[0.08em]">
                {c.name}
              </h3>
            </div>
          )}
        </Link>
      ))}
    </div>
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

  return (
    <div className="group block">
      <Link to="/" className="block relative overflow-hidden bg-[#F8F8F8] aspect-[3/4]">
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

        {/* Placeholder image — troca no hover */}
        <div className="absolute inset-0 grid place-items-center transition-opacity duration-500 group-hover:opacity-0">
          <span className="text-7xl font-semibold text-[#EFEFEF]">{initial}</span>
        </div>
        <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[#EFEFEF]">
          <span className="text-7xl font-semibold text-white">{initial}</span>
        </div>

        {/* Botão Comprar — aparece no hover */}
        <div className="absolute inset-x-3 bottom-3 z-10 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <span className="block w-full text-center bg-[#111] text-white py-3 text-[12px] uppercase tracking-[0.18em] font-semibold hover:bg-[var(--brand-red)] transition-colors">
            Comprar
          </span>
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
        <div className="flex items-baseline gap-2 pt-1">
          {p.on_sale && salePrice ? (
            <>
              <span className="text-[var(--brand-red)] text-[20px] font-bold">{salePrice}</span>
              {price && <span className="text-[#666] line-through text-[13px]">{price}</span>}
            </>
          ) : price ? (
            <span className="text-[#111] text-[20px] font-bold">{price}</span>
          ) : (
            <span className="text-[#666] text-[13px]">Sob consulta</span>
          )}
        </div>
        {installments && (
          <p className="text-[12px] text-[#666]">{installments}</p>
        )}
      </div>
    </div>
  );
}

export function ProductGrid({ products }: { products: StorefrontProduct[] }) {
  if (products.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-7 md:gap-y-12">
      {products.map((p) => <ProductCard key={p.id} p={p} />)}
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
  // Benefícios institucionais virão do Painel Administrativo.
  return null;
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
  return (
    <footer className="bg-white border-t border-[#EFEFEF]">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10 py-16 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <img src={logoAsset.url} alt={storeName} className="h-12 w-auto object-contain" />
        </div>

        <div className="md:col-span-8">
          <p className="text-[13px] uppercase tracking-[0.14em] text-[#111] font-semibold">Categorias</p>
          <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 text-[14px] text-[#666]">
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
      </div>
      <div className="border-t border-[#EFEFEF] bg-[#F8F8F8]">
        <div className="mx-auto max-w-[1440px] px-5 lg:px-10 py-5 text-[12px] text-[#666]">
          <span>© {new Date().getFullYear()} {storeName}</span>
        </div>
      </div>
    </footer>
  );
}


