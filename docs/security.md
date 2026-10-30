# Seguridad

Resumen de las medidas de seguridad de PantryMind y de las vulnerabilidades
conocidas de dependencias. El detalle de cada decisión está en los ADR
enlazados.

## Autenticación

### Contraseñas

Ver [ADR 0003](adr/0003-password-hashing.md).

- Se guardan con Argon2id (19 MiB, 2 iteraciones, 1 hilo), según OWASP. Nunca
  se guardan ni se devuelven en claro, y nunca aparecen en los logs.
- Entre 15 y 128 caracteres en el registro, sin reglas de composición, según
  NIST SP 800-63B-4.
- El login responde igual, y tarda lo mismo, para un correo inexistente que
  para una contraseña incorrecta: no permite averiguar qué correos están
  registrados.

### Sesión

Ver [ADR 0004](adr/0004-session-tokens.md).

- **Token de acceso:** JWT HS256 de 15 minutos, solo con `sub`, `iat` y `exp`.
  Se envía en `Authorization: Bearer` y la web lo guarda en memoria, nunca en
  `localStorage`.
- **Refresh token:** valor aleatorio de 32 bytes, de 7 días, en la cookie
  `pm_refresh` (`HttpOnly`, `SameSite=Strict`, `Path=/auth` y `Secure` en
  producción). En la base de datos solo se guarda su hash SHA-256.
- **Rotación:** cada refresh revoca el token usado y entrega uno nuevo, de
  forma atómica.
- **Reutilización:** un refresh token ya usado revoca toda la sesión.
- **Protección por defecto:** un guard global exige token de acceso en todas
  las rutas salvo las marcadas con `@Public()`: `GET /health` y las de
  `/auth`.
- **Errores:** todos los `401` de sesión tienen el mismo cuerpo y no indican
  el motivo.

### Validación de entradas

- Los cuerpos de las peticiones se validan con Zod. Un error responde `400`
  con el campo y el motivo, nunca con el valor recibido.
- La configuración se valida al arrancar: con un valor inválido la API no
  arranca, y el mensaje no muestra el valor (ver
  [environment.md](environment.md)).

### Secretos

- `JWT_ACCESS_SECRET` y las URL de base de datos son secretos fuera del
  entorno local. `.env` no se versiona.
- La CI usa valores de test no sensibles, definidos en el workflow. No hay
  secretos de GitHub.

## Pendiente

Cada punto es una posible Issue independiente:

- límite de peticiones en `login`, `register` y `refresh`, y filtro global de
  errores (Issue 10);
- limpieza periódica de los refresh tokens caducados;
- duración máxima de una sesión, aunque se siga usando;
- CORS y cabeceras de seguridad;
- adaptación de la sesión a la aplicación móvil con Capacitor;
- normalización Unicode (NFKC) de las contraseñas antes del hash.

## Vulnerabilidades de dependencias

`npm audit` se ejecuta en cada Issue. Resultado actual: **0
vulnerabilidades** (2026-10-30), en dependencias de producción y de
desarrollo.

### Resueltas

| Fecha      | Paquete                       | Severidad | Origen                           | Solución                                  |
| ---------- | ----------------------------- | --------- | -------------------------------- | ----------------------------------------- |
| 2026-10-30 | `multer` 2.0.0 - 2.4.0        | Alta      | `@nestjs/platform-express`       | `@nestjs/*` 12.3.2 (`multer` 2.5.0)       |
| 2026-10-30 | `@nestjs/platform-express`    | Alta      | Versiones anteriores a 12.3.2    | `@nestjs/*` 12.3.2                        |
| 2026-10-30 | `body-parser` 2.0.0 - 2.3.0   | Alta      | `express`                        | `@nestjs/*` 12.3.2 (`body-parser` 2.4.0)  |
| 2026-10-30 | `qs` 6.7.0 - 6.16.0           | Moderada  | `express`                        | `@nestjs/*` 12.3.2 (`qs` 6.17.1)          |
| 2026-10-30 | `fast-uri` 3.0.0 - 3.1.8      | Moderada  | `@nestjs/cli` → `ajv` (solo dev) | `npm audit fix` (`fast-uri` 3.1.9)        |
| 2026-10-30 | `undici` 8.0.0 - 8.12.1 (dev) | Alta      | `jsdom`, solo en tests de web    | `jsdom` 30.1.3 (`undici` 8.12.3)          |
| 2026-10-30 | `vitest` y `@vitest/mocker`   | Moderada  | Solo herramienta de tests        | `vitest` 4.1.12 (`@vitest/mocker` 4.1.12) |
| 2026-10-16 | `deepmerge-ts` 7.1.5          | Alta      | `prisma` → `@prisma/config`      | Prisma 7.10.1 (`deepmerge-ts` 8.0.2)      |
| 2026-10-16 | `mysql2` 3.15.3 (dos avisos)  | Alta      | `prisma`                         | Prisma 7.10.1 (`mysql2` 3.24.4)           |

Las correcciones de 2026-10-30 no cambian de versión mayor. Se aplicaron con
`npm audit fix` y con la actualización de los rangos de `@nestjs/*` y
`vitest`, sin `--force`.

`npm audit` contaba cuatro vulnerabilidades altas: las dos de la tabla y las
de `prisma` y `@prisma/config`, que solo heredaban las anteriores. Avisos:

- `deepmerge-ts`: agotamiento de la pila al combinar objetos con referencias
  circulares;
- `mysql2`: degradación del plugin de autenticación a
  `mysql_clear_password`, que expone credenciales en claro, y una bomba de
  descompresión zlib en el protocolo comprimido de MySQL.

Alcance antes de la corrección:

- llegaban por `prisma`, la CLI, que está en las dependencias de desarrollo;
  pero `@prisma/client` la declara como dependencia _peer_ opcional, así que
  `npm` también la instala sin las dependencias de desarrollo;
- la API compilada no carga ninguno de los dos paquetes: `mysql2` solo lo usa
  la CLI para bases de datos MySQL, y PantryMind usa PostgreSQL con
  `@prisma/adapter-pg`; `deepmerge-ts` solo se usa al leer la configuración
  de la CLI;
- el riesgo real era bajo, pero había una corrección sin cambio de versión
  mayor: Prisma 7.10.0 → 7.10.1 (`prisma`, `@prisma/client` y
  `@prisma/adapter-pg`).

No se usó `npm audit fix --force` ni se pasó a Prisma 8.

### Cómo revisar una vulnerabilidad nueva

1. Ver qué paquete la trae: `npm ls <paquete> --all`.
2. Comprobar si llega también sin las dependencias de desarrollo:
   `npm ls <paquete> --all --omit=dev`.
3. Buscar una versión del paquete que la trae, dentro de la misma versión
   mayor, que la resuelva.
4. Si existe, actualizar y ejecutar todas las comprobaciones. Si no, anotarla
   aquí con su origen y su alcance.
