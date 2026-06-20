import type { ReactNode } from "react";
import { usePageBreadcrumbs, type Crumb } from "./breadcrumb-context";
import { cn } from "@/lib/utils";

export type CrudPageProps = {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function CrudPage({
  title, description, breadcrumbs, actions, toolbar, children, className,
}: CrudPageProps) {
  usePageBreadcrumbs(breadcrumbs ?? []);
  return (
    <div className={cn("space-y-6", className)}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="shrink-0 flex flex-wrap gap-2">{actions}</div>}
      </header>
      {toolbar}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
