import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, Heart, User, ShoppingBag, Menu, X, Instagram, Facebook, Youtube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import lookCowboy from "@/assets/look-cowboy.jpg";
import lookFeminino from "@/assets/look-feminino.jpg";
import lookSocial from "@/assets/look-social.jpg";
import type { StorefrontCategory, StorefrontProduct } from "@/lib/business/storefront.functions";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export function StorefrontShell({ children }: { children: ReactNode }) {
  // Scope editorial fonts and white background to the public storefront only.
  return (
    <div className="font-storefront-sans font-light text-neutral-900 bg-white antialiased [&_*]:tracking-[0.005em]">
      {children}
    </div>
  );
}

const NAV_ITEMS = [
  { label: "Masculino", to: "/" },
  { label: "Feminino", to: "/" },
  { label: "Infantil", to: "/" },
  { label: "Calçados", to: "/" },
  { label: "Acessórios", to: "/" },
  { label: "Promoções", to: "/" },
  { label: "Novidades", to: "/" },
];

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

export function StorefrontNavbar({ storeName = "ATELIER" }: { storeName?: string }) {
  const [open, setOpen] = useState(false);
  const brand = storeName.toUpperCase();
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-100">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="flex h-20 items-center">
          {/* Mobile menu */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden -ml-2 p-2 text-neutral-700"
            aria-label="Menu"
          >
            {open ? <X className="h-[18px] w-[18px]" strokeWidth={1.25} /> : <Menu className="h-[18px] w-[18px]" strokeWidth={1.25} />}
          </button>

          {/* Brand */}
          <Link
            to="/"
            className="font-storefront-display text-2xl font-light tracking-[0.32em] md:absolute md:left-1/2 md:-translate-x-1/2"
          >
            {brand}
          </Link>

          {/* Right icons */}
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <IconBtn label="Buscar"><Search className="h-[18px] w-[18px]" strokeWidth={1.25} /></IconBtn>
            <IconBtn label="Favoritos"><Heart className="h-[18px] w-[18px]" strokeWidth={1.25} /></IconBtn>
            <IconBtn label="Minha conta"><User className="h-[18px] w-[18px]" strokeWidth={1.25} /></IconBtn>
            <IconBtn label="Sacola"><ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.25} /></IconBtn>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex h-11 items-center justify-center gap-10 text-[11px] uppercase tracking-[0.22em] text-neutral-700">
          {NAV_ITEMS.map((i) => (
            <Link
              key={i.label}
              to={i.to}
              className="relative py-1 hover:text-neutral-950 transition-colors duration-300"
            >
              {i.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile drawer */}
      {open && (
        <nav className="md:hidden border-t border-neutral-100 bg-white px-6 py-4 grid gap-3 text-sm uppercase tracking-[0.18em]">
          {NAV_ITEMS.map((i) => (
            <Link key={i.label} to={i.to} onClick={() => setOpen(false)} className="py-1.5 text-neutral-800">
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
      className="p-2 text-neutral-700 hover:text-neutral-950 transition-colors duration-300"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Hero (banner horizontal baixo, sem imagem placeholder)
// ---------------------------------------------------------------------------

export function StorefrontHero({ storeName }: { storeName?: string }) {
  return (
    <section className="border-b border-neutral-100">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-10 md:py-14 flex flex-col items-center text-center gap-4">
        <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">
          Coleção atual · Outono Inverno
        </span>
        <h1 className="font-storefront-display text-3xl md:text-5xl font-light tracking-tight max-w-2xl text-balance">
          {storeName ? `Bem-vindo à ${storeName}` : "Peças atemporais para o seu cotidiano"}
        </h1>
        <Link
          to="/"
          className="mt-2 inline-flex items-center justify-center border border-neutral-900 px-7 py-2.5 text-[11px] uppercase tracking-[0.28em] text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors duration-500"
        >
          Explorar
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
    <section className="bg-white">
      <div className="relative w-full overflow-hidden aspect-[21/10] md:aspect-[21/8]">
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
              width={1600}
              height={900}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
            <div className="absolute inset-x-0 bottom-10 md:bottom-16 flex flex-col items-center text-center text-white px-6">
              <span className="text-[10px] uppercase tracking-[0.4em] opacity-80">Lookbook</span>
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
    </section>
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
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.22em] text-neutral-800">{c.name}</span>
                <span className="text-[10px] uppercase tracking-[0.28em] text-neutral-400 group-hover:text-neutral-900 transition-colors duration-300">
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

function ProductCard({ p }: { p: StorefrontProduct }) {
  return (
    <Link to="/" className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-neutral-50">
        {(p.on_sale || p.new_product) && (
          <span className="absolute left-3 top-3 z-10 bg-white px-2 py-1 text-[9px] uppercase tracking-[0.24em] text-neutral-800">
            {p.on_sale ? "Sale" : "Novo"}
          </span>
        )}
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-storefront-display text-5xl font-light text-neutral-200">
            {p.name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-0.5">
        <h3 className="text-sm font-normal text-neutral-900 truncate group-hover:text-neutral-600 transition-colors duration-300">
          {p.name}
        </h3>
        {p.short_description && (
          <p className="text-xs text-neutral-500 line-clamp-1">{p.short_description}</p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Section primitives
// ---------------------------------------------------------------------------

function Section({ children, tone = "white" }: { children: ReactNode; tone?: "white" | "soft" }) {
  return (
    <section className={cn(tone === "soft" ? "bg-neutral-50/60" : "bg-white")}>
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-16 md:py-20">{children}</div>
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-10 flex flex-col items-center text-center md:mb-14">
      {subtitle && (
        <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">{subtitle}</span>
      )}
      <h2 className="mt-2 font-storefront-display text-2xl md:text-3xl font-light tracking-tight text-neutral-900">
        {title}
      </h2>
      <span aria-hidden className="mt-5 block h-px w-10 bg-neutral-300" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md text-center py-12">
      <p className="text-sm font-light text-neutral-600">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rodapé
// ---------------------------------------------------------------------------

export function StorefrontFooter({ storeName = "ATELIER" }: { storeName?: string }) {
  return (
    <footer className="bg-white border-t border-neutral-100">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-16 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="font-storefront-display text-xl font-light tracking-[0.32em]">
            {storeName.toUpperCase()}
          </p>
          <p className="mt-3 text-xs font-light text-neutral-500 leading-relaxed max-w-xs">
            Moda autoral, criada com atenção aos detalhes.
            Entrega para todo o Brasil.
          </p>
          <div className="mt-5 flex gap-3 text-neutral-500">
            <a href="#" aria-label="Instagram" className="hover:text-neutral-900 transition-colors duration-300">
              <Instagram className="h-4 w-4" strokeWidth={1.25} />
            </a>
            <a href="#" aria-label="Facebook" className="hover:text-neutral-900 transition-colors duration-300">
              <Facebook className="h-4 w-4" strokeWidth={1.25} />
            </a>
            <a href="#" aria-label="YouTube" className="hover:text-neutral-900 transition-colors duration-300">
              <Youtube className="h-4 w-4" strokeWidth={1.25} />
            </a>
          </div>
        </div>
        <FooterCol title="Institucional" items={["Sobre", "Nossa história", "Trabalhe conosco"]} />
        <FooterCol title="Atendimento" items={["Contato", "Trocas e devoluções", "Políticas", "Privacidade"]} />
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-neutral-900">Pagamento</p>
          <p className="mt-4 text-xs font-light text-neutral-500">
            Cartão de crédito · Pix · Boleto
          </p>
          <p className="mt-3 text-xs font-light text-neutral-500">
            Compra 100% segura
          </p>
        </div>
      </div>
      <div className="border-t border-neutral-100">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-5 text-[11px] uppercase tracking-[0.2em] text-neutral-400">
          © {new Date().getFullYear()} {storeName.toUpperCase()}
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.24em] text-neutral-900">{title}</p>
      <ul className="mt-4 space-y-2 text-sm font-light text-neutral-600">
        {items.map((i) => (
          <li key={i}>
            <a href="#" className="hover:text-neutral-900 transition-colors duration-300">{i}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
