import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { callsTo, json, noContent, sequence, stubApi } from '../test/stub-api';
import type { SessionUser } from './AuthContext';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

const session = { accessToken: 'token-1', expiresIn: 900 };
const user: SessionUser = { id: 'u1', email: 'ana@example.com' };
const unauthorized = json(401, { message: 'No autorizado' });

function renderSession({ strict = false } = {}) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    strict ? (
      <StrictMode>
        <AuthProvider>{children}</AuthProvider>
      </StrictMode>
    ) : (
      <AuthProvider>{children}</AuthProvider>
    );
  return renderHook(() => useAuth(), { wrapper });
}

describe('AuthProvider', () => {
  it('restaura la sesión con la cookie al cargar la página', async () => {
    stubApi({
      'POST /auth/refresh': json(200, session),
      'GET /users/me': json(200, user),
    });

    const { result } = renderSession();

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual(user);
  });

  it('queda anónimo si no hay cookie válida', async () => {
    stubApi({ 'POST /auth/refresh': unauthorized });

    const { result } = renderSession();

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(result.current.user).toBeNull();
  });

  it('llama a refresh una sola vez aunque StrictMode ejecute los efectos dos veces', async () => {
    // Si se llamara dos veces, la segunda reutilizaría la cookie ya rotada y
    // la API revocaría la sesión.
    const fetchMock = stubApi({
      'POST /auth/refresh': json(200, session),
      'GET /users/me': json(200, user),
    });

    const { result } = renderSession({ strict: true });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1);
  });

  it('inicia sesión y guarda el token solo en memoria', async () => {
    stubApi({
      'POST /auth/refresh': unauthorized,
      'POST /auth/login': json(200, { ...session, user }),
    });
    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(() =>
      result.current.login('ana@example.com', 'una frase de prueba larga'),
    );

    expect(result.current.status).toBe('authenticated');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('renueva el token y reintenta una petición que responde 401', async () => {
    const fetchMock = stubApi({
      // La primera renovación, al cargar la página, no tiene cookie válida; la segunda sí.
      'POST /auth/refresh': sequence(
        unauthorized,
        json(200, { accessToken: 'token-2', expiresIn: 900 }),
      ),
      'GET /users/me': sequence(unauthorized, json(200, user)),
    });
    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    const found = await act(() =>
      result.current.request<SessionUser>('/users/me'),
    );

    expect(found).toEqual(user);
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(2);
  });

  it('comparte una sola renovación entre peticiones simultáneas', async () => {
    const fetchMock = stubApi({
      // Carga inicial (401) y una única renovación (200).
      'POST /auth/refresh': sequence(
        unauthorized,
        json(200, { accessToken: 'token-2', expiresIn: 900 }),
      ),
      // Las tres primeras peticiones fallan; los reintentos tienen éxito.
      'GET /users/me': sequence(
        unauthorized,
        unauthorized,
        unauthorized,
        json(200, user),
      ),
    });
    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    const found = await act(() =>
      Promise.all([
        result.current.request<SessionUser>('/users/me'),
        result.current.request<SessionUser>('/users/me'),
        result.current.request<SessionUser>('/users/me'),
      ]),
    );

    expect(found).toEqual([user, user, user]);
    // Una carga inicial y una sola renovación para las tres peticiones.
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(2);
  });

  it('cierra la sesión si la renovación falla al reintentar', async () => {
    stubApi({
      'POST /auth/refresh': unauthorized,
      'POST /auth/login': json(200, { ...session, user }),
      'GET /users/me': unauthorized,
    });
    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    await act(() =>
      result.current.login('ana@example.com', 'una frase de prueba larga'),
    );

    await act(async () => {
      await expect(result.current.request('/users/me')).rejects.toMatchObject({
        status: 401,
      });
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.user).toBeNull();
  });

  it('cierra la sesión local aunque la API falle al hacer logout', async () => {
    stubApi({
      'POST /auth/refresh': json(200, session),
      'GET /users/me': json(200, user),
      'POST /auth/logout': () => new Response('error', { status: 500 }),
    });
    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(() => result.current.logout());

    expect(result.current.status).toBe('anonymous');
    expect(result.current.user).toBeNull();
  });

  it('llama a logout en la API al cerrar sesión', async () => {
    const fetchMock = stubApi({
      'POST /auth/refresh': json(200, session),
      'GET /users/me': json(200, user),
      'POST /auth/logout': noContent,
    });
    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(() => result.current.logout());

    expect(callsTo(fetchMock, '/auth/logout')).toHaveLength(1);
    expect(result.current.status).toBe('anonymous');
  });
});
