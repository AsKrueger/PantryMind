import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta, o todas las de un controlador, como pública: el guard
 * global no exige token de acceso. Todas las demás rutas lo exigen.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
