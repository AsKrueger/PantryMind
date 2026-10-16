import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenService } from './access-token.service.js';
import { UNAUTHORIZED_MESSAGE } from './auth.messages.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

// "Authorization: Bearer <token>". El esquema no distingue mayúsculas.
const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Guard global: toda ruta exige un token de acceso válido salvo que esté
 * marcada con @Public(). Una ruta nueva queda protegida aunque nadie se
 * acuerde de añadir el guard.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    const userId = token ? await this.accessTokens.verify(token) : null;
    if (!userId) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    request.user = { id: userId };
    return true;
  }
}
