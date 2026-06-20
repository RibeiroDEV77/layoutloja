import type { ReactNode } from "react";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type CrudDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Built-in submit footer; ignored when `footer` is provided. */
  onSubmit?: () => void | Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  side?: "right" | "left" | "top" | "bottom";
  width?: string;
};

export function CrudDrawer({
  open, onOpenChange, title, description, children, footer,
  onSubmit, submitLabel = "Salvar", cancelLabel = "Cancelar",
  loading, submitDisabled, side = "right", width = "sm:max-w-xl",
}: CrudDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <SheetContent side={side} className={cn("w-full flex flex-col p-0", width)}>
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {(footer || onSubmit) && (
          <SheetFooter className="px-6 py-4 border-t bg-muted/30 flex-row justify-end gap-2 sm:space-x-0">
            {footer ?? (
              <>
                <Button variant="outline" type="button" disabled={loading} onClick={() => onOpenChange(false)}>
                  {cancelLabel}
                </Button>
                <Button type="button" disabled={loading || submitDisabled} onClick={() => onSubmit?.()}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {submitLabel}
                </Button>
              </>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
