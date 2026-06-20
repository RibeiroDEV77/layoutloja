import { Check, ChevronsUpDown, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useActiveStore } from "@/hooks/use-active-store";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function StoreSwitcher() {
  const { stores, storeId, setStoreId, loading } = useActiveStore();
  const [open, setOpen] = useState(false);
  const current = stores.find((s) => s.id === storeId);

  if (loading) {
    return <div className="h-8 w-40 rounded-md bg-muted animate-pulse" />;
  }
  if (!stores.length) {
    return <span className="text-xs text-muted-foreground hidden sm:inline">Sem lojas</span>;
  }
  if (stores.length === 1) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
        <Store className="h-3.5 w-3.5" /> <span className="font-medium text-foreground">{current?.name}</span>
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 max-w-[180px]">
          <Store className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">{current?.name ?? "Selecionar loja"}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar loja..." />
          <CommandList>
            <CommandEmpty>Nenhuma loja</CommandEmpty>
            <CommandGroup>
              {stores.map((s) => (
                <CommandItem key={s.id} value={s.name} onSelect={() => { setStoreId(s.id); setOpen(false); }}>
                  <Check className={cn("h-4 w-4 mr-2", s.id === storeId ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{s.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
