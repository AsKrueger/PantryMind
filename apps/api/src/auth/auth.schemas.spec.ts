import {
  EMAIL_MAX_LENGTH,
  loginSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  registerSchema,
} from './auth.schemas.js';

const validPassword = 'correct horse battery staple';

function reasonsOf(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  expect(result.success).toBe(false);
  return result.error!.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`,
  );
}

// Correo de exactamente "length" caracteres.
function emailOfLength(length: number) {
  const domain = '@example.com';
  return 'a'.repeat(length - domain.length) + domain;
}

describe('registerSchema', () => {
  it('accepts valid credentials', () => {
    expect(
      registerSchema.parse({
        email: 'ana@example.com',
        password: validPassword,
      }),
    ).toEqual({ email: 'ana@example.com', password: validPassword });
  });

  it('normalizes the email: trims spaces and lowercases it', () => {
    expect(
      registerSchema.parse({
        email: '  Ana@Example.COM ',
        password: validPassword,
      }).email,
    ).toBe('ana@example.com');
  });

  it('does not trim or change the password', () => {
    const password = `  ${validPassword} `;

    expect(
      registerSchema.parse({ email: 'ana@example.com', password }).password,
    ).toBe(password);
  });

  it.each(['not-an-email', 'ana@', '@example.com', 'ana example@x.com'])(
    'rejects the invalid email %j',
    (email) => {
      expect(
        reasonsOf(registerSchema.safeParse({ email, password: validPassword })),
      ).toEqual(['email: debe ser un correo electrónico válido']);
    },
  );

  it(`accepts an email of ${EMAIL_MAX_LENGTH} characters`, () => {
    const email = emailOfLength(EMAIL_MAX_LENGTH);

    expect(registerSchema.parse({ email, password: validPassword }).email).toBe(
      email,
    );
  });

  it(`rejects an email longer than ${EMAIL_MAX_LENGTH} characters`, () => {
    expect(
      reasonsOf(
        registerSchema.safeParse({
          email: emailOfLength(EMAIL_MAX_LENGTH + 1),
          password: validPassword,
        }),
      ),
    ).toEqual([`email: debe tener como máximo ${EMAIL_MAX_LENGTH} caracteres`]);
  });

  it(`rejects a password shorter than ${PASSWORD_MIN_LENGTH} characters`, () => {
    expect(
      reasonsOf(
        registerSchema.safeParse({
          email: 'ana@example.com',
          password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
        }),
      ),
    ).toEqual([
      `password: debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    ]);
  });

  it.each([PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH])(
    'accepts a password of %i characters',
    (length) => {
      expect(
        registerSchema.safeParse({
          email: 'ana@example.com',
          password: 'a'.repeat(length),
        }).success,
      ).toBe(true);
    },
  );

  it(`rejects a password longer than ${PASSWORD_MAX_LENGTH} characters`, () => {
    expect(
      reasonsOf(
        registerSchema.safeParse({
          email: 'ana@example.com',
          password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
        }),
      ),
    ).toEqual([
      `password: debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres`,
    ]);
  });

  it('counts each Unicode character once', () => {
    // 15 emojis: 15 caracteres, aunque en UTF-16 ocupen 30 unidades.
    expect(
      registerSchema.safeParse({
        email: 'ana@example.com',
        password: '🔑'.repeat(PASSWORD_MIN_LENGTH),
      }).success,
    ).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(reasonsOf(registerSchema.safeParse({}))).toEqual([
      'email: es obligatorio',
      'password: es obligatorio',
    ]);
  });

  it('rejects fields that are not text', () => {
    expect(
      reasonsOf(registerSchema.safeParse({ email: 42, password: true })),
    ).toEqual(['email: debe ser un texto', 'password: debe ser un texto']);
  });
});

describe('loginSchema', () => {
  it('normalizes the email', () => {
    expect(
      loginSchema.parse({ email: ' ANA@example.com', password: 'x' }).email,
    ).toBe('ana@example.com');
  });

  it('does not require the minimum length of new passwords', () => {
    expect(
      loginSchema.safeParse({ email: 'ana@example.com', password: 'short' })
        .success,
    ).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(
      reasonsOf(
        loginSchema.safeParse({ email: 'ana@example.com', password: '' }),
      ),
    ).toEqual(['password: es obligatorio']);
  });

  it(`rejects a password longer than ${PASSWORD_MAX_LENGTH} characters`, () => {
    expect(
      reasonsOf(
        loginSchema.safeParse({
          email: 'ana@example.com',
          password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
        }),
      ),
    ).toEqual([
      `password: debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres`,
    ]);
  });

  it('rejects missing fields', () => {
    expect(reasonsOf(loginSchema.safeParse({}))).toEqual([
      'email: es obligatorio',
      'password: es obligatorio',
    ]);
  });
});
