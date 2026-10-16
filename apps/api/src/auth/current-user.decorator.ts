import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Usuario autenticado por el token de acceso. */
export interface AuthenticatedUser {
  id: string;
}

/** Petición en la que el guard ha dejado el usuario autenticado. */
export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

/**
 * Inyecta el usuario autenticado en un parámetro del controlador. Solo tiene
 * valor en rutas protegidas: en las públicas es undefined.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
