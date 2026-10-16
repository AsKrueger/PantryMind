import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  hashRefreshToken,
  RefreshTokensService,
} from './refresh-tokens.service.js';

const userId = '6f1c2f9e-6a0e-4f43-9d4a-2a3f2c1b0a99';
const familyId = '0b7e3d1c-2f4a-4b8e-9c6d-5a1f2e3d4c5b';
const stored = { id: 'token-1', userId, familyId };

describe('hashRefreshToken', () => {
  it('returns the SHA-256 hex digest', () => {
    expect(hashRefreshToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('RefreshTokensService', () => {
  let refreshToken: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  let service: RefreshTokensService;

  beforeEach(() => {
    refreshToken = {
      create: vi.fn().mockResolvedValue({ id: 'new' }),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    };
    // La transacción ejecuta la función con el mismo doble.
    const prisma = {
      refreshToken,
      $transaction: (fn: (tx: unknown) => unknown) => fn({ refreshToken }),
    } as unknown as PrismaService;
    const config = { get: () => 7 } as unknown as ConfigService<Env, true>;
    service = new RefreshTokensService(prisma, config);
  });

  const createdData = (call = 0) =>
    (
      refreshToken.create.mock.calls[call][0] as {
        data: Record<string, unknown>;
      }
    ).data;

  describe('issue', () => {
    it('stores only the hash of the value, in a new family', async () => {
      const token = await service.issue(userId);

      const data = createdData();
      expect(data.tokenHash).toBe(hashRefreshToken(token));
      expect(Object.values(data)).not.toContain(token);
      expect(data.userId).toBe(userId);
      expect(data.familyId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('generates 32 random bytes, different each time', async () => {
      const first = await service.issue(userId);
      const second = await service.issue(userId);

      expect(Buffer.from(first, 'base64url')).toHaveLength(32);
      expect(first).not.toBe(second);
      expect(createdData(0).familyId).not.toBe(createdData(1).familyId);
    });

    it('expires after the configured days', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));

      await service.issue(userId);

      expect(createdData().expiresAt).toEqual(new Date('2026-10-23T10:00:00Z'));
      vi.useRealTimers();
    });
  });

  describe('rotate', () => {
    it('revokes the current token only if it is still active, and issues a new one in the same family', async () => {
      refreshToken.findUnique.mockResolvedValueOnce(stored);
      refreshToken.updateMany.mockResolvedValueOnce({ count: 1 });

      const rotated = await service.rotate('current-token');

      expect(refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: hashRefreshToken('current-token') },
        }),
      );
      const [{ where }] = refreshToken.updateMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(where).toMatchObject({ id: stored.id, revokedAt: null });
      expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
      expect(rotated?.userId).toBe(userId);
      expect(rotated?.token).not.toBe('current-token');
      expect(createdData().familyId).toBe(familyId);
      expect(createdData().tokenHash).toBe(hashRefreshToken(rotated!.token));
    });

    it('returns null for an unknown token', async () => {
      refreshToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.rotate('unknown-token')).resolves.toBeNull();
      expect(refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('detects the reuse of a revoked token and revokes the whole family', async () => {
      refreshToken.findUnique.mockResolvedValueOnce(stored);
      refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });
      refreshToken.findUniqueOrThrow.mockResolvedValueOnce({
        revokedAt: new Date(),
      });
      refreshToken.updateMany.mockResolvedValueOnce({ count: 2 });

      await expect(service.rotate('reused-token')).resolves.toBeNull();
      expect(refreshToken.updateMany).toHaveBeenLastCalledWith({
        where: { familyId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(refreshToken.create).not.toHaveBeenCalled();
    });

    it('returns null for an expired token without revoking the family', async () => {
      refreshToken.findUnique.mockResolvedValueOnce(stored);
      refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });
      refreshToken.findUniqueOrThrow.mockResolvedValueOnce({ revokedAt: null });

      await expect(service.rotate('expired-token')).resolves.toBeNull();
      expect(refreshToken.updateMany).toHaveBeenCalledTimes(1);
      expect(refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('revokeFamily', () => {
    it('revokes every active token of the family', async () => {
      refreshToken.findUnique.mockResolvedValueOnce({ familyId });

      await service.revokeFamily('current-token');

      expect(refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('does nothing for an unknown token', async () => {
      refreshToken.findUnique.mockResolvedValueOnce(null);

      await service.revokeFamily('unknown-token');

      expect(refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
