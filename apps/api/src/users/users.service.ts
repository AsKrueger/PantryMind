import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Datos públicos de un usuario: los únicos que salen de la API. */
export interface PublicUser {
  id: string;
  email: string;
  createdAt: Date;
}

/** Datos necesarios para comprobar credenciales. No salen de la API. */
export interface UserCredentials {
  id: string;
  email: string;
  passwordHash: string;
}

/** El correo ya pertenece a otro usuario. */
export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/**
 * Acceso a los datos de usuarios. Sin lógica de autenticación. Cada consulta
 * selecciona explícitamente los campos que devuelve.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un usuario. Un correo repetido lo detecta la restricción única de la
   * base de datos, también si llegan dos registros a la vez.
   */
  async create(email: string, passwordHash: string): Promise<PublicUser> {
    try {
      return await this.prisma.user.create({
        data: { email, passwordHash },
        select: { id: true, email: true, createdAt: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  findPublicById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, createdAt: true },
    });
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
  }
}
