# ADR 0004: Sesión con token de acceso y refresh token rotatorio

- **Estado:** Aceptada
- **Fecha:** 2026-10-16

## Contexto

La Issue 7 dejó el registro y la comprobación de credenciales, sin sesión. A
partir de la Issue 8, todo endpoint con datos de un usuario necesita saber
quién hace la petición. Hay que decidir:

1. qué credencial lleva cada petición y cuánto dura;
2. cómo se renueva sin pedir la contraseña otra vez;
3. dónde la guarda el navegador;
4. cómo se limita el daño si alguien la roba;
5. cómo se protegen las rutas.

Las restricciones son las de la Issue 8: la web (Issue 9) se sirve con un
proxy de desarrollo desde el mismo origen, y la aplicación móvil con
Capacitor llegará en una fase posterior.

## Decisión

### Dos credenciales

|                               | Token de acceso                                          | Refresh token                           |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------- |
| Formato                       | JWT firmado con HS256                                    | 32 bytes aleatorios en base64url, opaco |
| Contenido                     | `sub` (id del usuario), `iat`, `exp`                     | Ninguno: es solo un identificador       |
| Duración                      | 15 minutos (`JWT_ACCESS_TTL_SECONDS`)                    | 7 días (`REFRESH_TOKEN_TTL_DAYS`)       |
| Dónde va                      | Cuerpo de la respuesta; cabecera `Authorization: Bearer` | Cookie `pm_refresh`                     |
| Dónde se guarda en el cliente | En memoria (Issue 9)                                     | Cookie gestionada por el navegador      |
| En la base de datos           | No se guarda                                             | Solo su hash SHA-256                    |
| Se puede revocar              | No: vale hasta que caduca                                | Sí                                      |

**Qué es un JWT.** Tres partes en base64url separadas por puntos: cabecera,
contenido y firma. La firma garantiza que el contenido lo emitió quien tiene
la clave (`JWT_ACCESS_SECRET`) y que nadie lo ha cambiado. No lo cifra:
cualquiera que tenga el token puede leer su contenido. Por eso solo lleva el
id del usuario y las fechas, sin correo ni otros datos personales.

**Por qué el token de acceso dura poco.** La API lo verifica sin consultar la
base de datos, así que no se puede revocar: un token robado sirve hasta que
caduca. Con 15 minutos, el daño de un robo es limitado. Lo que dura más es el
refresh token, que sí se comprueba en la base de datos en cada uso.

**Verificación.** El guard acepta solo HS256 (`algorithms: ['HS256']`): un
token sin firma (`"alg": "none"`) o firmado con otro algoritmo se rechaza.
También se rechazan las firmas incorrectas y los tokens caducados.

### Librerías

| Uso                       | Librería                                                               | Versión                 |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------- |
| Firmar y verificar el JWT | `@nestjs/jwt` (usa `jsonwebtoken` 9.0.3)                               | 12.0.3                  |
| Leer y escribir cookies   | Soporte integrado de NestJS (`@Cookies()`, `setCookie`, `clearCookie`) | `@nestjs/common` 12.1.2 |

Comprobadas el 2026-10-16 en la documentación oficial de NestJS y en npm.
`@nestjs/jwt` declara compatibilidad con `@nestjs/common` 12 y se importa sin
problemas desde módulos ES. NestJS lee cookies sin paquetes adicionales
desde la versión 12.1, así que no hace falta `cookie-parser`.

Se descartó `@nestjs/authentication` 0.1.1, el módulo de autenticación
oficial publicado en septiembre de 2026, aunque ya incluye un guard global y
`@Public()`:

- es una versión 0.x de dos semanas;
- envía el refresh token en el cuerpo de la petición, no en una cookie
  `HttpOnly`;
- añade `iss`, `aud` y `amr` al token.

Conviene reevaluarlo cuando sea estable.

### Token de acceso en memoria y refresh token en cookie `HttpOnly`

La alternativa más simple es guardar los dos tokens en `localStorage`. Se
descarta: cualquier JavaScript de la página puede leer `localStorage`, así
que una sola vulnerabilidad XSS, en el código propio o en una dependencia,
permitiría robar la sesión y usarla desde otra máquina durante días.

Con este diseño:

- el refresh token está en una cookie `HttpOnly`, que el JavaScript de la
  página no puede leer;
