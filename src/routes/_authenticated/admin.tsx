import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Layout" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { ctx, loading, isSuperAdmin, refresh } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  // Nenhum papel — possivelmente primeiro usuário OU usuário sem papéis
  const hasAnyRole = (ctx?.roles?.length ?? 0) > 0;

  const claim = async () => {
    const { error } = await supabase.rpc("claim_first_super_admin");
    if (error) return toast.error(error.message);
    toast.success("Você agora é Super Administrador");
    await refresh();
  };

  if (!hasAnyRole) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Bootstrap do sistema</CardTitle>
            <CardDescription>
              Você está autenticado mas ainda não possui papéis no sistema. Se você é o primeiro usuário, pode reivindicar
              o papel de Super Administrador abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={claim} className="w-full">Tornar-me Super Administrador</Button>
            <Button variant="outline" onClick={signOut} className="w-full">Sair</Button>
            <p className="text-xs text-muted-foreground">
              Se já existir um Super Admin, esta operação será bloqueada. Solicite um papel ao administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const name = ctx?.profile?.full_name || "Usuário";
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Link to="/admin" className="font-semibold">Layout</Link>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-9">
                  <Avatar className="h-7 w-7"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                  <span className="text-sm">{name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-xs text-muted-foreground">Papéis</div>
                  <div className="text-sm">
                    {ctx?.roles?.map((r) => r.name).join(", ")}
                    {isSuperAdmin() && " · Super Admin"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-6 bg-muted/20">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
