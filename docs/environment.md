# Variables de entorno

Referencia de todas las variables de entorno de PantryMind: qué significa
cada una, quién la lee y cuáles son sensibles. La plantilla con valores de
desarrollo está en [`.env.example`](../.env.example).

## Dónde se definen

- **En local:** en un único archivo `.env` en la raíz del repositorio, copia
  de `.env.example`. Git lo ignora.
- **En la integración continua:** en el propio workflow
  (`.github/workflows/ci.yml`), con valores de test no sensibles. No hay
  archivo `.env`.
- **En producción:** en el entorno del proceso. Todavía no hay despliegue.

Los archivos `.env` no admiten referencias entre variables: el usuario, la
contraseña y el puerto de PostgreSQL se repiten dentro de las dos URL de
conexión.

## Configuración de la API

La API valida estas variables al arrancar. Si alguna falta o no es válida, no
arranca: termina con código de salida 1 y un mensaje que nombra cada variable
y el motivo, sin mostrar nunca el valor recibido.

| Variable       | Obligatoria | Valor por defecto | Validación                                  | Ejemplo                                                            | Sensible |
| -------------- | ----------- | ----------------- | ------------------------------------------- | ------------------------------------------------------------------ | -------- |
| `NODE_ENV`     | No          | `development`     | `development`, `test` o `production`        | `production`                                                       | No       |
| `PORT`         | No          | `3000`            | Entero entre 1 y 65535                      | `8080`                                                             | No       |
| `DATABASE_URL` | Sí          | —                 | URL con protocolo `postgresql` o `postgres` | `postgresql://pantrymind:pantrymind_dev@127.0.0.1:5432/pantrymind` | **Sí**   |

- `NODE_ENV` indica el entorno en el que corre la API. Vitest la pone a
  `test` durante los tests.
- `PORT` es el puerto en el que escucha la API.
- `DATABASE_URL` es la conexión a PostgreSQL. Contiene usuario y contraseña:
  fuera de tu máquina es un secreto. La API nunca la escribe en los logs.

Ejemplo de mensaje con una configuración inválida:

```text
Configuración inválida. La API no puede arrancar:
  - PORT: debe ser un número entero entre 1 y 65535
  - DATABASE_URL: es obligatoria
Revisa el archivo .env de la raíz del repositorio o las variables de entorno (docs/environment.md).
```

### Cómo las carga la API

- El módulo de configuración (`apps/api/src/config/`) lee el `.env` de la raíz
  con el módulo oficial `@nestjs/config` y valida el resultado con Zod.
- Si el archivo `.env` no existe, no es un error: se usan solo las variables
  del entorno del proceso.
- Una variable definida en el entorno del proceso tiene prioridad sobre la
  del archivo.
- El resto del código obtiene la configuración, ya tipada, a través de
  `ConfigService`. Fuera de `apps/api/src/config/` no se lee `process.env`.

## Base de datos local (Docker Compose)

Las lee Docker Compose al ejecutar `npm run db:up`. PostgreSQL solo las tiene
en cuenta al crear el volumen por primera vez.

| Variable            | Obligatoria | Valor por defecto | Ejemplo          | Sensible |
| ------------------- | ----------- | ----------------- | ---------------- | -------- |
| `POSTGRES_USER`     | Sí          | —                 | `pantrymind`     | No       |
| `POSTGRES_PASSWORD` | Sí          | —                 | `pantrymind_dev` | **Sí**   |
| `POSTGRES_DB`       | Sí          | —                 | `pantrymind`     | No       |
| `POSTGRES_PORT`     | Sí          | —                 | `5432`           | No       |

- `POSTGRES_USER` y `POSTGRES_PASSWORD` son el usuario que crea el contenedor
  y su contraseña.
- `POSTGRES_DB` es la base de datos de desarrollo.
- `POSTGRES_PORT` es el puerto de tu máquina en el que se publica PostgreSQL,
  solo en `127.0.0.1`.

Son obligatorias para Docker Compose: si falta alguna, `npm run db:up` se
detiene con un mensaje. La API no las lee.

## Tests de integración

| Variable            | Obligatoria | Valor por defecto | Ejemplo                                                                 | Sensible |
| ------------------- | ----------- | ----------------- | ----------------------------------------------------------------------- | -------- |
| `DATABASE_URL_TEST` | Sí          | —                 | `postgresql://pantrymind:pantrymind_dev@127.0.0.1:5432/pantrymind_test` | **Sí**   |

Solo la usan los tests de integración; no forma parte de la configuración de
la API. Debe apuntar a una base de datos cuyo nombre termine en `_test`: en
otro caso, los tests se niegan a ejecutarse. Durante esos tests, su valor se
pasa a la API como `DATABASE_URL`.

## Quién lee cada variable

| Variable            | API | CLI de Prisma | Tests de integración | Docker Compose |
| ------------------- | --- | ------------- | -------------------- | -------------- |
| `NODE_ENV`          | Sí  | No            | No                   | No             |
| `PORT`              | Sí  | No            | No                   | No             |
| `DATABASE_URL`      | Sí  | Sí            | No                   | No             |
| `DATABASE_URL_TEST` | No  | No            | Sí                   | No             |
| `POSTGRES_USER`     | No  | No            | No                   | Sí             |
| `POSTGRES_PASSWORD` | No  | No            | No                   | Sí             |
| `POSTGRES_DB`       | No  | No            | No                   | Sí             |
| `POSTGRES_PORT`     | No  | No            | No                   | Sí             |

Cada herramienta carga el archivo `.env` por su cuenta:

| Quién                 | Cómo                                                          |
| --------------------- | ------------------------------------------------------------- |
| API                   | `apps/api/src/config/config.module.ts`, con `@nestjs/config`  |
| CLI de Prisma         | `apps/api/prisma7.config.ts` lo carga con `dotenv`            |
| Tests de integración  | `apps/api/vitest.config.integration.ts` lo carga con `dotenv` |
| Docker Compose        | Lee `.env` de la carpeta de `docker-compose.yml` por sí solo  |
| Tests unitarios y e2e | No lo leen: no necesitan base de datos ni archivo `.env`      |

La CLI de Prisma no pasa por la validación de la API: `prisma generate`
funciona sin `DATABASE_URL`, y los comandos que sí necesitan base de datos
(`db:migrate`, `db:deploy`) fallan con el error propio de Prisma si falta.

## Definir una variable de forma temporal

Para probar un valor sin tocar `.env`. La variable solo existe en esa
terminal.

En PowerShell:

```powershell
$env:PORT = "4000"
npm run start:dev -w @pantrymind/api
Remove-Item Env:PORT
```

En Linux, solo para un comando:

```bash
PORT=4000 npm run start:dev -w @pantrymind/api
```

## Añadir una variable nueva

1. Añádela al esquema de `apps/api/src/config/env.ts`, con su motivo de error.
2. Añade sus tests en `apps/api/src/config/env.spec.ts`.
3. Documéntala en este archivo y en `.env.example`.
4. Si la necesita la integración continua, defínela en el workflow.
