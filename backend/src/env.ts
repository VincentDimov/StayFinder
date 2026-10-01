import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
export const env = {
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://stayfinder_api:stayfinder_local_api@localhost:54329/stayfinder',
  authDatabaseUrl:
    process.env.AUTH_DATABASE_URL ??
    'postgresql://stayfinder_auth:stayfinder_local_auth@localhost:54329/stayfinder',
  adminDatabaseUrl:
    process.env.ADMIN_DATABASE_URL ??
    'postgresql://postgres:stayfinder_local_admin@localhost:54329/stayfinder',
  port: Number(process.env.API_PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  production: process.env.NODE_ENV === 'production',
};
