import { describe, expect, it, vi } from 'vitest';
import { json, noContent, stubApi } from '../test/stub-api';
import { ApiError, apiRequest } from './client';

describe('apiRequest', () => {
  it('devuelve el cuerpo JSON de una respuesta correcta', async () => {
    stubApi({ 'GET /health': json(200, { status: 'ok' }) });

    await expect(apiRequest('/health')).resolves.toEqual({ status: 'ok' });
  });

  it('envía el token de acceso como Bearer solo cuando se le pasa', async () => {
    const fetchMock = stubApi({
      'GET /users/me': json(200, { id: '1', email: 'ana@example.com' }),
    });

    await apiRequest('/users/me', { token: 'abc' });

    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe('Bearer abc');
  });

  it('lanza ApiError con el mensaje y los campos de un 400', async () => {
    stubApi({
      'POST /auth/register': json(400, {
        statusCode: 400,
        message: 'Datos de entrada inválidos',
        errors: [
          { field: 'password', reason: 'debe tener al menos 15 caracteres' },
        ],
      }),
    });

    const error = await apiRequest('/auth/register', {
      method: 'POST',
      body: {},
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: 'Datos de entrada inválidos',
      fields: { password: 'debe tener al menos 15 caracteres' },
    });
  });

  it('no rompe con una respuesta de error que no es JSON', async () => {
    stubApi({
      'GET /users/me': () =>
        new Response('<html>Bad Gateway</html>', { status: 502 }),
    });

    await expect(apiRequest('/users/me')).rejects.toMatchObject({
      status: 502,
      message: 'La operación no se ha podido completar',
    });
  });

  it('devuelve undefined ante un 204', async () => {
    stubApi({ 'POST /auth/logout': noContent });

    await expect(
      apiRequest('/auth/logout', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });

  it('no envía cuerpo ni Content-Type sin datos', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(null, { status: 204 });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/auth/logout', { method: 'POST' });

    const init = fetchMock.mock.calls[0][1];
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toEqual({});
  });
});
