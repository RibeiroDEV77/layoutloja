/**
 * AssetPicker — modal único usado por qualquer módulo que precise selecionar
 * mídias da biblioteca do DAM ou registrar novas.
 *
 * Uso típico:
 *   <AssetPicker context="product" multiple onSelect={(assets) => ...}>
 *     <Button>Selecionar mídia</Button>
 *   </AssetPicker>
 */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Check } from "lucide-react";
import { listAssets } from "@/lib/business/dam.functions";
import { AssetThumb, type AssetLike } from "./asset-thumb";
import { AssetUploader } from "./asset-uploader";
import { useActiveStore } from "@/hooks/use-active-store";
import { cn } from "@/lib/utils";

type Context = "product" | "category" | "brand" | "collection" | "banner" | "institutional" | "marketing" | "other";

export interface AssetPickerProps {
  context?: Context;
  multiple?: boolean;
  onSelect: (assets: AssetLike[]) => void;
  children: ReactNode;
  triggerLabel?: string;
}

export function AssetPicker({ context, multiple, onSelect, children }: AssetPickerProps) {
  const { storeId } = useActiveStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, AssetLike>>({});
  const list = useServerFn(listAssets);

  const query = useQuery({
    enabled: !!storeId && open,
    queryKey: ["dam", "library", storeId, context, search],
    queryFn: async () => {
      const r = await list({ data: { store_id: storeId!, context, search, status: "active", page_size: 60 } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });

  const toggle = (a: AssetLike) => {
    setSelected((prev) => {
      const has = !!prev[a.id];
      if (!multiple) return has ? {} : { [a.id]: a };
      const next = { ...prev };
      if (has) delete next[a.id]; else next[a.id] = a;
      return next;
    });
  };

  const confirm = () => {
    const arr = Object.values(selected);
    if (!arr.length) return;
    onSelect(arr);
    setSelected({});
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Selecionar mídia</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Biblioteca</TabsTrigger>
            <TabsTrigger value="upload">Enviar nova</TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por título, ALT, arquivo..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="min-h-[300px] max-h-[55vh] overflow-y-auto">
              {query.isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (query.data?.rows ?? []).length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">Nenhum asset encontrado.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {query.data!.rows.map((a) => {
                    const isSel = !!selected[a.id];
                    return (
                      <button key={a.id} type="button" onClick={() => toggle(a)}
                        className={cn("relative text-left group rounded-md ring-2 ring-transparent transition", isSel && "ring-primary")}>
                        <AssetThumb asset={a as AssetLike} />
                        <div className="mt-1 text-xs truncate">{a.title || a.original_filename || a.kind}</div>
                        {isSel && (
                          <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-muted-foreground">{Object.keys(selected).length} selecionada(s)</div>
              <Button onClick={confirm} disabled={!Object.keys(selected).length}>Usar selecionada(s)</Button>
            </div>
          </TabsContent>
          <TabsContent value="upload">
            <AssetUploader defaultContext={context ?? "other"} onCreated={() => query.refetch()} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
