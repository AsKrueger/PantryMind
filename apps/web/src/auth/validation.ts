// Mismos límites que la API (apps/api/src/auth/auth.schemas.ts). Solo sirven
// para avisar pronto: la API es quien decide.
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export type FieldErrors = Partial<Record<'email' | 'password', string>>;

// Cada punto de código Unicode cuenta como un carácter, igual que en la API.
const characterCount = (text: string) => [...text].length;

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (value === '') {
    return 'Escribe tu correo electrónico';
  }
  if (value.length > EMAIL_MAX_LENGTH) {
    return `Debe tener como máximo ${EMAIL_MAX_LENGTH} caracteres`;
  }
  if (!EMAIL_FORMAT.test(value)) {
    return 'Escribe un correo electrónico válido';
  }
  return undefined;
}

export function validateNewPassword(password: string): string | undefined {
  const length = characterCount(password);
  if (length < PASSWORD_MIN_LENGTH) {
    return `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `Debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres`;
  }
  return undefined;
}

export function validateCurrentPassword(password: string): string | undefined {
  if (password === '') {
    return 'Escribe tu contraseña';
  }
  if (characterCount(password) > PASSWORD_MAX_LENGTH) {
    return `Debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres`;
  }
  return undefined;
}
