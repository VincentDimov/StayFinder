import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authPool } from './db.ts';
import { env } from './env.ts';
import type { User } from '@stayfinder/shared';
// Hono-kontexten innehåller den verifierade användaren, eller null för en anonym besökare.
export type AppEnv = { Variables: { user: User | null } };
// Lagrar sessionsnyckelns SHA-256-hash i databasen; själva nyckeln finns i cookien.
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
// Skapar ett slumpmässigt salt och en scrypt-hash så att lösenord aldrig sparas i klartext.
export function passwordHash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
// Återskapar lösenordshashen med sparat salt och jämför lika långa hashvärden med timingSafeEqual.
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
// Slår upp sessionscookiens hash och returnerar användaren bara om sessionen inte har löpt ut.
export async function sessionUser(c: Context): Promise<User | null> {
  const token = getCookie(c, 'stayfinder_session');
  if (!token) return null;
  const { rows } = await authPool.query<User>(
    'SELECT u.id,u.email,u.name FROM private.sessions s JOIN private.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [hashToken(token)],
  );
  return rows[0] ?? null;
}
// Skapar en slumpmässig session som gäller i sju dagar och sparar dess hash med användarens ID.
export async function createSession(c: Context, id: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  await authPool.query(
    "INSERT INTO private.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [hashToken(token), id],
  );
  // HttpOnly hindrar JavaScript från att läsa cookien; Secure kräver HTTPS i produktion och SameSite begränsar korsanrop.
  setCookie(c, 'stayfinder_session', token, {
    httpOnly: true,
    secure: env.production,
    sameSite: 'Lax',
    path: '/',
    maxAge: 604800,
  });
}
// Återkallar sessionen i databasen och tar sedan bort motsvarande cookie i webbläsaren.
export async function removeSession(c: Context): Promise<void> {
  const token = getCookie(c, 'stayfinder_session');
  if (token)
    await authPool.query('DELETE FROM private.sessions WHERE token_hash=$1', [hashToken(token)]);
  deleteCookie(c, 'stayfinder_session', { path: '/', secure: env.production, sameSite: 'Lax' });
}
// Stoppar skyddade anrop med 401 när middleware inte har hittat en giltig session.
export function requireUser(c: Context<AppEnv>): User {
  const user = c.get('user');
  if (!user) throw new HTTPException(401, { message: 'Du måste logga in.' });
  return user;
}
