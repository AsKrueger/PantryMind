import { ConflictException, UnauthorizedException } from '@nestjs/common';
import {
  EmailAlreadyRegisteredError,
  UsersService,
} from '../users/users.service.js';
import {
  AuthService,
  EMAIL_CONFLICT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
} from './auth.service.js';
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

describe('AuthService', () => {
  let users: {
    create: ReturnType<typeof vi.fn>;
    findCredentialsByEmail: ReturnType<typeof vi.fn>;
  };
  let hasher: {
    hash: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
  };
  let auth: AuthService;

  beforeEach(async () => {
    users = { create: vi.fn(), findCredentialsByEmail: vi.fn() };
    hasher = {
      hash: vi.fn().mockResolvedValueOnce(DUMMY_HASH),
      verify: vi.fn(),
    };
    auth = new AuthService(
      users as unknown as UsersService,
      hasher as unknown as PasswordHasherService,
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

    it('responds 409 with a generic message when the email is taken', async () => {
      hasher.hash.mockResolvedValueOnce('new-hash');
      users.create.mockRejectedValueOnce(new EmailAlreadyRegisteredError());

      const error = await auth
        .register({ email: user.email, password })
        .catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(EMAIL_CONFLICT_MESSAGE);
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
    it('returns the id and email when the password is right', async () => {
      users.findCredentialsByEmail.mockResolvedValueOnce(credentials);
      hasher.verify.mockResolvedValueOnce(true);

      await expect(
        auth.login({ email: user.email, password }),
      ).resolves.toEqual({ id: user.id, email: user.email });
      expect(hasher.verify).toHaveBeenCalledWith('stored-hash', password);
    });

    it('responds 401 when the password is wrong', async () => {
      users.findCredentialsByEmail.mockResolvedValueOnce(credentials);
      hasher.verify.mockResolvedValueOnce(false);

      await expect(auth.login({ email: user.email, password })).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE),
      );
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
});
