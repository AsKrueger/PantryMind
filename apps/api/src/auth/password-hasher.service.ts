import { Injectable } from '@nestjs/common';
import { hash, verify, type Options } from '@node-rs/argon2';

/**
 * Parámetros de Argon2id recomendados por OWASP (Password Storage Cheat
 * Sheet): 19 MiB de memoria, 2 iteraciones y 1 hilo. Ver docs/adr/0003.
 *
 * Se fijan aquí aunque coincidan con los valores por defecto de la librería,
 * para que un cambio de versión no los altere sin que se note.
 */
const ARGON2ID_OPTIONS: Options = {
  // Algorithm.Argon2id. La librería lo declara como "const enum", que no se
  // puede importar con isolatedModules.
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Único punto del código que conoce la librería de hash. El hash resultante
 * es una cadena PHC ($argon2id$v=19$m=…,t=…,p=…$sal$hash) que incluye la sal
 * aleatoria y los parámetros, así que verify no necesita nada más.
 */
@Injectable()
export class PasswordHasherService {
  hash(password: string): Promise<string> {
    return hash(password, ARGON2ID_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
