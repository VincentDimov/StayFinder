import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authPool } from './db.js';
import { env } from './env.js';
import type { User } from '@stayfinder/shared';
export type AppEnv = { Variables: { user: User | null } };
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export function passwordHash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function sessionUser(c: Context): Promise<User | null> {
  const token = getCookie(c, 'stayfinder_session');
  if (!token) return null;
  const { rows } = await authPool.query<User>(
    'SELECT u.id,u.email,u.name FROM private.sessions s JOIN private.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [hashToken(token)],
  );
  return rows[0] ?? null;
}
export async function createSession(c: Context, id: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  await authPool.query(
    "INSERT INTO private.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [hashToken(token), id],
  );
  setCookie(c, 'stayfinder_session', token, {
    httpOnly: true,
    secure: env.production,
    sameSite: 'Lax',
    path: '/',
    maxAge: 604800,
  });
}
export async function removeSession(c: Context): Promise<void> {
  const token = getCookie(c, 'stayfinder_session');
  if (token)
    await authPool.query('DELETE FROM private.sessions WHERE token_hash=$1', [hashToken(token)]);
  deleteCookie(c, 'stayfinder_session', { path: '/', secure: env.production, sameSite: 'Lax' });
}
export function requireUser(c: Context<AppEnv>): User {
  const user = c.get('user');
  if (!user) throw new HTTPException(401, { message: 'Du måste logga in.' });
  return user;
}
