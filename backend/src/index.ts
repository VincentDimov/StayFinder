import { serve } from '@hono/node-server';
import { app } from './app.ts';
import { env } from './env.ts';
import { pool, authPool } from './db.ts';
const server = serve({ fetch: app.fetch, port: env.port }, (info) =>
  console.log(`StayFinder API: http://localhost:${info.port}`),
);
const shutdown = (): void => {
  server.close(() => {
    void Promise.all([pool.end(), authPool.end()]).then(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
