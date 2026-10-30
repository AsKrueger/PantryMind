import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../api/client';
import { useAuth } from './useAuth';
import {
  validateEmail,
  validateNewPassword,
  type FieldErrors,
} from './validation';

const CONNECTION_MESSAGE =
  'No se ha podido conectar con el servidor. Inténtalo de nuevo.';

export function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fieldErrors: FieldErrors = {
      email: validateEmail(email),
      password: validateNewPassword(password),
    };
    setErrors(fieldErrors);
    setFormError(undefined);
    if (fieldErrors.email || fieldErrors.password) {
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim().toLowerCase(), password);
      // El registro no inicia sesión: se pide entrar con la cuenta nueva.
      navigate('/login', { replace: true, state: { registered: true } });
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
          aria-describedby={errors.email ? 'register-email-error' : undefined}
        />
      </label>
      {errors.email && (
        <p id="register-email-error" className="field-error">
          {errors.email}
        </p>
      )}

      <label>
        Contraseña (entre 15 y 128 caracteres)
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? 'register-password-error' : undefined
          }
        />
      </label>
      {errors.password && (
        <p id="register-password-error" className="field-error">
          {errors.password}
        </p>
      )}

      {formError && (
        <p role="alert" className="form-error">
          {formError}
        </p>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
