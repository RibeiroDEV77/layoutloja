import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowLeft, Pin, Trash2, Plus, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  getCustomer360, getCustomerTimeline,
  addCustomerNote, updateCustomerNote, deleteCustomerNote,
  listCustomerTags, upsertCustomerTag, assignCustomerTags,
  updateCustomerConsents, recomputeCustomerScore,
} from '@/lib/business/customers.functions';

export const Route = createFileRoute('/_authenticated/admin/customers/$customerId')({
  head: () => ({ meta: [{ title: 'Cliente 360° — Admin' }] }),
  component: CustomerDetailPage,
});

const CONSENT_LABELS: Record<string, string> = {
  marketing_email: 'Marketing por E-mail',
  marketing_sms: 'Marketing por SMS',
  marketing_whatsapp: 'Marketing por WhatsApp',
  data_processing: 'Processamento de dados (LGPD)',
};

function CustomerDetailPage() {
  const { customerId } = useParams({ from: '/_authenticated/admin/customers/$customerId' });
  const get360 = useServerFn(getCustomer360);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customer-360', customerId],
    queryFn: () => get360({ data: { customer_id: customerId } }),
  });

  if (isLoading || !data) {
    return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32" /></div>;
  }

  const c = data.customer as Record<string, unknown> | null;
  if (!c) return <div className="p-6">Cliente não encontrado.</div>;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/customers"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{String(c.name ?? '—')}</h1>
            <p className="text-sm text-muted-foreground">
              {String(c.type).toUpperCase()} · {String(c.status)} · {String(c.segment ?? '')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Score: {Number(c.score ?? 0)}</Badge>
          <Badge variant="outline">Crédito: R$ {Number(data.credit_balance ?? 0).toFixed(2)}</Badge>
          {(data.tags ?? []).map((t) => t && (
            <Badge key={(t as { id: string }).id} variant="secondary">{(t as { name: string }).name}</Badge>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão 360°</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="consents">Consentimentos</TabsTrigger>
          <TabsTrigger value="addresses">Endereços</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab data={data} onRefresh={refetch} /></TabsContent>
        <TabsContent value="timeline"><TimelineTab customerId={customerId} /></TabsContent>
        <TabsContent value="notes"><NotesTab customerId={customerId} notes={data.notes ?? []} onChange={refetch} /></TabsContent>
        <TabsContent value="tags"><TagsTab customerId={customerId} storeId={data.store_id} current={(data.tags ?? []).filter(Boolean) as Array<{ id: string; name: string }>} onChange={refetch} /></TabsContent>
        <TabsContent value="consents"><ConsentsTab customerId={customerId} customer={c} consents={data.consents ?? []} onChange={refetch} /></TabsContent>
        <TabsContent value="addresses"><AddressesTab addresses={data.addresses ?? []} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ data, onRefresh }: { data: Awaited<ReturnType<typeof getCustomer360>>; onRefresh: () => void }) {
  const recompute = useServerFn(recomputeCustomerScore);
  const m = useMutation({
    mutationFn: (id: string) => recompute({ data: { customer_id: id } }),
    onSuccess: () => { toast.success('Score recalculado'); onRefresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const c = data.customer as Record<string, unknown>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div><b>Email:</b> {String(c.email ?? '—')}</div>
          <div><b>Telefone:</b> {String(c.phone ?? '—')}</div>
          <div><b>Documento:</b> {String(c.doc_number ?? '—')}</div>
          <div><b>Código:</b> {String(c.code ?? '—')}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Customer Score</CardTitle>
          <Button size="sm" variant="outline" onClick={() => m.mutate(String(c.id))} disabled={m.isPending}>
            <RefreshCw className="h-4 w-4 mr-1" />Recalcular
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="text-2xl font-bold mb-2">{Number(c.score ?? 0)}</div>
          {(data.factors ?? []).map((f) => (
            <div key={f.id} className="flex justify-between border-b py-1">
              <span>{f.factor_code}</span>
              <span className={Number(f.value) < 0 ? 'text-destructive' : 'text-foreground'}>{Number(f.value) > 0 ? '+' : ''}{Number(f.value)}</span>
            </div>
          ))}
          {(data.factors ?? []).length === 0 && <div className="text-muted-foreground">Sem fatores. Clique em Recalcular.</div>}
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Endereços ({(data.addresses ?? []).length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(data.addresses ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b py-2">
              <div>{a.street}, {a.number ?? 's/n'} — {a.city}/{a.state}</div>
              {a.latitude != null ? <Badge variant="secondary">Geocoded</Badge> : <Badge variant="outline">Sem geo</Badge>}
            </div>
          ))}
          {(data.addresses ?? []).length === 0 && <div className="text-muted-foreground">Nenhum endereço cadastrado.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineTab({ customerId }: { customerId: string }) {
  const fn = useServerFn(getCustomerTimeline);
  const { data } = useQuery({
    queryKey: ['customer-timeline', customerId],
    queryFn: () => fn({ data: { customer_id: customerId, limit: 50 } }),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {(data?.rows ?? []).map((e) => (
          <div key={e.event_id} className="flex items-start gap-3 border-b py-2 text-sm">
            <Badge variant="outline" className="shrink-0">{e.source}</Badge>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{e.kind}</div>
              <div className="text-xs text-muted-foreground">{new Date(e.occurred_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
        {(!data || data.rows.length === 0) && <div className="text-muted-foreground text-sm">Sem eventos.</div>}
      </CardContent>
    </Card>
  );
}

function NotesTab({ customerId, notes, onChange }: { customerId: string; notes: Array<Record<string, unknown>>; onChange: () => void }) {
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const add = useServerFn(addCustomerNote);
  const upd = useServerFn(updateCustomerNote);
  const del = useServerFn(deleteCustomerNote);
  const qc = useQueryClient();
  const refresh = () => { onChange(); qc.invalidateQueries({ queryKey: ['customer-360', customerId] }); };
  return (
    <Card>
      <CardHeader><CardTitle>Notas internas</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Nova nota…" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Switch checked={pinned} onCheckedChange={setPinned} /><Label>Fixar</Label></div>
            <Button size="sm" onClick={async () => {
              if (!body.trim()) return;
              try { await add({ data: { customer_id: customerId, body, pinned } }); setBody(''); setPinned(false); refresh(); toast.success('Nota adicionada'); }
              catch (e) { toast.error((e as Error).message); }
            }}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
          </div>
        </div>
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={String(n.id)} className="border rounded p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{new Date(String(n.created_at)).toLocaleString()}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={async () => { await upd({ data: { id: String(n.id), pinned: !n.pinned } }); refresh(); }}>
                    <Pin className={`h-4 w-4 ${n.pinned ? 'fill-current' : ''}`} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm('Excluir nota?')) { await del({ data: { id: String(n.id) } }); refresh(); } }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="whitespace-pre-wrap">{String(n.body)}</div>
            </div>
          ))}
          {notes.length === 0 && <div className="text-muted-foreground text-sm">Sem notas.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function TagsTab({ customerId, storeId, current, onChange }: { customerId: string; storeId: string; current: Array<{ id: string; name: string }>; onChange: () => void }) {
  const listFn = useServerFn(listCustomerTags);
  const upsertFn = useServerFn(upsertCustomerTag);
  const assignFn = useServerFn(assignCustomerTags);
  const { data: catalog, refetch } = useQuery({
    queryKey: ['customer-tags', storeId],
    queryFn: () => listFn({ data: { store_id: storeId } }),
  });
  const [newTag, setNewTag] = useState('');
  const selected = new Set(current.map((t) => t.id));

  const toggle = async (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    await assignFn({ data: { customer_id: customerId, tag_ids: Array.from(next) } });
    onChange();
  };
  return (
    <Card>
      <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Nova tag…" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
          <Button onClick={async () => {
            if (!newTag.trim()) return;
            try { await upsertFn({ data: { store_id: storeId, name: newTag } }); setNewTag(''); refetch(); toast.success('Tag criada'); }
            catch (e) { toast.error((e as Error).message); }
          }}>Criar</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(catalog ?? []).map((t) => (
            <Badge key={t.id} variant={selected.has(t.id) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggle(t.id)}>
              {t.name}
            </Badge>
          ))}
          {(!catalog || catalog.length === 0) && <span className="text-sm text-muted-foreground">Nenhuma tag no catálogo.</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ConsentsTab({ customerId, customer, consents, onChange }:
  { customerId: string; customer: Record<string, unknown>; consents: Array<Record<string, unknown>>; onChange: () => void }) {
  const fn = useServerFn(updateCustomerConsents);
  const channels = ['marketing_email', 'marketing_sms', 'marketing_whatsapp', 'data_processing'] as const;
  const colMap: Record<typeof channels[number], string> = {
    marketing_email: 'consent_marketing_email',
    marketing_sms: 'consent_marketing_sms',
    marketing_whatsapp: 'consent_marketing_whatsapp',
    data_processing: 'consent_data_processing',
  };
  const update = async (ch: typeof channels[number], granted: boolean) => {
    try { await fn({ data: { customer_id: customerId, consents: { [ch]: granted } } }); onChange(); toast.success('Consentimento atualizado'); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Consentimentos LGPD</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {channels.map((ch) => (
            <div key={ch} className="flex items-center justify-between">
              <Label>{CONSENT_LABELS[ch]}</Label>
              <Switch checked={!!customer[colMap[ch]]} onCheckedChange={(v) => update(ch, v)} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm max-h-96 overflow-auto">
          {consents.map((c) => (
            <div key={String(c.id)} className="flex justify-between border-b py-1">
              <span>{String(c.channel)} → {c.granted ? 'concedido' : 'revogado'}</span>
              <span className="text-xs text-muted-foreground">{new Date(String(c.created_at)).toLocaleString()}</span>
            </div>
          ))}
          {consents.length === 0 && <div className="text-muted-foreground">Sem histórico.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function AddressesTab({ addresses }: { addresses: Array<Record<string, unknown>> }) {
  return (
    <Card>
      <CardHeader><CardTitle>Endereços</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {addresses.map((a) => (
          <div key={String(a.id)} className="border rounded p-3 text-sm space-y-1">
            <div className="font-medium">{String(a.label ?? a.type ?? 'Endereço')}</div>
            <div>{String(a.street ?? '')}, {String(a.number ?? 's/n')} — {String(a.neighborhood ?? '')}</div>
            <div>{String(a.city ?? '')}/{String(a.state ?? '')} — CEP {String(a.postal_code ?? '')}</div>
            <div className="flex items-center gap-2 pt-1">
              {a.latitude != null ? (
                <Badge variant="secondary">Geo: {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)} ({String(a.geocode_precision ?? '')})</Badge>
              ) : (
                <Badge variant="outline">Sem geolocalização</Badge>
              )}
            </div>
          </div>
        ))}
        {addresses.length === 0 && <div className="text-muted-foreground text-sm">Nenhum endereço.</div>}
      </CardContent>
    </Card>
  );
}
