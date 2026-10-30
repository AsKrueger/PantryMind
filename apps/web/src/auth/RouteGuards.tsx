import { Navigate, Outlet } from 'react-router';
import { useAuth } from './useAuth';

/** Rutas protegidas: sin sesión, lleva a /login. */
export function RequireAuth() {
  const { status } = useAuth();
  if (status === 'loading') {
    return <p>Cargando…</p>;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/** Rutas solo para visitantes: con sesión, lleva a la página principal. */
export function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') {
    return <p>Cargando…</p>;
  }
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
