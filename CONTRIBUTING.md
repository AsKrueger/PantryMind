# Cómo contribuir a PantryMind

Esta guía describe cómo se organiza el trabajo en el repositorio: ramas,
commits y comprobaciones que deben pasar antes de proponer un cambio.

## Flujo de ramas

- `main` contiene las versiones estables del proyecto.
- `develop` es la rama de integración: reúne el trabajo terminado de cada Issue.
- El trabajo se hace en ramas creadas desde `develop`:
  - `feature/...` para una tarea o funcionalidad, por ejemplo `feature/issue3`;
  - `bugfix/...` para corregir un error.
- No se hacen commits directos en `develop` ni en `main`.

Pasos habituales:

1. Actualizar `develop` con los últimos cambios del remoto.
2. Crear la rama de trabajo desde `develop`.
3. Hacer los cambios y comprobar que pasan los comandos de calidad.
4. Abrir un pull request hacia `develop` que enlace la Issue correspondiente.
5. Esperar a que la integración continua termine en verde en Linux y en
   Windows. Un pull request no se fusiona con la CI en rojo o sin terminar.
6. Tras la fusión, eliminar la rama de trabajo.

## Integración de `develop` en `main`

`develop` se integra en `main` al cerrar una fase de la
[hoja de ruta](docs/roadmap.md), con la CI en verde en `develop`, mediante un
pull request desde `develop`. `main` no recibe cambios por ninguna otra vía.

## Commits

Los mensajes de commit siguen el formato
[Conventional Commits](https://www.conventionalcommits.org/es/):

```text
<tipo>(<ámbito opcional>): <descripción en imperativo y en minúsculas>
```

Tipos más habituales en este proyecto:

| Tipo       | Uso                                                       |
| ---------- | --------------------------------------------------------- |
| `feat`     | Nueva funcionalidad                                       |
| `fix`      | Corrección de un error                                    |
| `docs`     | Cambios solo en la documentación                          |
| `style`    | Formato del código, sin cambios de comportamiento         |
| `refactor` | Cambio interno que no añade funcionalidad ni corrige nada |
| `test`     | Tests nuevos o modificados                                |
| `chore`    | Mantenimiento: dependencias, configuración, limpieza      |

Ejemplos:

```text
feat(api): add health endpoint
chore: add root quality scripts
style: apply prettier formatting
```

El mensaje contiene únicamente la descripción del cambio. Cada commit agrupa
cambios con un mismo propósito; el formato aplicado de forma masiva va en un
commit propio para que el historial se pueda leer.

## Comandos de calidad

Antes de abrir un pull request, estos comandos deben terminar sin errores.
Se ejecutan desde la raíz del repositorio:

```text
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run test:e2e -w @pantrymind/api
npm run build
```

| Comando                | Qué comprueba                                              |
| ---------------------- | ---------------------------------------------------------- |
| `npm run lint`         | Patrones incorrectos o sospechosos en el código (oxlint)   |
| `npm run format:check` | Que el formato coincide con el de Prettier, sin modificar  |
| `npm run typecheck`    | Que los tipos de TypeScript son correctos, sin compilar    |
| `npm run test`         | Tests unitarios de la API y tests de componentes de la web |
| `npm run test:e2e ...` | Tests de extremo a extremo de la API                       |
| `npm run build`        | Que los dos workspaces compilan                            |

Si `format:check` falla, `npm run format` corrige el formato automáticamente.

Si el cambio afecta a la base de datos, también deben pasar los tests de
integración, que necesitan PostgreSQL en marcha (`npm run db:up`):

```text
npm run test:integration -w @pantrymind/api
```

## Integración continua

El workflow `.github/workflows/ci.yml` ejecuta estos mismos comandos, en el
mismo orden y precedidos de `npm ci`, en cada pull request hacia `develop` o
`main` y en cada push a esas ramas. Lo hace en Linux y en Windows; los dos
deben terminar en verde para poder fusionar. Un tercer job, solo en Linux,
aplica las migraciones a un PostgreSQL de servicio y ejecuta los tests de
integración; también debe terminar en verde.

Si la CI falla en un solo sistema, se corrige la causa en el repositorio. No
se añaden condiciones por sistema operativo al workflow para ocultarla.

## Estilo del código

- El formato lo decide Prettier, con una única configuración en la raíz
  (`.prettierrc.json`). No se discute en las revisiones.
- `.editorconfig` define lo básico para cualquier editor: UTF-8, finales de
  línea LF y sangría de 2 espacios.
- Cada workspace tiene su propia configuración de oxlint (`.oxlintrc.json`),
  porque la API y la web necesitan reglas distintas.
- Si hace falta desactivar una regla de linting, la razón se escribe junto a
  la excepción.
- La documentación se escribe en español; el código y los nombres de archivos,
  en inglés.
