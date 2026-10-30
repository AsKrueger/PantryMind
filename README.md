# PantryMind

[![CI](https://github.com/AsKrueger/PantryMind/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/AsKrueger/PantryMind/actions/workflows/ci.yml?query=branch%3Adevelop)

Aplicación web para gestionar el inventario de alimentos de casa, las recetas
y las listas de la compra.

## Qué problema resuelve

En casa es fácil perder la cuenta de lo que hay en la despensa: se compran
productos que ya se tenían, otros caducan sin usarse y cuesta decidir qué
cocinar con lo disponible. PantryMind quiere reunir en un solo sitio el
inventario de alimentos, las recetas y la lista de la compra para reducir
ese desperdicio y simplificar la planificación.

## Estado

**En desarrollo, sin funcionalidades de producto implementadas.**

Lo que existe por ahora es una API con un endpoint de salud, registro, inicio
de sesión con tokens y rutas protegidas (ver
[Endpoints de la API](#endpoints-de-la-api)), una web mínima con una página
inicial y una base de datos PostgreSQL local con usuarios y sesiones. La web
no se comunica con la API. Todavía no hay lógica de inventario, recetas o
listas de la compra. La planificación está en la
[hoja de ruta](docs/roadmap.md).

## Stack

Instalado:

- **Backend:** NestJS 12 (`@nestjs/core` 12.3.2) sobre Express, en `apps/api`.
- **Frontend:** React 19.3.1 con Vite 8.3.5 y TypeScript, en `apps/web`.
- **Tests:** Vitest 4.1.12 en los dos workspaces; en la web, además,
  Testing Library para React 16.3.3, `jest-dom` 7.0.1 y jsdom 30.1.3.
- **Base de datos:** PostgreSQL 18, en un contenedor con Docker Compose.
- **Acceso a datos:** Prisma ORM 7.10.1 con el adaptador `@prisma/adapter-pg`.

Las razones están en el
[ADR 0002](docs/adr/0002-postgresql-docker-prisma.md).

## Requisitos

- Node.js 24 (la versión está indicada en `.nvmrc`).
- npm 11.
- Git.
- Docker con Docker Compose, para la base de datos.

## Instalación

Las guías paso a paso, con los problemas habituales, están en:

- [Puesta en marcha en Windows](docs/setup-windows.md)
- [Puesta en marcha en Linux](docs/setup-linux.md)

En resumen, desde la raíz del repositorio:

```text
git clone https://github.com/AsKrueger/PantryMind.git
cd PantryMind
npm install
```

Después, copia `.env.example` con el nombre `.env`, levanta la base de datos
y aplica las migraciones:

```text
npm run db:up
npm run db:deploy -w @pantrymind/api
```

`npm install` se ejecuta siempre en la raíz: instala las dependencias de
todos los workspaces y mantiene un único `package-lock.json`.

## Base de datos

PostgreSQL se ejecuta en un contenedor; no hay que instalarlo. Los comandos
se ejecutan desde la raíz del repositorio:

| Comando                                      | Qué hace                                                    |
| -------------------------------------------- | ----------------------------------------------------------- |
| `npm run db:up`                              | Levanta PostgreSQL en segundo plano y espera a que responda |
| `npm run db:down`                            | Lo detiene; los datos se conservan                          |
| `npm run db:deploy -w @pantrymind/api`       | Aplica las migraciones existentes                           |
| `npm run db:migrate -w @pantrymind/api`      | Crea una migración a partir del esquema y la aplica         |
| `npm run prisma:generate -w @pantrymind/api` | Regenera el cliente de Prisma; no necesita base de datos    |

El contenedor aloja dos bases de datos: `pantrymind`, para desarrollo, y
`pantrymind_test`, que solo usan los tests de integración.

El cliente de Prisma no se versiona. Se regenera solo antes de `lint`,
`typecheck`, `build` y los tests.

## Arrancar la API en desarrollo

Desde la raíz del repositorio, con la base de datos en marcha:

```text
npm run start:dev -w @pantrymind/api
```

La API lee su configuración del archivo `.env` de la raíz y del entorno, la
valida y se conecta a la base de datos al arrancar. Si falta una variable
obligatoria o tiene un valor inválido, no arranca y explica cuál; las
variables están descritas en [docs/environment.md](docs/environment.md).
Escucha en el puerto indicado por la variable de entorno `PORT` o, si no está
definida, en el `3000`. Para comprobar que
funciona, abre <http://localhost:3000/health>; la respuesta es:

```json
{ "status": "ok" }
```

## Endpoints de la API

Todas las rutas exigen un token de acceso salvo las marcadas como públicas.

| Método y ruta         | Acceso          | Qué hace                                    | Respuestas                                                    |
| --------------------- | --------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `GET /health`         | Pública         | Comprueba que la API responde               | `200`                                                         |
| `POST /auth/register` | Pública         | Crea un usuario; no inicia sesión           | `201`, `400` entrada inválida, `409` correo ya registrado     |
| `POST /auth/login`    | Pública         | Inicia sesión                               | `200`, `400` entrada inválida, `401` credenciales incorrectas |
| `POST /auth/refresh`  | Cookie          | Renueva el token de acceso y rota la cookie | `200`, `401`                                                  |
| `POST /auth/logout`   | Cookie          | Cierra la sesión y borra la cookie          | `204`, también sin cookie válida                              |
| `GET /users/me`       | Token de acceso | Devuelve el usuario autenticado             | `200`, `401`                                                  |

- `register` y `login` reciben un JSON con `email` y `password`. El correo se
  guarda sin espacios alrededor y en minúsculas, con un máximo de 254
  caracteres. La contraseña de registro debe tener entre 15 y 128 caracteres,
  sin reglas de composición.
- `register` devuelve `id`, `email` y `createdAt`.
- `login` devuelve `accessToken`, `expiresIn` (segundos) y `user` (`id` y
  `email`), y deja el refresh token en la cookie `pm_refresh`.
- `refresh` devuelve `accessToken` y `expiresIn`, y cambia la cookie por una
  nueva. Una cookie ya usada cierra la sesión.
- Las rutas protegidas reciben el token en `Authorization: Bearer <token>`.
- Ninguna respuesta incluye la contraseña, su hash ni el refresh token. Todos
  los `401` de sesión tienen el mismo cuerpo.

Las decisiones están en el [ADR 0003](docs/adr/0003-password-hashing.md) y el
[ADR 0004](docs/adr/0004-session-tokens.md), y el resumen de seguridad en
[docs/security.md](docs/security.md).

Ejemplo en PowerShell, con la API arrancada. `-SessionVariable` guarda la
cookie y `-WebSession` la reenvía:

```powershell
$api = 'http://localhost:3000'
$body = @{ email = 'ana@example.com'; password = 'una frase de prueba larga' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$api/auth/register" -ContentType 'application/json' -Body $body
$login = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body $body -SessionVariable session
Invoke-RestMethod -Uri "$api/users/me" -Headers @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Method Post -Uri "$api/auth/refresh" -WebSession $session
Invoke-RestMethod -Method Post -Uri "$api/auth/logout" -WebSession $session
```

## Tests de la API

Desde la raíz del repositorio:

```text
npm run test -w @pantrymind/api
npm run test:e2e -w @pantrymind/api
npm run test:integration -w @pantrymind/api
```

El primer comando ejecuta los tests unitarios y el segundo los tests de
extremo a extremo, que arrancan la aplicación y hacen peticiones HTTP reales.
Ninguno de los dos necesita base de datos.

El tercero ejecuta los tests de integración: necesita PostgreSQL en marcha,
aplica las migraciones a `pantrymind_test` y nunca toca la base de datos de
desarrollo.

## Arrancar la web en desarrollo

Desde la raíz del repositorio:

```text
npm run dev -w @pantrymind/web
```

Vite muestra en la terminal la dirección en la que sirve la web, por defecto
<http://localhost:5173>. La página muestra el encabezado "PantryMind" y un
aviso de que la aplicación está en preparación.

## Tests de la web

Desde la raíz del repositorio:

```text
npm run test -w @pantrymind/web
```

El comando ejecuta una vez los tests de componentes y termina.

## Comandos de calidad

Desde la raíz del repositorio, para todos los workspaces a la vez:

```text
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

- `lint` busca patrones incorrectos en el código con oxlint.
- `format:check` comprueba el formato con Prettier sin modificar nada;
  `npm run format` lo corrige.
- `typecheck` comprueba los tipos de TypeScript sin generar archivos.
- `test` ejecuta los tests unitarios de la API y los de componentes de la web.
  Los tests de extremo a extremo de la API siguen en su propio comando.
- `build` compila los dos workspaces.

## Integración continua

Cada pull request hacia `develop` o `main`, y cada push a esas ramas, ejecuta
en GitHub Actions los comandos de calidad anteriores y los tests de extremo a
extremo de la API. El proyecto se verifica en dos sistemas:

- **Linux** (`ubuntu-latest`).
- **Windows** (`windows-latest`).

Un job aparte ejecuta los tests de integración contra PostgreSQL, solo en
Linux: GitHub Actions no ofrece contenedores de servicio en Windows.

La insignia del principio de este documento muestra el estado de la última
ejecución en `develop`. El workflow está en
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Estructura de carpetas

```text
.
├── .github/
│   └── workflows/  Integración continua (GitHub Actions)
├── apps/
│   ├── api/        Backend: API con NestJS
│   │   └── prisma/ Esquema de datos y migraciones
│   └── web/        Frontend: web con React y Vite
├── docker/
│   └── postgres/   Script de inicialización de la base de datos
├── docs/
│   ├── adr/        Registros de decisiones de arquitectura
│   ├── environment.md  Variables de entorno
│   ├── roadmap.md  Hoja de ruta
│   ├── security.md Medidas de seguridad y vulnerabilidades conocidas
│   └── setup-*.md  Guías de puesta en marcha en Windows y Linux
├── docker-compose.yml  PostgreSQL local
├── .editorconfig     Estilo de edición común a todos los editores
├── .env.example      Plantilla de variables de entorno
├── .gitattributes    Normalización de finales de línea
├── .gitignore        Archivos que no se versionan
├── .nvmrc            Versión de Node.js del proyecto
├── .prettierignore   Archivos que Prettier no formatea
├── .prettierrc.json  Configuración de formato de todo el repositorio
├── CONTRIBUTING.md   Guía de contribución
└── package.json      Raíz del monorepo (npm workspaces) y scripts comunes
```

## Documentación

- [Guía de contribución](CONTRIBUTING.md)
- [Hoja de ruta](docs/roadmap.md)
- [Puesta en marcha en Windows](docs/setup-windows.md)
- [Puesta en marcha en Linux](docs/setup-linux.md)
- [Variables de entorno](docs/environment.md)
- [ADR 0001: Monorepo con npm workspaces](docs/adr/0001-monorepo-npm-workspaces.md)
- [ADR 0002: PostgreSQL en Docker Compose y acceso a datos con Prisma](docs/adr/0002-postgresql-docker-prisma.md)
- [Seguridad](docs/security.md)
- [ADR 0003: Hash de contraseñas con Argon2id](docs/adr/0003-password-hashing.md)
- [ADR 0004: Sesión con token de acceso y refresh token rotatorio](docs/adr/0004-session-tokens.md)
