import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Env } from '../config/env.js';
import {
  AccessTokenService,
  accessTokenJwtOptions,
} from './access-token.service.js';

const secret = 'unit-test-secret-with-at-least-32-chars';
const ttlSeconds = 900;
const userId = '6f1c2f9e-6a0e-4f43-9d4a-2a3f2c1b0a99';

function serviceWith(jwtSecret: string) {
  const config = {
    get: () => ttlSeconds,
  } as unknown as ConfigService<Env, true>;
  return new AccessTokenService(
    new JwtService(accessTokenJwtOptions(jwtSecret, ttlSeconds)),
    config,
  );
}

function decodePart(token: string, index: number): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(token.split('.')[index], 'base64url').toString(),
  ) as Record<string, unknown>;
}

describe('AccessTokenService', () => {
  const tokens = serviceWith(secret);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('signs an HS256 token with only sub, iat and exp', async () => {
    const { accessToken, expiresIn } = await tokens.sign(userId);

    expect(expiresIn).toBe(ttlSeconds);
    expect(decodePart(accessToken, 0)).toEqual({ alg: 'HS256', typ: 'JWT' });
    const payload = decodePart(accessToken, 1);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
    expect(payload.sub).toBe(userId);
    expect(Number(payload.exp) - Number(payload.iat)).toBe(ttlSeconds);
  });

  it('verifies a valid token', async () => {
    const { accessToken } = await tokens.sign(userId);

    await expect(tokens.verify(accessToken)).resolves.toBe(userId);
  });

  it('rejects a token signed with another secret', async () => {
    const { accessToken } = await serviceWith(
      'another-secret-with-at-least-32-chars',
    ).sign(userId);

    await expect(tokens.verify(accessToken)).resolves.toBeNull();
  });

  it('rejects a token whose payload was modified', async () => {
    const { accessToken } = await tokens.sign(userId);
    const [header, , signature] = accessToken.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'someone-else', iat: 1, exp: 9999999999 }),
    ).toString('base64url');

    await expect(
      tokens.verify(`${header}.${forgedPayload}.${signature}`),
    ).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
    const { accessToken } = await tokens.sign(userId);

    vi.setSystemTime(new Date('2026-10-16T10:14:59Z'));
    await expect(tokens.verify(accessToken)).resolves.toBe(userId);

    vi.setSystemTime(new Date('2026-10-16T10:15:01Z'));
    await expect(tokens.verify(accessToken)).resolves.toBeNull();
  });

  it('rejects a token signed with another algorithm', async () => {
    const hs512 = await new JwtService({ secret }).signAsync(
      { sub: userId },
      { algorithm: 'HS512', expiresIn: ttlSeconds },
    );

    await expect(tokens.verify(hs512)).resolves.toBeNull();
  });

  it('rejects an unsigned token ("alg": "none")', async () => {
    const encode = (part: object) =>
      Buffer.from(JSON.stringify(part)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: userId,
      iat: now,
      exp: now + ttlSeconds,
    })}.`;

    await expect(tokens.verify(unsigned)).resolves.toBeNull();
  });

  it('rejects something that is not a JWT', async () => {
    await expect(tokens.verify('not-a-jwt')).resolves.toBeNull();
  });
});
