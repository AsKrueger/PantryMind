import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from './../../src/prisma/prisma.module.js';
import { PrismaService } from './../../src/prisma/prisma.service.js';

describe('User (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('uses the test database', async () => {
    const [row] = await prisma.$queryRaw<
      { name: string }[]
    >`SELECT current_database()::text AS name`;

    expect(row.name).toMatch(/_test$/);
  });

  it('creates a user and reads it back', async () => {
    const created = await prisma.user.create({
      data: { email: 'ana@example.com', passwordHash: 'not-a-real-hash' },
    });

    const found = await prisma.user.findUnique({
      where: { email: 'ana@example.com' },
    });

    expect(found).toEqual(created);
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects a second user with the same email', async () => {
    await prisma.user.create({
      data: { email: 'ana@example.com', passwordHash: 'not-a-real-hash' },
    });

    await expect(
      prisma.user.create({
        data: { email: 'ana@example.com', passwordHash: 'another-hash' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(await prisma.user.count()).toBe(1);
  });
});
