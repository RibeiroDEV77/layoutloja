import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

/**
 * P8: prefixos de queryKey que carregam dados privados por usuário.
 * Ao trocar de usuário ou fazer logout, o cache correspondente é removido
 * para impedir vazamento cross-user via TanStack Query cache.
 */
const PRIVATE_QUERY_PREFIXES: readonly (readonly unknown[])[] = [
  ["account"],
  ["orders"],
  ["addresses"],
  ["wholesale"],
  // legado (mantido para transição, caso alguma tela antiga ainda invalide):
  ["storefront", "my-account"],
  ["my-orders"],
  ["my-wishlist"],
];

function clearPrivateQueries(qc: ReturnType<typeof useQueryClient>) {
  for (const prefix of PRIVATE_QUERY_PREFIXES) {
    qc.removeQueries({ queryKey: prefix as unknown[], exact: false });
  }
}

export type UserRole = { code: string; name: string; store_id: string | null };
export type UserContext = {
  authenticated: boolean;
  user_id?: string;
  profile?: { user_id: string; full_name: string | null; avatar_url: string | null } | null;
  roles?: UserRole[];
  permissions?: string[];
  stores?: string[];
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  ctx: UserContext | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (code: string) => boolean;
  hasAnyRole: (codes: string[]) => boolean;
  hasPermission: (code: string) => boolean;
  isSuperAdmin: () => boolean;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);

  const loadContext = async (sess: Session | null) => {
    if (!sess) {
      setCtx({ authenticated: false });
      return;
    }
    const { data, error } = await supabase.rpc("current_user_context");
    if (error) {
      console.error("current_user_context", error);
      setCtx({ authenticated: true, user_id: sess.user.id, roles: [], permissions: [], stores: [] });
      return;
    }
    const serverContext = data && typeof data === "object" ? data as Record<string, unknown> : {};
    setCtx({
      ...serverContext,
      authenticated: true,
      user_id: typeof serverContext.user_id === "string" ? serverContext.user_id : sess.user.id,
    } as unknown as UserContext);
  };

  useEffect(() => {
    let active = true;

    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!active) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        // Defer to avoid deadlock
        setTimeout(() => loadContext(sess), 0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      loadContext(data.session).finally(() => active && setLoading(false));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refresh = async () => loadContext(session);
  const signOut = async () => {
    await supabase.auth.signOut();
    setCtx({ authenticated: false });
  };

  const hasRole = (code: string) => !!ctx?.roles?.some((r) => r.code === code);
  const hasAnyRole = (codes: string[]) => !!ctx?.roles?.some((r) => codes.includes(r.code));
  const hasPermission = (code: string) =>
    hasRole("super_admin") || !!ctx?.permissions?.includes(code);
  const isSuperAdmin = () => hasRole("super_admin");

  return (
    <AuthCtx.Provider
      value={{ loading, session, user, ctx, refresh, signOut, hasRole, hasAnyRole, hasPermission, isSuperAdmin }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
