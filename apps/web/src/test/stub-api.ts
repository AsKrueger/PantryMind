import { vi } from 'vitest';

/** Respuesta preparada. Es una función porque un Response solo se puede leer una vez. */
export type Reply = () => Response;

export function json(status: number, body: unknown): Reply {
  return () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

export const noContent: Reply = () => new Response(null, { status: 204 });

/** Varias respuestas para la misma petición, en orden. La última se repite. */
export function sequence(...replies: Reply[]): Reply {
  let index = 0;
  return () => replies[Math.min(index++, replies.length - 1)]();
}

/**
 * Sustituye fetch por un simulador. Las claves son "MÉTODO ruta". Una
 * petición sin respuesta preparada falla, para que ninguna llamada inesperada
 * pase desapercibida.
 */
export function stubApi(routes: Record<string, Reply>) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`;
      const reply = routes[key];
      if (!reply) {
        throw new Error(`Petición sin respuesta simulada: ${key}`);
      }
      return reply();
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Cuenta las llamadas hechas a una ruta concreta, con cualquier método. */
export function callsTo(fetchMock: ReturnType<typeof stubApi>, path: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input) === path);
}
