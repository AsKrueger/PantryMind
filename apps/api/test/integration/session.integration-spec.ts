import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../../src/app.module.js';
import { PrismaService } from './../../src/prisma/prisma.service.js';
import { hashRefreshToken } from './../../src/refresh-tokens/refresh-tokens.service.js';

const email = 'ana@example.com';
const password = 'correct horse battery staple';
const unauthorized = {
  message: 'No autorizado',
  error: 'Unauthorized',
  statusCode: 401,
};

/** Cabecera Set-Cookie del refresh token, o undefined si no hay. */
function refreshSetCookie(response: Response): string | undefined {
  const header = response.headers['set-cookie'] as unknown as
    string[] | undefined;
  return header?.find((cookie) => cookie.startsWith('pm_refresh='));
}

/** Valor del refresh token que la respuesta deja en la cookie. */
function refreshCookieValue(response: Response): string {
  const cookie = refreshSetCookie(response);
  if (!cookie) {
    throw new Error('The response does not set the refresh cookie');
  }
  return decodeURIComponent(cookie.split(';')[0].slice('pm_refresh='.length));
}

describe('Session (integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

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
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    userId = response.body.id;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
  });

  const login = () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
  const refresh = (token?: string) => {
    const call = request(app.getHttpServer()).post('/auth/refresh');
    return token ? call.set('Cookie', `pm_refresh=${token}`) : call;
  };
  const me = (authorization?: string) => {
    const call = request(app.getHttpServer()).get('/users/me');
    return authorization ? call.set('Authorization', authorization) : call;
  };

  describe('POST /auth/login', () => {
    it('returns an access token and sets the refresh cookie', async () => {
      const response = await login();

      expect(Object.keys(response.body).sort()).toEqual([
        'accessToken',
        'expiresIn',
        'user',
      ]);
      expect(response.body.expiresIn).toBe(900);
      expect(response.body.user).toEqual({ id: userId, email });

      const cookie = refreshSetCookie(response)!;
      expect(cookie).toMatch(/; HttpOnly/);
      expect(cookie).toMatch(/; SameSite=Strict/);
      expect(cookie).toMatch(/; Path=\/auth(;|$)/);
      expect(cookie).toMatch(/; Max-Age=604800/);
      // NODE_ENV=test: sin HTTPS no se marca Secure.
      expect(cookie).not.toMatch(/; Secure/);
      // El refresh token no va en el cuerpo.
      expect(response.text).not.toContain(refreshCookieValue(response));
    });

    it('stores only the hash of the refresh token', async () => {
      const token = refreshCookieValue(await login());

      const rows = await prisma.refreshToken.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(hashRefreshToken(token));
      expect(JSON.stringify(rows)).not.toContain(token);
    });
  });

  describe('GET /users/me', () => {
    it('responds 401 without a token', async () => {
      await me().expect(401).expect(unauthorized);
    });

    it('responds 401 with a manipulated token', async () => {
      const { accessToken } = (await login()).body as { accessToken: string };
      const [header, , signature] = accessToken.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ sub: userId, iat: 1, exp: 9999999999 }),
      ).toString('base64url');

      await me(`Bearer ${header}.${forgedPayload}.${signature}`)
        .expect(401)
        .expect(unauthorized);
    });

    it('responds 401 with an expired token', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
      const { accessToken } = (await login()).body as { accessToken: string };

      vi.setSystemTime(new Date('2026-10-16T10:15:01Z'));
      await me(`Bearer ${accessToken}`).expect(401).expect(unauthorized);
    });

    it('responds 200 with the user when the token is valid', async () => {
      const { accessToken } = (await login()).body as { accessToken: string };

      const response = await me(`Bearer ${accessToken}`).expect(200);
      expect(Object.keys(response.body).sort()).toEqual([
        'createdAt',
        'email',
        'id',
      ]);
      expect(response.body).toMatchObject({ id: userId, email });
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns a new access token and rotates the cookie', async () => {
      const first = refreshCookieValue(await login());

      const response = await refresh(first).expect(200);

      expect(Object.keys(response.body).sort()).toEqual([
        'accessToken',
        'expiresIn',
      ]);
      await me(`Bearer ${response.body.accessToken}`).expect(200);
      const second = refreshCookieValue(response);
      expect(second).not.toBe(first);

      // El anterior deja de servir.
      await refresh(first).expect(401).expect(unauthorized);
    });

    it('revokes the whole family when a rotated token is reused', async () => {
      const first = refreshCookieValue(await login());
      const second = refreshCookieValue(await refresh(first).expect(200));

      await refresh(first).expect(401);

      // También el más reciente ha quedado revocado.
      await refresh(second).expect(401).expect(unauthorized);
      const rows = await prisma.refreshToken.findMany();
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    });

    it('gives a new token to only one of two simultaneous requests', async () => {
      const token = refreshCookieValue(await login());

      const responses = await Promise.all([refresh(token), refresh(token)]);

      expect(
        responses.map((response) => response.status).sort((a, b) => a - b),
      ).toEqual([200, 401]);
      // Dos tokens en la familia: el original y el único que se ha emitido.
      expect(await prisma.refreshToken.count()).toBe(2);
    });

    it('responds 401 when the refresh token has expired', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
      const token = refreshCookieValue(await login());

      vi.setSystemTime(new Date('2026-10-23T10:00:01Z'));
      await refresh(token).expect(401).expect(unauthorized);
    });

    it('responds 401 without a cookie or with an unknown one', async () => {
      await refresh().expect(401).expect(unauthorized);
      await refresh('not-a-real-token').expect(401).expect(unauthorized);
    });

    it('clears the cookie when it is rejected', async () => {
      const response = await refresh('not-a-real-token').expect(401);

      expect(refreshSetCookie(response)).toMatch(/^pm_refresh=;/);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const token = refreshCookieValue(await login());

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', `pm_refresh=${token}`)
        .expect(204);

      const cookie = refreshSetCookie(response)!;
      expect(cookie).toMatch(/^pm_refresh=;/);
      expect(cookie).toMatch(/; Path=\/auth(;|$)/);
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
      await refresh(token).expect(401);
    });

    it('responds 204 without a valid cookie', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(204);
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', 'pm_refresh=not-a-real-token')
        .expect(204);
    });
  });

  it('deleting a user deletes their refresh tokens', async () => {
    await login();
    await login();
    expect(await prisma.refreshToken.count()).toBe(2);

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.refreshToken.count()).toBe(0);
  });
});
