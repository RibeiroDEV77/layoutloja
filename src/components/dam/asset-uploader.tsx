/**
 * AssetUploader — formulário para registrar um asset no DAM.
 *
 * Hoje suporta:
 *  - URLs externas (imagem, vídeo, PDF, SVG)
 *  - YouTube / Vimeo (detectados automaticamente)
 *
 * Quando o bucket `dam` for habilitado, o mesmo componente passará a aceitar
 * upload binário via dropzone — sem mudança de contrato para os consumidores.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, LinkIcon, Upload } from "lucide-react";
import { registerExternalAsset } from "@/lib/business/dam.functions";
import { useActiveStore } from "@/hooks/use-active-store";

type Context = "product" | "category" | "brand" | "collection" | "banner" | "institutional" | "marketing" | "other";

const CONTEXTS: { value: Context; label: string }[] = [
  { value: "product", label: "Produtos" },
  { value: "category", label: "Categorias" },
  { value: "brand", label: "Marcas" },
  { value: "collection", label: "Coleções" },
  { value: "banner", label: "Banners" },
  { value: "institutional", label: "Institucional" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Outros" },
];

export function AssetUploader({
  defaultContext = "other",
  onCreated,
}: {
  defaultContext?: Context;
  onCreated?: (asset: { id: string }) => void;
}) {
  const { storeId } = useActiveStore();
  const [context, setContext] = useState<Context>(defaultContext);
  const [urls, setUrls] = useState("");
  const [title, setTitle] = useState("");
  const [alt, setAlt] = useState("");
  const register = useServerFn(registerExternalAsset);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Selecione uma loja");
      const list = urls.split(/\s+/).map((s) => s.trim()).filter(Boolean);
      if (!list.length) throw new Error("Informe ao menos uma URL");
      const created: { id: string }[] = [];
      for (const u of list) {
        const r = await register({
          data: { store_id: storeId, context, url: u, title: title || undefined, alt_text: alt || undefined },
        });
        if (!r.ok) throw new Error(r.error.message);
        created.push({ id: r.data.id });
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(`${created.length} mídia(s) registrada(s)`);
      setUrls(""); setTitle(""); setAlt("");
      if (created[0]) onCreated?.(created[0]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground flex items-start gap-3">
        <Upload className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          Upload direto de arquivos será habilitado quando o bucket de Storage estiver disponível.
          Por enquanto, registre mídias informando uma <strong>URL pública</strong> (imagem, vídeo, PDF, SVG)
          ou um link de <strong>YouTube/Vimeo</strong>.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Contexto</Label>
          <Select value={context} onValueChange={(v) => setContext(v as Context)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTEXTS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Título (opcional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>ALT (acessibilidade, opcional)</Label>
        <Input value={alt} onChange={(e) => setAlt(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label className="flex items-center gap-1"><LinkIcon className="h-3.5 w-3.5" /> URLs (uma por linha)</Label>
        <Textarea rows={5} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://...&#10;https://youtu.be/..." />
      </div>

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !storeId} className="w-full">
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Registrar no DAM
      </Button>
    </div>
  );
}
