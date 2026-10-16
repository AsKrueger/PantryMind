import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hash con el que se guarda y se busca un refresh token. SHA-256 basta: el
 * valor tiene 32 bytes aleatorios, no se puede adivinar probando, así que no
 * hace falta un hash lento como el de las contraseñas.
 */
export function hashRefreshToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface RotatedRefreshToken {
  userId: string;
  /** Valor del refresh token nuevo. Solo existe aquí y en la cookie. */
  token: string;
}

type RefreshTokenClient = Pick<Prisma.TransactionClient, 'refreshToken'>;

/**
 * Refresh tokens opacos, rotatorios y agrupados en familias. En la base de
 * datos solo se guarda su hash. Sin lógica HTTP.
 */
@Injectable()
export class RefreshTokensService {
  private readonly ttlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlDays = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
  }

  /** Emite el primer token de una familia nueva, al iniciar sesión. */
  issue(userId: string): Promise<string> {
    return this.create(this.prisma, userId, randomUUID());
  }

  /**
   * Cambia un refresh token válido por uno nuevo de la misma familia y
   * revoca el anterior. Devuelve null si el token no existe, ha caducado o
   * ya estaba revocado.
   *
   * Si estaba revocado, alguien está reutilizando un token ya usado: puede
   * ser un atacante o el usuario legítimo, y no hay forma de saber cuál. Por
   * eso se revoca toda la familia, incluido el token más reciente.
   *
   * La rotación es atómica. El UPDATE solo revoca el token si sigue activo, y
   * PostgreSQL bloquea la fila hasta el final de la transacción: si llegan dos
   * peticiones con el mismo token, la segunda espera, vuelve a evaluar la
   * condición cuando la primera confirma y no actualiza ninguna fila. Solo
   * una obtiene un token nuevo; la otra se trata como reutilización.
   */
  rotate(token: string): Promise<RotatedRefreshToken | null> {
    const tokenHash = hashRefreshToken(token);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.refreshToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, familyId: true },
      });
      if (!current) {
        return null;
      }

      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (count === 1) {
        return {
          userId: current.userId,
          token: await this.create(tx, current.userId, current.familyId),
        };
      }

      // No se ha podido rotar: el token ha caducado o ya estaba revocado. Se
      // vuelve a leer porque otra petición puede haberlo revocado después de
      // la primera lectura.
      const { revokedAt } = await tx.refreshToken.findUniqueOrThrow({
        where: { id: current.id },
        select: { revokedAt: true },
      });
      if (revokedAt) {
        await this.revokeFamilyById(tx, current.familyId, now);
      }
      return null;
    });
  }

  /** Revoca la familia del token, si existe. Se usa al cerrar sesión. */
  async revokeFamily(token: string): Promise<void> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
      select: { familyId: true },
    });
    if (current) {
      await this.revokeFamilyById(this.prisma, current.familyId, new Date());
    }
  }

  private async create(
    client: RefreshTokenClient,
    userId: string,
    familyId: string,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await client.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashRefreshToken(token),
        expiresAt: new Date(Date.now() + this.ttlDays * DAY_MS),
      },
      select: { id: true },
    });
    return token;
  }

  private async revokeFamilyById(
    client: RefreshTokenClient,
    familyId: string,
    now: Date,
  ): Promise<void> {
    await client.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
