import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorStateProps = {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
};

function extractMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err && "message" in err) return String((err as { message: unknown }).message);
  return undefined;
}

export function ErrorState({
  title = "Algo deu errado",
  description,
  error,
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  const msg = description ?? extractMessage(error) ?? "Não foi possível carregar os dados.";
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-4", className)}>
      <div className="text-destructive mb-3"><AlertCircle className="h-10 w-10" /></div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">{msg}</p>
      <div className="mt-4 flex gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
