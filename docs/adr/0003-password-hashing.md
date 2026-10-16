# ADR 0003: Hash de contraseñas con Argon2id

- **Estado:** Aceptada
- **Fecha:** 2026-10-16

## Contexto

La Issue 7 añade el registro y el inicio de sesión en la API. La contraseña es
el único factor de autenticación de PantryMind: no hay MFA. Hay que decidir:

1. con qué algoritmo y con qué parámetros se guardan las contraseñas;
2. qué librería lo implementa, de forma que se instale y funcione igual en
   Windows y en Linux, en local y en la CI;
3. qué longitudes se admiten;
4. cómo se evita que el inicio de sesión revele qué correos están registrados.

Una contraseña no se cifra, porque el cifrado es reversible: quien tenga la
clave recupera todas las contraseñas. Se guarda un hash, que no se puede
deshacer: para comprobar una contraseña se calcula de nuevo el hash y se
compara. Cada hash lleva una sal aleatoria propia, así que dos usuarios con la
misma contraseña tienen hashes distintos y las tablas precalculadas no sirven.

## Decisión

### Algoritmo: Argon2id

Argon2id es la primera opción del
[OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
Es deliberadamente lento y además exige memoria: cada intento de un atacante
con la base de datos robada cuesta tiempo y memoria, lo que encarece los
ataques con GPU o hardware específico, que tienen mucha capacidad de cálculo
pero poca memoria por núcleo.

### Parámetros

| Parámetro     | Valor                                                   |
| ------------- | ------------------------------------------------------- |
| Variante      | Argon2id, versión 0x13 (19)                             |
| Memoria       | 19456 KiB (19 MiB)                                      |
| Iteraciones   | 2                                                       |
| Paralelismo   | 1                                                       |
| Longitud hash | 32 bytes                                                |
| Sal           | 16 bytes aleatorios por hash, generados por la librería |

Fuente: OWASP Password Storage Cheat Sheet, consultado el 2026-10-16: _"Use
Argon2id with a minimum configuration of 19 MiB of memory, an iteration count
of 2, and 1 degree of parallelism."_ Las configuraciones equivalentes que
lista (46 MiB y t=1, 12 MiB y t=3, etc.) dan la misma protección cambiando
memoria por CPU.

Los parámetros se fijan en `PasswordHasherService`
(`apps/api/src/auth/password-hasher.service.ts`), aunque coincidan con los
valores por defecto de la librería, para que una actualización no los cambie
sin que se note. El hash se guarda en formato PHC
(`$argon2id$v=19$m=19456,t=2,p=1$<sal>$<hash>`), que incluye la sal y los
parámetros: si en el futuro se suben, los hashes antiguos se siguen
verificando con los suyos.

### Librería: `@node-rs/argon2` 2.2.2

Se compararon tres opciones (2026-10-16):

|                | `@node-rs/argon2` 2.2.2                                                                                                 | `argon2` 0.45.1                                                                      | `crypto.argon2` de Node    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------- |
| Implementación | RustCrypto, con napi-rs                                                                                                 | C de referencia, con N-API                                                           | OpenSSL, desde Node 24.7.0 |
| Instalación    | un paquete precompilado por plataforma, entre ellos `win32-x64-msvc`, `linux-x64-gnu` y `linux-x64-musl`; nunca compila | binarios precompilados con `node-gyp-build`; compila en la máquina si no hay binario | incluida en Node           |
| Módulos ES     | sí                                                                                                                      | paquete CommonJS                                                                     | sí                         |
| Resultado      | cadena PHC, con `hash` y `verify`                                                                                       | cadena PHC, con `hash`, `verify` y `needsRehash`                                     | bytes en bruto             |

Se elige `@node-rs/argon2`:

- se instala sin compilar código nativo en Windows y en Linux;
- sus valores por defecto ya son los de OWASP;
- devuelve y verifica cadenas PHC estándar.

`argon2` es igual de válida, pero puede intentar compilar en la máquina si no
encuentra binario. `crypto.argon2` evita una dependencia, pero obligaría a
generar la sal, codificar el formato PHC y comparar en tiempo constante por
nuestra cuenta: código criptográfico propio que no hace falta escribir.

Solo `PasswordHasherService` importa la librería. Cambiarla afecta a un único
archivo.

### Límites de longitud

| Campo      | Mínimo                             | Máximo         |
| ---------- | ---------------------------------- | -------------- |
| Correo     | —                                  | 254 caracteres |
| Contraseña | 15 caracteres, solo en el registro | 128 caracteres |

- **Mínimo de 15.** La Issue proponía 12. Se sube a 15 porque es lo que piden
  las dos referencias vigentes cuando la contraseña es el único factor:
  - [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)
    (agosto de 2025): _"require passwords that are used as a single-factor
    authentication mechanism to be a minimum of 15 characters in length"_;
  - [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html):
    _"If MFA is not enabled passwords shorter than 15 characters are
    considered to be weak"_.
- **Máximo de 128.** Las dos fuentes piden admitir al menos 64 caracteres para
  permitir frases. El máximo también acota el coste de calcular el hash con
  una entrada enorme.
- **Sin reglas de composición.** NIST prohíbe exigir mayúsculas, números o
  símbolos.
- **Sin truncar ni transformar.** La contraseña se usa tal cual, sin recortar
  espacios.
- **Unicode.** Cada carácter (punto de código) cuenta como uno, como indica
  NIST: un emoji cuenta como 1, no como 2.
- **Login.** El inicio de sesión no aplica el mínimo, que es una regla para
  contraseñas nuevas: si algún día se sube, los usuarios con contraseñas
  anteriores podrán seguir entrando. Sí aplica el máximo.
- **Correo.** Se recortan los espacios alrededor y se pasa a minúsculas antes
  de validarlo, buscarlo y guardarlo. 254 caracteres es el máximo de una
  dirección utilizable según la RFC 5321.

### Protección frente a la enumeración de usuarios

Enumerar usuarios es averiguar qué correos tienen cuenta por diferencias en
la respuesta del login. Para evitarlo:

- un correo inexistente y una contraseña incorrecta responden lo mismo:
  `401` con el mismo cuerpo (`Correo o contraseña incorrectos`);
- si el correo no existe, se verifica igualmente la contraseña contra un hash
  ficticio, calculado al arrancar con los mismos parámetros, para que la
  respuesta tarde lo mismo que con un correo existente.

El registro sí indica que el correo ya está registrado (`409`): es necesario
para que el usuario sepa por qué no puede crear la cuenta. El mensaje es
genérico, pero permite comprobar si un correo existe. Lo mitigará el límite
de peticiones de la Issue 10.

### Validación de entradas

Los cuerpos de las peticiones se validan con Zod, igual que la configuración
(Issue 6), mediante un pipe propio de unas 40 líneas
(`apps/api/src/common/zod-validation.pipe.ts`). No se usa una librería de
integración porque el caso es pequeño y así no se añade otra dependencia. El
pipe responde `400` con un motivo por campo y nunca incluye el valor recibido.

## Alternativas consideradas

### bcrypt

Muy extendido, pero OWASP lo deja para sistemas antiguos donde Argon2id y
scrypt no están disponibles. Trunca la entrada a 72 bytes, lo que obligaría a
limitar las contraseñas por bytes y no por caracteres, y no exige memoria, así
que resiste peor los ataques con GPU.

### scrypt

Exige memoria y está incluido en Node (`crypto.scrypt`), pero OWASP lo sitúa
por detrás de Argon2id. Además no tiene un formato PHC estándar en Node:
habría que codificar sal y parámetros por nuestra cuenta.

## Consecuencias

### Positivas

- Las contraseñas se guardan con el algoritmo y los parámetros recomendados
  vigentes, y los parámetros quedan dentro de cada hash.
- La instalación no depende de compiladores ni de Python en ninguna máquina.
- La librería está aislada en un servicio: cambiarla o subir parámetros es
  local.
- El login no revela qué correos existen, ni por el mensaje ni por el tiempo.

### Negativas y riesgos

- Cada hash usa 19 MiB durante unos 10 ms (medido en el equipo de desarrollo
  el 2026-10-16). Muchos registros o logins simultáneos consumen memoria y
  CPU; el límite de peticiones (Issue 10) lo acota.
- Las dependencias opcionales por plataforma de `@node-rs/argon2` dependen de
  que `package-lock.json` incluya todas las plataformas. Si al regenerarlo se
  pierde alguna, `npm ci` falla en esa plataforma. La CI en Linux y Windows lo
  detecta.
- El `409` del registro permite comprobar si un correo existe (ver arriba).
- NIST recomienda normalizar Unicode (NFKC o NFKD) antes de calcular el hash,
  para que una misma contraseña escrita con distintas formas Unicode coincida.
  No se aplica todavía; cambiarlo después obliga a tener en cuenta los hashes
  existentes. Queda como posible Issue futura.
