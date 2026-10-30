import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider.tsx';
import {
  callsTo,
  json,
  noContent,
  sequence,
  stubApi,
} from './test/stub-api.ts';

const user = { id: 'u1', email: 'ana@example.com' };
const password = 'una frase de prueba larga';
const anonymous = json(401, {
  message: 'No autorizado',
  error: 'Unauthorized',
  statusCode: 401,
});

function renderAt(path: string) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe('flujo de acceso', () => {
  it('sin sesión, la página protegida lleva a iniciar sesión', async () => {
    stubApi({ 'POST /auth/refresh': anonymous });

    renderAt('/');

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });

  it('muestra errores de validación sin llamar a la API', async () => {
    const fetchMock = stubApi({ 'POST /auth/refresh': anonymous });
    renderAt('/login');
    await screen.findByRole('heading', { name: 'Iniciar sesión' });

    await userEvent.click(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    );

    expect(
      screen.getByText('Escribe tu correo electrónico'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escribe tu contraseña')).toBeInTheDocument();
    expect(callsTo(fetchMock, '/auth/login')).toHaveLength(0);
  });

  it('inicia sesión, muestra la página protegida y cierra sesión', async () => {
    const fetchMock = stubApi({
      'POST /auth/refresh': anonymous,
      'POST /auth/login': json(200, { accessToken: 't', expiresIn: 900, user }),
      'POST /auth/logout': noContent,
    });
    renderAt('/login');
    await screen.findByRole('heading', { name: 'Iniciar sesión' });

    await userEvent.type(
      screen.getByLabelText('Correo electrónico'),
      'Ana@Example.com ',
    );
    await userEvent.type(screen.getByLabelText('Contraseña'), password);
    await userEvent.click(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    );

    expect(
      await screen.findByText('Has iniciado sesión como ana@example.com.'),
    ).toBeInTheDocument();
    expect(callsTo(fetchMock, '/auth/login')).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(callsTo(fetchMock, '/auth/logout')).toHaveLength(1);
  });

  it('muestra el mensaje genérico de la API si las credenciales no sirven', async () => {
    stubApi({
      'POST /auth/refresh': anonymous,
      'POST /auth/login': json(401, {
        message: 'Correo o contraseña incorrectos',
        error: 'Unauthorized',
        statusCode: 401,
      }),
    });
    renderAt('/login');
    await screen.findByRole('heading', { name: 'Iniciar sesión' });

    await userEvent.type(
      screen.getByLabelText('Correo electrónico'),
      'ana@example.com',
    );
    await userEvent.type(screen.getByLabelText('Contraseña'), password);
    await userEvent.click(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Correo o contraseña incorrectos',
    );
  });

  it('con sesión, /login lleva a la página principal', async () => {
    stubApi({
      'POST /auth/refresh': json(200, { accessToken: 't', expiresIn: 900 }),
      'GET /users/me': json(200, user),
    });

    renderAt('/login');

    expect(
      await screen.findByText('Has iniciado sesión como ana@example.com.'),
    ).toBeInTheDocument();
  });

  it('rechaza una contraseña de 14 caracteres al registrarse, sin llamar a la API', async () => {
    const fetchMock = stubApi({ 'POST /auth/refresh': anonymous });
    renderAt('/register');
    await screen.findByRole('heading', { name: 'Crear cuenta' });

    await userEvent.type(
      screen.getByLabelText('Correo electrónico'),
      'ana@example.com',
    );
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'a'.repeat(14));
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      screen.getByText('Debe tener al menos 15 caracteres'),
    ).toBeInTheDocument();
    expect(callsTo(fetchMock, '/auth/register')).toHaveLength(0);
  });

  it('muestra el 409 de la API cuando el correo ya existe', async () => {
    stubApi({
      'POST /auth/refresh': anonymous,
      'POST /auth/register': json(409, {
        message: 'No se ha podido completar el registro con ese correo',
        error: 'Conflict',
        statusCode: 409,
      }),
    });
    renderAt('/register');
    await screen.findByRole('heading', { name: 'Crear cuenta' });

    await userEvent.type(
      screen.getByLabelText('Correo electrónico'),
      'ana@example.com',
    );
    await userEvent.type(screen.getByLabelText(/Contraseña/), password);
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha podido completar el registro con ese correo',
    );
  });

  it('tras registrarse, lleva a iniciar sesión con un aviso y sin sesión abierta', async () => {
    const fetchMock = stubApi({
      'POST /auth/refresh': anonymous,
      'POST /auth/register': json(201, {
        id: 'u1',
        email: 'ana@example.com',
        createdAt: '',
      }),
    });
    renderAt('/register');
    await screen.findByRole('heading', { name: 'Crear cuenta' });

    await userEvent.type(
      screen.getByLabelText('Correo electrónico'),
      'ana@example.com',
    );
    await userEvent.type(screen.getByLabelText(/Contraseña/), password);
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cuenta creada. Ya puedes iniciar sesión.',
    );
    expect(callsTo(fetchMock, '/auth/login')).toHaveLength(0);
  });

  it('una ruta desconocida lleva a la página principal', async () => {
    stubApi({
      'POST /auth/refresh': sequence(anonymous),
    });

    renderAt('/no-existe');

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Iniciar sesión' }),
      ).toBeInTheDocument(),
    );
  });
});
