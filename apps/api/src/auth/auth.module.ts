import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from '../config/config.module.js';
import { Env } from '../config/env.js';
import { RefreshTokensModule } from '../refresh-tokens/refresh-tokens.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenGuard } from './access-token.guard.js';
import {
  AccessTokenService,
  accessTokenJwtOptions,
} from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordHasherService } from './password-hasher.service.js';

@Module({
  imports: [
    AppConfigModule,
    UsersModule,
    RefreshTokensModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        accessTokenJwtOptions(
          config.get('JWT_ACCESS_SECRET', { infer: true }),
          config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
        ),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasherService,
    AccessTokenService,
    // Guard global: protege todas las rutas de la aplicación, no solo las de
    // este módulo. Las públicas se marcan con @Public().
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
})
export class AuthModule {}
