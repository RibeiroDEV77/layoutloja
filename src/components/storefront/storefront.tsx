import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, Heart, User, ShoppingBag, Menu, X, Instagram, Facebook, Youtube,
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
    <div className="font-storefront-sans font-light text-neutral-900 bg-white antialiased [&_*]:tracking-[0.005em]">
      {children}
    </div>
  );
}

// Brand horizontal line — inspired by the line in the logo
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

const NAV_ITEMS = [
  { label: "Masculino", to: "/" },
  { label: "Feminino", to: "/" },
  { label: "Infantil", to: "/" },
  { label: "Calçados", to: "/" },
  { label: "Acessórios", to: "/" },
  { label: "Promoções", to: "/", accent: true as const },
  { label: "Novidades", to: "/" },
];

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

export function StorefrontNavbar({ storeName = "Layout" }: { storeName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-100">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="flex h-20 items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden -ml-2 p-2 text-neutral-800 hover:text-[var(--brand-red)] transition-colors"
            aria-label="Menu"
          >
            {open ? <X className="h-[18px] w-[18px]" strokeWidth={1.25} /> : <Menu className="h-[18px] w-[18px]" strokeWidth={1.25} />}
          </button>

          {/* Logo à esquerda */}
          <Link to="/" className="flex items-center" aria-label={storeName}>
            <img
              src={logoAsset.url}
              alt={storeName}
              className="h-10 md:h-12 w-auto object-contain"
            />
          </Link>

          {/* Desktop nav (centro) */}
          <nav className="hidden md:flex flex-1 items-center justify-center gap-9 text-[11px] uppercase tracking-[0.22em] text-neutral-800">
            {NAV_ITEMS.map((i) => (
              <Link
                key={i.label}
                to={i.to}
                className={cn(
                  "relative py-1 transition-colors duration-300 hover:text-[var(--brand-red)]",
                  i.accent && "text-[var(--brand-red)]",
                )}
              >
                {i.label}
              </Link>
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

      {open && (
        <nav className="md:hidden border-t border-neutral-100 bg-white px-6 py-4 grid gap-3 text-sm uppercase tracking-[0.18em]">
          {NAV_ITEMS.map((i) => (
            <Link
              key={i.label}
              to={i.to}
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
// Hero — horizontal, baixo
// ---------------------------------------------------------------------------

export function StorefrontHero({ storeName }: { storeName?: string }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-14 md:py-20 flex flex-col items-center text-center gap-5">
        <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">
          Coleção atual · Outono Inverno
        </span>
        <h1 className="font-storefront-display text-3xl md:text-5xl font-light tracking-tight max-w-2xl text-balance text-neutral-900">
          {storeName ? `Bem-vindo à ${storeName}` : "Peças atemporais para o seu cotidiano"}
        </h1>
        <BrandLine className="mt-1" />
        <Link
          to="/"
          className="mt-3 inline-flex items-center justify-center bg-neutral-900 px-8 py-3 text-[11px] uppercase tracking-[0.28em] text-white hover:bg-[var(--brand-red)] transition-colors duration-500"
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-6">
          {roots.map((c) => (
            <Link key={c.id} to="/" className="group block">
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
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.22em] text-neutral-900 group-hover:text-[var(--brand-red)] transition-colors duration-300">
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6 md:gap-y-12">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </Section>
  );
}

function formatBRL(n?: number | null) {
  if (n == null) return null;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

function ProductCard({ p }: { p: StorefrontProduct }) {
  const price = formatBRL((p as { price?: number | null }).price ?? null);
  const salePrice = formatBRL((p as { sale_price?: number | null }).sale_price ?? null);
  return (
    <Link to="/" className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-neutral-50">
        {p.on_sale && (
          <span className="absolute left-3 top-3 z-10 bg-[var(--brand-red)] px-2 py-1 text-[9px] uppercase tracking-[0.24em] text-white">
            Sale
          </span>
        )}
        {!p.on_sale && p.new_product && (
          <span className="absolute left-3 top-3 z-10 bg-white px-2 py-1 text-[9px] uppercase tracking-[0.24em] text-neutral-900">
            Novo
          </span>
        )}
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-storefront-display text-5xl font-light text-neutral-200">
            {p.name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <h3 className="text-sm font-normal text-neutral-900 truncate group-hover:text-[var(--brand-red)] transition-colors duration-300">
          {p.name}
        </h3>
        {(price || salePrice) && (
          <div className="flex items-baseline gap-2 text-xs">
            {p.on_sale && salePrice ? (
              <>
                <span className="text-[var(--brand-red)]">{salePrice}</span>
                {price && <span className="text-neutral-400 line-through">{price}</span>}
              </>
            ) : (
              price && <span className="text-neutral-700">{price}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Section primitives
// ---------------------------------------------------------------------------

function Section({ children, tone = "white", compact = false }: {
  children: ReactNode; tone?: "white" | "soft"; compact?: boolean;
}) {
  return (
    <section className={cn(tone === "soft" ? "bg-neutral-50/70" : "bg-white")}>
      <div className={cn(
        "mx-auto max-w-[1400px] px-6 lg:px-10",
        compact ? "py-14 md:py-16" : "py-20 md:py-24",
      )}>{children}</div>
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-12 flex flex-col items-center text-center md:mb-16">
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
      <p className="text-[11px] uppercase tracking-[0.24em] text-neutral-900">{title}</p>
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
