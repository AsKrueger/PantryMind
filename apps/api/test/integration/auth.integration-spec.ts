import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../../src/app.module.js';
import { PrismaService } from './../../src/prisma/prisma.service.js';

const password = 'correct horse battery staple';

describe('Auth (integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const register = (body: object) =>
    request(app.getHttpServer()).post('/auth/register').send(body);
  const login = (body: object) =>
    request(app.getHttpServer()).post('/auth/login').send(body);

  describe('POST /auth/register', () => {
    it('creates the user and stores an Argon2id hash', async () => {
      const response = await register({ email: 'ana@example.com', password });

      expect(response.status).toBe(201);
      expect(Object.keys(response.body).sort()).toEqual([
        'createdAt',
        'email',
        'id',
      ]);
      expect(response.body.email).toBe('ana@example.com');
      expect(response.text).not.toContain(password);
      expect(response.text).not.toContain('argon2');

      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'ana@example.com' },
      });
      expect(stored.id).toBe(response.body.id);
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('responds 409 when the email is already registered', async () => {
      await register({ email: 'ana@example.com', password }).expect(201);

      const response = await register({
        email: 'ana@example.com',
        password: 'another long password',
      });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        'No se ha podido completar el registro con ese correo',
      );
      expect(await prisma.user.count()).toBe(1);
    });

    it('responds 409 for the same email with other case or spaces', async () => {
      await register({ email: 'ana@example.com', password }).expect(201);

      await register({ email: 'Ana@Example.com ', password }).expect(409);
      expect(await prisma.user.count()).toBe(1);
    });

    it('creates only one user when two registrations arrive at once', async () => {
      const responses = await Promise.all([
        register({ email: 'ana@example.com', password }),
        register({ email: 'ana@example.com', password }),
      ]);

      expect(
        responses.map((response) => response.status).sort((a, b) => a - b),
      ).toEqual([201, 409]);
      expect(await prisma.user.count()).toBe(1);
    });

    it('responds 400 with the invalid fields and without the received values', async () => {
      const response = await register({
        email: 'not-an-email-secret',
        password: 'short-secret',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: 'Datos de entrada inválidos',
        errors: [
          { field: 'email', reason: 'debe ser un correo electrónico válido' },
          { field: 'password', reason: 'debe tener al menos 15 caracteres' },
        ],
      });
      expect(response.text).not.toContain('not-an-email-secret');
      expect(response.text).not.toContain('short-secret');
      expect(await prisma.user.count()).toBe(0);
    });

    it('responds 400 when the body is missing', async () => {
      const response = await request(app.getHttpServer()).post(
        '/auth/register',
      );

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    let userId: string;

    beforeEach(async () => {
      const response = await register({ email: 'ana@example.com', password });
      userId = response.body.id;
    });

    it('responds 200 with the user when the credentials are right', async () => {
      const response = await login({ email: 'ana@example.com', password });

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual({
        id: userId,
        email: 'ana@example.com',
      });
      expect(response.text).not.toContain(password);
      expect(response.text).not.toContain('argon2');
    });

    it('accepts the email with other case or spaces', async () => {
      const response = await login({ email: ' ANA@Example.com', password });

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(userId);
    });

    it('responds the same 401 for a wrong password and for an unknown email', async () => {
      const wrongPassword = await login({
        email: 'ana@example.com',
        password: 'wrong password, long enough',
      });
      const unknownEmail = await login({
        email: 'nobody@example.com',
        password,
      });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual({
        statusCode: 401,
        message: 'Correo o contraseña incorrectos',
        error: 'Unauthorized',
      });
      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(unknownEmail.text).toBe(wrongPassword.text);
    });

    it('responds 400 with the invalid fields and without the received values', async () => {
      const response = await login({ email: 'bad-email-secret' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual([
        { field: 'email', reason: 'debe ser un correo electrónico válido' },
        { field: 'password', reason: 'es obligatorio' },
      ]);
      expect(response.text).not.toContain('bad-email-secret');
    });
  });
});
