import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiRequest } from '../api/client';
import {
  AuthContext,
  type AuthContextValue,
  type RequestOptions,
  type SessionStatus,
  type SessionUser,
} from './AuthContext';

/** Respuesta de login y de refresh: el token de acceso y su duración en segundos. */
interface AccessTokenResponse {
  accessToken: string;
  expiresIn: number;
}

interface LoginResponse extends AccessTokenResponse {
  user: SessionUser;
}

// Se renueva el token al 80 % de su duración, antes de que caduque.
const REFRESH_AHEAD = 0.8;

/**
 * Sesión de la web. El token de acceso vive solo en memoria: nunca en
 * localStorage ni en sessionStorage. El refresh token viaja en la cookie
 * HttpOnly, que el JavaScript de la página no puede leer.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  // Refs en lugar de estado: cambiarlos no debe provocar renders.
  const accessToken = useRef<string | null>(null);
  const refreshTimer = useRef<number | undefined>(undefined);
  const inFlightRefresh = useRef<Promise<boolean> | null>(null);
  const restoring = useRef<Promise<void> | null>(null);

  function remember(session: AccessTokenResponse) {
    accessToken.current = session.accessToken;
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(
      () => {
        void refresh().then((ok) => {
          if (!ok) {
            forget();
          }
        });
      },
      session.expiresIn * 1000 * REFRESH_AHEAD,
    );
  }

  function forget() {
    accessToken.current = null;
    window.clearTimeout(refreshTimer.current);
    setUser(null);
    setStatus('anonymous');
  }

  /**
   * Cambia la cookie por un token de acceso nuevo. Si ya hay una renovación en
   * curso, espera a esa en lugar de lanzar otra: el refresh token rota, así
   * que dos renovaciones a la vez usarían la misma cookie y la API revocaría
   * la sesión por reutilización.
   */
  function refresh(): Promise<boolean> {
    inFlightRefresh.current ??= apiRequest<AccessTokenResponse>(
      '/auth/refresh',
      {
        method: 'POST',
      },
    )
      .then(
        (session) => {
          remember(session);
          return true;
        },
        () => false,
      )
      .finally(() => {
        inFlightRefresh.current = null;
      });
    return inFlightRefresh.current;
  }

  /** Al cargar la página: si la cookie sirve, recupera la sesión. */
  async function restore() {
    if (!(await refresh())) {
      setStatus('anonymous');
      return;
    }
    try {
      setUser(
        await apiRequest<SessionUser>('/users/me', {
          token: accessToken.current,
        }),
      );
      setStatus('authenticated');
    } catch {
      forget();
    }
  }

  // StrictMode ejecuta los efectos dos veces en desarrollo. Como el refresh
  // rota la cookie, la segunda llamada reutilizaría la cookie ya usada y la
  // API revocaría la sesión. Por eso la restauración se lanza una sola vez.
  useEffect(() => {
    restoring.current ??= restore();
    return () => window.clearTimeout(refreshTimer.current);
    // Solo al montar: las funciones de sesión usan refs y setters estables.
  }, []);

  async function login(email: string, password: string) {
    const session = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    remember(session);
    setUser(session.user);
    setStatus('authenticated');
  }

  async function register(email: string, password: string) {
    await apiRequest<SessionUser>('/auth/register', {
      method: 'POST',
      body: { email, password },
    });
  }

  async function logout() {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } catch {
      // Aunque la API no responda, la sesión de esta pestaña se cierra igual.
    }
    forget();
  }

  async function send<T>(
    path: string,
    options: RequestOptions,
    retried: boolean,
  ): Promise<T> {
    try {
      return await apiRequest<T>(path, {
        ...options,
        token: accessToken.current,
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || retried) {
        throw error;
      }
      if (!(await refresh())) {
        forget();
        throw error;
      }
      return send<T>(path, options, true);
    }
  }

  const value: AuthContextValue = {
    status,
    user,
    login,
    register,
    logout,
    request: (path, options = {}) => send(path, options, false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
