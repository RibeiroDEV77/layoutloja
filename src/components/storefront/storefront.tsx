import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, Heart, User, ShoppingBag, Menu, X, Instagram, Facebook, Youtube,
  Star, ChevronDown, Phone, Truck, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import lookCowboy from "@/assets/look-cowboy.jpg";
import lookFeminino from "@/assets/look-feminino.jpg";
import lookSocial from "@/assets/look-social.jpg";
import logoAsset from "@/assets/layout-logo.png.asset.json";
import type { StorefrontCategory, StorefrontProduct } from "@/lib/business/storefront.functions";

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function StorefrontShell({ children }: { children: ReactNode }) {
  return (
    <div className="font-storefront-sans font-normal text-neutral-900 bg-white antialiased [&_*]:tracking-[0.005em]">
      {children}
    </div>
  );
}

// Linha horizontal com ponto vermelho — inspirada na assinatura do logo
function BrandLine({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block h-px w-12 bg-neutral-900 relative after:absolute after:-right-1.5 after:-top-[2px] after:h-[5px] after:w-[5px] after:rounded-full after:bg-[var(--brand-red)]",
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Navbar — barra preta + navbar branca + mega menu
// ---------------------------------------------------------------------------

const MEGA_MENU: Record<string, { groups: { title: string; items: string[] }[]; image: string; tag: string; cta: string }> = {
  Masculino: {
    tag: "Coleção Masculina",
    cta: "Ver tudo de masculino",
    image: lookSocial,
    groups: [
      { title: "Roupas", items: ["Camisas", "Camisetas", "Polos", "Calças", "Bermudas", "Jaquetas", "Blazers"] },
      { title: "Calçados", items: ["Sapatos", "Tênis", "Botas", "Mocassins"] },
      { title: "Acessórios", items: ["Cintos", "Carteiras", "Bonés", "Relógios"] },
    ],
  },
  Feminino: {
    tag: "Coleção Feminina",
    cta: "Ver tudo de feminino",
    image: lookFeminino,
    groups: [
      { title: "Roupas", items: ["Blusas", "Vestidos", "Saias", "Calças", "Conjuntos", "Casacos"] },
      { title: "Calçados", items: ["Sandálias", "Tênis", "Botas", "Scarpins"] },
      { title: "Acessórios", items: ["Bolsas", "Bijuterias", "Lenços", "Chapéus"] },
    ],
  },
  Infantil: {
    tag: "Coleção Infantil",
    cta: "Ver tudo de infantil",
    image: lookCowboy,
    groups: [
      { title: "Menino", items: ["Camisetas", "Bermudas", "Conjuntos", "Calçados"] },
      { title: "Menina", items: ["Vestidos", "Blusas", "Conjuntos", "Calçados"] },
      { title: "Bebê", items: ["Body", "Macacão", "Kits", "Acessórios"] },
    ],
  },
};

const NAV_ITEMS: { label: string; mega?: boolean; accent?: boolean }[] = [
  { label: "Masculino", mega: true },
  { label: "Feminino", mega: true },
  { label: "Infantil", mega: true },
  { label: "Calçados" },
  { label: "Acessórios" },
  { label: "Promoções", accent: true },
  { label: "Novidades" },
];

export function StorefrontNavbar({ storeName = "Layout" }: { storeName?: string }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-40">
      {/* Barra preta institucional */}
      <div className="bg-neutral-950 text-neutral-300">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10 h-9 flex items-center justify-between text-[11px] tracking-[0.18em] uppercase">
          <div className="flex items-center gap-5 font-light">
            <span className="hidden md:inline-flex items-center gap-1.5"><Truck className="h-3 w-3" strokeWidth={1.25}/> Frete grátis acima de R$ 299</span>
            <span className="hidden lg:inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" strokeWidth={1.25}/> Compra 100% segura</span>
          </div>
          <div className="flex items-center gap-5 font-light">
            <a href="#" className="hidden md:inline-flex items-center gap-1.5 hover:text-white transition-colors"><Phone className="h-3 w-3" strokeWidth={1.25}/> Atendimento</a>
            <a href="#" className="hover:text-white transition-colors">Minha conta</a>
            <a href="#" className="hidden sm:inline hover:text-white transition-colors">Pedidos</a>
          </div>
        </div>
      </div>

      {/* Navbar branca */}
      <div className="bg-white/95 backdrop-blur-md border-b border-neutral-100"
        onMouseLeave={() => setHover(null)}>
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="flex h-20 items-center gap-6">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="md:hidden -ml-2 p-2 text-neutral-800 hover:text-[var(--brand-red)] transition-colors"
              aria-label="Menu"
            >
              {open ? <X className="h-[18px] w-[18px]" strokeWidth={1.25} /> : <Menu className="h-[18px] w-[18px]" strokeWidth={1.25} />}
            </button>

            <Link to="/" className="flex items-center" aria-label={storeName}>
              <img src={logoAsset.url} alt={storeName} className="h-10 md:h-12 w-auto object-contain" />
            </Link>

            <nav className="hidden md:flex flex-1 items-center justify-center gap-10 text-[11px] uppercase tracking-[0.24em] font-normal text-neutral-800">
              {NAV_ITEMS.map((i) => (
                <div
                  key={i.label}
                  onMouseEnter={() => setHover(i.mega ? i.label : null)}
                  className="relative"
                >
                  <Link
                    to="/"
                    className={cn(
                      "group relative inline-flex items-center py-7 transition-colors duration-300 hover:text-[var(--brand-red)]",
                      i.accent && "text-[var(--brand-red)]",
                    )}
                  >
                    {i.label}
                    <span
                      aria-hidden
                      className="absolute left-0 right-0 -bottom-px h-px origin-center scale-x-0 bg-[var(--brand-red)] transition-transform duration-300 group-hover:scale-x-100"
                    />
                  </Link>
                </div>
              ))}
            </nav>

            <div className="ml-auto md:ml-0 flex items-center gap-0.5">
              <IconBtn label="Buscar"><Search className="h-[18px] w-[18px]" strokeWidth={1.25} /></IconBtn>
              <IconBtn label="Favoritos"><Heart className="h-[18px] w-[18px]" strokeWidth={1.25} /></IconBtn>
              <IconBtn label="Minha conta"><User className="h-[18px] w-[18px]" strokeWidth={1.25} /></IconBtn>
              <IconBtn label="Sacola"><ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.25} /></IconBtn>
            </div>
          </div>
        </div>

        {/* Mega Menu */}
        {hover && MEGA_MENU[hover] && (
          <div
            className="hidden md:block absolute left-0 right-0 top-full bg-white border-t border-neutral-100 shadow-[0_24px_40px_-24px_rgba(0,0,0,0.12)] animate-in fade-in duration-200"
            onMouseEnter={() => setHover(hover)}
          >
            <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-12 grid grid-cols-12 gap-10">
              <div className="col-span-8 grid grid-cols-3 gap-10">
                {MEGA_MENU[hover].groups.map((g) => (
                  <div key={g.title}>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-900 font-medium">{g.title}</p>
                    <BrandLine className="mt-3 mb-4 w-8" />
                    <ul className="space-y-2.5 text-sm font-light text-neutral-600">
                      {g.items.map((it) => (
                        <li key={it}>
                          <a href="#" className="hover:text-[var(--brand-red)] transition-colors duration-300">{it}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="col-span-4">
                <a href="#" className="group block relative overflow-hidden aspect-[4/5] bg-neutral-50">
                  <img src={MEGA_MENU[hover].image} alt={MEGA_MENU[hover].tag}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                  <div className="absolute inset-x-6 bottom-6 text-white">
                    <p className="text-[10px] uppercase tracking-[0.36em] opacity-90">{MEGA_MENU[hover].tag}</p>
                    <p className="mt-2 font-storefront-display text-xl font-light">{MEGA_MENU[hover].cta} →</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {open && (
        <nav className="md:hidden border-t border-neutral-100 bg-white px-6 py-4 grid gap-3 text-sm uppercase tracking-[0.2em]">
          {NAV_ITEMS.map((i) => (
            <Link
              key={i.label}
              to="/"
              onClick={() => setOpen(false)}
              className={cn(
                "py-1.5 text-neutral-800 hover:text-[var(--brand-red)] transition-colors",
                i.accent && "text-[var(--brand-red)]",
              )}
            >
              {i.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function IconBtn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="p-2 text-neutral-800 hover:text-[var(--brand-red)] transition-colors duration-300"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function StorefrontHero({ storeName }: { storeName?: string }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-16 md:py-24 flex flex-col items-center text-center gap-5">
        <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">
          Coleção atual · Outono Inverno
        </span>
        <h1 className="font-storefront-display text-3xl md:text-5xl font-light tracking-tight max-w-2xl text-balance text-neutral-900">
          {storeName ? `Bem-vindo à ${storeName}` : "Peças atemporais para o seu cotidiano"}
        </h1>
        <BrandLine className="mt-1" />
        <Link
          to="/"
          className="mt-3 inline-flex items-center justify-center bg-neutral-900 px-8 py-3 text-[11px] uppercase tracking-[0.28em] text-white hover:bg-[var(--brand-red)] transition-colors duration-500 font-medium"
        >
          Explorar coleção
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Slider de Looks
// ---------------------------------------------------------------------------

const LOOKS = [
  { src: lookCowboy, title: "Look Cowboy", subtitle: "Atitude rústica contemporânea" },
  { src: lookFeminino, title: "Look Feminino", subtitle: "Leveza e elegância" },
  { src: lookSocial, title: "Look Social Masculino", subtitle: "Alfaiataria moderna" },
];

export function LooksSlider() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LOOKS.length), 6000);
    return () => clearInterval(t);
  }, []);
  return (
    <Section tone="soft" compact>
      <SectionTitle title="Lookbook" subtitle="Inspirações da estação" />
      <div className="relative w-full overflow-hidden aspect-[21/10] md:aspect-[21/9]">
        {LOOKS.map((look, i) => (
          <div
            key={look.title}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-out",
              i === idx ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={i !== idx}
          >
            <img
              src={look.src}
              alt={look.title}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
            <div className="absolute inset-x-0 bottom-10 md:bottom-16 flex flex-col items-center text-center text-white px-6">
              <span className="text-[10px] uppercase tracking-[0.4em] opacity-80">Look</span>
              <h3 className="mt-2 font-storefront-display text-2xl md:text-4xl font-light">{look.title}</h3>
              <p className="mt-1 text-xs md:text-sm font-light opacity-90">{look.subtitle}</p>
            </div>
          </div>
        ))}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {LOOKS.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className={cn(
                "h-px w-8 transition-all duration-500",
                i === idx ? "bg-white" : "bg-white/40",
              )}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Cards das categorias
// ---------------------------------------------------------------------------

export function CategoryCards({ categories }: { categories: StorefrontCategory[] }) {
  const roots = categories.filter((c) => !c.parent_id).slice(0, 4);
  return (
    <Section>
      <SectionTitle title="Categorias" subtitle="Selecionadas para você" />
      {roots.length === 0 ? (
        <EmptyState message="Categorias em breve." />
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4 md:gap-7">
          {roots.map((c) => (
            <Link
              key={c.id}
              to="/categoria/$slug"
              params={{ slug: c.slug }}
              className="group block"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-neutral-50">
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="font-storefront-display text-6xl font-light text-neutral-300">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.24em] text-neutral-900 font-medium group-hover:text-[var(--brand-red)] transition-colors duration-300">
                  {c.name}
                </span>
                <span className="text-[10px] uppercase tracking-[0.28em] text-neutral-400 group-hover:text-[var(--brand-red)] transition-colors duration-300">
                  Ver →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Sessões de produtos
// ---------------------------------------------------------------------------

export function ProductSection({
  title, subtitle, products, emptyMessage, tone = "white",
}: {
  title: string; subtitle?: string;
  products: StorefrontProduct[]; emptyMessage: string;
  tone?: "white" | "soft";
}) {
  return (
    <Section tone={tone}>
      <SectionTitle title={title} subtitle={subtitle} />
      {products.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ProductGrid products={products} />
      )}
    </Section>
  );
}

export function ProductGrid({ products }: { products: StorefrontProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4 md:gap-x-7 md:gap-y-14">
      {products.map((p) => <ProductCard key={p.id} p={p} />)}
    </div>
  );
}

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
  };
  const price = formatBRL(x.price ?? null);
  const salePrice = formatBRL(x.sale_price ?? null);
  const installments = x.installments
    ? `${x.installments.count}x de ${formatBRL(x.installments.value)} sem juros`
    : null;
  const rating = x.rating ?? null;

  return (
    <Link to="/" className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-neutral-50">
        {p.on_sale && (
          <span className="absolute left-3 top-3 z-10 bg-[var(--brand-red)] px-2 py-1 text-[9px] uppercase tracking-[0.24em] text-white font-medium">
            Promoção
          </span>
        )}
        {!p.on_sale && p.new_product && (
          <span className="absolute left-3 top-3 z-10 bg-white px-2 py-1 text-[9px] uppercase tracking-[0.24em] text-neutral-900 font-medium border border-neutral-200">
            Novo
          </span>
        )}
        <div className="absolute inset-0 grid place-items-center transition-opacity duration-500 group-hover:opacity-70">
          <span className="font-storefront-display text-5xl font-light text-neutral-200">
            {p.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <button
          type="button"
          aria-label="Favoritar"
          onClick={(e) => e.preventDefault()}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center bg-white/0 text-neutral-700 opacity-0 transition-all duration-300 hover:text-[var(--brand-red)] group-hover:bg-white group-hover:opacity-100"
        >
          <Heart className="h-4 w-4" strokeWidth={1.25} />
        </button>
      </div>
      <div className="mt-5 space-y-1.5">
        {x.brand && (
          <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-light">{x.brand}</p>
        )}
        <h3 className="text-sm font-medium text-neutral-900 truncate group-hover:text-[var(--brand-red)] transition-colors duration-300">
          {p.name}
        </h3>
        {rating != null && (
          <div className="flex items-center gap-1 text-[11px] text-neutral-500">
            <Star className="h-3 w-3 fill-current text-neutral-700" strokeWidth={0} />
            <span>{rating.toFixed(1)}</span>
          </div>
        )}
        {(price || salePrice) && (
          <div className="flex items-baseline gap-2 text-sm">
            {p.on_sale && salePrice ? (
              <>
                <span className="text-[var(--brand-red)] font-semibold">{salePrice}</span>
                {price && <span className="text-neutral-400 line-through font-light text-xs">{price}</span>}
              </>
            ) : (
              price && <span className="text-neutral-900 font-semibold">{price}</span>
            )}
          </div>
        )}
        {installments && (
          <p className="text-[11px] text-neutral-500 font-light">{installments}</p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Section primitives
// ---------------------------------------------------------------------------

export function Section({ children, tone = "white", compact = false }: {
  children: ReactNode; tone?: "white" | "soft"; compact?: boolean;
}) {
  return (
    <section className={cn(tone === "soft" ? "bg-neutral-50/70" : "bg-white")}>
      <div className={cn(
        "mx-auto max-w-[1400px] px-6 lg:px-10",
        compact ? "py-16 md:py-20" : "py-20 md:py-28",
      )}>{children}</div>
    </section>
  );
}

export function SectionTitle({ title, subtitle, align = "center" }: {
  title: string; subtitle?: string; align?: "center" | "left";
}) {
  return (
    <div className={cn(
      "mb-14 flex flex-col md:mb-16",
      align === "center" ? "items-center text-center" : "items-start text-left",
    )}>
      <h2 className="font-storefront-display text-3xl md:text-4xl font-light tracking-tight text-neutral-900">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-xs uppercase tracking-[0.3em] text-neutral-500 font-light">
          {subtitle}
        </p>
      )}
      <BrandLine className="mt-6" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md text-center py-12">
      <p className="text-sm font-light text-neutral-500">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[11px] uppercase tracking-[0.24em] text-neutral-500 font-light">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((i, idx) => {
          const last = idx === items.length - 1;
          return (
            <li key={`${i.label}-${idx}`} className="flex items-center gap-2">
              {i.to && !last ? (
                <a href={i.to} className="hover:text-[var(--brand-red)] transition-colors duration-300">{i.label}</a>
              ) : (
                <span className={cn(last && "text-neutral-900")}>{i.label}</span>
              )}
              {!last && <span aria-hidden className="text-neutral-300">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Filter
// ---------------------------------------------------------------------------

export type FilterGroup = {
  key: string;
  title: string;
  options: { label: string; count?: number; swatch?: string }[];
};

export function SidebarFilter({
  groups, onClear,
}: { groups: FilterGroup[]; onClear?: () => void }) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.key, true])),
  );
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  return (
    <aside className="w-full">
      <div className="flex items-center justify-between pb-5 border-b border-neutral-200">
        <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-900 font-medium">Filtros</p>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 hover:text-[var(--brand-red)] transition-colors"
        >
          Limpar
        </button>
      </div>

      <div className="divide-y divide-neutral-100">
        {groups.map((g) => {
          const open = openMap[g.key];
          return (
            <div key={g.key} className="py-5">
              <button
                type="button"
                onClick={() => setOpenMap((m) => ({ ...m, [g.key]: !m[g.key] }))}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-[11px] uppercase tracking-[0.24em] text-neutral-900 font-medium">{g.title}</span>
                <ChevronDown
                  className={cn("h-4 w-4 text-neutral-500 transition-transform duration-300", open && "rotate-180")}
                  strokeWidth={1.25}
                />
              </button>

              {open && (
                <div className="mt-4">
                  {g.key === "price" ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number" inputMode="numeric" placeholder="Mín"
                        value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                        className="w-full border border-neutral-200 px-3 py-2 text-xs font-light focus:border-neutral-900 outline-none transition-colors"
                      />
                      <span className="text-neutral-400 text-xs">—</span>
                      <input
                        type="number" inputMode="numeric" placeholder="Máx"
                        value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                        className="w-full border border-neutral-200 px-3 py-2 text-xs font-light focus:border-neutral-900 outline-none transition-colors"
                      />
                    </div>
                  ) : g.key === "color" ? (
                    <div className="flex flex-wrap gap-2.5">
                      {g.options.map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          title={o.label}
                          className="h-7 w-7 rounded-full border border-neutral-200 ring-offset-2 hover:ring-1 hover:ring-neutral-900 transition-all"
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
                          className="min-w-10 h-9 px-2 border border-neutral-200 text-xs font-light text-neutral-800 hover:border-neutral-900 transition-colors"
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
                            <span className="flex items-center gap-2.5 text-sm font-light text-neutral-700 group-hover:text-neutral-950 transition-colors">
                              <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--brand-red)]" />
                              {o.label}
                            </span>
                            {o.count != null && (
                              <span className="text-[11px] text-neutral-400">{o.count}</span>
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

// ---------------------------------------------------------------------------
// Sort + count toolbar
// ---------------------------------------------------------------------------

export function CategoryToolbar({
  count, sort, onSortChange,
}: {
  count: number;
  sort: string;
  onSortChange: (s: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-y border-neutral-100 py-4">
      <p className="text-xs font-light text-neutral-600">
        <span className="text-neutral-900 font-medium">{count}</span> {count === 1 ? "produto" : "produtos"}
      </p>
      <label className="flex items-center gap-3 text-xs text-neutral-600">
        <span className="uppercase tracking-[0.2em] text-[10px] text-neutral-500 hidden sm:inline">Ordenar por</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="bg-transparent border-b border-neutral-200 py-1 pr-6 text-xs font-light focus:border-neutral-900 outline-none transition-colors"
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

// ---------------------------------------------------------------------------
// Rodapé
// ---------------------------------------------------------------------------

export function StorefrontFooter({ storeName = "Layout" }: { storeName?: string }) {
  return (
    <footer className="bg-white border-t border-neutral-100">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-16 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <img src={logoAsset.url} alt={storeName} className="h-10 w-auto object-contain" />
          <p className="mt-5 text-xs font-light text-neutral-500 leading-relaxed max-w-xs">
            Indústria do vestuário com tradição e qualidade. Moda autoral, criada com atenção aos detalhes.
          </p>
          <div className="mt-5 flex gap-3 text-neutral-500">
            <a href="#" aria-label="Instagram" className="hover:text-[var(--brand-red)] transition-colors duration-300">
              <Instagram className="h-4 w-4" strokeWidth={1.25} />
            </a>
            <a href="#" aria-label="Facebook" className="hover:text-[var(--brand-red)] transition-colors duration-300">
              <Facebook className="h-4 w-4" strokeWidth={1.25} />
            </a>
            <a href="#" aria-label="YouTube" className="hover:text-[var(--brand-red)] transition-colors duration-300">
              <Youtube className="h-4 w-4" strokeWidth={1.25} />
            </a>
          </div>
        </div>
        <FooterCol title="Institucional" items={["Sobre", "Nossa história", "Trabalhe conosco"]} />
        <FooterCol title="Atendimento" items={["Contato", "Trocas e devoluções", "Políticas", "Privacidade"]} />
        <FooterCol title="Minha conta" items={["Acessar", "Meus pedidos", "Endereços", "Favoritos"]} />
      </div>
      <div className="border-t border-neutral-100">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-5 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.2em] text-neutral-400">
          <span>© {new Date().getFullYear()} {storeName} — Indústria do vestuário Ltda.</span>
          <span className="hidden md:inline">Compra 100% segura</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.24em] text-neutral-900 font-medium">{title}</p>
      <ul className="mt-5 space-y-2.5 text-sm font-light text-neutral-600">
        {items.map((i) => (
          <li key={i}>
            <a href="#" className="hover:text-[var(--brand-red)] transition-colors duration-300">{i}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
