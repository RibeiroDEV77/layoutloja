import { Link, useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AdminBreadcrumb } from "./admin-breadcrumb";
import { StoreSwitcher } from "./store-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsMenu } from "./notifications-menu";
import { CommandPalette, useCommandPalette } from "./command-palette";

export function AdminHeader() {
  const { ctx, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const palette = useCommandPalette();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const name = ctx?.profile?.full_name || "Usuário";
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <header className="h-14 flex items-center justify-between border-b px-4 bg-background sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <SidebarTrigger />
          <Link to="/admin" className="font-semibold shrink-0">Admin</Link>
          <div className="hidden md:block h-5 w-px bg-border" />
          <div className="hidden md:flex min-w-0"><AdminBreadcrumb /></div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground hidden md:inline-flex"
            onClick={() => palette.setOpen(true)}
            aria-label="Busca global"
          >
            <Search className="h-4 w-4" />
            <span>Buscar…</span>
            <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-mono">
              ⌘K
            </kbd>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => palette.setOpen(true)} aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Button>
          <StoreSwitcher />
          <NotificationsMenu />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 h-9">
                <Avatar className="h-7 w-7"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                <span className="text-sm hidden sm:inline">{name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-xs text-muted-foreground">Papéis</div>
                <div className="text-sm">
                  {ctx?.roles?.map((r) => r.name).join(", ") || "—"}
                  {isSuperAdmin() && " · Super Admin"}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
    </>
  );
}
