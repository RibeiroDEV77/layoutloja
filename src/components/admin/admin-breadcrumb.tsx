import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { useBreadcrumbs } from "./breadcrumb-context";

export function AdminBreadcrumb() {
  const { crumbs } = useBreadcrumbs();
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link to="/admin" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {c.to && i < crumbs.length - 1 ? (
            <Link to={c.to} className="hover:text-foreground transition-colors">{c.label}</Link>
          ) : (
            <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : ""}>{c.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
