# Puesta en marcha en Windows

Pasos para tener PantryMind funcionando en Windows desde cero: base de datos,
migraciones, API y tests. Los comandos son para PowerShell y se ejecutan desde
la raíz del repositorio. La guía equivalente para Linux está en
[setup-linux.md](setup-linux.md).

## Requisitos

- Windows 10 u 11 de 64 bits.
- Git.
- Node.js 24 (la versión está indicada en `.nvmrc`) y npm 11.
- [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/),
  que incluye Docker Compose. No hace falta instalar PostgreSQL.

Comprobación:

```powershell
node --version
npm --version
docker --version
docker compose version
```

## 1. Clonar e instalar

```powershell
git clone https://github.com/AsKrueger/PantryMind.git
cd PantryMind
npm ci
```

## 2. Arrancar Docker Desktop

Abre Docker Desktop y espera a que indique que el motor está en marcha.
Comprobación:

```powershell
docker info
```

Si responde con un error de conexión, Docker Desktop todavía no ha arrancado.

## 3. Crear el archivo `.env`

```powershell
Copy-Item .env.example .env
```

Hay un único `.env`, en la raíz, y Git lo ignora. Los valores de la plantilla
sirven tal cual para desarrollo local. Cada variable está explicada en
[environment.md](environment.md).

Quién lee ese archivo:

| Quién                 | Cómo                                                          |
| --------------------- | ------------------------------------------------------------- |
| Docker Compose        | Lee `.env` de la carpeta de `docker-compose.yml` por sí solo  |
| CLI de Prisma         | `apps/api/prisma7.config.ts` lo carga con `dotenv`            |
| API                   | Su módulo de configuración lo carga y valida al arrancar      |
| Tests de integración  | `apps/api/vitest.config.integration.ts` lo carga con `dotenv` |
| Tests unitarios y e2e | No lo leen: no necesitan base de datos                        |

## 4. Levantar la base de datos

```powershell
npm run db:up
docker compose ps
```

`db:up` descarga la imagen de PostgreSQL la primera vez, arranca el contenedor
en segundo plano y espera a que esté listo. En `docker compose ps` el estado
debe incluir `(healthy)`.

La primera vez se crean dos bases de datos: `pantrymind`, para desarrollo, y
`pantrymind_test`, para los tests de integración.

## 5. Aplicar las migraciones

```powershell
npm run db:deploy -w @pantrymind/api
```

Crea las tablas en la base de datos de desarrollo. La de test no hay que
migrarla a mano: los tests de integración lo hacen al empezar.

## 6. Arrancar la API

```powershell
npm run start:dev -w @pantrymind/api
```

Abre <http://localhost:3000/health>; la respuesta es `{ "status": "ok" }`.
La API se conecta a la base de datos al arrancar: si PostgreSQL no está en
marcha, se detiene con un error.

## 7. Ejecutar todos los tests

```powershell
npm run test
npm run test:e2e -w @pantrymind/api
npm run test:integration -w @pantrymind/api
```

Los dos primeros no necesitan base de datos. El tercero necesita el
contenedor en marcha y usa solo `pantrymind_test`.

## Parar la base de datos

```powershell
npm run db:down
```

Detiene y elimina el contenedor, pero los datos se conservan en un volumen de
Docker y vuelven a estar disponibles con `npm run db:up`.

Para borrar también los datos y empezar de cero:

```powershell
docker compose down -v
```

## Cambiar el esquema de datos

Tras modificar `apps/api/prisma/schema.prisma`:

```powershell
npm run db:migrate -w @pantrymind/api -- --name descripcion_del_cambio
```

Crea una migración nueva en `apps/api/prisma/migrations/` y la aplica a la
base de datos de desarrollo. Las migraciones ya aplicadas no se editan.

## Problemas habituales

### Docker Desktop no está en marcha

Síntoma: `npm run db:up` falla con un error de conexión que menciona
`dockerDesktopLinuxEngine`, parecido a este:

```text
error during connect: ... open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

Solución: abre Docker Desktop, espera a que el motor arranque y repite el
comando.

### El puerto 5432 está ocupado

Síntoma, al ejecutar `npm run db:up`:

```text
Bind for 0.0.0.0:5432 failed: port is already allocated
```

Otro PostgreSQL, u otro contenedor, ya usa ese puerto. Para ver cuál:

```powershell
Get-NetTCPConnection -LocalPort 5432 -State Listen
docker ps --format "{{.Names}}: {{.Ports}}"
```

Solución: detén el otro servicio o usa otro puerto. Para cambiarlo, edita
`.env` y sustituye `5432` en **tres** sitios: `POSTGRES_PORT`, `DATABASE_URL`
y `DATABASE_URL_TEST`. Después repite `npm run db:up`.

### Falta el archivo `.env`

Síntomas: `npm run db:up` responde `Falta POSTGRES_USER. Copia .env.example
como .env`, o la API no arranca y responde `Configuración inválida` con
`DATABASE_URL: es obligatoria`.

Solución: repite el paso 3.

### Falta una variable nueva en `.env`

Síntomas: después de actualizar el repositorio, la API no arranca y responde
`Configuración inválida` con una variable que tu `.env` no tiene, por ejemplo
`JWT_ACCESS_SECRET: es obligatoria`.

Solución: copia esa variable de `.env.example` a tu `.env`. Para
`JWT_ACCESS_SECRET`, genera un valor propio como se explica en
[environment.md](environment.md#generar-jwt_access_secret).

### La API no llega a la base de datos

Síntoma: `Can't reach database server at 127.0.0.1:5432`.

Comprueba con `docker compose ps` que el contenedor está `(healthy)` y que el
puerto de `DATABASE_URL` coincide con `POSTGRES_PORT`. En las URL se usa
`127.0.0.1` y no `localhost` porque el puerto solo se publica en IPv4 y
Windows puede resolver `localhost` como IPv6.

### Cambié usuario o contraseña y ya no conecta

PostgreSQL solo lee `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` al
crear el volumen por primera vez. Para aplicar valores nuevos hay que borrar
los datos con `docker compose down -v` y volver a levantar y migrar.
