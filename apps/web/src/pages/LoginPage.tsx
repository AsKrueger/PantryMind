import { Link, useLocation } from 'react-router';
import { LoginForm } from '../auth/LoginForm';

export function LoginPage() {
  // Tras crear la cuenta, RegisterForm indica en el estado de la ruta que se
  // ha registrado correctamente.
  const location = useLocation();
  const registered =
    (location.state as { registered?: boolean } | null)?.registered === true;

  return (
    <main>
      <h1>Iniciar sesión</h1>
      {registered && (
        <p role="status">Cuenta creada. Ya puedes iniciar sesión.</p>
      )}
      <LoginForm />
      <p>
        ¿No tienes cuenta? <Link to="/register">Crear cuenta</Link>
      </p>
    </main>
  );
}
