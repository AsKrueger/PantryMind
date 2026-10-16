import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.js';

// Único .env del proyecto, en la raíz del monorepo. Este archivo está en
// apps/api/src/config (o en apps/api/dist/config una vez compilado): la raíz
// queda cuatro carpetas por encima en los dos casos.
const envFilePath = resolve(import.meta.dirname, '../../../../.env');

/**
 * Punto único de configuración de la API. Los módulos que necesitan
 * configuración importan este módulo e inyectan ConfigService<Env, true>;
 * ninguno lee process.env directamente.
 *
 * - Si el archivo .env no existe, se usan solo las variables del entorno del
 *   proceso (es el caso de la CI y de producción).
 * - Las variables del entorno del proceso tienen prioridad sobre el archivo.
 * - Si la validación falla, la aplicación no arranca.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath,
      validate: validateEnv,
      cache: true,
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
