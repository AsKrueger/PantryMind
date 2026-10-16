import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service.js';
import {
  EmailAlreadyRegisteredError,
  UsersService,
} from '../users/users.service.js';
import { AccessTokenService } from './access-token.service.js';
import {
  EMAIL_CONFLICT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  UNAUTHORIZED_MESSAGE,
} from './auth.messages.js';
import { AuthService } from './auth.service.js';
import { PasswordHasherService } from './password-hasher.service.js';

const DUMMY_HASH = 'dummy-hash';
const user = {
  id: '6f1c2f9e-6a0e-4f43-9d4a-2a3f2c1b0a99',
  email: 'ana@example.com',
  createdAt: new Date('2026-10-16T10:00:00Z'),
};
const credentials = {
  id: user.id,
  email: user.email,
  passwordHash: 'stored-hash',
};
const password = 'correct horse battery staple';
const accessToken = { accessToken: 'access-token', expiresIn: 900 };

describe('AuthService', () => {
  let users: {
    create: ReturnType<typeof vi.fn>;
    findCredentialsByEmail: ReturnType<typeof vi.fn>;
  };
  let hasher: {
    hash: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
  };
  let accessTokens: { sign: ReturnType<typeof vi.fn> };
  let refreshTokens: {
    issue: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    revokeFamily: ReturnType<typeof vi.fn>;
  };
  let auth: AuthService;

  beforeEach(async () => {
    users = { create: vi.fn(), findCredentialsByEmail: vi.fn() };
    hasher = {
      hash: vi.fn().mockResolvedValueOnce(DUMMY_HASH),
      verify: vi.fn(),
    };
    accessTokens = { sign: vi.fn().mockResolvedValue(accessToken) };
    refreshTokens = {
      issue: vi.fn(),
      rotate: vi.fn(),
      revokeFamily: vi.fn(),
    };
    auth = new AuthService(
      users as unknown as UsersService,
      hasher as unknown as PasswordHasherService,
      accessTokens as unknown as AccessTokenService,
      refreshTokens as unknown as RefreshTokensService,
    );
    await auth.onModuleInit();
  });

  describe('register', () => {
    it('stores the hash, never the password, and returns the public user', async () => {
      hasher.hash.mockResolvedValueOnce('new-hash');
      users.create.mockResolvedValueOnce(user);

      await expect(
        auth.register({ email: user.email, password }),
      ).resolves.toEqual(user);
      expect(hasher.hash).toHaveBeenLastCalledWith(password);
      expect(users.create).toHaveBeenCalledWith(user.email, 'new-hash');
    });

    it('does not open a session', async () => {
      hasher.hash.mockResolvedValueOnce('new-hash');
      users.create.mockResolvedValueOnce(user);

      await auth.register({ email: user.email, password });

      expect(refreshTokens.issue).not.toHaveBeenCalled();
      expect(accessTokens.sign).not.toHaveBeenCalled();
    });

    it('responds 409 with a generic message when the email is taken', async () => {
      hasher.hash.mockResolvedValueOnce('new-hash');
      users.create.mockRejectedValueOnce(new EmailAlreadyRegisteredError());

      await expect(
        auth.register({ email: user.email, password }),
      ).rejects.toThrow(new ConflictException(EMAIL_CONFLICT_MESSAGE));
    });

    it('lets unexpected errors through', async () => {
      hasher.hash.mockResolvedValueOnce('new-hash');
      users.create.mockRejectedValueOnce(new Error('database down'));

      await expect(
        auth.register({ email: user.email, password }),
      ).rejects.toThrow('database down');
    });
  });

  describe('login', () => {
    it('opens a session when the password is right', async () => {
      users.findCredentialsByEmail.mockResolvedValueOnce(credentials);
      hasher.verify.mockResolvedValueOnce(true);
      refreshTokens.issue.mockResolvedValueOnce('refresh-token');

      await expect(
        auth.login({ email: user.email, password }),
      ).resolves.toEqual({
        ...accessToken,
        refreshToken: 'refresh-token',
        user: { id: user.id, email: user.email },
      });
      expect(hasher.verify).toHaveBeenCalledWith('stored-hash', password);
      expect(refreshTokens.issue).toHaveBeenCalledWith(user.id);
      expect(accessTokens.sign).toHaveBeenCalledWith(user.id);
    });

    it('responds 401 and opens no session when the password is wrong', async () => {
      users.findCredentialsByEmail.mockResolvedValueOnce(credentials);
      hasher.verify.mockResolvedValueOnce(false);

      await expect(auth.login({ email: user.email, password })).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE),
      );
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('verifies against the dummy hash and responds the same 401 when the email does not exist', async () => {
      users.findCredentialsByEmail.mockResolvedValueOnce(null);
      hasher.verify.mockResolvedValueOnce(false);

      await expect(
        auth.login({ email: 'nobody@example.com', password }),
      ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE));
      expect(hasher.verify).toHaveBeenCalledWith(DUMMY_HASH, password);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and signs a new access token', async () => {
      refreshTokens.rotate.mockResolvedValueOnce({
        userId: user.id,
        token: 'new-refresh-token',
      });

      await expect(auth.refresh('old-refresh-token')).resolves.toEqual({
        ...accessToken,
        refreshToken: 'new-refresh-token',
      });
      expect(refreshTokens.rotate).toHaveBeenCalledWith('old-refresh-token');
      expect(accessTokens.sign).toHaveBeenCalledWith(user.id);
    });

    it('responds 401 when the token cannot be rotated', async () => {
      refreshTokens.rotate.mockResolvedValueOnce(null);

      await expect(auth.refresh('used-refresh-token')).rejects.toThrow(
        new UnauthorizedException(UNAUTHORIZED_MESSAGE),
      );
      expect(accessTokens.sign).not.toHaveBeenCalled();
    });

    it('responds 401 when there is no cookie', async () => {
      await expect(auth.refresh(undefined)).rejects.toThrow(
        new UnauthorizedException(UNAUTHORIZED_MESSAGE),
      );
      expect(refreshTokens.rotate).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the family of the refresh token', async () => {
      await auth.logout('refresh-token');

      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('refresh-token');
    });

    it('does nothing when there is no cookie', async () => {
      await auth.logout(undefined);

      expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    });
  });
});
