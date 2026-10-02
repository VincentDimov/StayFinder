import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Kravtesterna använder den lokala Docker-databasen och egna tillfälliga testkonton.
// Ange alla anslutningar uttryckligen så att appens Supabase-.env inte påverkar testerna.
const testEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://stayfinder_api:stayfinder_local_api@localhost:54329/stayfinder',
  AUTH_DATABASE_URL:
    'postgresql://stayfinder_auth:stayfinder_local_auth@localhost:54329/stayfinder',
  ADMIN_DATABASE_URL: 'postgresql://postgres:stayfinder_local_admin@localhost:54329/stayfinder',
  DATABASE_CA: '',
  FRONTEND_URL: 'http://localhost:3000',
};
delete testEnvironment.VERCEL;

// Startar samma TypeScript-testfil som tidigare men med en egen, lokal processmiljö.
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL('../../node_modules/tsx/dist/cli.mjs', import.meta.url)),
    '--test',
    fileURLToPath(new URL('../tests/integration.test.ts', import.meta.url)),
  ],
  { cwd: projectRoot, env: testEnvironment, stdio: 'inherit' },
);

// För vidare startfel och testernas exitkod till npm och eventuell CI-körning.
if (result.error) throw result.error;
process.exit(result.status ?? 1);
