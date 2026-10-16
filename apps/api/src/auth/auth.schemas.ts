import { z } from 'zod';

// Límites de longitud. Las fuentes están en docs/adr/0003-password-hashing.md.
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 15;
// Además de admitir frases largas, acota el coste de calcular el hash.
export const PASSWORD_MAX_LENGTH = 128;

// Los motivos son textos fijos: nunca incluyen el valor recibido.
const requiredText = (input: unknown) =>
  input === undefined ? 'es obligatorio' : 'debe ser un texto';

// Cada carácter Unicode (punto de código) cuenta como uno, que es como cuenta
// la longitud NIST SP 800-63B; con .length un emoji contaría como dos.
// oxlint-disable-next-line typescript/no-misused-spread
const characterCount = (text: string) => [...text].length;

/**
 * Correo normalizado: sin espacios alrededor y en minúsculas, antes de
 * validarlo. Así se busca y se guarda siempre de la misma forma.
 */
const emailSchema = z
  .string({ error: (issue) => requiredText(issue.input) })
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, {
    error: `debe tener como máximo ${EMAIL_MAX_LENGTH} caracteres`,
  })
  .pipe(z.email({ error: 'debe ser un correo electrónico válido' }));

const passwordTooLong = {
  error: `debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres`,
};

/** Registro: se aplica la política completa de contraseñas nuevas. */
export const registerSchema = z.object({
  email: emailSchema,
  // La contraseña no se recorta ni se transforma: se usa tal cual.
  password: z
    .string({ error: (issue) => requiredText(issue.input) })
    .refine((password) => characterCount(password) >= PASSWORD_MIN_LENGTH, {
      error: `debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    })
    .refine(
      (password) => characterCount(password) <= PASSWORD_MAX_LENGTH,
      passwordTooLong,
    ),
});

/**
 * Inicio de sesión: no se exige la longitud mínima, que es una regla para
 * contraseñas nuevas; solo el máximo, para acotar el coste del hash.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: (issue) => requiredText(issue.input) })
    .min(1, { error: 'es obligatorio' })
    .refine(
      (password) => characterCount(password) <= PASSWORD_MAX_LENGTH,
      passwordTooLong,
    ),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
