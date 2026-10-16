import { validateEnv } from './env.js';

const validDatabaseUrl = 'postgresql://user:pass@127.0.0.1:5432/pantrymind';

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
      }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      DATABASE_URL: validDatabaseUrl,
    });
  });

  it('accepts the "postgres" protocol', () => {
    const url = 'postgres://user:pass@127.0.0.1:5432/pantrymind';

    expect(validateEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it('applies defaults when NODE_ENV and PORT are missing', () => {
    expect(validateEnv({ DATABASE_URL: validDatabaseUrl })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: validDatabaseUrl,
    });
  });

  it('ignores variables that are not part of the configuration', () => {
    expect(
      validateEnv({ DATABASE_URL: validDatabaseUrl, PATH: '/usr/bin' }),
    ).not.toHaveProperty('PATH');
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(errorMessageOf({})).toContain('DATABASE_URL: es obligatoria');
  });

  it('rejects a DATABASE_URL with a protocol other than PostgreSQL', () => {
    expect(
      errorMessageOf({ DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/db' }),
    ).toContain('DATABASE_URL: debe ser una URL con protocolo');
  });

  it('rejects a DATABASE_URL that is not a URL', () => {
    expect(errorMessageOf({ DATABASE_URL: 'not a url' })).toContain(
      'DATABASE_URL: debe ser una URL con protocolo',
    );
  });

  it.each(['abc', '3000abc', '', '0', '65536', '-1', '80.5'])(
    'rejects PORT=%j',
    (port) => {
      expect(
        errorMessageOf({ PORT: port, DATABASE_URL: validDatabaseUrl }),
      ).toContain('PORT: debe ser un número entero entre 1 y 65535');
    },
  );

  it.each(['1', '65535'])('accepts PORT=%j', (port) => {
    expect(
      validateEnv({ PORT: port, DATABASE_URL: validDatabaseUrl }).PORT,
    ).toBe(Number(port));
  });

  it('rejects a NODE_ENV that is not allowed', () => {
    expect(
      errorMessageOf({ NODE_ENV: 'staging', DATABASE_URL: validDatabaseUrl }),
    ).toContain('NODE_ENV: debe ser "development", "test" o "production"');
  });

  it('reports every invalid variable at once', () => {
    const message = errorMessageOf({ NODE_ENV: 'staging', PORT: 'abc' });

    expect(message).toContain('NODE_ENV:');
    expect(message).toContain('PORT:');
    expect(message).toContain('DATABASE_URL:');
  });

  it('never includes the received values in the error message', () => {
    const message = errorMessageOf({
      NODE_ENV: 'staging-secret',
      PORT: 'port-secret',
      DATABASE_URL: 'mysql://admin:s3cr3t-p4ssw0rd@db.internal:3306/app',
    });

    expect(message).not.toContain('staging-secret');
    expect(message).not.toContain('port-secret');
    expect(message).not.toContain('s3cr3t-p4ssw0rd');
    expect(message).not.toContain('admin');
    expect(message).not.toContain('db.internal');
  });
});
