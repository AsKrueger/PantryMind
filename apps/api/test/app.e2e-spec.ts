import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Estos tests no usan la base de datos: se sustituye PrismaService para
      // que la aplicación arranque sin PostgreSQL.
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  // El guard global responde antes de llegar a la base de datos.
  it('/users/me (GET) without a token is rejected', () => {
    return request(app.getHttpServer()).get('/users/me').expect(401).expect({
      message: 'No autorizado',
      error: 'Unauthorized',
      statusCode: 401,
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
