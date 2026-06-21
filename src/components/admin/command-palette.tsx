import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { usePermissions } from "@/hooks/use-permissions";
import { useTheme } from "@/components/theme-provider";
import { NAV_GROUPS } from "./nav-registry";
import { Moon, Sun, Monitor } from "lucide-react";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { setTheme } = useTheme();
  const allow = (p?: string) => !p || isSuperAdmin() || hasPermission(p);

  const go = (url: string) => {
    onOpenChange(false);
    navigate({ to: url });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar telas, ações, comandos…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {NAV_GROUPS.map((g) => {
          const visible = g.items.filter((i) => allow(i.permission));
          if (!visible.length) return null;
          return (
            <CommandGroup key={g.label} heading={g.label}>
              {visible.map((item) => (
                <CommandItem
                  key={item.url}
                  value={`${item.title} ${(item.keywords ?? []).join(" ")} ${item.url}`}
                  onSelect={() => go(item.url)}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  <span>{item.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{item.url}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        <CommandSeparator />
        <CommandGroup heading="Tema">
          <CommandItem onSelect={() => { setTheme("light"); onOpenChange(false); }}>
            <Sun className="h-4 w-4 mr-2" /> Tema claro
          </CommandItem>
          <CommandItem onSelect={() => { setTheme("dark"); onOpenChange(false); }}>
            <Moon className="h-4 w-4 mr-2" /> Tema escuro
          </CommandItem>
          <CommandItem onSelect={() => { setTheme("system"); onOpenChange(false); }}>
            <Monitor className="h-4 w-4 mr-2" /> Tema do sistema
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Headless hook: Cmd/Ctrl+K toggles palette. Returns controlled open state. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
