import { execSync } from 'node:child_process';
import { resolveTestDatabaseUrl } from './test-database.js';

/**
 * Se ejecuta una vez antes de todos los tests de integración: aplica las
 * migraciones existentes a la base de datos de test.
 */
export default function setup() {
  const testDatabaseUrl = resolveTestDatabaseUrl(process.env);

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
}
