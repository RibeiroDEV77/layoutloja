import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { FormField, type FormFieldProps } from "./form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string };

export type MultiSelectFieldProps = Omit<FormFieldProps, "children"> & {
  value: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
};

export function MultiSelectField({
  value, onChange, options, placeholder = "Selecione...",
  emptyText = "Nada encontrado", disabled, ...field
}: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const selectedOpts = options.filter((o) => value.includes(o.value));

  return (
    <FormField {...field}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button" variant="outline" role="combobox" disabled={disabled}
            className="w-full justify-between font-normal h-auto min-h-10 py-1.5"
          >
            <div className="flex flex-wrap gap-1 min-w-0">
              {selectedOpts.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
              {selectedOpts.map((o) => (
                <Badge key={o.value} variant="secondary" className="gap-1">
                  {o.label}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); toggle(o.value); }}
                    className="hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))}
            </div>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const sel = value.includes(o.value);
                  return (
                    <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                      <Check className={cn("h-4 w-4 mr-2", sel ? "opacity-100" : "opacity-0")} />
                      {o.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FormField>
  );
}
