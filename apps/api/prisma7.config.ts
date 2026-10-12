import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma no carga archivos .env por su cuenta. El proyecto tiene un único
// .env en la raíz del monorepo, dos carpetas por encima de esta. Si no existe
// (por ejemplo en la CI), se usan las variables del entorno tal como estén.
config({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Sin env(): "prisma generate" no necesita base de datos y debe funcionar
    // aunque DATABASE_URL no esté definida.
    url: process.env['DATABASE_URL'],
  },
});
