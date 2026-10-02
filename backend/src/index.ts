import { serve } from '@hono/node-server';
import { app } from './app.ts';
import { env } from './env.ts';
import { pool, authPool } from './db.ts';
// Startar Hono som en separat lokal Node-server på den konfigurerade API-porten.
const server = serve({ fetch: app.fetch, port: env.port }, (info) =>
  console.log(`StayFinder API: http://localhost:${info.port}`),
);
// Stänger HTTP-servern och databasens anslutningspooler innan processen avslutas.
const shutdown = (): void => {
  server.close(() => {
    void Promise.all([pool.end(), authPool.end()]).then(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
