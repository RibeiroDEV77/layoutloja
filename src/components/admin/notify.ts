import { toast } from "sonner";

/** Server function response: { ok: true, data } | { ok: false, error } */
export type BizResult<T> = { ok: true; data: T } | { ok: false; error: { code?: string; message: string; details?: unknown } };

export const notify = {
  success: (msg: string, description?: string) => toast.success(msg, { description }),
  error: (msg: string, description?: string) => toast.error(msg, { description }),
  info: (msg: string, description?: string) => toast.info(msg, { description }),
  warning: (msg: string, description?: string) => toast.warning(msg, { description }),
  loading: (msg: string) => toast.loading(msg),
  dismiss: (id?: string | number) => toast.dismiss(id),
  promise: <T,>(
    p: Promise<T>,
    msgs: { loading: string; success: string | ((d: T) => string); error: string | ((e: unknown) => string) }
  ) => toast.promise(p, msgs),
};

/** Unwrap a server-function BizResult, throwing a friendly Error on failure. */
export function unwrap<T>(result: BizResult<T>): T {
  if (!result.ok) {
    const err = new Error(result.error.message);
    (err as Error & { code?: string }).code = result.error.code;
    throw err;
  }
  return result.data;
}

/** Run a server function and surface success/error via toast. */
export async function runAction<T>(
  action: () => Promise<BizResult<T>>,
  opts: { loading?: string; success: string; error?: string } = { success: "Operação concluída" }
): Promise<T | null> {
  const id = opts.loading ? notify.loading(opts.loading) : undefined;
  try {
    const data = unwrap(await action());
    if (id) notify.dismiss(id);
    notify.success(opts.success);
    return data;
  } catch (e) {
    if (id) notify.dismiss(id);
    notify.error(opts.error ?? "Falha na operação", e instanceof Error ? e.message : undefined);
    return null;
  }
}
