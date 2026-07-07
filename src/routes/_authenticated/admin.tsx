import { createFileRoute, Outlet, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertCircle, FileQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { BreadcrumbProvider } from "@/components/admin/breadcrumb-context";
import { AdminHeader } from "@/components/admin/admin-header";
import { FullPageLoading } from "@/components/admin/loading";
import { ActiveStoreProvider } from "@/hooks/use-active-store";
import { FeatureFlagProvider } from "@/hooks/use-feature-flag";
import { RouterProgress } from "@/components/admin/router-progress";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin" }] }),
  component: AdminLayout,
  errorComponent: AdminErrorBoundary,
  notFoundComponent: AdminNotFound,
});

function AdminErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "admin_layout_error" });
    // eslint-disable-next-line no-console
    console.error("[admin]", error);
  }, [error]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" /> Erro no painel
          </CardTitle>
          <CardDescription>{error.message || "Algo deu errado ao carregar esta área."}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => { router.invalidate(); reset(); }}>Tentar novamente</Button>
          <Button asChild variant="outline"><Link to="/admin">Voltar ao Dashboard</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <FileQuestion className="h-5 w-5" /> Página não encontrada
          </CardTitle>
          <CardDescription>A rota administrativa solicitada não existe.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link to="/admin">Ir para o Dashboard</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

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
    <FeatureFlagProvider>
      <BreadcrumbProvider>
        <ActiveStoreProvider>
          <SidebarProvider>
            <RouterProgress />
            <div className="min-h-screen flex w-full notranslate" translate="no">
              <AppSidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <AdminHeader />
                <main className="flex-1 p-4 sm:p-6 bg-muted/20">
                  <Outlet />
                </main>
              </div>
            </div>
          </SidebarProvider>
        </ActiveStoreProvider>
      </BreadcrumbProvider>
    </FeatureFlagProvider>
  );
}
