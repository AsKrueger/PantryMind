import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

@Module({
  imports: [AppConfigModule, PrismaModule],
  providers: [RefreshTokensService],
  exports: [RefreshTokensService],
})
export class RefreshTokensModule {}
