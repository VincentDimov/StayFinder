import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { ZodError, type ZodType } from 'zod';
import { env } from './env.js';
import { database, authPool } from './db.js';
import {
  createSession,
  passwordHash,
  removeSession,
  requireUser,
  sessionUser,
  verifyPassword,
  type AppEnv,
} from './auth.js';
import {
  registration,
  credentials,
  propertyInput,
  bookingInput,
  statusInput,
  filters,
  uuid,
} from './validation.js';
import type { Context } from 'hono';
import type { Booking, Property, User } from '@stayfinder/shared';

async function input<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'Begäran måste innehålla giltig JSON.' });
  }
  return schema.parse(data);
}
export const app = new Hono<AppEnv>({ strict: false });
app.use(
  '*',
  cors({
    origin: env.frontendUrl,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);
app.use('*', bodyLimit({ maxSize: 32 * 1024 }));
app.use('*', async (c, next) => {
  // SameSite cookies plus Origin validation protects cookie-authenticated mutations.
  const origin = c.req.header('Origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && origin && origin !== env.frontendUrl)
    throw new HTTPException(403, { message: 'Anropets ursprung är inte tillåtet.' });
  c.header('Cache-Control', 'no-store');
  c.set('user', await sessionUser(c));
  await next();
});
app.get('/', (c) => c.json({ name: 'StayFinder API' }));
app.get('/health', async (c) => {
  await authPool.query('SELECT 1');
  return c.json({ status: 'ok' });
});

// Bounded login attempts per email; reset after fifteen minutes or successful login.
const attempts = new Map<string, { count: number; reset: number }>();
app.post('/auth/register', async (c) => {
  const data = await input(c, registration);
  const { rows } = await authPool.query<User>(
    'INSERT INTO private.users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id,email,name',
    [data.email, data.name, passwordHash(data.password)],
  );
  await createSession(c, rows[0].id);
  return c.json(rows[0], 201);
});
app.post('/auth/login', async (c) => {
  const data = await input(c, credentials);
  const previous = attempts.get(data.email);
  if (previous && previous.reset > Date.now() && previous.count >= 10)
    throw new HTTPException(429, { message: 'För många försök. Försök igen om 15 minuter.' });
  if (attempts.size > 10000) attempts.clear();
  attempts.set(data.email, {
    count: previous && previous.reset > Date.now() ? previous.count + 1 : 1,
    reset: previous && previous.reset > Date.now() ? previous.reset : Date.now() + 900000,
  });
  const { rows } = await authPool.query<User & { password_hash: string }>(
    'SELECT id,email,name,password_hash FROM private.users WHERE email=$1',
    [data.email],
  );
  if (!rows[0] || !verifyPassword(data.password, rows[0].password_hash))
    throw new HTTPException(401, { message: 'Fel e-postadress eller lösenord.' });
  attempts.delete(data.email);
  const { id, email, name } = rows[0];
  await createSession(c, id);
  return c.json({ id, email, name });
});
app.get('/auth/me', (c) => c.json({ user: c.get('user') }));
app.post('/auth/logout', async (c) => {
  await removeSession(c);
  return c.body(null, 204);
});

app.get('/properties', async (c) => {
  const f = filters.parse(c.req.query());
  const rows = await database(c.get('user')?.id ?? null, async (db) => {
    const values: unknown[] = [];
    const clauses: string[] = [];
    const parameter = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };
    if (f.location)
      clauses.push(
        `location ILIKE ${parameter('%' + f.location.replace(/[\\%_]/g, '\\$&') + '%')}`,
      );
    if (f.max_price) clauses.push(`price_per_night <= ${parameter(f.max_price)}`);
    if (f.guests) clauses.push(`max_guests >= ${parameter(f.guests)}`);
    if (f.check_in && f.check_out)
      clauses.push(
        `private.is_available(id, ${parameter(f.check_in)}::date, ${parameter(f.check_out)}::date)`,
      );
    return (
      await db.query<Property>(
        `SELECT * FROM public.properties ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY price_per_night ${f.sort === 'price_desc' ? 'DESC' : 'ASC'}, id`,
        values,
      )
    ).rows;
  });
  return c.json(rows);
});
app.get('/properties/:id', async (c) => {
  const id = uuid.parse(c.req.param('id'));
  const row = await database(
    null,
    async (db) =>
      (await db.query<Property>('SELECT * FROM public.properties WHERE id=$1', [id])).rows[0],
  );
  if (!row) throw new HTTPException(404, { message: 'Boendet finns inte.' });
  return c.json(row);
});
app.post('/properties', async (c) => {
  const user = requireUser(c);
  const d = await input(c, propertyInput);
  const row = await database(
    user.id,
    async (db) =>
      (
        await db.query<Property>(
          'INSERT INTO public.properties(owner_id,title,description,location,price_per_night,max_guests) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
          [user.id, d.title, d.description, d.location, d.price_per_night, d.max_guests],
        )
      ).rows[0],
  );
  return c.json(row, 201);
});
app.put('/properties/:id', async (c) => {
  const user = requireUser(c);
  const id = uuid.parse(c.req.param('id'));
  const d = await input(c, propertyInput);
  const row = await database(
    user.id,
    async (db) =>
      (
        await db.query<Property>(
          'UPDATE public.properties SET title=$2,description=$3,location=$4,price_per_night=$5,max_guests=$6 WHERE id=$1 RETURNING *',
          [id, d.title, d.description, d.location, d.price_per_night, d.max_guests],
        )
      ).rows[0],
  );
  if (!row) throw new HTTPException(404, { message: 'Boendet saknas eller tillhör någon annan.' });
  return c.json(row);
});
app.delete('/properties/:id', async (c) => {
  const user = requireUser(c);
  const id = uuid.parse(c.req.param('id'));
  const row = await database(
    user.id,
    async (db) =>
      (await db.query('DELETE FROM public.properties WHERE id=$1 RETURNING id', [id])).rows[0],
  );
  if (!row) throw new HTTPException(404, { message: 'Boendet saknas eller tillhör någon annan.' });
  return c.body(null, 204);
});
app.get('/bookings', async (c) => {
  const user = requireUser(c);
  const propertyId = c.req.query('property_id');
  if (propertyId) uuid.parse(propertyId);
  const rows = await database(
    user.id,
    async (db) =>
      (
        await db.query<Booking>(
          `SELECT b.*,p.title AS property_title,p.owner_id FROM public.bookings b JOIN public.properties p ON p.id=b.property_id ${propertyId ? 'WHERE b.property_id=$1' : ''} ORDER BY b.check_in,b.id`,
          propertyId ? [propertyId] : [],
        )
      ).rows,
  );
  return c.json(rows);
});
app.post('/properties/:id/bookings', async (c) => {
  const user = requireUser(c);
  const id = uuid.parse(c.req.param('id'));
  const d = await input(c, bookingInput);
  const row = await database(user.id, async (db) => {
    if (!(await db.query('SELECT id FROM public.properties WHERE id=$1', [id])).rows[0])
      throw new HTTPException(404, { message: 'Boendet finns inte.' });
    return (
      await db.query<Booking>(
        'INSERT INTO public.bookings(property_id,user_id,email,guests,check_in,check_out,total_price) VALUES($1,$2,$3,$4,$5,$6,0) RETURNING *',
        [id, user.id, d.email, d.guests, d.check_in, d.check_out],
      )
    ).rows[0];
  });
  return c.json(row, 201);
});
app.put('/bookings/:id', async (c) => {
  const user = requireUser(c);
  const id = uuid.parse(c.req.param('id'));
  const d = await input(c, bookingInput);
  const row = await database(
    user.id,
    async (db) =>
      (
        await db.query<Booking>(
          'UPDATE public.bookings SET email=$2,guests=$3,check_in=$4,check_out=$5 WHERE id=$1 RETURNING *',
          [id, d.email, d.guests, d.check_in, d.check_out],
        )
      ).rows[0],
  );
  if (!row)
    throw new HTTPException(404, {
      message: 'Bokningen saknas eller är inte tillgänglig för dig.',
    });
  return c.json(row);
});
app.patch('/bookings/:id/status', async (c) => {
  const user = requireUser(c);
  const id = uuid.parse(c.req.param('id'));
  const d = await input(c, statusInput);
  const row = await database(
    user.id,
    async (db) =>
      (
        await db.query<Booking>('UPDATE public.bookings SET status=$2 WHERE id=$1 RETURNING *', [
          id,
          d.status,
        ])
      ).rows[0],
  );
  if (!row)
    throw new HTTPException(404, {
      message: 'Bokningen saknas eller är inte tillgänglig för dig.',
    });
  return c.json(row);
});
app.delete('/bookings/:id', async (c) => {
  const user = requireUser(c);
  const id = uuid.parse(c.req.param('id'));
  const row = await database(
    user.id,
    async (db) =>
      (await db.query('DELETE FROM public.bookings WHERE id=$1 RETURNING id', [id])).rows[0],
  );
  if (!row)
    throw new HTTPException(404, {
      message: 'Bokningen saknas eller är inte tillgänglig för dig.',
    });
  return c.body(null, 204);
});
app.notFound((c) => c.json({ error: 'Resursen finns inte.', code: 'NOT_FOUND' }, 404));
app.onError((error, c) => {
  if (error instanceof ZodError)
    return c.json(
      {
        error: 'Kontrollera formulärets uppgifter.',
        code: 'VALIDATION',
        fields: error.flatten().fieldErrors,
      },
      400,
    );
  if (error instanceof HTTPException)
    return c.json({ error: error.message, code: `HTTP_${error.status}` }, error.status);
  const dbError = error as Error & { code?: string };
  if (dbError.code === '23P01')
    return c.json(
      { error: 'Boendet är redan bokat under den valda perioden.', code: 'BOOKING_CONFLICT' },
      409,
    );
  if (dbError.code === '23505')
    return c.json({ error: 'E-postadressen används redan.', code: 'ALREADY_EXISTS' }, 409);
  if (dbError.code === '23503')
    return c.json(
      {
        error: 'Resursen saknas eller har bokningar som måste tas bort först.',
        code: 'REFERENCE_CONFLICT',
      },
      409,
    );
  if (dbError.code === '42501')
    return c.json({ error: 'Du saknar behörighet för denna ändring.', code: 'FORBIDDEN' }, 403);
  if (dbError.code === 'P0001')
    return c.json({ error: dbError.message, code: 'BOOKING_RULE' }, 400);
  if (dbError.code === '23514' || dbError.code === '22007')
    return c.json({ error: 'Ogiltiga uppgifter.', code: 'VALIDATION' }, 400);
  console.error('Unhandled API error:', error);
  return c.json({ error: 'Ett serverfel inträffade. Försök igen.', code: 'INTERNAL_ERROR' }, 500);
});
