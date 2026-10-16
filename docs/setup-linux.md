# Puesta en marcha en Linux

Pasos para tener PantryMind funcionando en Linux desde cero: base de datos,
migraciones, API y tests. Los comandos se ejecutan desde la raíz del
repositorio. La guía equivalente para Windows está en
[setup-windows.md](setup-windows.md).

> Esta guía no se ha ejecutado todavía en una máquina Linux de escritorio.
> Los comandos de npm y de Prisma son los mismos que verifica la integración
> continua en Linux; la parte de Docker Compose solo se ha probado en Windows.

## Requisitos

- Git.
- Node.js 24 (la versión está indicada en `.nvmrc`) y npm 11.
- [Docker Engine](https://docs.docker.com/engine/install/) con el plugin de
  Docker Compose. No hace falta instalar PostgreSQL.

Comprobación:

```bash
node --version
npm --version
docker --version
docker compose version
```

## 1. Clonar e instalar

```bash
git clone https://github.com/AsKrueger/PantryMind.git
cd PantryMind
npm ci
```

## 2. Comprobar que Docker está en marcha

```bash
docker info
```

Si el servicio está parado:

```bash
sudo systemctl start docker
```

Si `docker info` responde `permission denied`, tu usuario no pertenece al
grupo `docker`. La documentación de Docker explica cómo
[usar Docker sin `sudo`](https://docs.docker.com/engine/install/linux-postinstall/).

## 3. Crear el archivo `.env`

```bash
cp .env.example .env
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

```bash
npm run db:up
docker compose ps
```

`db:up` descarga la imagen de PostgreSQL la primera vez, arranca el contenedor
en segundo plano y espera a que esté listo. En `docker compose ps` el estado
debe incluir `(healthy)`.

La primera vez se crean dos bases de datos: `pantrymind`, para desarrollo, y
`pantrymind_test`, para los tests de integración.

## 5. Aplicar las migraciones

```bash
npm run db:deploy -w @pantrymind/api
```

Crea las tablas en la base de datos de desarrollo. La de test no hay que
migrarla a mano: los tests de integración lo hacen al empezar.

## 6. Arrancar la API

```bash
npm run start:dev -w @pantrymind/api
```

Abre <http://localhost:3000/health>; la respuesta es `{ "status": "ok" }`.
La API se conecta a la base de datos al arrancar: si PostgreSQL no está en
marcha, se detiene con un error.

## 7. Ejecutar todos los tests

```bash
npm run test
npm run test:e2e -w @pantrymind/api
npm run test:integration -w @pantrymind/api
```

Los dos primeros no necesitan base de datos. El tercero necesita el
contenedor en marcha y usa solo `pantrymind_test`.

## Parar la base de datos

```bash
npm run db:down
```

Detiene y elimina el contenedor, pero los datos se conservan en un volumen de
Docker y vuelven a estar disponibles con `npm run db:up`.

Para borrar también los datos y empezar de cero:

```bash
docker compose down -v
```

## Cambiar el esquema de datos

Tras modificar `apps/api/prisma/schema.prisma`:

```bash
npm run db:migrate -w @pantrymind/api -- --name descripcion_del_cambio
```

Crea una migración nueva en `apps/api/prisma/migrations/` y la aplica a la
base de datos de desarrollo. Las migraciones ya aplicadas no se editan.

## Problemas habituales

### Docker no está en marcha

Síntoma, al ejecutar `npm run db:up`:

```text
Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
```

Solución: `sudo systemctl start docker` y repite el comando.

### El puerto 5432 está ocupado

Síntoma: `npm run db:up` falla con un mensaje que termina en
`port is already allocated` o en `address already in use`, por ejemplo:

```text
Bind for 0.0.0.0:5432 failed: port is already allocated
```

Es frecuente si la distribución tiene PostgreSQL instalado como servicio.
Para ver qué proceso usa el puerto:

```bash
ss -ltnp | grep 5432
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
puerto de `DATABASE_URL` coincide con `POSTGRES_PORT`.

### Cambié usuario o contraseña y ya no conecta

PostgreSQL solo lee `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` al
crear el volumen por primera vez. Para aplicar valores nuevos hay que borrar
los datos con `docker compose down -v` y volver a levantar y migrar.
