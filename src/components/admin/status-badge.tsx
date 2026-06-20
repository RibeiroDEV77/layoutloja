import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "default" | "success" | "warning" | "danger" | "info" | "muted";

const toneCls: Record<StatusTone, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200/50",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200/50",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200/50",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200/50",
  muted: "bg-muted text-muted-foreground",
};

export type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
};

export function StatusBadge({ label, tone = "default", dot, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("font-medium gap-1.5", toneCls[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {label}
    </Badge>
  );
}

/** Map a status string to a tone using a dictionary. */
export function statusToTone(
  status: string | null | undefined,
  map: Record<string, StatusTone>,
  fallback: StatusTone = "default"
): StatusTone {
  if (!status) return fallback;
  return map[status] ?? fallback;
}
