import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Heart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { listMyWishlist, removeFromWishlist } from "@/lib/business/storefront-account.functions";

export const Route = createFileRoute("/minha-conta/favoritos")({
  component: WishlistPage,
});

function WishlistPage() {
  const { ctx } = useAuth();
  const userId = ctx?.authenticated ? ctx.user_id : undefined;
  const fetchList = useServerFn(listMyWishlist);
  const remove = useServerFn(removeFromWishlist);
  const qc = useQueryClient();

  const wishlistKey = ["account", userId ?? "anon", "wishlist"] as const;

  const { data, isLoading } = useQuery({
    queryKey: wishlistKey,
    queryFn: () => fetchList(),
    enabled: !!userId,
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: wishlistKey });
    },
  });

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-900">Favoritos</h2>
      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : !data || data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center">
            <Heart className="mx-auto h-8 w-8 text-zinc-400" />
            <p className="mt-2 text-sm text-zinc-500">Nenhum favorito ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
            {data.map((it: any) => (
              <li key={it.id} className="flex items-center justify-between p-3">
                <Link
                  to="/produto/$slug"
                  params={{ slug: it.products?.slug ?? "" }}
                  className="text-sm text-zinc-900 hover:underline"
                >
                  {it.products?.name ?? "Produto"}
                </Link>
                <Button size="icon" variant="ghost" onClick={() => removeMut.mutate(it.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
