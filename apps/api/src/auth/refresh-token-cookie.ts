import type { CookieSerializeOptions } from '@nestjs/common';
import type { Env } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'pm_refresh';

// El navegador solo envía la cookie a las rutas de /auth: refresh y logout la
// necesitan. Ninguna otra ruta de la API la recibe.
export const REFRESH_COOKIE_PATH = '/auth';

/**
 * Atributos de la cookie del refresh token:
 * - HttpOnly: el JavaScript de la página no puede leerla.
 * - SameSite=Strict: el navegador no la envía en peticiones que empiezan en
 *   otro sitio, lo que evita CSRF.
 * - Secure en producción: solo viaja por HTTPS. En desarrollo la API se sirve
 *   por HTTP y la cookie no llegaría.
 */
export function refreshCookieOptions(
  nodeEnv: Env['NODE_ENV'],
  ttlDays: number,
): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    // En segundos, no en milisegundos.
    maxAge: ttlDays * 24 * 60 * 60,
  };
}
