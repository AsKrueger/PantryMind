import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service.js';
import {
  EmailAlreadyRegisteredError,
  PublicUser,
  UsersService,
} from '../users/users.service.js';
import { AccessToken, AccessTokenService } from './access-token.service.js';
import {
  EMAIL_CONFLICT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  UNAUTHORIZED_MESSAGE,
} from './auth.messages.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { PasswordHasherService } from './password-hasher.service.js';

/** Resultado de crear o renovar una sesión. */
export interface SessionTokens extends AccessToken {
  /** Va en la cookie, nunca en el cuerpo de la respuesta. */
  refreshToken: string;
}

export interface LoginResult extends SessionTokens {
  user: Pick<PublicUser, 'id' | 'email'>;
}

/** Reglas de registro, credenciales y sesión. */
@Injectable()
export class AuthService implements OnModuleInit {
  // Hash de una contraseña aleatoria que nadie conoce, con los mismos
  // parámetros que los reales. Se verifica contra él cuando el correo no
  // existe, para que el login tarde lo mismo en los dos casos.
  private dummyHash: string;

  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasherService,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokensService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await this.hasher.hash(randomUUID());
  }

  async register({ email, password }: RegisterInput): Promise<PublicUser> {
    const passwordHash = await this.hasher.hash(password);
    try {
      return await this.users.create(email, passwordHash);
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        throw new ConflictException(EMAIL_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  /** Comprueba las credenciales y abre una sesión nueva. */
  async login({ email, password }: LoginInput): Promise<LoginResult> {
    const user = await this.users.findCredentialsByEmail(email);
    const valid = await this.hasher.verify(
      user?.passwordHash ?? this.dummyHash,
      password,
    );
    if (!user || !valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const refreshToken = await this.refreshTokens.issue(user.id);
    const accessToken = await this.accessTokens.sign(user.id);
    return {
      ...accessToken,
      refreshToken,
      user: { id: user.id, email: user.email },
    };
  }

  /** Rota el refresh token y emite un token de acceso nuevo. */
  async refresh(refreshToken: string | undefined): Promise<SessionTokens> {
    const rotated = refreshToken
      ? await this.refreshTokens.rotate(refreshToken)
      : null;
    if (!rotated) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const accessToken = await this.accessTokens.sign(rotated.userId);
    return { ...accessToken, refreshToken: rotated.token };
  }

  /** Cierra la sesión revocando la familia del refresh token, si la hay. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.refreshTokens.revokeFamily(refreshToken);
    }
  }
}
