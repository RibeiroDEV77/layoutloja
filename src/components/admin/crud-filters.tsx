import type { ReactNode } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CrudFiltersProps = {
  children: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  className?: string;
  label?: string;
};

export function CrudFilters({ children, activeCount = 0, onClear, className, label = "Filtros" }: CrudFiltersProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 gap-2", className)}>
          <Filter className="h-4 w-4" />
          {label}
          {activeCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeCount}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{label}</h4>
          {activeCount > 0 && onClear && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
        <div className="space-y-3">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
