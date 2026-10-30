import { Link } from 'react-router';
import { RegisterForm } from '../auth/RegisterForm';

export function RegisterPage() {
  return (
    <main>
      <h1>Crear cuenta</h1>
      <RegisterForm />
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
      </p>
    </main>
  );
}
