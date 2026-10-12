import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';
import { resolveTestDatabaseUrl } from './test/integration/test-database.js';

// Único .env del proyecto, en la raíz del monorepo. En la CI no existe y las
// variables llegan del entorno del job.
config({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/integration/**/*.integration-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    // Todos los archivos comparten la misma base de datos: en paralelo, un
    // test vaciaría las tablas que otro está usando.
    fileParallelism: false,
    // Los tests, y el PrismaService que crean, solo ven la base de datos de
    // test, nunca la de desarrollo.
    env: {
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
