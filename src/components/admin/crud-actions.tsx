import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type CrudAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  hidden?: boolean;
  disabled?: boolean;
};

export type CrudActionsProps = {
  actions: CrudAction[];
  label?: string;
  align?: "start" | "end";
};

export function CrudActions({ actions, label = "Ações", align = "end" }: CrudActionsProps) {
  const visible = actions.filter((a) => !a.hidden);
  if (!visible.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visible.map((a, i) => (
          <DropdownMenuItem
            key={i} disabled={a.disabled} onClick={a.onClick}
            className={cn(a.destructive && "text-destructive focus:text-destructive")}
          >
            {a.icon && <span className="mr-2">{a.icon}</span>}
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
