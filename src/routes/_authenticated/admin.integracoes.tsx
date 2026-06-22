import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useActiveStore } from "@/hooks/use-active-store";
import {
  getMelhorEnvioStatus,
  startMelhorEnvioOAuth,
  refreshMelhorEnvioToken,
  disconnectMelhorEnvio,
  calculateMelhorEnvioQuote,
} from "@/lib/business/melhor-envio.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, RefreshCw, Plug, PlugZap, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/integracoes")({
  head: () => ({ meta: [{ title: "Integrações — Admin" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { storeId } = useActiveStore();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="text-muted-foreground text-sm">
          Conectores externos da loja. Toda comunicação ocorre no backend; nenhum
          segredo é exposto ao navegador.
        </p>
      </div>
      {storeId ? <MelhorEnvioCard storeId={storeId} /> : (
        <Alert><AlertTitle>Selecione uma loja</AlertTitle></Alert>
      )}
    </div>
  );
}

function MelhorEnvioCard({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const getStatus = useServerFn(getMelhorEnvioStatus);
  const startOAuth = useServerFn(startMelhorEnvioOAuth);
  const refresh = useServerFn(refreshMelhorEnvioToken);
  const disconnect = useServerFn(disconnectMelhorEnvio);

  const statusQ = useQuery({
    queryKey: ["melhor-envio-status", storeId],
    queryFn: () => getStatus({ data: { store_id: storeId } }),
  });

  // Mostra ?connected=melhor_envio ou ?error=... vindos do callback OAuth.
  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    const err = url.searchParams.get("error");
    if (connected === "melhor_envio") toast.success("Melhor Envio conectado com sucesso");
    else if (err) toast.error(`Falha no OAuth: ${err}`);
    if (connected || err) {
      url.searchParams.delete("connected");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
      qc.invalidateQueries({ queryKey: ["melhor-envio-status", storeId] });
    }
  }, [qc, storeId]);

  const connectMut = useMutation({
    mutationFn: async () => {
      console.log('[ME OAuth CLIENT] step=button_click', { store_id: storeId });
      const r = await startOAuth({ data: { store_id: storeId, return_to: "/admin/integracoes" } });
      console.log('[ME OAuth CLIENT] step=server_fn_returned', { ok: r.ok, has_url: r.ok ? !!r.data?.authorize_url : false, error: !r.ok ? r.error : undefined });
      return r;
    },
    onSuccess: (r) => {
      if (!r.ok) { console.error('[ME OAuth CLIENT] step=server_returned_error', r.error); toast.error(r.error.message); return; }
      console.log('[ME OAuth CLIENT] step=before_redirect', { url: r.data.authorize_url });
      window.location.href = r.data.authorize_url;
    },
    onError: (e) => { console.error('[ME OAuth CLIENT] step=mutation_exception', e); toast.error((e as Error).message); },
  });

  const refreshMut = useMutation({
    mutationFn: async () => refresh({ data: { store_id: storeId } }),
    onSuccess: (r) => {
      if (!r.ok) { toast.error(r.error.message); return; }
      toast.success(`Token renovado. Expira em ${new Date(r.data.expires_at).toLocaleString("pt-BR")}`);
      qc.invalidateQueries({ queryKey: ["melhor-envio-status", storeId] });
    },
  });

  const disconnectMut = useMutation({
    mutationFn: async () => disconnect({ data: { store_id: storeId } }),
    onSuccess: () => {
      toast.success("Melhor Envio desconectado");
      qc.invalidateQueries({ queryKey: ["melhor-envio-status", storeId] });
    },
  });

  const s = statusQ.data?.ok ? statusQ.data.data : null;
  const envOk = s?.env.configured;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Melhor Envio
              {s?.connected ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</Badge>
              ) : (
                <Badge variant="secondary">Desconectado</Badge>
              )}
              {s?.sandbox && <Badge variant="outline">Sandbox</Badge>}
            </CardTitle>
            <CardDescription>
              OAuth 2.0 oficial. Cálculo de frete, geração de etiquetas, rastreamento e webhook.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {s?.connected ? (
              <>
                <Button variant="outline" size="sm" onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
                  {refreshMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2">Atualizar token</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => connectMut.mutate()} disabled={connectMut.isPending || !envOk}>
                  <PlugZap className="h-4 w-4 mr-2" />Reconectar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}>
                  Desconectar
                </Button>
              </>
            ) : (
              <Button onClick={() => connectMut.mutate()} disabled={connectMut.isPending || !envOk}>
                {connectMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plug className="h-4 w-4 mr-2" />}
                Conectar Melhor Envio
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!envOk && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Variáveis de ambiente ausentes</AlertTitle>
            <AlertDescription className="text-sm">
              Configure no painel do projeto: <code>MELHOR_ENVIO_CLIENT_ID</code>,
              {" "}<code>MELHOR_ENVIO_CLIENT_SECRET</code>,
              {" "}<code>MELHOR_ENVIO_REDIRECT_URI</code>,
              {" "}<code>MELHOR_ENVIO_WEBHOOK_SECRET</code>,
              {" "}<code>MELHOR_ENVIO_ENV</code> (sandbox|production).
            </AlertDescription>
          </Alert>
        )}

        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Ambiente" value={s.sandbox ? "Sandbox" : "Produção"} />
            <Info label="Token expira em" value={s.expires_at ? new Date(s.expires_at).toLocaleString("pt-BR") : "—"} />
            <Info label="Última verificação" value={s.last_test_at ? new Date(s.last_test_at).toLocaleString("pt-BR") : "—"} />
            <Info label="Status" value={s.last_test_ok === null ? "—" : s.last_test_ok ? "OK" : "Falha"} />
          </div>
        )}

        {s?.env.redirect_uri && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <div><strong>Redirect URI cadastrado:</strong> <code className="break-all">{s.env.redirect_uri}</code></div>
            <div className="text-muted-foreground">
              Configure essa URL no app Melhor Envio (Painel &rarr; Aplicativos &rarr; Editar).
              Webhook URL: <code>{new URL("/api/public/hooks/melhor-envio-webhook", window.location.origin).toString()}</code>
            </div>
          </div>
        )}

        {s?.connected && <QuoteTester storeId={storeId} />}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}

