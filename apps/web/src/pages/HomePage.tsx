import { useState } from 'react';
import { useAuth } from '../auth/useAuth';

export function HomePage() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  return (
    <main>
      <h1>PantryMind</h1>
      <p>Has iniciado sesión como {user?.email}.</p>
      <button type="button" onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </main>
  );
}
