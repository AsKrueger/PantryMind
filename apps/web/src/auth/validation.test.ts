import { describe, expect, it } from 'vitest';
import {
  validateCurrentPassword,
  validateEmail,
  validateNewPassword,
} from './validation';

describe('validateEmail', () => {
  it('exige un correo con formato válido', () => {
    expect(validateEmail('')).toBeDefined();
    expect(validateEmail('ana')).toBeDefined();
    expect(validateEmail('ana@example')).toBeDefined();
    expect(validateEmail('ana@example.com')).toBeUndefined();
  });

  it('acepta el máximo de 254 caracteres y rechaza 255', () => {
    // "@example.com" ocupa 12 caracteres.
    expect(
      validateEmail(`${'a'.repeat(254 - 12)}@example.com`),
    ).toBeUndefined();
    expect(validateEmail(`${'a'.repeat(255 - 12)}@example.com`)).toBeDefined();
  });
});

describe('validateNewPassword', () => {
  it('exige entre 15 y 128 caracteres', () => {
    expect(validateNewPassword('a'.repeat(14))).toBeDefined();
    expect(validateNewPassword('a'.repeat(15))).toBeUndefined();
    expect(validateNewPassword('a'.repeat(128))).toBeUndefined();
    expect(validateNewPassword('a'.repeat(129))).toBeDefined();
  });

  it('cuenta los caracteres Unicode, no las unidades de código', () => {
    // Cada emoji ocupa dos unidades de código y cuenta como un carácter.
    expect(validateNewPassword('😀'.repeat(14))).toBeDefined();
    expect(validateNewPassword('😀'.repeat(15))).toBeUndefined();
  });
});

describe('validateCurrentPassword', () => {
  it('solo exige que haya contraseña y que no pase de 128 caracteres', () => {
    expect(validateCurrentPassword('')).toBeDefined();
    expect(validateCurrentPassword('corta')).toBeUndefined();
    expect(validateCurrentPassword('a'.repeat(128))).toBeUndefined();
    expect(validateCurrentPassword('a'.repeat(129))).toBeDefined();
  });
});
