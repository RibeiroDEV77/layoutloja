import type { ReactNode } from "react";
import { useAuth } from "./use-auth";

/**
 * Permissions hook — thin façade over useAuth() for RBAC checks.
 * UX gating only; server functions remain the authoritative authorization.
 */
export function usePermissions() {
  const { ctx, hasRole, hasAnyRole, hasPermission, isSuperAdmin } = useAuth();
  const hasAnyPermission = (codes: string[]) => codes.some((c) => hasPermission(c));
  const hasAllPermissions = (codes: string[]) => codes.every((c) => hasPermission(c));
  return {
    roles: ctx?.roles ?? [],
    permissions: ctx?.permissions ?? [],
    hasRole,
    hasAnyRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
  };
}

export type CanProps = {
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  role?: string;
  anyRole?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

/** RBAC gate — hides children unless current user matches. Server authorization is still required. */
export function Can({ permission, anyPermission, allPermissions, role, anyRole, fallback = null, children }: CanProps) {
  const p = usePermissions();
  if (p.isSuperAdmin()) return <>{children}</>;
  if (permission && !p.hasPermission(permission)) return <>{fallback}</>;
  if (anyPermission && !p.hasAnyPermission(anyPermission)) return <>{fallback}</>;
  if (allPermissions && !p.hasAllPermissions(allPermissions)) return <>{fallback}</>;
  if (role && !p.hasRole(role)) return <>{fallback}</>;
  if (anyRole && !p.hasAnyRole(anyRole)) return <>{fallback}</>;
  return <>{children}</>;
}
