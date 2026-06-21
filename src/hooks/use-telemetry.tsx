import { useCallback } from "react";
import { useAuth } from "./use-auth";

/**
 * UI Telemetry — fire-and-forget event recorder for the Admin Shell.
 *
 * TODO (Fase 6.4): plug a Server Function `recordTelemetry({name,value,tags})`
 * (admin-shell.functions.ts) que insere em `public.metrics` com store/user tags.
 * Por ora apenas console.debug em DEV — não bloqueia render, não falha UX.
 */
export type TelemetryEvent = {
  name: string;
  value?: number;
  tags?: Record<string, string | number | boolean | null | undefined>;
};

export function useTelemetry() {
  const { ctx } = useAuth();
  const userId = ctx?.user_id;

  const record = useCallback((event: TelemetryEvent) => {
    if (typeof window === "undefined") return;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[telemetry]", event.name, { value: event.value, ...event.tags, userId });
    }
    // Future: enqueue + flush to recordTelemetry server fn.
  }, [userId]);

  return { record };
}
