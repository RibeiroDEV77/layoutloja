/**
 * AssetUploader — registra mídias no DAM.
 *
 * Suporta dois modos no mesmo componente:
 *  1) Upload binário (arquivos do computador) → bucket `dam` via signed URL.
 *  2) URL externa (imagem, vídeo, PDF, SVG, YouTube, Vimeo).
 *
 * Toda a infraestrutura de Assets / Upload Jobs / RLS / Outbox / Audit
 * continua sendo a mesma — apenas o caminho do binário foi habilitado.
 */
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, LinkIcon, Upload, X } from "lucide-react";
import {
  registerExternalAsset,
  createUploadJob,
  signUploadJob,
  completeUploadJob,
  failUploadJob,
} from "@/lib/business/dam.functions";
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

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "signing" | "uploading" | "finalizing" | "done" | "error";
  error?: string;
  assetId?: string;
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText}`)));
    xhr.onerror = () => reject(new Error("Falha de rede ao enviar arquivo"));
    xhr.send(file);
  });
}

async function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return {};
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({}); };
    img.src = url;
  });
}

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
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const registerExternal = useServerFn(registerExternalAsset);
  const createJob = useServerFn(createUploadJob);
  const signJob = useServerFn(signUploadJob);
  const completeJob = useServerFn(completeUploadJob);
  const failJob = useServerFn(failUploadJob);

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  async function uploadOne(item: UploadItem) {
    if (!storeId) return;
    try {
      updateItem(item.id, { status: "signing", progress: 0 });
      const created = await createJob({
        data: {
          store_id: storeId,
          context,
          filename: item.file.name,
          size_bytes: item.file.size,
          mime: item.file.type || undefined,
        },
      });
      if (!created.ok) throw new Error(created.error.message);
      const jobId = created.data.job_id;

      const signed = await signJob({ data: { job_id: jobId } });
      if (!signed.ok) throw new Error(signed.error.message);

      updateItem(item.id, { status: "uploading" });
      try {
        await putWithProgress(signed.data.url, item.file, (p) => updateItem(item.id, { progress: p }));
      } catch (e) {
        await failJob({ data: { job_id: jobId, error: (e as Error).message } });
        throw e;
      }

      updateItem(item.id, { status: "finalizing", progress: 100 });
      const dims = await readImageDimensions(item.file);
      const finished = await completeJob({
        data: {
          job_id: jobId,
          size_bytes: item.file.size,
          mime: item.file.type || undefined,
          width: dims.width,
          height: dims.height,
          title: title || undefined,
          alt_text: alt || undefined,
        },
      });
      if (!finished.ok) throw new Error(finished.error.message);

      updateItem(item.id, { status: "done", assetId: finished.data.id });
      onCreated?.({ id: finished.data.id });
    } catch (e) {
      updateItem(item.id, { status: "error", error: (e as Error).message });
      toast.error(`${item.file.name}: ${(e as Error).message}`);
    }
  }

  function enqueueFiles(files: FileList | File[]) {
    if (!storeId) {
      toast.error("Selecione uma loja");
      return;
    }
    const arr = Array.from(files);
    const queued: UploadItem[] = arr.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      progress: 0,
      status: "queued",
    }));
    setItems((prev) => [...prev, ...queued]);
    // Faz upload em paralelo (até 3 simultâneos)
    let active = 0;
    const queue = [...queued];
    const next = () => {
      while (active < 3 && queue.length) {
        const it = queue.shift()!;
        active++;
        uploadOne(it).finally(() => { active--; next(); });
      }
    };
    next();
  }

  const externalMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Selecione uma loja");
      const list = urls.split(/\s+/).map((s) => s.trim()).filter(Boolean);
      if (!list.length) throw new Error("Informe ao menos uma URL");
      const created: { id: string }[] = [];
      for (const u of list) {
        const r = await registerExternal({
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

      {/* Dropzone de upload binário */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          if (e.dataTransfer.files?.length) enqueueFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-muted-foreground/60"
        }`}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <div className="text-sm font-medium">Arraste arquivos ou clique para selecionar</div>
        <div className="text-xs text-muted-foreground mt-1">
          Imagens, vídeos, PDFs, SVG — múltiplos arquivos suportados
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) enqueueFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded border p-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{it.file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(it.file.size / 1024).toFixed(0)} KB ·{" "}
                  {it.status === "queued" && "Na fila"}
                  {it.status === "signing" && "Preparando…"}
                  {it.status === "uploading" && `Enviando ${it.progress}%`}
                  {it.status === "finalizing" && "Finalizando…"}
                  {it.status === "done" && "Concluído"}
                  {it.status === "error" && <span className="text-destructive">{it.error}</span>}
                </div>
                {(it.status === "uploading" || it.status === "finalizing") && (
                  <Progress value={it.progress} className="h-1 mt-1" />
                )}
              </div>
              {it.status === "done" && <span className="text-xs text-emerald-600">✓</span>}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-4 space-y-2">
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-xs"><LinkIcon className="h-3.5 w-3.5" /> Ou registre URLs externas (uma por linha)</Label>
          <Textarea rows={3} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://...&#10;https://youtu.be/..." />
        </div>
        <Button onClick={() => externalMutation.mutate()} disabled={externalMutation.isPending || !storeId || !urls.trim()} variant="outline" className="w-full">
          {externalMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Registrar URLs no DAM
        </Button>
      </div>
    </div>
  );
}
