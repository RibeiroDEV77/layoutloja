/**
 * AssetLinksManager — gerencia o vínculo de assets a uma entidade dona
 * (produto, cor, categoria, marca, coleção, banner...). Consome o DAM via
 * server functions; nunca grava direto em Storage.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { listLinksByOwner, linkAsset, unlinkAsset, reorderLinks } from "@/lib/business/dam.functions";
import { AssetPicker } from "./asset-picker";
import { AssetThumb, type AssetLike } from "./asset-thumb";
import { useActiveStore } from "@/hooks/use-active-store";

export function AssetLinksManager({
  ownerType,
  ownerId,
  role = "gallery",
  context,
  title = "Mídias",
}: {
  ownerType: string;
  ownerId: string;
  role?: string;
  context?: "product" | "category" | "brand" | "collection" | "banner" | "institutional" | "marketing" | "other";
  title?: string;
}) {
  const { storeId } = useActiveStore();
  const qc = useQueryClient();
  const list = useServerFn(listLinksByOwner);
  const link = useServerFn(linkAsset);
  const unlink = useServerFn(unlinkAsset);
  const reorder = useServerFn(reorderLinks);

  const key = ["dam", "links", ownerType, ownerId, role];
  const query = useQuery({
    enabled: !!storeId,
    queryKey: key,
    queryFn: async () => {
      const r = await list({ data: { owner_type: ownerType, owner_id: ownerId, store_id: storeId! } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.filter((l) => l.role === role);
    },
  });

  const add = useMutation({
    mutationFn: async (assets: AssetLike[]) => {
      const existing = (query.data ?? []).length;
      for (let i = 0; i < assets.length; i++) {
        const r = await link({ data: { asset_id: assets[i].id, owner_type: ownerType, owner_id: ownerId, role, sort_order: existing + i } });
        if (!r.ok) throw new Error(r.error.message);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Mídia(s) vinculada(s)"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await unlink({ data: { id } });
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Vínculo removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const rows = [...(query.data ?? [])];
      const j = index + dir;
      if (j < 0 || j >= rows.length) return;
      [rows[index], rows[j]] = [rows[j], rows[index]];
      const items = rows.map((r, i) => ({ id: r.id, sort_order: i }));
      const r = await reorder({ data: { items } });
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <AssetPicker context={context} multiple onSelect={(a) => add.mutate(a)}>
          <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </AssetPicker>
      </div>
      {(query.data ?? []).length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded-md p-6 text-center">Nenhuma mídia vinculada.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {(query.data ?? []).map((l, i) => (
            <div key={l.id} className="space-y-1">
              <AssetThumb asset={(l.assets ?? {}) as AssetLike} />
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move.mutate({ index: i, dir: -1 })} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move.mutate({ index: i, dir: 1 })} disabled={i === (query.data!.length - 1)}><ArrowDown className="h-3 w-3" /></Button>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(l.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
