import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CrudToolbarProps = {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function CrudToolbar({ left, right, className }: CrudToolbarProps) {
  return (
    <div className={cn(
      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between",
      className
    )}>
      <div className="flex flex-wrap items-center gap-2 min-w-0">{left}</div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">{right}</div>
    </div>
  );
}
