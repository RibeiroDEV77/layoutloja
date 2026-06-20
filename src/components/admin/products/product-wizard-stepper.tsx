/**
 * Stepper + barra de progresso + checklist do Wizard de produto.
 * Renderiza estado calculado pelo server (`getProductReadiness`).
 */
import { Check, Circle, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReadinessStep {
  key: string;
  label: string;
  complete: boolean;
  issues: string[];
}

export function ProductWizardStepper({
  steps, activeKey, onSelect, progress, canPublish,
}: {
  steps: ReadinessStep[];
  activeKey: string;
  onSelect: (key: string) => void;
  progress: number;
  canPublish: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase">Progresso</span>
          <span className="text-sm font-bold">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              canPublish ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <nav className="space-y-1">
        {steps.map((s, i) => {
          const isActive = s.key === activeKey;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(s.key)}
              className={cn(
                "w-full flex items-start gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              <span className="shrink-0 mt-0.5">
                {s.complete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : s.issues.length ? (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-medium truncate">{s.label}</span>
                </span>
                {!s.complete && s.issues.length > 0 && (
                  <span className="block text-xs text-amber-700 dark:text-amber-400 mt-0.5 truncate">
                    {s.issues[0]}
                  </span>
                )}
              </span>
              {s.complete && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
