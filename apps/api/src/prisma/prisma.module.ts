import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [AppConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
