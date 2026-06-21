import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useActiveStore } from "@/hooks/use-active-store";
import {
  listShippingZones, createShippingZone, addShippingPostalRange,
  listShippingMethods, createShippingMethod, listShippingRates, createShippingRate,
} from "@/lib/business/shipping.functions";
import {
  listShippingProviders, listShippingCarrierAccounts, createShippingCarrierAccount,
  updateShippingCarrierAccount, deleteShippingCarrierAccount,
  setShippingCarrierCredentials, testShippingCarrierAccount,
} from "@/lib/business/shipping-carriers.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/shipping")({
  head: () => ({ meta: [{ title: "Expedição — Admin" }] }),
  component: ShippingPage,
});

function ShippingPage() {
  const { storeId } = useActiveStore();
  const qc = useQueryClient();

  const lz = useServerFn(listShippingZones);
  const cz = useServerFn(createShippingZone);
  const apr = useServerFn(addShippingPostalRange);
  const lm = useServerFn(listShippingMethods);
  const cm = useServerFn(createShippingMethod);
  const lr = useServerFn(listShippingRates);
  const cr = useServerFn(createShippingRate);

  const zones = useQuery({ queryKey: ["shipping-zones", storeId], queryFn: () => lz({ data: { store_id: storeId! } }), enabled: !!storeId });
  const methods = useQuery({ queryKey: ["shipping-methods", storeId], queryFn: () => lm({ data: { store_id: storeId! } }), enabled: !!storeId });
  const rates = useQuery({ queryKey: ["shipping-rates", storeId], queryFn: () => lr({ data: { store_id: storeId! } }), enabled: !!storeId });

  const zonesData = zones.data?.ok ? zones.data.data : [];
  const methodsData = methods.data?.ok ? methods.data.data : [];
  const ratesData = rates.data?.ok ? rates.data.data : [];

  // forms
  const [zoneForm, setZoneForm] = useState({ name: "", states: "" });
  const [rangeForm, setRangeForm] = useState({ zone_id: "", postal_from: "", postal_to: "" });
  const [methodForm, setMethodForm] = useState({ code: "", name: "", kind: "flat", carrier: "", emin: 1, emax: 10 });
  const [rateForm, setRateForm] = useState({ zone_id: "", method_id: "", min_weight_g: 0, max_weight_g: "", price: 0, free_above_subtotal: "" });

  const inv = (k: string) => qc.invalidateQueries({ queryKey: [k] });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Expedição</h1>
        <p className="text-muted-foreground text-sm">Zonas, métodos e tarifas. Adapter layer pronta para Correios/Melhor Envio.</p>
      </div>

      <Tabs defaultValue="zones">
        <TabsList>
          <TabsTrigger value="zones">Zonas</TabsTrigger>
          <TabsTrigger value="methods">Métodos</TabsTrigger>
          <TabsTrigger value="rates">Tarifas</TabsTrigger>
          <TabsTrigger value="providers">Transportadoras</TabsTrigger>
        </TabsList>

        <TabsContent value="zones" className="space-y-4">
          <Card><CardHeader><CardTitle>Nova zona</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div><Label>Nome</Label><Input value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} /></div>
              <div><Label>Estados (CSV)</Label><Input value={zoneForm.states} onChange={(e) => setZoneForm({ ...zoneForm, states: e.target.value })} placeholder="SP,RJ" /></div>
              <div className="flex items-end"><Button onClick={async () => {
                const r = await cz({ data: { store_id: storeId!, name: zoneForm.name, states: zoneForm.states.split(",").map((s) => s.trim()).filter(Boolean) } });
                if (r.ok) { toast.success("Zona criada"); inv("shipping-zones"); setZoneForm({ name: "", states: "" }); }
                else toast.error(r.error.message);
              }}>Criar</Button></div>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Adicionar faixa de CEP</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-4 gap-3">
              <div><Label>Zona</Label>
                <Select value={rangeForm.zone_id} onValueChange={(v) => setRangeForm({ ...rangeForm, zone_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{zonesData.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>CEP de</Label><Input value={rangeForm.postal_from} onChange={(e) => setRangeForm({ ...rangeForm, postal_from: e.target.value })} /></div>
              <div><Label>CEP até</Label><Input value={rangeForm.postal_to} onChange={(e) => setRangeForm({ ...rangeForm, postal_to: e.target.value })} /></div>
              <div className="flex items-end"><Button onClick={async () => {
                const r = await apr({ data: rangeForm });
                if (r.ok) { toast.success("Faixa adicionada"); inv("shipping-zones"); }
                else toast.error(r.error.message);
              }}>Adicionar</Button></div>
            </CardContent>
          </Card>

          <Card><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Zona</TableHead><TableHead>Estados</TableHead><TableHead>Faixas CEP</TableHead></TableRow></TableHeader>
              <TableBody>{zonesData.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.name}</TableCell>
                  <TableCell>{(z.states ?? []).join(", ") || "—"}</TableCell>
                  <TableCell className="text-xs">{(z.shipping_zone_postal_ranges ?? []).map((r) => `${r.postal_from}–${r.postal_to}`).join(", ") || "—"}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="methods" className="space-y-4">
          <Card><CardHeader><CardTitle>Novo método</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-6 gap-3">
              <div><Label>Código</Label><Input value={methodForm.code} onChange={(e) => setMethodForm({ ...methodForm, code: e.target.value })} /></div>
              <div><Label>Nome</Label><Input value={methodForm.name} onChange={(e) => setMethodForm({ ...methodForm, name: e.target.value })} /></div>
              <div><Label>Tipo</Label>
                <Select value={methodForm.kind} onValueChange={(v) => setMethodForm({ ...methodForm, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Plano</SelectItem><SelectItem value="free">Grátis</SelectItem>
                    <SelectItem value="carrier">Transportadora</SelectItem><SelectItem value="pickup">Retirada</SelectItem>
                    <SelectItem value="table">Tabela</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Carrier</Label><Input value={methodForm.carrier} onChange={(e) => setMethodForm({ ...methodForm, carrier: e.target.value })} /></div>
              <div><Label>Dias min</Label><Input type="number" value={methodForm.emin} onChange={(e) => setMethodForm({ ...methodForm, emin: Number(e.target.value) })} /></div>
              <div className="flex items-end gap-2"><Input type="number" value={methodForm.emax} onChange={(e) => setMethodForm({ ...methodForm, emax: Number(e.target.value) })} />
                <Button onClick={async () => {
                  const r = await cm({ data: { store_id: storeId!, code: methodForm.code, name: methodForm.name, kind: methodForm.kind as "carrier" | "flat" | "free" | "pickup" | "table", carrier: methodForm.carrier || undefined, estimated_days_min: methodForm.emin, estimated_days_max: methodForm.emax } });
                  if (r.ok) { toast.success("Método criado"); inv("shipping-methods"); }
                  else toast.error(r.error.message);
                }}>Criar</Button>
              </div>
            </CardContent>
          </Card>

          <Card><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Carrier</TableHead><TableHead>Prazo</TableHead></TableRow></TableHeader>
              <TableBody>{methodsData.map((m) => (
                <TableRow key={m.id}>
                  <TableCell><code>{m.code}</code></TableCell><TableCell>{m.name}</TableCell>
                  <TableCell>{m.kind}</TableCell><TableCell>{m.carrier ?? "—"}</TableCell>
                  <TableCell>{m.estimated_days_min ?? "—"}–{m.estimated_days_max ?? "—"} dias</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rates" className="space-y-4">
          <Card><CardHeader><CardTitle>Nova tarifa</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-6 gap-3">
              <div><Label>Zona</Label>
                <Select value={rateForm.zone_id} onValueChange={(v) => setRateForm({ ...rateForm, zone_id: v })}>
                  <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent>{zonesData.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Método</Label>
                <Select value={rateForm.method_id} onValueChange={(v) => setRateForm({ ...rateForm, method_id: v })}>
                  <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent>{methodsData.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Peso min (g)</Label><Input type="number" value={rateForm.min_weight_g} onChange={(e) => setRateForm({ ...rateForm, min_weight_g: Number(e.target.value) })} /></div>
              <div><Label>Peso max (g)</Label><Input type="number" value={rateForm.max_weight_g} onChange={(e) => setRateForm({ ...rateForm, max_weight_g: e.target.value })} /></div>
              <div><Label>Preço</Label><Input type="number" value={rateForm.price} onChange={(e) => setRateForm({ ...rateForm, price: Number(e.target.value) })} /></div>
              <div className="flex items-end gap-2">
                <Input type="number" placeholder="grátis acima" value={rateForm.free_above_subtotal} onChange={(e) => setRateForm({ ...rateForm, free_above_subtotal: e.target.value })} />
                <Button onClick={async () => {
                  const r = await cr({ data: {
                    store_id: storeId!, zone_id: rateForm.zone_id, method_id: rateForm.method_id,
                    min_weight_g: rateForm.min_weight_g,
                    max_weight_g: rateForm.max_weight_g ? Number(rateForm.max_weight_g) : null,
                    price: rateForm.price,
                    free_above_subtotal: rateForm.free_above_subtotal ? Number(rateForm.free_above_subtotal) : null,
                  } });
                  if (r.ok) { toast.success("Tarifa criada"); inv("shipping-rates"); }
                  else toast.error(r.error.message);
                }}>Criar</Button>
              </div>
            </CardContent>
          </Card>

          <Card><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Zona</TableHead><TableHead>Método</TableHead><TableHead>Peso</TableHead><TableHead>Preço</TableHead><TableHead>Grátis acima</TableHead></TableRow></TableHeader>
              <TableBody>{ratesData.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{(r.shipping_zones as { name: string } | null)?.name ?? "—"}</TableCell>
                  <TableCell>{(r.shipping_methods as { name: string } | null)?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.min_weight_g}g – {r.max_weight_g ?? "∞"}g</TableCell>
                  <TableCell>R$ {Number(r.price).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{r.free_above_subtotal != null ? `R$ ${Number(r.free_above_subtotal).toFixed(2)}` : "—"}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <CarrierAccountsPanel storeId={storeId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Painel de Transportadoras (Correios e demais providers)
// ============================================================

interface CredentialField { key: string; label: string; type: "text" | "password" | "number"; required?: boolean; helper?: string }
interface ProviderDescriptor {
  code: string; display_name: string;
  capabilities: { quote: boolean; label: boolean; tracking: boolean; sandbox: boolean };
  credential_schema: CredentialField[];
  config_schema: CredentialField[];
}
interface CarrierAccount {
  id: string; store_id: string; provider_code: string; display_name: string;
  is_active: boolean; sandbox: boolean;
  config: Record<string, unknown> | null;
  capabilities: Record<string, unknown> | null;
  credentials_fingerprint: string | null;
  credentials_set_at: string | null;
  last_test_at: string | null; last_test_ok: boolean | null; last_test_error: string | null;
}

function CarrierAccountsPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const lp = useServerFn(listShippingProviders);
  const la = useServerFn(listShippingCarrierAccounts);
  const ca = useServerFn(createShippingCarrierAccount);

  const providers = useQuery({
    queryKey: ["shipping-providers"],
    queryFn: () => lp(),
  });
  const accounts = useQuery({
    queryKey: ["shipping-carrier-accounts", storeId],
    queryFn: () => la({ data: { store_id: storeId } }),
    enabled: !!storeId,
  });

  const providersData: ProviderDescriptor[] = providers.data?.ok ? (providers.data.data as ProviderDescriptor[]) : [];
  const accountsData: CarrierAccount[] = accounts.data?.ok ? (accounts.data.data as CarrierAccount[]) : [];

  const [form, setForm] = useState({ provider_code: "correios", display_name: "Correios produção", sandbox: true });
  const [editing, setEditing] = useState<CarrierAccount | null>(null);

  const invAll = () => qc.invalidateQueries({ queryKey: ["shipping-carrier-accounts", storeId] });

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Nova conta de transportadora</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-4 gap-3">
          <div>
            <Label>Provider</Label>
            <Select value={form.provider_code} onValueChange={(v) => setForm({ ...form, provider_code: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {providersData.map((p) => (
                  <SelectItem key={p.code} value={p.code}>{p.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome de exibição</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div className="flex items-end gap-2">
            <Label className="flex items-center gap-2">
              <input type="checkbox" checked={form.sandbox} onChange={(e) => setForm({ ...form, sandbox: e.target.checked })} />
              Sandbox
            </Label>
          </div>
          <div className="flex items-end">
            <Button
              onClick={async () => {
                const r = await ca({ data: { store_id: storeId, provider_code: form.provider_code, display_name: form.display_name, sandbox: form.sandbox } });
                if (r.ok) { toast.success("Conta criada"); invAll(); }
                else toast.error(r.error.message);
              }}
            >Criar</Button>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Provider</TableHead><TableHead>Nome</TableHead><TableHead>Ambiente</TableHead>
            <TableHead>Credenciais</TableHead><TableHead>Último teste</TableHead><TableHead>Status</TableHead><TableHead className="w-[1%]">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {accountsData.map((a) => (
              <TableRow key={a.id}>
                <TableCell><code>{a.provider_code}</code></TableCell>
                <TableCell>{a.display_name}</TableCell>
                <TableCell>{a.sandbox ? "Sandbox" : "Produção"}</TableCell>
                <TableCell className="text-xs font-mono">
                  {a.credentials_fingerprint ? a.credentials_fingerprint.slice(0, 12) + "…" : <span className="text-muted-foreground">não configurado</span>}
                </TableCell>
                <TableCell className="text-xs">
                  {a.last_test_at ? (
                    <span className={a.last_test_ok ? "text-emerald-600" : "text-destructive"}>
                      {a.last_test_ok ? "OK" : (a.last_test_error ?? "Falha")}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>{a.is_active ? "Ativa" : "Inativa"}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setEditing(a)}>Editar</Button>
                </TableCell>
              </TableRow>
            ))}
            {accountsData.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                Nenhuma conta cadastrada. Crie uma acima para começar.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>

      {editing && (
        <CarrierAccountEditor
          account={editing}
          provider={providersData.find((p) => p.code === editing.provider_code) ?? null}
          onClose={() => setEditing(null)}
          onChanged={() => { invAll(); }}
        />
      )}
    </>
  );
}

function CarrierAccountEditor({
  account, provider, onClose, onChanged,
}: {
  account: CarrierAccount;
  provider: ProviderDescriptor | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const upd = useServerFn(updateShippingCarrierAccount);
  const del = useServerFn(deleteShippingCarrierAccount);
  const setCred = useServerFn(setShippingCarrierCredentials);
  const test = useServerFn(testShippingCarrierAccount);

  const [meta, setMeta] = useState({
    display_name: account.display_name,
    is_active: account.is_active,
    sandbox: account.sandbox,
  });
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    const src = (account.config ?? {}) as Record<string, unknown>;
    for (const f of provider?.config_schema ?? []) out[f.key] = src[f.key] == null ? "" : String(src[f.key]);
    return out;
  });
  const [creds, setCreds] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of provider?.credential_schema ?? []) out[f.key] = "";
    return out;
  });

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{account.display_name} <span className="text-xs text-muted-foreground">({account.provider_code})</span></span>
          <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dados gerais + config */}
        <section className="grid grid-cols-3 gap-3">
          <div><Label>Nome</Label><Input value={meta.display_name} onChange={(e) => setMeta({ ...meta, display_name: e.target.value })} /></div>
          <Label className="flex items-end gap-2">
            <input type="checkbox" checked={meta.is_active} onChange={(e) => setMeta({ ...meta, is_active: e.target.checked })} /> Ativa
          </Label>
          <Label className="flex items-end gap-2">
            <input type="checkbox" checked={meta.sandbox} onChange={(e) => setMeta({ ...meta, sandbox: e.target.checked })} /> Sandbox
          </Label>
          {(provider?.config_schema ?? []).map((f) => (
            <div key={f.key} className="col-span-3 md:col-span-1">
              <Label>{f.label}{f.required && " *"}</Label>
              <Input
                type={f.type === "number" ? "number" : "text"}
                value={config[f.key] ?? ""}
                onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
              />
              {f.helper && <p className="text-xs text-muted-foreground mt-1">{f.helper}</p>}
            </div>
          ))}
          <div className="col-span-3 flex gap-2">
            <Button onClick={async () => {
              const cfg: Record<string, unknown> = {};
              for (const f of provider?.config_schema ?? []) {
                const v = config[f.key];
                if (v === "" || v == null) continue;
                cfg[f.key] = f.type === "number" ? Number(v) : v;
              }
              const r = await upd({ data: { id: account.id, display_name: meta.display_name, is_active: meta.is_active, sandbox: meta.sandbox, config: cfg } });
              if (r.ok) { toast.success("Conta atualizada"); onChanged(); }
              else toast.error(r.error.message);
            }}>Salvar</Button>
            <Button variant="outline" onClick={async () => {
              const r = await test({ data: { id: account.id } });
              if (r.ok) {
                if (r.data.ok) toast.success("Conexão OK");
                else toast.error(`Falha: ${r.data.error}`);
                onChanged();
              } else toast.error(r.error.message);
            }}>Testar conexão</Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirm("Remover esta conta?")) return;
              const r = await del({ data: { id: account.id } });
              if (r.ok) { toast.success("Removida"); onChanged(); onClose(); }
              else toast.error(r.error.message);
            }}>Excluir</Button>
          </div>
        </section>

        {/* Credenciais — nunca exibe o valor atual; só permite rotacionar */}
        <section className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Credenciais</h3>
              <p className="text-xs text-muted-foreground">
                Armazenadas criptografadas. {account.credentials_fingerprint
                  ? `Fingerprint atual: ${account.credentials_fingerprint.slice(0, 16)}…`
                  : "Nenhuma credencial gravada ainda."}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(provider?.credential_schema ?? []).map((f) => (
              <div key={f.key}>
                <Label>{f.label}{f.required && " *"}</Label>
                <Input
                  type={f.type === "password" ? "password" : f.type === "number" ? "number" : "text"}
                  autoComplete="off"
                  value={creds[f.key] ?? ""}
                  onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
                />
                {f.helper && <p className="text-xs text-muted-foreground mt-1">{f.helper}</p>}
              </div>
            ))}
          </div>
          <Button onClick={async () => {
            const payload: Record<string, unknown> = {};
            for (const f of provider?.credential_schema ?? []) {
              const v = creds[f.key];
              if (v === "" || v == null) continue;
              payload[f.key] = f.type === "number" ? Number(v) : v;
            }
            const r = await setCred({ data: { id: account.id, credentials: payload } });
            if (r.ok) {
              toast.success("Credenciais gravadas");
              setCreds(Object.fromEntries((provider?.credential_schema ?? []).map((f) => [f.key, ""])));
              onChanged();
            } else toast.error(r.error.message);
          }}>Gravar credenciais</Button>
        </section>
      </CardContent>
    </Card>
  );
}
