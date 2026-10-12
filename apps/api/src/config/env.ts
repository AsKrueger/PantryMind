import { z } from 'zod';

/**
 * Configuración de la API. Cada variable se documenta en docs/environment.md.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // Las variables de entorno son siempre texto: se convierte a número.
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type Env = z.infer<typeof envSchema>;

// Motivo que se muestra cuando una variable tiene un valor inválido. Los
// textos son fijos: el mensaje de error nunca se construye con el valor
// recibido, que puede contener una contraseña.
const invalidReasons: Record<keyof Env, string> = {
  NODE_ENV: 'debe ser "development", "test" o "production"',
  PORT: 'debe ser un número entero entre 1 y 65535',
  DATABASE_URL: 'debe ser una URL con protocolo "postgresql" o "postgres"',
};

/**
 * Valida las variables de entorno y devuelve la configuración tipada, con los
 * valores por defecto aplicados. Si alguna variable falta o es inválida,
 * lanza un error que las nombra todas, con el motivo y sin su valor.
 */
export function validateEnv(variables: Record<string, unknown>): Env {
  const result = envSchema.safeParse(variables);
  if (result.success) {
    return result.data;
  }

  const invalidNames = new Set(
    result.error.issues.map((issue) => issue.path[0] as keyof Env),
  );
  const lines = [...invalidNames].map((name) => {
    const reason =
      variables[name] === undefined ? 'es obligatoria' : invalidReasons[name];
    return `  - ${name}: ${reason}`;
  });

  throw new Error(
    [
      'Configuración inválida. La API no puede arrancar:',
      ...lines,
      'Revisa el archivo .env de la raíz del repositorio o las variables de entorno (docs/environment.md).',
    ].join('\n'),
  );
}
