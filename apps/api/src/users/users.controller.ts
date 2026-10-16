import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { UNAUTHORIZED_MESSAGE } from '../auth/auth.messages.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator.js';
import { PublicUser, UsersService } from './users.service.js';

/** Rutas protegidas: el guard global exige un token de acceso válido. */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    const found = await this.users.findPublicById(user.id);
    // El token es válido pero el usuario ya no existe (se ha borrado).
    if (!found) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }
    return found;
  }
}
