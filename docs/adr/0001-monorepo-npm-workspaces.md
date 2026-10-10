# ADR 0001: Monorepo con npm workspaces

- **Estado:** Aceptada
- **Fecha:** 2026-10-10

## Contexto

PantryMind tendrá dos aplicaciones: una API (NestJS) y un cliente web
(React con Vite). Las desarrolla una sola persona, como proyecto de portfolio
y de aprendizaje, y ambas evolucionan a la vez: la mayoría de las
funcionalidades tocan backend y frontend.

Hay que decidir cómo organizar el código antes de escribirlo, porque cambiar
la estructura del repositorio más adelante obliga a mover archivos, rehacer
la configuración y complica el historial.

El entorno de desarrollo es Windows, pero el proyecto debe funcionar igual en
Linux (integración continua y despliegue).

## Decisión

Se usa un único repositorio (monorepo) gestionado con **npm workspaces**:

- Las aplicaciones viven en `apps/api` y `apps/web`.
- El `package.json` raíz declara `"workspaces": ["apps/*"]` y es privado.
- Hay un único `package-lock.json` en la raíz.
- No se crea carpeta `packages/` para código compartido hasta que exista una
  necesidad real.

## Alternativas consideradas

### Dos repositorios separados

Un repositorio para la API y otro para el cliente web.

- A favor: separación total, historiales y despliegues independientes.
- En contra: un cambio que afecta a las dos partes requiere dos commits y dos
  pull requests coordinados; la configuración común (finales de línea,
  versión de Node, estilo) se duplica y puede divergir; para quien revisa el
  portfolio es más difícil ver el proyecto completo.

Se descarta porque el coste de coordinación no aporta nada con un único
desarrollador y dos aplicaciones que cambian juntas.

### Turborepo o Nx

Herramientas de monorepo que añaden caché de tareas, ejecución en paralelo y
análisis del grafo de dependencias.

- A favor: aceleran compilaciones y tests en monorepos grandes.
- En contra: añaden una dependencia, configuración propia y conceptos que
  aprender; sus ventajas se notan con muchos paquetes y tiempos de compilación
  largos, que este proyecto no tiene.

Se descartan por ahora. Ambas funcionan sobre los workspaces del gestor de
paquetes, así que podrían incorporarse más adelante sin reestructurar el
repositorio.

## Consecuencias

### Positivas

- Un solo `npm install` en la raíz instala las dependencias de todo el proyecto.
- Un cambio que afecta a API y web cabe en un único commit y un único
  pull request.
- La configuración común se define una sola vez en la raíz.
- No se añade ninguna herramienta: npm workspaces viene incluido con npm.

### Negativas y riesgos

- npm eleva (hoist) las dependencias a `node_modules` de la raíz. Una
  aplicación podría importar por error un paquete que no declara en su propio
  `package.json`; hay que declarar siempre las dependencias en el workspace
  que las usa.
- No hay caché ni orquestación de tareas. Si los tiempos de compilación o de
  tests llegan a ser un problema, se revisará esta decisión.
- La integración continua tendrá que distinguir qué aplicación ha cambiado si
  se quiere evitar ejecutar todo en cada cambio.
- API y web comparten versión de Node.js.
