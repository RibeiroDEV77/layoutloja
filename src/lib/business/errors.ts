/**
 * Camada de Negócio — Erros padronizados (client-safe).
 *
 * Toda Server Function deve lançar uma instância de BusinessError.
 * O controller serializa para o cliente como { code, message, details }.
 */

export type BusinessErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'INTERNAL';

export type ErrorDetails = Record<string, string | number | boolean | null>;

export class BusinessError extends Error {
  readonly code: BusinessErrorCode;
  readonly httpStatus: number;
  readonly details?: ErrorDetails;

  constructor(
    code: BusinessErrorCode,
    message: string,
    opts?: { httpStatus?: number; details?: ErrorDetails },
  ) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.httpStatus = opts?.httpStatus ?? defaultHttpStatus(code);
    this.details = opts?.details;
  }

  toJSON() {
    return { code: this.code, message: this.message, details: this.details };
  }
}

function defaultHttpStatus(code: BusinessErrorCode): number {
  switch (code) {
    case 'UNAUTHENTICATED': return 401;
    case 'FORBIDDEN': return 403;
    case 'NOT_FOUND': return 404;
    case 'CONFLICT': return 409;
    case 'VALIDATION': return 422;
    case 'BUSINESS_RULE': return 422;
    case 'INTERNAL': return 500;
  }
}

export const Errors = {
  unauthenticated: (msg = 'Não autenticado') =>
    new BusinessError('UNAUTHENTICATED', msg),
  forbidden: (msg = 'Acesso negado', details?: ErrorDetails) =>
    new BusinessError('FORBIDDEN', msg, { details }),
  notFound: (entity: string, id?: string) =>
    new BusinessError('NOT_FOUND', `${entity} não encontrado`, { details: { entity, id: id ?? null } }),
  validation: (msg: string, details?: ErrorDetails) =>
    new BusinessError('VALIDATION', msg, { details }),
  conflict: (msg: string, details?: ErrorDetails) =>
    new BusinessError('CONFLICT', msg, { details }),
  rule: (msg: string, details?: ErrorDetails) =>
    new BusinessError('BUSINESS_RULE', msg, { details }),
  internal: (msg = 'Erro interno', details?: ErrorDetails) =>
    new BusinessError('INTERNAL', msg, { details }),
};

