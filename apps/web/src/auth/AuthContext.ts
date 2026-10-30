import { createContext } from 'react';

export interface SessionUser {
  id: string;
  email: string;
}

/** `loading` mientras se comprueba la cookie al cargar la página. */
export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

export interface AuthContextValue {
  status: SessionStatus;
  user: SessionUser | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  /** Petición a la API con el token de acceso. Renueva la sesión una vez si hace falta. */
  request<T>(path: string, options?: RequestOptions): Promise<T>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
