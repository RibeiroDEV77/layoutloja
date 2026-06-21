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
      </Tabs>
    </div>
  );
}
