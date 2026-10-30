/** Error devuelto por la API. Solo lleva el estado, el mensaje y los campos. */
export class ApiError extends Error {
  readonly status: number;
  /** Motivo por campo, para los errores 400 de validación. */
  readonly fields: Partial<Record<string, string>>;

  constructor(
    status: number,
    message: string,
    fields: Partial<Record<string, string>>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Token de acceso. Solo se envía cuando la petición lo necesita. */
  token?: string | null;
}

interface ErrorBody {
  message?: unknown;
  errors?: unknown;
}

// La API usa "/" como origen relativo: en desarrollo, Vite lo reenvía a la API.
const API_ORIGIN = '';

const GENERIC_MESSAGE = 'La operación no se ha podido completar';

function readFields(body: ErrorBody): Record<string, string> {
  if (!Array.isArray(body.errors)) {
    return {};
  }
  const fields: Record<string, string> = {};
  for (const item of body.errors as Array<{
    field?: unknown;
    reason?: unknown;
  } | null>) {
    if (typeof item?.field === 'string' && typeof item?.reason === 'string') {
      fields[item.field] = item.reason;
    }
  }
  return fields;
}

/**
 * Hace una petición JSON a la API. Devuelve el cuerpo de la respuesta, o
 * undefined si no hay contenido (204). Si la respuesta no es un éxito, lanza
 * un ApiError: nunca devuelve un error como si fuera un resultado.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_ORIGIN}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  // Una respuesta que no es JSON (por ejemplo, un error de proxy) no rompe la
  // aplicación: se trata como un cuerpo vacío.
  const body = (await response.json().catch(() => null)) as T & ErrorBody;

  if (!response.ok) {
    const message =
      typeof body?.message === 'string' ? body.message : GENERIC_MESSAGE;
    throw new ApiError(response.status, message, readFields(body ?? {}));
  }

  return body;
}
