import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { PublicUser } from '../users/users.service.js';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';

/** Traduce HTTP a llamadas a AuthService. Sin lógica propia. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<PublicUser> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
  ): Promise<Pick<PublicUser, 'id' | 'email'>> {
    return this.auth.login(body);
  }
}
