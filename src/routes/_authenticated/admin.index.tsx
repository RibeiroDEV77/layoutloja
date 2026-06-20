import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Admin" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { ctx } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo, {ctx?.profile?.full_name || "Usuário"}.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Papéis</CardTitle>
            <CardDescription>Funções atribuídas a você</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {ctx?.roles?.map((r) => (<Badge key={r.code} variant="secondary">{r.name}</Badge>))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permissões</CardTitle>
            <CardDescription>{ctx?.permissions?.length ?? 0} permissões ativas</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1 max-h-40 overflow-auto">
            {ctx?.permissions?.map((p) => (<Badge key={p} variant="outline" className="text-xs">{p}</Badge>))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lojas</CardTitle>
            <CardDescription>{ctx?.stores?.length ?? 0} loja(s) vinculada(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Multi-tenant ativo.</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas etapas</CardTitle>
          <CardDescription>Fase 3 — Estoque e Compras será implementada em seguida.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
