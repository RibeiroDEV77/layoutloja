import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Feature flags — in-memory provider for Shell v2.
 *
 * TODO (Fase 6.4): substituir o `initialFlags` por uma Server Function
 * `listFeatureFlags()` na Business Layer (admin-shell.functions.ts),
 * que consulta `public.feature_flags` + `public.feature_flag_overrides`
 * resolvendo escopo (user/store/role) e expiração.
 */
export type FlagMap = Record<string, boolean | string | number | null>;

type FlagCtx = { flags: FlagMap };
const Ctx = createContext<FlagCtx>({ flags: {} });

export function FeatureFlagProvider({ children, initialFlags = {} }: { children: ReactNode; initialFlags?: FlagMap }) {
  const value = useMemo(() => ({ flags: initialFlags }), [initialFlags]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFeatureFlag(key: string, fallback: boolean = false): boolean {
  const { flags } = useContext(Ctx);
  const raw = flags[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") return raw !== "" && raw !== "false" && raw !== "0";
  return fallback;
}

export function useFeatureValue<T = unknown>(key: string, fallback: T): T {
  const { flags } = useContext(Ctx);
  const raw = flags[key];
  return (raw ?? fallback) as T;
}
