import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAdminCarts, getCart, getCartTimeline, expireStaleReservations } from "@/lib/business/cart.functions";
import { useActiveStore } from "@/hooks/use-active-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/carts")({
  head: () => ({ meta: [{ title: "Carrinhos — Admin" }] }),
  component: CartsPage,
});

function CartsPage() {
  const { storeId } = useActiveStore();
  const list = useServerFn(listAdminCarts);
  const getOne = useServerFn(getCart);
  const tl = useServerFn(getCartTimeline);
  const expire = useServerFn(expireStaleReservations);
  const [status, setStatus] = useState<string | undefined>("active");
  const [selected, setSelected] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-carts", storeId, status],
    queryFn: () => list({ data: { store_id: storeId!, status } }),
    enabled: !!storeId,
  });

  const detail = useQuery({
    queryKey: ["admin-cart", selected],
    queryFn: () => getOne({ data: { cart_id: selected! } }),
    enabled: !!selected,
  });

  const timeline = useQuery({
    queryKey: ["admin-cart-timeline", selected],
    queryFn: () => tl({ data: { cart_id: selected! } }),
    enabled: !!selected,
  });

  const carts = q.data?.ok ? q.data.data : [];
  const detailData = detail.data?.ok ? detail.data.data : null;
  const timelineData = timeline.data?.ok ? timeline.data.data : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Carrinhos</h1>
          <p className="text-muted-foreground text-sm">Carrinhos ativos, abandonados, mesclados e expirados.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            const r = await expire({ data: undefined as never });
            if (r.ok) toast.success(`${r.data.expired} reservas expiradas`);
          }}>Expirar reservas stale</Button>
        </div>
      </div>

      <Tabs value={status ?? "all"} onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
        <TabsList>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="abandoned">Abandonados</TabsTrigger>
          <TabsTrigger value="merged">Mesclados</TabsTrigger>
          <TabsTrigger value="converted">Convertidos</TabsTrigger>
          <TabsTrigger value="expired">Expirados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
        <TabsContent value={status ?? "all"}>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente / Sessão</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atualizado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carts.map((c) => (
                    <TableRow key={c.id} className={selected === c.id ? "bg-accent" : ""}>
                      <TableCell><code className="text-xs">{c.id.slice(0, 8)}</code></TableCell>
                      <TableCell className="text-xs">{c.customer_id ?? c.session_token?.slice(0, 12) ?? "—"}</TableCell>
                      <TableCell>{c.items_count}</TableCell>
                      <TableCell>R$ {Number(c.total).toFixed(2)}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setSelected(c.id)}>Ver</Button></TableCell>
                    </TableRow>
                  ))}
                  {!carts.length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum carrinho.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do carrinho</CardTitle>
            <CardDescription>{selected}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Visão geral</TabsTrigger>
                <TabsTrigger value="items">Itens</TabsTrigger>
                <TabsTrigger value="coupons">Cupons</TabsTrigger>
                <TabsTrigger value="shipping">Frete</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(detailData?.cart, null, 2)}</pre>
              </TabsContent>
              <TabsContent value="items">
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(detailData?.items, null, 2)}</pre>
              </TabsContent>
              <TabsContent value="coupons">
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(detailData?.coupons, null, 2)}</pre>
              </TabsContent>
              <TabsContent value="shipping">
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(detailData?.shipping_quotes, null, 2)}</pre>
              </TabsContent>
              <TabsContent value="timeline">
                <div className="space-y-1">
                  {timelineData.map((e) => (
                    <div key={e.id} className="text-xs border-l-2 pl-2 py-1">
                      <span className="font-medium">{e.event_type}</span>{" "}
                      <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                      <pre className="text-[10px] mt-1">{JSON.stringify(e.payload)}</pre>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
