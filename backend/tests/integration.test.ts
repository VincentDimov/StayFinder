import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { app } from '../src/app.js';
import { database, pool, authPool } from '../src/db.js';
import { env } from '../src/env.js';
import type { User, Property, Booking } from '@stayfinder/shared';
// Unika testadresser skiljer denna körnings testdata från andra körningar.
const prefix = `test-${randomUUID()}`;
const admin = new pg.Pool({ connectionString: env.adminDatabaseUrl });
const users: string[] = [];
const properties: string[] = [];
// Städar körningens testdata efter testerna. Administratören kan tillfälligt stänga av skyddet för historiska testbokningar.
after(async () => {
  const client = await admin.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE public.bookings DISABLE TRIGGER guard_booking');
    if (properties.length) {
      await client.query('DELETE FROM public.bookings WHERE property_id=ANY($1::uuid[])', [
        properties,
      ]);
      await client.query('DELETE FROM public.properties WHERE id=ANY($1::uuid[])', [properties]);
    }
    if (users.length)
      await client.query('DELETE FROM private.users WHERE id=ANY($1::uuid[])', [users]);
    await client.query('ALTER TABLE public.bookings ENABLE TRIGGER guard_booking');
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await Promise.all([admin.end(), pool.end(), authPool.end()]);
  }
});
type Reply<T> = { response: Response; data: T };
// Anropar Hono direkt med JSON och valfri sessionscookie utan att starta en HTTP-server.
async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = '',
): Promise<Reply<T>> {
  const response = await app.request(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? undefined : await response.json();
  return { response, data: data as T };
}
// Skapar ett testkonto och sparar dess session och ID för senare anrop och städning.
async function account(name: string) {
  const email = `${prefix}-${name}@example.test`;
  const result = await request<User>('/auth/register', 'POST', {
    email,
    name,
    password: 'Testpassword2026!',
  });
  assert.equal(result.response.status, 201);
  users.push(result.data.id);
  return {
    user: result.data,
    cookie: result.response.headers.get('set-cookie')!.split(';')[0],
    email,
  };
}
const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
// Kör kravens API- och databasscenarier med separata värd-, gäst- och utomstående konton.
test('StayFinder: API and real PostgreSQL enforce G and VG rules', async (t) => {
  const host = await account('Host');
  const guest = await account('Guest');
  const stranger = await account('Other');
  const propertyData = {
    title: 'Test house',
    description: 'A sufficiently long test description.',
    location: prefix,
    price_per_night: 1000,
    max_guests: 4,
  };
  const created = await request<Property>('/properties', 'POST', propertyData, host.cookie);
  assert.equal(created.response.status, 201);
  const p = created.data;
  properties.push(p.id);
  const valid = { email: guest.email, guests: 2, check_in: day(30), check_out: day(33) };
  let booking: Booking;
  // Kontrollerar registrering, bestående session, inloggning, utloggning och sessionscookiens egenskaper.
  await t.test('G1–3: register, persisted session, login and logout', async () => {
    const me = await request<{ user: User }>('/auth/me', 'GET', undefined, guest.cookie);
    assert.equal(me.data.user.id, guest.user.id);
    assert.match(created.response.headers.get('cache-control') ?? '', /no-store/);
    const invalid = await request('/auth/login', 'POST', {
      email: guest.email,
      password: 'Wrongpassword!',
    });
    assert.equal(invalid.response.status, 401);
    const logged = await request<User>('/auth/login', 'POST', {
      email: guest.email,
      password: 'Testpassword2026!',
    });
    assert.equal(logged.response.status, 200);
    assert.match(logged.response.headers.get('set-cookie')!, /HttpOnly/);
    const cookie = logged.response.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await request('/auth/logout', 'POST', undefined, cookie)).response.status, 204);
    assert.equal(
      (await request<{ user: User | null }>('/auth/me', 'GET', undefined, cookie)).data.user,
      null,
    );
  });
  // Kontrollerar offentlig läsning, filter, sortering och att andra användare inte får ändra värdens boende.
  await t.test(
    'G4–8: public properties, filters, server sort and authenticated writes',
    async () => {
      assert.equal((await request(`/properties/${p.id}`)).response.status, 200);
      assert.equal((await request('/properties', 'POST', propertyData)).response.status, 401);
      // Oinloggade skrivningar nekas av API:t för alla boendeoperationer.
      for (const method of ['PUT', 'DELETE']) {
        assert.equal(
          (
            await request(
              `/properties/${p.id}`,
              method,
              method === 'PUT' ? propertyData : undefined,
            )
          ).response.status,
          401,
        );
      }
      // Utan användaridentitet kan inte heller direkt SQL ändra eller ta bort raden.
      for (const sql of [
        'UPDATE public.properties SET price_per_night=1 WHERE id=$1',
        'DELETE FROM public.properties WHERE id=$1',
      ]) {
        await database(null, async (db) => {
          assert.equal((await db.query(sql, [p.id])).rowCount, 0);
        });
      }
      const searched = await request<Property[]>(
        `/properties?location=${prefix}&max_price=1000&guests=4&sort=price_desc`,
      );
      assert.equal(searched.data.length, 1);
      assert.equal(
        (await request<Property[]>(`/properties?location=${prefix}&max_price=999`)).data.length,
        0,
      );
      const second = await request<Property>(
        '/properties',
        'POST',
        { ...propertyData, title: 'Second house', price_per_night: 1500 },
        host.cookie,
      );
      properties.push(second.data.id);
      const sorted = await request<Property[]>(`/properties?location=${prefix}&sort=price_desc`);
      assert.deepEqual(
        sorted.data.map((v) => v.price_per_night),
        [1500, 1000],
      );
      const ascending = await request<Property[]>(`/properties?location=${prefix}&sort=price_asc`);
      assert.deepEqual(
        ascending.data.map((v) => v.price_per_night),
        [1000, 1500],
      );
      assert.equal(
        (await request<Property[]>(`/properties?location=${prefix}&guests=5`)).data.length,
        0,
      );
      assert.equal(
        (await request(`/properties/${p.id}`, 'DELETE', undefined, stranger.cookie)).response
          .status,
        404,
      );
      assert.equal((await request('/properties?guests=invalid')).response.status, 400);
      assert.equal(
        (await request(`/properties/${p.id}`, 'PUT', propertyData, stranger.cookie)).response
          .status,
        404,
      );
    },
  );
  // Kontrollerar bokningsvalidering och att klienten inte kan bestämma gästidentitet, pris eller startstatus.
  await t.test(
    'G9–11, G14: invalid bookings and status codes; server total ignores client input',
    async () => {
      assert.equal(
        (await request(`/properties/${p.id}/bookings`, 'POST', valid)).response.status,
        401,
      );
      for (const patch of [
        { email: 'bad' },
        { guests: 0 },
        { check_in: valid.check_out },
        { check_in: '2026-02-30' },
        { check_in: day(-1) },
        { guests: 5 },
      ])
        assert.equal(
          (
            await request(
              `/properties/${p.id}/bookings`,
              'POST',
              { ...valid, ...patch },
              guest.cookie,
            )
          ).response.status,
          400,
        );
      assert.equal(
        (await request(`/properties/${randomUUID()}/bookings`, 'POST', valid, guest.cookie))
          .response.status,
        404,
      );
      const result = await request<Booking>(
        `/properties/${p.id}/bookings`,
        'POST',
        { ...valid, total_price: 1, user_id: host.user.id, status: 'confirmed' },
        guest.cookie,
      );
      assert.equal(result.response.status, 201);
      booking = result.data;
      assert.equal(booking.total_price, 3000);
      assert.equal(booking.status, 'pending');
      assert.equal(booking.user_id, guest.user.id);
    },
  );
  // Testar isolering mellan användare både genom API:t och direkt SQL med de begränsade databasrollerna.
  await t.test(
    'VG1, G15: ownership enforced in API and direct SQL; no guest data leakage',
    async () => {
      assert.equal(
        (await request<Booking[]>('/bookings', 'GET', undefined, stranger.cookie)).data.length,
        0,
      );
      assert.equal(
        (await request<Booking[]>('/bookings', 'GET', undefined, host.cookie)).data.length,
        1,
      );
      assert.equal(
        (await request(`/bookings/${booking.id}`, 'PUT', valid, stranger.cookie)).response.status,
        404,
      );
      await database(stranger.user.id, async (db) => {
        assert.equal((await db.query('SELECT * FROM public.bookings')).rows.length, 0);
        assert.equal(
          (
            await db.query('UPDATE public.properties SET title=$2 WHERE id=$1 RETURNING *', [
              p.id,
              'Unauthorized',
            ])
          ).rowCount,
          0,
        );
      });
      await assert.rejects(
        database(null, (db) =>
          db.query(
            'INSERT INTO public.properties(owner_id,title,description,location,price_per_night,max_guests) VALUES($1,$2,$3,$4,$5,$6)',
            [host.user.id, 'Anonymous', 'A long description', 'City', 500, 2],
          ),
        ),
        (e: unknown) => (e as { code: string }).code === '42501',
      );
      await assert.rejects(
        database(guest.user.id, (db) =>
          db.query('UPDATE public.bookings SET user_id=$2 WHERE id=$1', [
            booking.id,
            stranger.user.id,
          ]),
        ),
      );
      await assert.rejects(
        database(stranger.user.id, (db) =>
          db.query(
            'INSERT INTO public.bookings(property_id,user_id,email,guests,check_in,check_out,total_price) VALUES($1,$2,$3,1,$4,$5,0)',
            [p.id, guest.user.id, guest.email, day(50), day(51)],
          ),
        ),
      );
      await assert.rejects(
        database(guest.user.id, (db) => db.query('SELECT * FROM private.users')),
      );
      const roles = await admin.query(
        "SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('stayfinder_api','stayfinder_auth')",
      );
      assert(roles.rows.every((r) => !r.rolsuper && !r.rolbypassrls));
    },
  );
  // Testar överlappning, angränsande vistelser och samtidiga försök så att samma datum inte dubbelbokas.
  await t.test(
    'VG2: overlap blocked on create/update, adjacent dates allowed, own reservation ignored',
    async () => {
      assert.equal(
        (
          await request(
            `/properties/${p.id}/bookings`,
            'POST',
            { ...valid, check_in: day(31), check_out: day(34) },
            stranger.cookie,
          )
        ).response.status,
        409,
      );
      assert.equal(
        (await request(`/bookings/${booking.id}`, 'PUT', valid, guest.cookie)).response.status,
        200,
      );
      const adjacent = await request<Booking>(
        `/properties/${p.id}/bookings`,
        'POST',
        { ...valid, check_in: day(33), check_out: day(35) },
        stranger.cookie,
      );
      assert.equal(adjacent.response.status, 201);
      assert.equal(
        (
          await request(
            `/bookings/${adjacent.data.id}`,
            'PUT',
            { ...valid, check_in: day(32), check_out: day(35) },
            stranger.cookie,
          )
        ).response.status,
        409,
      );
      await assert.rejects(
        database(stranger.user.id, (db) =>
          db.query(
            'INSERT INTO public.bookings(property_id,user_id,email,guests,check_in,check_out,total_price) VALUES($1,$2,$3,1,$4,$5,1)',
            [p.id, stranger.user.id, stranger.email, day(31), day(34)],
          ),
        ),
        (e: unknown) => (e as { code: string }).code === '23P01',
      );
      const concurrent = await Promise.all(
        [guest, stranger].map((a) =>
          request<Booking>(
            `/properties/${p.id}/bookings`,
            'POST',
            { ...valid, email: a.email, check_in: day(70), check_out: day(72) },
            a.cookie,
          ),
        ),
      );
      assert.deepEqual(concurrent.map((v) => v.response.status).sort(), [201, 409]);
    },
  );
  // Testar gästantal och att boendets kapacitet inte kan minskas under en aktiv boknings behov.
  await t.test('VG3: database capacity rule and safe property capacity reductions', async () => {
    await assert.rejects(
      database(guest.user.id, (db) =>
        db.query('UPDATE public.bookings SET guests=5 WHERE id=$1', [booking.id]),
      ),
    );
    assert.equal(
      (await request(`/properties/${p.id}`, 'PUT', { ...propertyData, max_guests: 1 }, host.cookie))
        .response.status,
      400,
    );
  });
  // Testar att servern bestämmer priset och att en befintlig bokning behåller sitt ursprungliga nattpris.
  await t.test(
    'VG6: price remains unchanged after property edits; direct price tampering ignored',
    async () => {
      assert.equal(
        (
          await request(
            `/properties/${p.id}`,
            'PUT',
            { ...propertyData, price_per_night: 2000 },
            host.cookie,
          )
        ).response.status,
        200,
      );
      const current = await database(
        guest.user.id,
        async (db) =>
          (
            await db.query<Booking>(
              'UPDATE public.bookings SET total_price=1 WHERE id=$1 RETURNING *',
              [booking.id],
            )
          ).rows[0],
      );
      assert.equal(current.total_price, 3000);
      const changed = await request<Booking>(
        `/bookings/${booking.id}`,
        'PUT',
        { ...valid, check_out: day(32) },
        guest.cookie,
      );
      assert.equal(changed.data.total_price, 2000);
      await request(`/bookings/${booking.id}`, 'PUT', valid, guest.cookie);
    },
  );
  // Testar ledighetssökning över även dolda bokningar, kombinerade filter och felaktiga sökperioder.
  await t.test(
    'VG7: available-date search sees hidden reservations and combines filters',
    async () => {
      const unavailable = await request<Property[]>(
        `/properties?location=${prefix}&check_in=${day(31)}&check_out=${day(32)}&guests=2&max_price=2500&sort=price_desc`,
      );
      assert(!unavailable.data.some((v) => v.id === p.id));
      assert.equal(unavailable.data.length, 1);
      const available = await request<Property[]>(
        `/properties?location=${prefix}&check_in=${day(35)}&check_out=${day(36)}`,
      );
      assert(available.data.some((v) => v.id === p.id));
      assert.equal((await request(`/properties?check_in=${day(30)}`)).response.status, 400);
      assert.equal(
        (await request(`/properties?check_in=${day(31)}&check_out=${day(30)}`)).response.status,
        400,
      );
      await assert.rejects(
        database(null, (db) =>
          db.query('SELECT private.is_available($1,$2,$3)', [p.id, day(30), day(30)]),
        ),
      );
    },
  );
  // Testar att bara värden bekräftar och att avbokade bokningar inte kan ändras eller återaktiveras.
  await t.test(
    'VG4: only host confirms, both parties cancel, terminal status immutable',
    async () => {
      assert.equal(
        (
          await request(
            `/bookings/${booking.id}/status`,
            'PATCH',
            { status: 'confirmed' },
            guest.cookie,
          )
        ).response.status,
        403,
      );
      await assert.rejects(
        database(guest.user.id, (db) =>
          db.query("UPDATE public.bookings SET status='confirmed' WHERE id=$1", [booking.id]),
        ),
      );
      assert.equal(
        (
          await request(
            `/bookings/${booking.id}/status`,
            'PATCH',
            { status: 'confirmed' },
            host.cookie,
          )
        ).response.status,
        200,
      );
      assert.equal(
        (
          await request(
            `/bookings/${booking.id}/status`,
            'PATCH',
            { status: 'pending' },
            host.cookie,
          )
        ).response.status,
        400,
      );
      assert.equal(
        (
          await request(
            `/bookings/${booking.id}/status`,
            'PATCH',
            { status: 'cancelled' },
            guest.cookie,
          )
        ).response.status,
        200,
      );
      assert.equal(
        (await request(`/bookings/${booking.id}`, 'PUT', valid, guest.cookie)).response.status,
        400,
      );
      await assert.rejects(
        database(guest.user.id, (db) =>
          db.query("UPDATE public.bookings SET status='pending' WHERE id=$1", [booking.id]),
        ),
      );
      const replacement = await request<Booking>(
        `/properties/${p.id}/bookings`,
        'POST',
        valid,
        stranger.cookie,
      );
      assert.equal(replacement.response.status, 201);
      assert.equal(
        (
          await request(
            `/bookings/${replacement.data.id}/status`,
            'PATCH',
            { status: 'cancelled' },
            host.cookie,
          )
        ).response.status,
        200,
      );
    },
  );
  // Skapar en passerad incheckning som testfixture och kontrollerar att API och SQL blockerar ändring och borttagning.
  await t.test(
    'VG5: past check-in and already-started modifications/cancellation/deletion denied',
    async () => {
      const historical = await request<Booking>(
        `/properties/${p.id}/bookings`,
        'POST',
        { ...valid, check_in: day(90), check_out: day(92) },
        guest.cookie,
      );
      assert.equal(historical.response.status, 201);
      // Simulate passage of time only as database administrator, never through application roles.
      const client = await admin.connect();
      try {
        await client.query('BEGIN');
        await client.query('ALTER TABLE public.bookings DISABLE TRIGGER guard_booking');
        await client.query('UPDATE public.bookings SET check_in=$2,check_out=$3 WHERE id=$1', [
          historical.data.id,
          day(-2),
          day(2),
        ]);
        await client.query('ALTER TABLE public.bookings ENABLE TRIGGER guard_booking');
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      assert.equal(
        (await request(`/bookings/${historical.data.id}`, 'PUT', valid, guest.cookie)).response
          .status,
        400,
      );
      assert.equal(
        (
          await request(
            `/bookings/${historical.data.id}/status`,
            'PATCH',
            { status: 'cancelled' },
            host.cookie,
          )
        ).response.status,
        400,
      );
      assert.equal(
        (await request(`/bookings/${historical.data.id}`, 'DELETE', undefined, guest.cookie))
          .response.status,
        400,
      );
      await assert.rejects(
        database(guest.user.id, (db) =>
          db.query('DELETE FROM public.bookings WHERE id=$1', [historical.data.id]),
        ),
      );
    },
  );
  // Testar borttagning, saknade resurser, ogiltig JSON och nekade anrop från ett annat ursprung.
  await t.test(
    'G12/G14: booking delete, not found, malformed JSON and CSRF origin denial',
    async () => {
      assert.equal(
        (await request(`/bookings/${booking.id}`, 'DELETE', undefined, guest.cookie)).response
          .status,
        204,
      );
      assert.equal(
        (await request(`/bookings/${booking.id}`, 'DELETE', undefined, guest.cookie)).response
          .status,
        404,
      );
      assert.equal((await request(`/properties/${randomUUID()}`)).response.status, 404);
      assert.equal(
        (
          await app.request('/properties', {
            method: 'POST',
            headers: { Cookie: host.cookie, 'Content-Type': 'application/json' },
            body: '{',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await app.request('/auth/logout', {
            method: 'POST',
            headers: { Cookie: host.cookie, Origin: 'https://untrusted.example' },
          })
        ).status,
        403,
      );
    },
  );
});
