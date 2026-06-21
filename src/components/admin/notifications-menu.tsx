import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "./empty-state";

/**
 * Admin notifications dropdown.
 *
 * TODO (Fase 6.3): consumir `listMyNotifications()` / `markNotificationRead(id)`
 * via admin-shell.functions.ts (Business Layer) com TanStack Query +
 * realtime subscription em `public.notifications` filtrado por recipient_user_id.
 * Por ora exibe placeholder estável — não consulta tabelas direto.
 */
export function NotificationsMenu() {
  const items: { id: string; title: string; body?: string; createdAt: string }[] = [];
  const unread = 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]">{unread}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b text-sm font-medium">Notificações</div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 ? (
            <div className="p-2">
              <EmptyState title="Nenhuma notificação" description="Tudo em dia por aqui." />
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className="px-3 py-2 text-sm">
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-muted-foreground text-xs">{n.body}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
