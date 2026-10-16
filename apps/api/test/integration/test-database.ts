/**
 * Devuelve la URL de la base de datos de test y se niega a continuar si no
 * está definida o si su nombre no termina en "_test". Es la protección que
 * impide que los tests de integración vacíen la base de datos de desarrollo.
 */
export function resolveTestDatabaseUrl(
  env: Record<string, string | undefined>,
): string {
  const url = env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL_TEST. Copia .env.example como .env en la raíz del repositorio.',
    );
  }

  const databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `DATABASE_URL_TEST apunta a la base de datos "${databaseName}". ` +
        'Los tests de integración solo se ejecutan contra una base de datos cuyo nombre termine en "_test".',
    );
  }

  return url;
}
