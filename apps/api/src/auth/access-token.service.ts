import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { Env } from '../config/env.js';

export interface AccessToken {
  accessToken: string;
  /** Segundos hasta que caduca. */
  expiresIn: number;
}

/**
 * Opciones del JWT de acceso: HS256 al firmar y solo HS256 al verificar. Así
 * se rechazan los tokens sin firma ("alg": "none") y los firmados con otro
 * algoritmo.
 */
export function accessTokenJwtOptions(
  secret: string,
  ttlSeconds: number,
): JwtModuleOptions {
  return {
    secret,
    signOptions: { algorithm: 'HS256', expiresIn: ttlSeconds },
    verifyOptions: { algorithms: ['HS256'] },
  };
}

/**
 * Emite y verifica tokens de acceso. El contenido es solo sub (id del
 * usuario), iat y exp: ningún dato personal, porque cualquiera que tenga el
 * token puede leerlo.
 */
@Injectable()
export class AccessTokenService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlSeconds = config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  async sign(userId: string): Promise<AccessToken> {
    const accessToken = await this.jwt.signAsync({ sub: userId });
    return { accessToken, expiresIn: this.ttlSeconds };
  }

  /**
   * Devuelve el id del usuario si el token es válido: firma correcta con
   * HS256 y sin caducar. En cualquier otro caso devuelve null, sin distinguir
   * el motivo.
   */
  async verify(token: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
