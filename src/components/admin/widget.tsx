import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type WidgetSize = "sm" | "md" | "lg" | "xl" | "full";

export type WidgetProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  size?: WidgetSize;
  loading?: boolean;
  className?: string;
  footer?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

const sizeCls: Record<WidgetSize, string> = {
  sm: "col-span-12 sm:col-span-6 lg:col-span-3",
  md: "col-span-12 sm:col-span-6 lg:col-span-4",
  lg: "col-span-12 lg:col-span-6",
  xl: "col-span-12 lg:col-span-8",
  full: "col-span-12",
};

export function Widget({
  title, description, icon, size = "md", loading, className, footer, actions, children,
}: WidgetProps) {
  return (
    <Card className={cn(sizeCls[size], className)}>
      {(title || description || actions) && (
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1 min-w-0">
            {title && (
              <CardTitle className="text-base flex items-center gap-2 min-w-0">
                {icon}
                <span className="truncate">{title}</span>
              </CardTitle>
            )}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </CardHeader>
      )}
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : children}
        {footer && <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">{footer}</div>}
      </CardContent>
    </Card>
  );
}

export function WidgetGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-12 gap-4", className)}>{children}</div>;
}

export type StatWidgetProps = {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  loading?: boolean;
  size?: WidgetSize;
};

export function StatWidget({ title, value, hint, icon, trend, loading, size = "sm" }: StatWidgetProps) {
  return (
    <Widget size={size} loading={loading}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          {trend && (
            <p className={cn("text-xs font-medium", trend.value >= 0 ? "text-emerald-600" : "text-red-600")}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {icon && <div className="shrink-0 rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>}
      </div>
    </Widget>
  );
}
