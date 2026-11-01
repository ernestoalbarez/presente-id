import type { ErrorRequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';

/** Error con status HTTP; el manejador global lo devuelve como { error, codigo }. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public codigo?: string,
  ) {
    super(message);
  }
}

/** Valida datos de entrada con un esquema zod; si fallan, responde 400. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, codigo: err.codigo });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.issues[0]?.message ?? 'Datos inválidos',
      codigo: 'DATOS_INVALIDOS',
      detalles: err.issues,
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor', codigo: 'ERROR_INTERNO' });
};
