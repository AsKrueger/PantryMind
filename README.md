# PantryMind

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

Lo único que existe por ahora es una API mínima con un endpoint de salud
(`GET /health`) y una web mínima con una página inicial. La web todavía no
se comunica con la API. No hay base de datos, autenticación ni lógica de
inventario, recetas o listas de la compra. La planificación está en la
[hoja de ruta](docs/roadmap.md).

## Stack

Instalado:

- **Backend:** NestJS 12 (`@nestjs/core` 12.1.2) sobre Express, en `apps/api`.
- **Frontend:** React 19.3.0 con Vite 8.3.4 y TypeScript, en `apps/web`.
- **Tests:** Vitest 4.1.11 en los dos workspaces; en la web, además,
  Testing Library para React 16.3.3, `jest-dom` 7.0.1 y jsdom 30.1.2.

Previsto, aún sin instalar ni configurar:

- **Acceso a datos:** Prisma.
- **Base de datos:** PostgreSQL.

## Requisitos

- Node.js 24 (la versión está indicada en `.nvmrc`).
- npm 11.
- Git.

## Instalación

```text
git clone https://github.com/AsKrueger/PantryMind.git
cd PantryMind
npm install
```

`npm install` se ejecuta siempre en la raíz: instala las dependencias de
todos los workspaces y mantiene un único `package-lock.json`.

## Arrancar la API en desarrollo

Desde la raíz del repositorio:

```text
npm run start:dev -w @pantrymind/api
```

La API escucha en el puerto indicado por la variable de entorno `PORT` o,
si no está definida, en el `3000`. Para comprobar que funciona, abre
<http://localhost:3000/health>; la respuesta es:

```json
{ "status": "ok" }
```

## Tests de la API

Desde la raíz del repositorio:

```text
npm run test -w @pantrymind/api
npm run test:e2e -w @pantrymind/api
```

El primer comando ejecuta los tests unitarios y el segundo los tests de
extremo a extremo, que arrancan la aplicación y hacen peticiones HTTP reales.

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

## Estructura de carpetas

```text
.
├── apps/
│   ├── api/        Backend: API con NestJS
│   └── web/        Frontend: web con React y Vite
├── docs/
│   ├── adr/        Registros de decisiones de arquitectura
│   └── roadmap.md  Hoja de ruta
├── .editorconfig   Estilo de edición común a todos los editores
├── .env.example    Plantilla de variables de entorno
├── .gitattributes  Normalización de finales de línea
├── .gitignore      Archivos que no se versionan
├── .nvmrc          Versión de Node.js del proyecto
└── package.json    Raíz del monorepo (npm workspaces)
```

## Documentación

- [Hoja de ruta](docs/roadmap.md)
- [ADR 0001: Monorepo con npm workspaces](docs/adr/0001-monorepo-npm-workspaces.md)
