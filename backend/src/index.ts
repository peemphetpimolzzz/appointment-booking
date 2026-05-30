import { createApp } from './app';
import { prisma } from './lib/prisma';

const PORT = Number(process.env.PORT ?? 8080);

/** Wait for Postgres to accept connections before serving traffic. */
async function waitForDatabase(retries = 30, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      console.log(`[startup] database not ready (attempt ${attempt}/${retries})`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main(): Promise<void> {
  await waitForDatabase();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[startup] appointment-booking API listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
