import { validateEnv } from './env.js';

const validDatabaseUrl = 'postgresql://user:pass@127.0.0.1:5432/pantrymind';
const validSecret = 'test-secret-with-at-least-32-characters';
// Variables obligatorias con valores válidos.
const required = {
  DATABASE_URL: validDatabaseUrl,
  JWT_ACCESS_SECRET: validSecret,
};

function errorMessageOf(variables: Record<string, unknown>): string {
  try {
    validateEnv(variables);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('validateEnv did not throw');
}

describe('validateEnv', () => {
  it('accepts a complete valid configuration', () => {
    expect(
      validateEnv({
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_URL: validDatabaseUrl,
        JWT_ACCESS_SECRET: validSecret,
        JWT_ACCESS_TTL_SECONDS: '300',
        REFRESH_TOKEN_TTL_DAYS: '30',
      }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      DATABASE_URL: validDatabaseUrl,
      JWT_ACCESS_SECRET: validSecret,
      JWT_ACCESS_TTL_SECONDS: 300,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
  });

  it('accepts the "postgres" protocol', () => {
    const url = 'postgres://user:pass@127.0.0.1:5432/pantrymind';

    expect(validateEnv({ ...required, DATABASE_URL: url }).DATABASE_URL).toBe(
      url,
    );
  });

  it('applies defaults when the optional variables are missing', () => {
    expect(validateEnv(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      ...required,
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 7,
    });
  });

  it('ignores variables that are not part of the configuration', () => {
    expect(validateEnv({ ...required, PATH: '/usr/bin' })).not.toHaveProperty(
      'PATH',
    );
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(errorMessageOf({ JWT_ACCESS_SECRET: validSecret })).toContain(
      'DATABASE_URL: es obligatoria',
    );
  });

  it('rejects a DATABASE_URL with a protocol other than PostgreSQL', () => {
    expect(
      errorMessageOf({
        ...required,
        DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/db',
      }),
    ).toContain('DATABASE_URL: debe ser una URL con protocolo');
  });

  it('rejects a DATABASE_URL that is not a URL', () => {
    expect(
      errorMessageOf({ ...required, DATABASE_URL: 'not a url' }),
    ).toContain('DATABASE_URL: debe ser una URL con protocolo');
  });

  it.each(['abc', '3000abc', '', '0', '65536', '-1', '80.5'])(
    'rejects PORT=%j',
    (port) => {
      expect(errorMessageOf({ ...required, PORT: port })).toContain(
        'PORT: debe ser un número entero entre 1 y 65535',
      );
    },
  );

  it.each(['1', '65535'])('accepts PORT=%j', (port) => {
    expect(validateEnv({ ...required, PORT: port }).PORT).toBe(Number(port));
  });

  it('rejects a NODE_ENV that is not allowed', () => {
    expect(errorMessageOf({ ...required, NODE_ENV: 'staging' })).toContain(
      'NODE_ENV: debe ser "development", "test" o "production"',
    );
  });

  it('rejects a missing JWT_ACCESS_SECRET', () => {
    expect(errorMessageOf({ DATABASE_URL: validDatabaseUrl })).toContain(
      'JWT_ACCESS_SECRET: es obligatoria',
    );
  });

  it('rejects a JWT_ACCESS_SECRET shorter than 32 characters', () => {
    expect(
      errorMessageOf({ ...required, JWT_ACCESS_SECRET: 'a'.repeat(31) }),
    ).toContain('JWT_ACCESS_SECRET: debe tener al menos 32 caracteres');
  });

  it('accepts a JWT_ACCESS_SECRET of exactly 32 characters', () => {
    expect(
      validateEnv({ ...required, JWT_ACCESS_SECRET: 'a'.repeat(32) })
        .JWT_ACCESS_SECRET,
    ).toHaveLength(32);
  });

  it.each(['JWT_ACCESS_TTL_SECONDS', 'REFRESH_TOKEN_TTL_DAYS'])(
    'rejects a %s that is not a positive integer',
    (name) => {
      for (const value of ['abc', '0', '-5', '1.5']) {
        expect(errorMessageOf({ ...required, [name]: value })).toContain(
          `${name}: debe ser un número entero positivo`,
        );
      }
    },
  );

  it('reports every invalid variable at once', () => {
    const message = errorMessageOf({ NODE_ENV: 'staging', PORT: 'abc' });

    expect(message).toContain('NODE_ENV:');
    expect(message).toContain('PORT:');
    expect(message).toContain('DATABASE_URL:');
    expect(message).toContain('JWT_ACCESS_SECRET:');
  });

  it('never includes the received values in the error message', () => {
    const message = errorMessageOf({
      NODE_ENV: 'staging-secret',
      PORT: 'port-secret',
      DATABASE_URL: 'mysql://admin:s3cr3t-p4ssw0rd@db.internal:3306/app',
      JWT_ACCESS_SECRET: 'short-jwt-secret',
    });

    expect(message).not.toContain('staging-secret');
    expect(message).not.toContain('port-secret');
    expect(message).not.toContain('s3cr3t-p4ssw0rd');
    expect(message).not.toContain('admin');
    expect(message).not.toContain('db.internal');
    expect(message).not.toContain('short-jwt-secret');
  });
});
