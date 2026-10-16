import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenGuard } from './access-token.guard.js';
import { AccessTokenService } from './access-token.service.js';
import { UNAUTHORIZED_MESSAGE } from './auth.messages.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';

const userId = '6f1c2f9e-6a0e-4f43-9d4a-2a3f2c1b0a99';

function contextFor(request: AuthenticatedRequest) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AccessTokenGuard', () => {
  let isPublic: boolean | undefined;
  let verify: ReturnType<typeof vi.fn>;
  let guard: AccessTokenGuard;

  beforeEach(() => {
    isPublic = undefined;
    verify = vi.fn(async (token: string) =>
      token === 'valid-token' ? userId : null,
    );
    const reflector = {
      getAllAndOverride: () => isPublic,
    } as unknown as Reflector;
    guard = new AccessTokenGuard(reflector, {
      verify,
    } as unknown as AccessTokenService);
  });

  it('lets a public route through without a token', async () => {
    isPublic = true;

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a protected route without a token', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toThrow(new UnauthorizedException(UNAUTHORIZED_MESSAGE));
  });

  it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'valid-token', 'Bearer a b'])(
    'rejects the Authorization header %j',
    async (authorization) => {
      await expect(
        guard.canActivate(contextFor({ headers: { authorization } })),
      ).rejects.toThrow(UnauthorizedException);
    },
  );

  it('rejects a protected route with an invalid token', async () => {
    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: 'Bearer forged-token' } }),
      ),
    ).rejects.toThrow(new UnauthorizedException(UNAUTHORIZED_MESSAGE));
    expect(verify).toHaveBeenCalledWith('forged-token');
  });

  it('accepts a valid token and leaves the user in the request', async () => {
    const request: AuthenticatedRequest = {
      headers: { authorization: 'Bearer valid-token' },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: userId });
  });

  it('accepts the scheme in any case', async () => {
    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: 'bearer valid-token' } }),
      ),
    ).resolves.toBe(true);
  });
});
