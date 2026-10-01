import pg, { type PoolClient } from 'pg';
import { env } from './env.js';
// pg returns bigint as strings by default. Prices are bounded to safe JS integers.
pg.types.setTypeParser(20, (value: string) => Number(value));
pg.types.setTypeParser(1082, (value: string) => value);
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5000,
});
export const authPool = new pg.Pool({
  connectionString: env.authDatabaseUrl,
  max: 5,
  connectionTimeoutMillis: 5000,
});
// pg removes a disconnected idle client. Listening prevents its error event from
// terminating Node; the next request obtains a new connection after recovery.
for (const connectionPool of [pool, authPool]) {
  connectionPool.on('error', (error) =>
    console.error('Database connection interrupted:', error.message),
  );
}
export async function database<T>(
  userId: string | null,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId ?? '']);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
