/**
 * Helper compartilhado dos controllers — envolve o handler em try/catch
 * e converte BusinessError em payload serializável.
 *
 * Usar com `createServerFn(...).middleware([requireSupabaseAuth]).handler(withBusiness(async ({...}) => ...))`.
 */
import { BusinessError, type ErrorDetails } from './errors';

export interface BusinessErrorResponse {
  ok: false;
  error: { code: string; message: string; details?: ErrorDetails };
}

export interface BusinessSuccessResponse<T> {
  ok: true;
  data: T;
}

export type BusinessResponse<T> = BusinessSuccessResponse<T> | BusinessErrorResponse;

export function withBusiness<Ctx, Out>(
  fn: (ctx: Ctx) => Promise<Out>,
): (ctx: Ctx) => Promise<BusinessResponse<Out>> {
  return async (ctx) => {
    try {
      const data = await fn(ctx);
      return { ok: true, data };
    } catch (err) {
      if (err instanceof BusinessError) {
        return { ok: false, error: err.toJSON() };
      }
      console.error('[business] erro não tratado', err);
      return {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: err instanceof Error ? err.message : 'Erro interno',
        },
      };
    }
  };
}
