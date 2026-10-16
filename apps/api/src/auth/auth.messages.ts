// Mensajes de error de autenticación. Son genéricos a propósito: ninguno dice
// el motivo concreto del rechazo.

export const EMAIL_CONFLICT_MESSAGE =
  'No se ha podido completar el registro con ese correo';

// El mismo mensaje para un correo inexistente y para una contraseña
// incorrecta: la respuesta no revela qué correos están registrados.
export const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos';

// Cualquier otro 401: token de acceso ausente, inválido o caducado, y refresh
// token ausente, caducado, revocado o reutilizado.
export const UNAUTHORIZED_MESSAGE = 'No autorizado';