- el token de acceso solo vive en una variable de la aplicación y desaparece
  al recargar; la web pide uno nuevo con el refresh token;
- un XSS todavía puede hacer peticiones mientras la página está abierta, pero
  no puede llevarse la sesión.

### Refresh opaco y guardado como hash

Un refresh token JWT se podría verificar sin base de datos, pero entonces no
se podría revocar ni detectar su reutilización. Como el refresh token se
consulta siempre en la base de datos, no necesita contener nada: basta un
valor aleatorio.

Solo se guarda su hash SHA-256. Quien lea la tabla `refresh_tokens`, por
ejemplo con una copia de seguridad robada, no puede usar los tokens. No hace
falta un hash lento como Argon2id: el valor tiene 32 bytes aleatorios
(256 bits) y no se puede adivinar probando, al contrario que una contraseña.

### Rotación y detección de reutilización

**Rotación.** Cada refresh revoca el token usado (`revoked_at`) y entrega uno
nuevo. Así, un token robado deja de servir en cuanto el usuario legítimo hace
su siguiente refresh.

**Familias.** Todos los tokens que salen del mismo login comparten
`family_id`.

**Reutilización.** Si llega un token ya revocado, alguien está usando un token
que ya se usó. Puede ser el atacante, si el usuario se le adelantó, o el
usuario, si se le adelantó el atacante, y la API no puede saber cuál de los
dos. Por eso revoca toda la familia, incluido el token más reciente, y
responde `401`: los dos tienen que volver a iniciar sesión, y el atacante
pierde el acceso.

Un token caducado y no revocado se rechaza con `401` sin revocar la familia:
caducar no es una señal de robo.

**Atomicidad.** La rotación se hace en una transacción, con un `UPDATE`
condicional:

```sql
UPDATE refresh_tokens SET revoked_at = now()
WHERE id = $1 AND revoked_at IS NULL AND expires_at > now();
```

Solo si esa sentencia actualiza una fila se crea el token nuevo, dentro de la
misma transacción. PostgreSQL bloquea la fila actualizada hasta el final de la
transacción. Si llegan dos peticiones con el mismo token:

1. la primera revoca la fila y crea el token nuevo;
2. la segunda espera en su `UPDATE` hasta que la primera confirma;
3. después vuelve a evaluar la condición, ya no se cumple porque `revoked_at`
   tiene valor, y no actualiza ninguna fila;
4. al no poder rotar, la segunda trata el token como reutilizado y revoca la
   familia, que ya incluye el token que acaba de crear la primera.

Solo una de las dos obtiene un token nuevo. Consecuencia: si la web lanzara
dos refresh a la vez con la misma cookie, cerraría su propia sesión. La web
de la Issue 9 debe hacer un solo refresh a la vez.

### Cookie y CSRF

**CSRF** (falsificación de petición entre sitios): una página maliciosa hace
que el navegador del usuario envíe una petición a la API. El navegador
adjuntaría la cookie del usuario, así que la petición llegaría autenticada
sin que el usuario lo sepa.

Atributos de la cookie `pm_refresh`:

| Atributo   | Valor         | Para qué                                                                                                               |
| ---------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `HttpOnly` | sí            | El JavaScript de la página no puede leerla.                                                                            |
| `SameSite` | `Strict`      | El navegador no la envía en peticiones iniciadas desde otro sitio: es la defensa principal frente a CSRF.              |
| `Path`     | `/auth`       | Solo viaja a las rutas de autenticación, que son las que la usan (`refresh` y `logout`). Ninguna otra ruta la recibe.  |
| `Secure`   | en producción | Solo viaja por HTTPS. En desarrollo la API va por HTTP, y con `Secure` la cookie no llegaría. Se deriva de `NODE_ENV`. |
| `Max-Age`  | 7 días        | Igual que la duración del refresh token.                                                                               |

Además:

- la cookie solo sirve para `POST /auth/refresh` y `POST /auth/logout`, y
  ninguna petición `GET` la usa: un enlace o una imagen no pueden
  provocar una acción con ella;
- `refresh` solo devuelve un token de acceso en el cuerpo de la respuesta, que
  una página de otro sitio no puede leer;
- el resto de la API se autentica con la cabecera `Authorization`, que el
  navegador nunca añade por su cuenta.

