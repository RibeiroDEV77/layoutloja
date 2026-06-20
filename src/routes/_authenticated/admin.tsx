import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { BreadcrumbProvider } from "@/components/admin/breadcrumb-context";
import { AdminHeader } from "@/components/admin/admin-header";
import { FullPageLoading } from "@/components/admin/loading";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { ctx, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading) return <FullPageLoading />;

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

  return (
    <BreadcrumbProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader />
            <main className="flex-1 p-4 sm:p-6 bg-muted/20">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </BreadcrumbProvider>
  );
}
