import dotenv from 'dotenv';
import { resolve } from 'node:path';
// Läser lokal .env från arbetsmappen eller dess förälder. Redan satta miljövariabler har företräde.
dotenv.config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')],
  quiet: true,
});
// Avbryter på Vercel om databasanslutningar eller CA-certifikat saknas, i stället för att använda lokala standardvärden.
if (
  process.env.VERCEL &&
  (!process.env.DATABASE_URL || !process.env.AUTH_DATABASE_URL || !process.env.DATABASE_CA)
) {
  throw new Error('DATABASE_URL, AUTH_DATABASE_URL and DATABASE_CA must be configured on Vercel.');
}
// Samlar miljöinställningarna. Standardanslutningarna gäller den lokala Docker-databasen.
export const env = {
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://stayfinder_api:stayfinder_local_api@localhost:54329/stayfinder',
  authDatabaseUrl:
    process.env.AUTH_DATABASE_URL ??
    'postgresql://stayfinder_auth:stayfinder_local_auth@localhost:54329/stayfinder',
  // Administratörsanslutningen används av lokal installation och teststädning, inte av API:ts vanliga anrop.
  adminDatabaseUrl:
    process.env.ADMIN_DATABASE_URL ??
    'postgresql://postgres:stayfinder_local_admin@localhost:54329/stayfinder',
  port: Number(process.env.API_PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  production: process.env.NODE_ENV === 'production',
  // Omvandlar eventuella skrivna \n till radbrytningar i det PEM-formaterade CA-certifikatet.
  databaseCa: process.env.DATABASE_CA?.replace(/\\n/g, '\n'),
};
