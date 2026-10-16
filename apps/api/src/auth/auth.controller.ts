import {
  Body,
  Controller,
  Cookies,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Env } from '../config/env.js';
import type { PublicUser } from '../users/users.service.js';
import type { AccessToken } from './access-token.service.js';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from './refresh-token-cookie.js';

/**
 * Traduce HTTP a llamadas a AuthService. Además de la validación, solo se
 * ocupa de la cookie del refresh token, que es un detalle de HTTP.
 *
 * Todas sus rutas son públicas: refresh y logout se autentican con la cookie,
 * no con el token de acceso.
 */
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly adapterHost: HttpAdapterHost,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<PublicUser> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<AccessToken & { user: Pick<PublicUser, 'id' | 'email'> }> {
    const { refreshToken, ...session } = await this.auth.login(body);
    this.setRefreshCookie(response, refreshToken);
    return session;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Cookies(REFRESH_COOKIE_NAME) currentToken: string | undefined,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<AccessToken> {
    try {
      const { refreshToken, ...accessToken } =
        await this.auth.refresh(currentToken);
      this.setRefreshCookie(response, refreshToken);
      return accessToken;
    } catch (error) {
      // Una cookie que ya no sirve se borra para que el cliente no la reenvíe.
      this.clearRefreshCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Cookies(REFRESH_COOKIE_NAME) currentToken: string | undefined,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<void> {
    await this.auth.logout(currentToken);
    this.clearRefreshCookie(response);
  }

  private cookieOptions() {
    return refreshCookieOptions(
      this.config.get('NODE_ENV', { infer: true }),
      this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }),
    );
  }

  private setRefreshCookie(response: unknown, refreshToken: string) {
    this.adapterHost.httpAdapter.setCookie(
      response,
      REFRESH_COOKIE_NAME,
      refreshToken,
      this.cookieOptions(),
    );
  }

  private clearRefreshCookie(response: unknown) {
    this.adapterHost.httpAdapter.clearCookie(
      response,
      REFRESH_COOKIE_NAME,
      this.cookieOptions(),
    );
  }
}