function QuoteTester({ storeId }: { storeId: string }) {
  const quote = useServerFn(calculateMelhorEnvioQuote);
  const [form, setForm] = useState({
    origin: "01001000", destination: "20040020",
    weight_g: 500, length: 20, width: 15, height: 5, value: 100,
  });
  const m = useMutation({
    mutationFn: async () => quote({ data: {
      store_id: storeId,
      origin_postal_code: form.origin,
      destination_postal_code: form.destination,
      weight_g: form.weight_g,
      declared_value: form.value,
      dimensions_cm: { length: form.length, width: form.width, height: form.height },
    } }),
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = m.data?.ok ? m.data.data : [];

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Testar cotação</h3>
        <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Calcular
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        <Field label="CEP origem"><Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></Field>
        <Field label="CEP destino"><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></Field>
        <Field label="Peso (g)"><Input type="number" value={form.weight_g} onChange={(e) => setForm({ ...form, weight_g: +e.target.value })} /></Field>
        <Field label="C (cm)"><Input type="number" value={form.length} onChange={(e) => setForm({ ...form, length: +e.target.value })} /></Field>
        <Field label="L (cm)"><Input type="number" value={form.width} onChange={(e) => setForm({ ...form, width: +e.target.value })} /></Field>
        <Field label="A (cm)"><Input type="number" value={form.height} onChange={(e) => setForm({ ...form, height: +e.target.value })} /></Field>
        <Field label="Valor (R$)"><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: +e.target.value })} /></Field>
      </div>
      {m.data && !m.data.ok && <Alert variant="destructive"><AlertDescription>{m.data.error.message}</AlertDescription></Alert>}
      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.service_code}>
                <TableCell>{r.service_name}</TableCell>
                <TableCell>R$ {r.price.toFixed(2)}</TableCell>
                <TableCell>{r.estimated_days_min ?? "?"}–{r.estimated_days_max ?? "?"} dias</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label>{children}</div>;
}
