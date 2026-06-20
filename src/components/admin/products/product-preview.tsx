/**
 * Preview em tempo real da página do produto.
 * Lê apenas do React Query — sem fetch direto.
 */
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type Color = Tables<"product_colors">;
type Media = Tables<"product_color_media">;

export function ProductPreview({
  product, colors, mediaByColor,
}: {
  product: Product | null;
  colors: Color[];
  mediaByColor: Record<string, Media[]>;
}) {
  if (!product) return null;
  const defaultColor = colors.find((c) => c.is_default) ?? colors[0] ?? null;
  const media = defaultColor ? mediaByColor[defaultColor.id] ?? [] : [];
  const cover = media.find((m) => m.is_cover) ?? media[0];
  const coverUrl = cover?.external_url || cover?.thumbnail_url || cover?.storage_path || null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="aspect-square bg-muted relative overflow-hidden">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Sem imagem de capa
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg leading-tight">{product.name || "Sem nome"}</h3>
          {product.short_description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.short_description}</p>
          )}
        </div>
        {colors.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Cores ({colors.length})</p>
            <div className="flex gap-1.5 flex-wrap">
              {colors.map((c) => (
                <span
                  key={c.id}
                  title={c.name}
                  className="h-6 w-6 rounded-full border-2 border-white shadow ring-1 ring-border"
                  style={{ background: c.hex ?? "#ccc" }}
                />
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <code className="text-muted-foreground">{product.sku_root}</code>
          <span className="font-medium">{product.status === "published" ? "Publicado" : product.status === "archived" ? "Arquivado" : "Rascunho"}</span>
        </div>
      </div>
    </div>
  );
}
