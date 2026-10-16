import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Sin esto, al detener el proceso no se ejecuta onModuleDestroy y la
  // conexión con la base de datos no se cierra de forma ordenada.
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  // Solo valores no sensibles: nunca la URL de conexión ni secretos.
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  Logger.log(`NODE_ENV=${nodeEnv}, puerto ${port}`, 'Bootstrap');
}
await bootstrap();
