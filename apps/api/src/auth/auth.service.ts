import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EmailAlreadyRegisteredError,
  PublicUser,
  UsersService,
} from '../users/users.service.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { PasswordHasherService } from './password-hasher.service.js';

export const EMAIL_CONFLICT_MESSAGE =
  'No se ha podido completar el registro con ese correo';
// El mismo mensaje para un correo inexistente y para una contraseña
// incorrecta: la respuesta no revela qué correos están registrados.
export const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos';

/** Reglas de registro y de comprobación de credenciales. */
@Injectable()
export class AuthService implements OnModuleInit {
  // Hash de una contraseña aleatoria que nadie conoce, con los mismos
  // parámetros que los reales. Se verifica contra él cuando el correo no
  // existe, para que el login tarde lo mismo en los dos casos.
  private dummyHash: string;

  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasherService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await this.hasher.hash(randomUUID());
  }

  async register({ email, password }: RegisterInput): Promise<PublicUser> {
    const passwordHash = await this.hasher.hash(password);
    try {
      return await this.users.create(email, passwordHash);
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        throw new ConflictException(EMAIL_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async login({
    email,
    password,
  }: LoginInput): Promise<Pick<PublicUser, 'id' | 'email'>> {
    const user = await this.users.findCredentialsByEmail(email);
    const valid = await this.hasher.verify(
      user?.passwordHash ?? this.dummyHash,
      password,
    );
    if (!user || !valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    return { id: user.id, email: user.email };
  }
}
