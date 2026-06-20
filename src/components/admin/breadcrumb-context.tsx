import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Crumb = { label: string; to?: string };

type Ctx = {
  crumbs: Crumb[];
  setCrumbs: (c: Crumb[]) => void;
};

const BreadcrumbCtx = createContext<Ctx | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  return <BreadcrumbCtx.Provider value={{ crumbs, setCrumbs }}>{children}</BreadcrumbCtx.Provider>;
}

export function useBreadcrumbs() {
  const v = useContext(BreadcrumbCtx);
  if (!v) throw new Error("useBreadcrumbs must be used within BreadcrumbProvider");
  return v;
}

/** Set the breadcrumb trail for a page. Safe to call in render. */
export function usePageBreadcrumbs(crumbs: Crumb[]) {
  const { setCrumbs } = useBreadcrumbs();
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    setCrumbs(crumbs);
    return () => setCrumbs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
