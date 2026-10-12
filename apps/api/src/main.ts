import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Sin esto, al detener el proceso no se ejecuta onModuleDestroy y la
  // conexión con la base de datos no se cierra de forma ordenada.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
