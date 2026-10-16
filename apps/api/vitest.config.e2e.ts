import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Los tests e2e no usan base de datos ni dependen de que exista un .env:
    // PrismaService se sustituye en cada test, así que esta URL solo sirve
    // para superar la validación de la configuración y nunca se abre. El
    // secreto es de test y no es sensible.
    env: {
      DATABASE_URL: 'postgresql://e2e:e2e@127.0.0.1:5432/pantrymind_e2e_unused',
      JWT_ACCESS_SECRET: 'e2e-test-secret-not-for-production-use',
    },
  },
});
