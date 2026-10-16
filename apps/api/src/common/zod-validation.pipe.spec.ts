import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({
  name: z.string().trim().min(3, { error: 'es demasiado corto' }),
  age: z.number({ error: 'debe ser un número' }),
});

function responseOf(pipe: ZodValidationPipe<typeof schema>, value: unknown) {
  try {
    pipe.transform(value);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse();
  }
  throw new Error('transform did not throw');
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value', () => {
    expect(pipe.transform({ name: ' Ana ', age: 30 })).toEqual({
      name: 'Ana',
      age: 30,
    });
  });

  it('responds 400 with one reason per invalid field', () => {
    expect(responseOf(pipe, { name: 'x', age: 'old' })).toEqual({
      statusCode: 400,
      message: 'Datos de entrada inválidos',
      errors: [
        { field: 'name', reason: 'es demasiado corto' },
        { field: 'age', reason: 'debe ser un número' },
      ],
    });
  });

  it('reports a body that is not an object', () => {
    expect(responseOf(pipe, undefined)).toMatchObject({
      errors: [{ field: '(body)' }],
    });
  });

  it('never includes the received values', () => {
    const response = JSON.stringify(
      responseOf(pipe, { name: 'S3', age: 'secret-value-123' }),
    );

    expect(response).not.toContain('S3');
    expect(response).not.toContain('secret-value-123');
  });
});
