import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, Heart, User, ShoppingBag, Menu, X,
  Instagram, Facebook, Youtube, CreditCard, ShieldCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import lookCowboy from "@/assets/look-cowboy.jpg";
import lookFeminino from "@/assets/look-feminino.jpg";
import lookSocial from "@/assets/look-social.jpg";
import type { StorefrontCategory, StorefrontProduct } from "@/lib/business/storefront.functions";

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { label: "Masculino", to: "/" },
  { label: "Feminino", to: "/" },
  { label: "Infantil", to: "/" },
  { label: "Calçados", to: "/" },
  { label: "Acessórios", to: "/" },
  { label: "Promoções", to: "/" },
  { label: "Novidades", to: "/" },
];

export function StorefrontNavbar({ storeName = "Loja" }: { storeName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden -ml-2 p-2 text-foreground"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link to="/" className="shrink-0 text-lg font-bold tracking-tight">
          {storeName}
        </Link>
        <nav className="hidden md:flex flex-1 items-center justify-center gap-5 text-sm font-medium">
          {NAV_ITEMS.map((i) => (
            <Link key={i.label} to={i.to} className="text-muted-foreground hover:text-foreground transition-colors">
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Buscar"><Search className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Favoritos"><Heart className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Minha conta"><User className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Carrinho"><ShoppingBag className="h-5 w-5" /></Button>
        </div>
      </div>
      {open && (
        <nav className="md:hidden border-t bg-background px-4 py-3 grid gap-2 text-sm">
          {NAV_ITEMS.map((i) => (
            <Link key={i.label} to={i.to} onClick={() => setOpen(false)} className="py-1.5 font-medium">
              {i.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero (banner horizontal baixo — sem imagem placeholder)
// ---------------------------------------------------------------------------

export function StorefrontHero({ storeName }: { storeName?: string }) {
  return (
    <section className="relative border-b">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 md:flex-row md:py-8">
        <div className="text-center md:text-left">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Coleção atual</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            {storeName ?? "Bem-vindo"} — moda autoral para todos os looks
          </h1>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link to="/">Explorar agora</Link>
        </Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Slider de Looks
// ---------------------------------------------------------------------------

const LOOKS = [
  { src: lookCowboy, title: "Look Cowboy", subtitle: "Atitude rústica e contemporânea" },
  { src: lookFeminino, title: "Look Feminino", subtitle: "Leveza e elegância em cada detalhe" },
  { src: lookSocial, title: "Look Social Masculino", subtitle: "Alfaiataria moderna" },
];

export function LooksSlider() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LOOKS.length), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="relative bg-muted/30">
      <div className="relative mx-auto max-w-7xl px-4 py-6">
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl md:aspect-[21/8]">
          {LOOKS.map((look, i) => (
            <div
              key={look.title}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-out",
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
              <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex items-center">
                <div className="px-6 md:px-12 text-white max-w-md">
                  <p className="text-xs uppercase tracking-widest opacity-80">Lookbook</p>
                  <h3 className="mt-1 text-2xl font-bold md:text-4xl">{look.title}</h3>
                  <p className="mt-1 text-sm opacity-90 md:text-base">{look.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {LOOKS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Ir para slide ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === idx ? "w-6 bg-white" : "w-1.5 bg-white/60",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cards das categorias
// ---------------------------------------------------------------------------

export function CategoryCards({ categories }: { categories: StorefrontCategory[] }) {
  // Mostra apenas raízes (sem parent) para a Home
  const roots = categories.filter((c) => !c.parent_id).slice(0, 6);
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      <SectionHeader title="Navegue por categoria" />
      {roots.length === 0 ? (
        <EmptyState message="Nenhuma categoria publicada ainda." hint="Cadastre categorias no painel administrativo." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {roots.map((c) => (
            <Link
              key={c.id}
              to="/"
              className="group relative aspect-square overflow-hidden rounded-xl border bg-gradient-to-br from-muted to-muted/40 transition-shadow hover:shadow-md"
            >
              {c.image_url ? (
                <img src={c.image_url} alt={c.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-3xl text-muted-foreground/50">
                  {c.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <span className="text-sm font-semibold text-white">{c.name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sessões de produtos
// ---------------------------------------------------------------------------

export function ProductSection({
  title, subtitle, products, emptyMessage,
}: { title: string; subtitle?: string; products: StorefrontProduct[]; emptyMessage: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      <SectionHeader title={title} subtitle={subtitle} />
      {products.length === 0 ? (
        <EmptyState message={emptyMessage} hint="Em breve novidades aqui." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </section>
  );
}

function ProductCard({ p }: { p: StorefrontProduct }) {
  return (
    <Link to="/" className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/40">
        <div className="absolute inset-0 grid place-items-center text-muted-foreground/40">
          <Sparkles className="h-8 w-8" />
        </div>
        {(p.on_sale || p.new_product || p.featured) && (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {p.new_product && <Badge tone="primary">Novo</Badge>}
            {p.on_sale && <Badge tone="destructive">Promo</Badge>}
            {p.featured && <Badge tone="default">Destaque</Badge>}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-medium">{p.name}</h3>
        {p.short_description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.short_description}</p>
        )}
      </div>
    </Link>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "primary" | "destructive" | "default" }) {
  const cls = {
    primary: "bg-primary text-primary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    default: "bg-foreground text-background",
  }[tone];
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>{children}</span>;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="text-lg font-bold tracking-tight md:text-xl">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <Link to="/" className="text-xs font-medium text-primary hover:underline">Ver tudo →</Link>
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-muted-foreground/60" />
      <p className="mt-2 text-sm font-medium text-foreground">{message}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rodapé
// ---------------------------------------------------------------------------

export function StorefrontFooter({ storeName = "Loja" }: { storeName?: string }) {
  return (
    <footer className="mt-6 border-t bg-muted/20">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-4">
        <div>
          <p className="text-lg font-bold">{storeName}</p>
          <p className="mt-1 text-sm text-muted-foreground">Moda autoral, entrega para todo o Brasil.</p>
          <div className="mt-3 flex gap-2 text-muted-foreground">
            <a href="#" aria-label="Instagram" className="hover:text-foreground"><Instagram className="h-5 w-5" /></a>
            <a href="#" aria-label="Facebook" className="hover:text-foreground"><Facebook className="h-5 w-5" /></a>
            <a href="#" aria-label="YouTube" className="hover:text-foreground"><Youtube className="h-5 w-5" /></a>
          </div>
        </div>
        <FooterCol title="Institucional" items={["Sobre nós", "Nossa história", "Trabalhe conosco"]} />
        <FooterCol title="Atendimento" items={["Contato", "Trocas e devoluções", "Políticas", "Privacidade"]} />
        <div>
          <p className="text-sm font-semibold">Formas de pagamento</p>
          <div className="mt-2 flex flex-wrap gap-2 text-muted-foreground">
            <Chip><CreditCard className="h-3.5 w-3.5" /> Crédito</Chip>
            <Chip>Pix</Chip>
            <Chip>Boleto</Chip>
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Compra 100% segura
          </p>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {storeName}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i}><a href="#" className="hover:text-foreground">{i}</a></li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs">{children}</span>;
}
