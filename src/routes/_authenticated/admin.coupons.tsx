import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useActiveStore } from "@/hooks/use-active-store";
import { listCoupons, createCoupon, updateCoupon, deleteCoupon, getCouponLedger } from "@/lib/business/coupons.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  head: () => ({ meta: [{ title: "Cupons — Admin" }] }),
  component: CouponsPage,
});

function CouponsPage() {
  const { storeId } = useActiveStore();
  const list = useServerFn(listCoupons);
  const create = useServerFn(createCoupon);
  const update = useServerFn(updateCoupon);
  const remove = useServerFn(deleteCoupon);
  const ledger = useServerFn(getCouponLedger);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ledgerId, setLedgerId] = useState<string | null>(null);

  const [form, setForm] = useState({ code: "", name: "", type: "percent", value: 10, min_subtotal: "", usage_limit_total: "", stackable: false, active: true });

  const q = useQuery({
    queryKey: ["coupons", storeId],
    queryFn: () => list({ data: { store_id: storeId! } }),
    enabled: !!storeId,
  });
  const ledgerQ = useQuery({
    queryKey: ["coupon-ledger", ledgerId],
    queryFn: () => ledger({ data: { id: ledgerId! } }),
    enabled: !!ledgerId,
  });

  const createMut = useMutation({
    mutationFn: async () => create({ data: {
      store_id: storeId!, code: form.code, name: form.name,
      type: form.type as "percent" | "fixed" | "free_shipping", value: Number(form.value),
      min_subtotal: form.min_subtotal ? Number(form.min_subtotal) : null,
      usage_limit_total: form.usage_limit_total ? Number(form.usage_limit_total) : null,
      stackable: form.stackable, active: form.active,
    }}),
    onSuccess: (r) => {
      if (!r.ok) { toast.error(r.error.message); return; }
      toast.success("Cupom criado"); setOpen(false);
      setForm({ code: "", name: "", type: "percent", value: 10, min_subtotal: "", usage_limit_total: "", stackable: false, active: true });
      qc.invalidateQueries({ queryKey: ["coupons"] });
    },
  });

  const toggleMut = useMutation({
    mutationFn: async (c: { id: string; active: boolean }) =>
      update({ data: { id: c.id, patch: { active: !c.active } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Cupom excluído"); qc.invalidateQueries({ queryKey: ["coupons"] }); },
  });

  const coupons = q.data?.ok ? q.data.data : [];
  const ledgerRows = ledgerQ.data?.ok ? ledgerQ.data.data : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cupons</h1>
          <p className="text-muted-foreground text-sm">Engine de cupons com ledger imutável.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Novo cupom</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo cupom</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentual</SelectItem>
                      <SelectItem value="fixed">Valor fixo</SelectItem>
                      <SelectItem value="free_shipping">Frete grátis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Valor</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Subtotal mínimo</Label><Input type="number" value={form.min_subtotal} onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })} /></div>
                <div><Label>Limite total de usos</Label><Input type="number" value={form.usage_limit_total} onChange={(e) => setForm({ ...form, usage_limit_total: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.stackable} onCheckedChange={(v) => setForm({ ...form, stackable: v })} /><Label>Empilhável</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
            </div>
            <DialogFooter><Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead><TableHead>Usos</TableHead><TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><code className="font-mono">{c.code}</code></TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                  <TableCell>{c.type === "percent" ? `${c.value}%` : `R$ ${Number(c.value).toFixed(2)}`}</TableCell>
                  <TableCell>{c.usage_count}{c.usage_limit_total ? `/${c.usage_limit_total}` : ""}</TableCell>
                  <TableCell><Switch checked={c.active} onCheckedChange={() => toggleMut.mutate(c)} /></TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setLedgerId(c.id)}>Ledger</Button>
                    <Button size="sm" variant="ghost" onClick={() => delMut.mutate(c.id)}>Excluir</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!coupons.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum cupom.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {ledgerId && (
        <Card>
          <CardHeader><CardTitle>Ledger</CardTitle><CardDescription>Histórico append-only de eventos do cupom</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Valor</TableHead><TableHead>Motivo</TableHead><TableHead>Quando</TableHead></TableRow></TableHeader>
              <TableBody>
                {ledgerRows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell><Badge variant="outline">{l.kind}</Badge></TableCell>
                    <TableCell>{l.amount != null ? `R$ ${Number(l.amount).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-xs">{l.reason ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
