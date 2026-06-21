import { Link } from '@tanstack/react-router';
import type { StorefrontProductCard } from '@/lib/business/services/storefront.server';
import { formatBRL } from '@/lib/storefront/format';
import { cn } from '@/lib/utils';

export function ProductCard({ product, className }: { product: StorefrontProductCard; className?: string }) {
  const hasSale = product.list_price_from != null && product.price_from != null && product.list_price_from > product.price_from;
  return (
    <Link
      to="/p/$slug"
      params={{ slug: product.slug }}
      className={cn('group block', className)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-widest-tight text-muted-foreground">
            Sem imagem
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1">
          {product.on_sale && (
            <span className="bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest-tight text-accent-foreground">
              Promo
            </span>
          )}
          {product.new_product && (
            <span className="bg-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest-tight text-background">
              Novo
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="line-clamp-1 text-sm font-medium">{product.name}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-sm">{formatBRL(product.price_from)}</span>
          {hasSale && (
            <span className="text-xs text-muted-foreground line-through">{formatBRL(product.list_price_from)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: StorefrontProductCard[] }) {
  if (!products.length) {
    return (
      <div className="border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        Nenhum produto disponível.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
