import pg, { type PoolClient } from 'pg';
import { env } from './env.ts';
// Läser bigint-priser som tal; projektets prisgränser håller värdena inom säkra JavaScript-heltal.
pg.types.setTypeParser(20, (value: string) => Number(value));
// Behåller PostgreSQL-datum som kalendersträngar så att tidszoner inte flyttar in- eller utcheckningsdagen.
pg.types.setTypeParser(1082, (value: string) => value);
// Återanvänder anslutningar med API-rollen som omfattas av RLS. Ett angivet CA-certifikat verifierar databasens TLS-anslutning.
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: env.production ? 2 : 10,
  ssl: env.databaseCa ? { ca: env.databaseCa, rejectUnauthorized: true } : undefined,
  connectionTimeoutMillis: 5000,
});
// Separat anslutningspool för den begränsade rollen som hanterar privata konton och sessioner.
export const authPool = new pg.Pool({
  connectionString: env.authDatabaseUrl,
  max: env.production ? 2 : 5,
  ssl: env.databaseCa ? { ca: env.databaseCa, rejectUnauthorized: true } : undefined,
  connectionTimeoutMillis: 5000,
});
// Loggar fel på lediga poolanslutningar så att deras error-händelse inte avslutar Node.
// pg tar bort den trasiga anslutningen och ett senare anrop kan skapa en ny.
for (const connectionPool of [pool, authPool]) {
  connectionPool.on('error', (error) =>
    console.error('Database connection interrupted:', error.message),
  );
}
// Kör ett arbete i en transaktion med användarens identitet så att databasens RLS-policyer kan avgöra åtkomst.
export async function database<T>(
  userId: string | null,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Den sista parametern true gör identiteten lokal för transaktionen; den följer inte med nästa användare i poolen.
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId ?? '']);
    const result = await work(client);
    // Bekräftar alla ändringar först när hela arbetet har lyckats.
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // Ångrar transaktionen vid fel och låter API:ts felhantering skapa svaret.
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Lämnar alltid tillbaka anslutningen till poolen, även när ett fel uppstår.
    client.release();
  }
}