### Guard global con rutas públicas explícitas

El guard (`AccessTokenGuard`) se registra como `APP_GUARD`: se aplica a todas
las rutas de la aplicación. Una ruta solo es pública si se marca con
`@Public()`. Son públicas `GET /health` y las cuatro de `/auth`:

- `register` y `login` todavía no tienen sesión;
- `refresh` y `logout` se autentican con la cookie, no con el token de acceso.

Con un guard por ruta, cada endpoint nuevo tendría que acordarse de añadirlo,
y un olvido dejaría datos expuestos sin que ningún test fallara. Con el guard
global, un olvido deja la ruta cerrada (`401`), que es un fallo visible y
seguro.

El decorador `@CurrentUser()` entrega al controlador el usuario autenticado
(`{ id }`), sin leer la petición a mano.

### Respuestas `401`

Todas las respuestas `401` de sesión tienen el mismo cuerpo
(`{"message":"No autorizado","error":"Unauthorized","statusCode":401}`),
falte el token, esté manipulado, caducado, revocado o reutilizado. No indicar
el motivo no da pistas a quien prueba tokens. El login mantiene su mensaje
propio (`Correo o contraseña incorrectos`), igual para los dos casos
(ver [ADR 0003](0003-password-hashing.md)).

## Alternativas consideradas

### Sesión en el servidor con cookie de sesión

Una cookie con un identificador de sesión y la sesión guardada en el
servidor. Es más simple para una web, pero cada petición consulta la sesión
en la base de datos, y en la aplicación móvil tendría la misma limitación de
cookies que se describe abajo. El diseño con token de acceso deja la mayoría
de peticiones sin consulta y separa la credencial de corta duración de la de
larga duración.

### Refresh token JWT

Descartado arriba: no se podría revocar ni detectar su reutilización sin
guardarlo, y una vez guardado no aporta nada frente a un valor opaco.

## Consecuencias

### Positivas

- Un token de acceso robado sirve 15 minutos como mucho.
- Un refresh token robado deja de servir con la siguiente rotación, y su
  reutilización cierra la sesión completa.
- Ni el XSS ni una copia de la base de datos permiten llevarse una sesión
  duradera.
- Ninguna ruta nueva queda abierta por olvido.

### Negativas, limitaciones y trabajo pendiente

- **Capacitor.** En la aplicación móvil, la web se sirve desde un origen
  local (`capacitor://localhost` o `https://localhost`) distinto del de la
  API. Las cookies `SameSite=Strict` no se envían entre orígenes distintos, y
  el soporte de cookies de terceros en los WebView es limitado. Opciones a
  evaluar en esa fase:
  - guardar el refresh token en el almacenamiento seguro del sistema
    (Keychain o Keystore) y enviarlo en el cuerpo de `POST /auth/refresh`, en
    una variante del endpoint solo para clientes nativos;
  - servir la API y la aplicación bajo el mismo dominio;
  - usar el cliente HTTP nativo de Capacitor, que gestiona sus propias
    cookies.
- **Ruta de la cookie con proxy.** `Path=/auth` es la ruta que ve el
  navegador. Si el proxy de desarrollo de la Issue 9 publica la API bajo
  otro prefijo (por ejemplo `/api/auth`), tendrá que reescribir la ruta de la
  cookie, o la cookie no se enviará.
- **Tokens acumulados.** Los tokens caducados y revocados se quedan en la
  tabla `refresh_tokens`. Hace falta una limpieza periódica que borre los
  caducados hace tiempo: queda como Issue futura.
- **Duración máxima de la sesión.** Cada rotación da 7 días más, así que una
  sesión usada a diario no caduca nunca. Si hace falta, se puede añadir una
  duración máxima por familia.
- **Revocación del token de acceso.** Cerrar sesión revoca el refresh token,
  pero el token de acceso sigue valiendo hasta que caduca, como mucho
  15 minutos.
- **Refresh simultáneos.** Dos refresh a la vez con la misma cookie cierran
  la sesión (ver Atomicidad). La web debe hacer un solo refresh a la vez.
- **Rotación del secreto.** Cambiar `JWT_ACCESS_SECRET` invalida todos los
  tokens de acceso. Como duran 15 minutos y el refresh no depende del
  secreto, el efecto es un refresh adicional, no un cierre de sesión.
