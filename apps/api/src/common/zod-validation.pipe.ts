import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export interface InvalidField {
  field: string;
  reason: string;
}

/**
 * Valida un valor de entrada (normalmente el cuerpo de la petición) con un
 * esquema de Zod y devuelve el resultado ya transformado.
 *
 * Si no es válido, responde 400 con un motivo por campo. La respuesta se
 * construye solo con la ruta y el mensaje de cada error, nunca con el valor
 * recibido: puede ser una contraseña.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    // Un motivo por campo: el primero que falla.
    const errors = new Map<string, string>();
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || '(body)';
      if (!errors.has(field)) {
        errors.set(field, issue.message);
      }
    }

    throw new BadRequestException({
      statusCode: 400,
      message: 'Datos de entrada inválidos',
      errors: [...errors].map(([field, reason]): InvalidField => ({
        field,
        reason,
      })),
    });
  }
}
