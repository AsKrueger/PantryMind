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

**En preparación, sin funcionalidades implementadas.**

El repositorio contiene por ahora únicamente la estructura del monorepo, la
configuración común y la documentación inicial. Todavía no hay código de
aplicación. La planificación está en la [hoja de ruta](docs/roadmap.md).

## Stack previsto

Estas tecnologías están planificadas, pero aún no están instaladas ni
configuradas:

- **Frontend:** React con Vite.
- **Backend:** NestJS.
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

El proyecto todavía no tiene dependencias, así que `npm install` solo
prepara los workspaces y comprueba el archivo `package-lock.json`.

## Estructura de carpetas

```text
.
├── apps/
│   ├── api/        Backend (pendiente)
│   └── web/        Frontend (pendiente)
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
