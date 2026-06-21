import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { getStorefrontContext } from '@/lib/business/storefront.functions';
import { getPublicCart } from '@/lib/business/cart-public.functions';
import { useCartUi } from '@/hooks/use-cart-ui';
import { cn } from '@/lib/utils';
import {
  Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetHeader,
} from '@/components/ui/sheet';

const PRIMARY_NAV: Array<{ label: string; slug: string }> = [
  { label: 'Masculino', slug: 'masculino' },
  { label: 'Feminino', slug: 'feminino' },
  { label: 'Infantil', slug: 'infantil' },
  { label: 'Calçados', slug: 'calcados' },
  { label: 'Acessórios', slug: 'acessorios' },
];

export function StoreHeader() {
  const navigate = useNavigate();
  const ctxFn = useServerFn(getStorefrontContext);
  const cartFn = useServerFn(getPublicCart);
  const { data: ctx } = useQuery({
    queryKey: ['storefront', 'context'],
    queryFn: () => ctxFn(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: cart } = useQuery({
    queryKey: ['storefront', 'cart'],
    queryFn: () => cartFn(),
    staleTime: 5 * 1000,
  });
  const openCart = useCartUi((s) => s.open);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const itemsCount = cart?.cart?.items_count ?? 0;
  const storeName = ctx?.store?.name ?? 'Layout';

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearchOpen(false);
    navigate({ to: '/busca', search: { q: search.trim(), page: 1 } });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="hidden border-b border-border bg-foreground/95 px-4 py-1.5 text-center text-[11px] font-medium uppercase tracking-widest-tight text-background md:block">
        Frete grátis acima de R$ 299 · Trocas em até 30 dias
      </div>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Sheet>
          <SheetTrigger asChild>
            <button className="md:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 px-0">
            <SheetHeader className="px-6">
              <SheetTitle className="font-display text-xl">{storeName}</SheetTitle>
              <SheetDescription className="sr-only">Navegação</SheetDescription>
            </SheetHeader>
            <nav className="mt-6 flex flex-col">
              {PRIMARY_NAV.map((n) => (
                <Link
                  key={n.slug}
                  to="/c/$category"
                  params={{ category: n.slug }}
                  className="border-t border-border px-6 py-4 text-sm font-medium uppercase tracking-widest-tight hover:bg-secondary"
                >
                  {n.label}
                </Link>
              ))}
              <Link to="/c/$category" params={{ category: 'promocoes' }} className="border-t border-border px-6 py-4 text-sm font-medium uppercase tracking-widest-tight text-accent hover:bg-secondary">Promoções</Link>
              <Link to="/c/$category" params={{ category: 'novidades' }} className="border-y border-border px-6 py-4 text-sm font-medium uppercase tracking-widest-tight hover:bg-secondary">Novidades</Link>
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/" className="font-display text-xl font-semibold tracking-tight">
          {storeName}
        </Link>

        <nav className="ml-8 hidden flex-1 items-center gap-7 md:flex">
          {PRIMARY_NAV.map((n) => (
            <Link
              key={n.slug}
              to="/c/$category"
              params={{ category: n.slug }}
              className="text-xs font-medium uppercase tracking-widest-tight text-foreground/80 transition hover:text-foreground"
              activeProps={{ className: 'text-foreground' }}
            >
              {n.label}
            </Link>
          ))}
          <Link to="/c/$category" params={{ category: 'promocoes' }} className="text-xs font-medium uppercase tracking-widest-tight text-accent transition hover:opacity-80">
            Promoções
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setSearchOpen((v) => !v)} aria-label="Buscar" className="p-2 hover:bg-secondary">
            <Search className="h-4 w-4" />
          </button>
          <Link to="/auth" className="hidden p-2 hover:bg-secondary md:inline-flex" aria-label="Minha conta">
            <User className="h-4 w-4" />
          </Link>
          <button onClick={openCart} className="relative p-2 hover:bg-secondary" aria-label="Abrir carrinho">
            <ShoppingBag className="h-4 w-4" />
            {itemsCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium text-background">
                {itemsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-border bg-background">
          <form onSubmit={submitSearch} className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="O que você procura?"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button type="button" onClick={() => setSearchOpen(false)} className="p-1" aria-label="Fechar busca">
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </header>
  );
}

export { cn };
