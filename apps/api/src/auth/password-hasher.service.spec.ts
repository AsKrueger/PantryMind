import { PasswordHasherService } from './password-hasher.service.js';

describe('PasswordHasherService', () => {
  const hasher = new PasswordHasherService();
  const password = 'correct horse battery staple';

  it('produces an Argon2id hash with the OWASP parameters', async () => {
    const passwordHash = await hasher.hash(password);

    expect(passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(passwordHash).not.toContain(password);
  });

  it('produces a different hash each time for the same password', async () => {
    const [first, second] = await Promise.all([
      hasher.hash(password),
      hasher.hash(password),
    ]);

    expect(first).not.toBe(second);
  });

  it('verifies the right password', async () => {
    const passwordHash = await hasher.hash(password);

    await expect(hasher.verify(passwordHash, password)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await hasher.hash(password);

    await expect(
      hasher.verify(passwordHash, 'Correct horse battery staple'),
    ).resolves.toBe(false);
  });
});
