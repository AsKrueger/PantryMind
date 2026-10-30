import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from './useAuth';
import {
  validateCurrentPassword,
  validateEmail,
  type FieldErrors,
} from './validation';

// Respuesta genérica cuando la API no responde o no hay conexión.
const CONNECTION_MESSAGE =
  'No se ha podido conectar con el servidor. Inténtalo de nuevo.';

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fieldErrors: FieldErrors = {
      email: validateEmail(email),
      password: validateCurrentPassword(password),
    };
    setErrors(fieldErrors);
    setFormError(undefined);
    if (fieldErrors.email || fieldErrors.password) {
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields);
      } else {
        setFormError(
          error instanceof ApiError ? error.message : CONNECTION_MESSAGE,
        );
      }
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label>
        Correo electrónico
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
        />
      </label>
      {errors.email && (
        <p id="login-email-error" className="field-error">
          {errors.email}
        </p>
      )}

      <label>
        Contraseña
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? 'login-password-error' : undefined
          }
        />
      </label>
      {errors.password && (
        <p id="login-password-error" className="field-error">
          {errors.password}
        </p>
      )}

      {formError && (
        <p role="alert" className="form-error">
          {formError}
        </p>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Entrando…' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
