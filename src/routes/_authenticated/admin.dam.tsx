/**
 * Biblioteca de Mídias do DAM — listagem, filtros, ações.
 *
 * Toda a infraestrutura central de mídias do sistema. Demais módulos
 * (produtos, categorias, marcas, coleções, banners, institucional, marketing)
 * consomem assets daqui via `<AssetPicker />` ou `<AssetLinksManager />`.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Archive, ArchiveRestore, Trash2, Save } from "lucide-react";
import { usePageBreadcrumbs } from "@/components/admin/breadcrumb-context";
import { useActiveStore } from "@/hooks/use-active-store";
import { AssetThumb, type AssetLike } from "@/components/dam/asset-thumb";
import { AssetUploader } from "@/components/dam/asset-uploader";
import {
  listAssets, getAssetUsage, updateAssetMeta, archiveAsset, restoreAsset, deleteAsset,
} from "@/lib/business/dam.functions";

export const Route = createFileRoute("/_authenticated/admin/dam")({
  head: () => ({ meta: [{ title: "Biblioteca de Mídias — Admin" }] }),
  component: DAMPage,
});

type Ctx = "product" | "category" | "brand" | "collection" | "banner" | "institutional" | "marketing" | "other";
type Status = "active" | "archived";

const CONTEXTS: { value: Ctx | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "product", label: "Produtos" },
  { value: "category", label: "Categorias" },
  { value: "brand", label: "Marcas" },
  { value: "collection", label: "Coleções" },
  { value: "banner", label: "Banners" },
  { value: "institutional", label: "Institucional" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Outros" },
];

function DAMPage() {
  usePageBreadcrumbs([{ label: "Mídias" }, { label: "Biblioteca" }]);
  const { storeId } = useActiveStore();
  const qc = useQueryClient();
  const [context, setContext] = useState<Ctx | "all">("all");
  const [status, setStatus] = useState<Status>("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useServerFn(listAssets);
  const query = useQuery({
    enabled: !!storeId,
    queryKey: ["dam", "list", storeId, context, status, search],
    queryFn: async () => {
      const r = await list({
        data: {
          store_id: storeId!,
          context: context === "all" ? undefined : context,
          status,
          search,
          page_size: 96,
        },
      });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dam"] });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Biblioteca de Mídias</h1>
          <p className="text-sm text-muted-foreground">Centraliza todos os ativos digitais usados pelo sistema. Nenhum módulo envia arquivos diretamente — tudo passa por aqui.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Enviar nova mídia</CardTitle></CardHeader>
          <CardContent>
            <AssetUploader onCreated={invalidate} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {CONTEXTS.map((c) => (
                <Button key={c.value} size="sm" variant={context === c.value ? "default" : "outline"} onClick={() => setContext(c.value)}>{c.label}</Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
                <TabsList>
                  <TabsTrigger value="active">Ativas</TabsTrigger>
                  <TabsTrigger value="archived">Arquivadas</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar mídias..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {query.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (query.data?.rows ?? []).length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">Nenhuma mídia encontrada.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {query.data!.rows.map((a) => (
                <button key={a.id} type="button" onClick={() => setSelectedId(a.id)} className="text-left group">
                  <AssetThumb asset={a as AssetLike} />
                  <div className="mt-1 text-xs truncate">{a.title || a.original_filename || a.kind}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px] py-0 px-1">{a.kind}</Badge>
                    <Badge variant="outline" className="text-[10px] py-0 px-1">{a.context}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
          {query.data && <div className="mt-3 text-xs text-muted-foreground">{query.data.total} mídia(s)</div>}
        </CardContent>
      </Card>

      {selectedId && <AssetDetail id={selectedId} onClose={() => setSelectedId(null)} onChanged={invalidate} />}
    </div>
  );
}

function AssetDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const usage = useServerFn(getAssetUsage);
  const update = useServerFn(updateAssetMeta);
  const archive = useServerFn(archiveAsset);
  const restore = useServerFn(restoreAsset);
  const del = useServerFn(deleteAsset);

  const q = useQuery({
    queryKey: ["dam", "asset", id],
    queryFn: async () => {
      const r = await usage({ data: { id } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });

  const [form, setForm] = useState<{ title: string; alt_text: string; description: string; context: Ctx } | null>(null);
  useMemo(() => {
    // Lazy init from server data
  }, []);
  // Inicializa form quando dados chegarem
  if (q.data && !form) {
    // hack mínimo: faz uma fetch separada do asset para ter campos
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const r = await update({ data: { id, title: form.title, alt_text: form.alt_text, description: form.description, context: form.context } });
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: () => { toast.success("Salvo"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const doArchive = useMutation({
    mutationFn: async () => { const r = await archive({ data: { id } }); if (!r.ok) throw new Error(r.error.message); },
    onSuccess: () => { toast.success("Arquivado"); onChanged(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const doRestore = useMutation({
    mutationFn: async () => { const r = await restore({ data: { id } }); if (!r.ok) throw new Error(r.error.message); },
    onSuccess: () => { toast.success("Restaurado"); onChanged(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const doDelete = useMutation({
    mutationFn: async () => { const r = await del({ data: { id } }); if (!r.ok) throw new Error(r.error.message); },
    onSuccess: () => { toast.success("Excluído"); onChanged(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>Detalhes do asset</SheetTitle></SheetHeader>
        {q.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4 mt-4">
            <AssetMetaForm id={id} form={form} setForm={setForm} />
            <Button onClick={() => save.mutate()} disabled={!form || save.isPending} className="w-full">
              <Save className="h-4 w-4 mr-1" /> Salvar metadados
            </Button>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Utilização ({q.data?.count ?? 0})</h4>
              {(q.data?.links ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Não está sendo usado em nenhuma entidade.</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {q.data!.links.map((l) => (
                    <li key={l.id} className="flex items-center justify-between border rounded px-2 py-1">
                      <span><Badge variant="outline" className="mr-1">{l.owner_type}</Badge> {l.role}</span>
                      <code className="text-xs text-muted-foreground">{l.owner_id.slice(0, 8)}…</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => doArchive.mutate()}><Archive className="h-4 w-4 mr-1" /> Arquivar</Button>
              <Button variant="outline" onClick={() => doRestore.mutate()}><ArchiveRestore className="h-4 w-4 mr-1" /> Restaurar</Button>
              <Button variant="destructive" onClick={() => doDelete.mutate()} disabled={(q.data?.count ?? 0) > 0}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            </div>
            {(q.data?.count ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">A exclusão é bloqueada porque o asset está vinculado.</p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AssetMetaForm({
  id,
  form,
  setForm,
}: {
  id: string;
  form: { title: string; alt_text: string; description: string; context: Ctx } | null;
  setForm: (f: { title: string; alt_text: string; description: string; context: Ctx }) => void;
}) {
  const fn = useServerFn(getAsset);
  const q = useQuery({
    queryKey: ["dam", "asset-meta", id],
    queryFn: async () => {
      const r = await fn({ data: { id } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });
  if (q.data && !form) {
    setForm({
      title: q.data.title ?? "",
      alt_text: q.data.alt_text ?? "",
      description: q.data.description ?? "",
      context: q.data.context as Ctx,
    });
  }
  if (!form) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  return (
    <>
      {q.data && (
        <div className="flex justify-center"><div className="w-48"><AssetThumb asset={q.data as AssetLike} /></div></div>
      )}
      <div className="space-y-1"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="space-y-1"><Label>ALT</Label><Input value={form.alt_text} onChange={(e) => setForm({ ...form, alt_text: e.target.value })} /></div>
      <div className="space-y-1"><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="space-y-1">
        <Label>Contexto</Label>
        <Select value={form.context} onValueChange={(v) => setForm({ ...form, context: v as Ctx })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONTEXTS.filter((c) => c.value !== "all").map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
