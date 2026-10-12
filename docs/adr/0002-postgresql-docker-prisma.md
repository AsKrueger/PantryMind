# ADR 0002: PostgreSQL en Docker Compose y acceso a datos con Prisma

- **Estado:** Aceptada
- **Fecha:** 2026-10-12

## Contexto

PantryMind necesita guardar datos relacionales: usuarios, alimentos,
inventario, recetas y listas de la compra, con relaciones entre ellos y
operaciones que deben ser atómicas. Antes de escribir autenticación o lógica
de negocio hay que decidir tres cosas:

1. qué base de datos se usa;
2. cómo se ejecuta en local, de forma que sea igual en Windows y en Linux;
3. cómo accede la API a los datos y cómo se versiona la estructura.

El entorno de desarrollo es Windows con Docker Desktop y sin PostgreSQL
instalado. La integración continua corre en Windows y en Linux. La API es un
paquete ESM (`"type": "module"`) con NestJS 12, Node.js 24 y TypeScript 6.

## Decisión

### PostgreSQL 18 en un contenedor

- La base de datos es **PostgreSQL**, en su versión mayor estable vigente
  (18), con la imagen oficial `postgres:18`. La versión mayor es fija; nunca
  se usa `latest`.
- En local se ejecuta con **Docker Compose** (`docker-compose.yml` en la
  raíz), con un único servicio. La API y la web se ejecutan fuera de Docker.
- Los datos viven en un volumen con nombre y el puerto se publica solo en
  `127.0.0.1`.
- El mismo contenedor aloja dos bases de datos: `pantrymind` (desarrollo) y
  `pantrymind_test` (tests de integración). La segunda la crea un script SQL
  de inicialización.

### Prisma ORM 7

- El acceso a datos se hace con **Prisma ORM 7** y su adaptador de driver para
  PostgreSQL (`@prisma/adapter-pg`, sobre el driver `pg`).
- El esquema está en `apps/api/prisma/schema.prisma` y las migraciones, en
  SQL y versionadas, en `apps/api/prisma/migrations/`.
- El cliente se genera con el generador `prisma-client` en formato ESM dentro
  de `apps/api/src/generated/prisma`. No se versiona: se regenera antes de
  `lint`, `typecheck`, `build` y los tests.
- Un único `PrismaService`, en el módulo `PrismaModule`, crea el cliente. Los
  demás módulos importan `PrismaModule`; ninguno crea su propio cliente.

### Convenciones

- Tablas y columnas en `snake_case` y tablas en plural (`users`,
  `password_hash`); modelos y campos en `camelCase` en el código. La
  correspondencia se declara con `@map` y `@@map`.
- Identificadores UUID generados por la base de datos (`gen_random_uuid()`),
  de modo que una fila insertada sin pasar por Prisma también recibe uno.
- Marcas de tiempo con zona horaria (`timestamptz`).

### Variables de entorno

Hay un único `.env` en la raíz. Docker Compose lo lee por sí solo; la CLI de
Prisma y los tests de integración lo cargan con `dotenv`; la API lo recibe
con la opción `--env-file` de Node.js en los scripts de desarrollo.

## Alternativas consideradas

### PostgreSQL instalado de forma nativa

- A favor: sin Docker; algo menos de consumo de memoria.
- En contra: la instalación, la versión, el servicio y la autenticación son
  distintos en Windows y en cada distribución de Linux, y habría que
  documentar y mantener cada variante; es difícil garantizar que dos personas
  usan la misma versión; empezar de cero exige borrar bases de datos a mano.

Se descarta porque el objetivo es que el entorno sea reproducible con los
mismos comandos en los dos sistemas.

### SQLite

- A favor: no necesita servidor ni Docker.
- En contra: tipos, restricciones y concurrencia distintos a los de la base
  de datos prevista para el despliegue; los tests pasarían contra un motor que
  no es el real.

### TypeORM

- A favor: es el ORM con integración más antigua en NestJS; usa clases y
  decoradores, como el resto del framework.
- En contra: el modelo se reparte entre clases y decoradores; el tipado de
  los resultados de las consultas es menos estricto; sus migraciones
  generadas requieren más revisión manual.

### Drizzle

- A favor: muy cercano a SQL, ligero y con buen tipado.
- En contra: obliga a escribir más a mano (relaciones, consultas) y tiene
  menos documentación y ejemplos con NestJS; para un proyecto de aprendizaje,
  Prisma ofrece un flujo de migraciones más guiado.

### SQL directo con `pg`

- A favor: control total, sin capas.
- En contra: sin tipos generados ni sistema de migraciones; habría que
  construir ambos.

## Consecuencias

### Positivas

- Levantar la base de datos es un comando (`npm run db:up`), igual en Windows
  y en Linux, y empezar de cero es otro (`docker compose down -v`).
- La estructura de la base de datos está versionada como SQL legible y se
  revisa en los pull requests.
- Las consultas están tipadas a partir del esquema: un cambio de modelo que
  rompe código se detecta en `typecheck`.
- Los tests de integración ejecutan SQL real contra PostgreSQL, en una base
  de datos separada de la de desarrollo.

### Negativas y riesgos

- Docker pasa a ser un requisito para desarrollar y para los tests de
  integración.
- Los contenedores de servicio de GitHub Actions solo existen en Linux, así
  que los tests de integración no se ejecutan en Windows en la CI. En Windows
  solo se verifican en local.
- El cliente generado es un paso más: sin `prisma generate` el proyecto no
  compila. Lo cubren los scripts `pre*`, a costa de unos segundos en cada
  comando.
- En el momento de esta decisión, la etiqueta `latest` del paquete `prisma`
  en npm apunta a una versión preliminar de Prisma 8. Hay que instalar
  `prisma@7` de forma explícita y mantener `prisma` y `@prisma/client` en la
  misma versión mayor. Prisma 8 cambia el flujo de trabajo; migrar será una
  decisión aparte.
- Con un adaptador de driver, `$connect()` no abre ninguna conexión.
  `PrismaService` ejecuta una consulta mínima al arrancar para que la API
  falle pronto si la base de datos no responde.
- Los archivos `.env` no admiten referencias entre variables: usuario,
  contraseña y puerto se repiten en las URL de conexión.
- La validación de las variables de entorno al arrancar queda para la
  Issue 6. Hasta entonces, una `DATABASE_URL` ausente produce un error de
  conexión poco claro.
- PostgreSQL 18 cambió la ruta de datos de la imagen oficial; el volumen se
  monta en `/var/lib/postgresql`. Un cambio de versión mayor exige migrar los
  datos, no basta con cambiar la etiqueta.
