import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { env } from '../src/env.js';
import { passwordHash } from '../src/auth.js';
import { pool, authPool } from '../src/db.js';
const admin = new pg.Client({ connectionString: env.adminDatabaseUrl });
try {
  await admin.connect();
  await admin.query(await readFile(new URL('../sql/001_schema.sql', import.meta.url), 'utf8'));
  const { rows } = await admin.query<{ id: string }>(
    "INSERT INTO private.users(email,name,password_hash) VALUES('vard@stayfinder.test','Elin Värd',$1) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING id",
    [passwordHash('StayFinder2026!')],
  );
  const sample = [
    [
      'Skogsstugan vid sjön',
      'En stillsam stuga med egen brygga, kamin och skogen precis utanför dörren. Perfekt för långa helger och lugna morgnar.',
      'Dalarna',
      1250,
      4,
    ],
    [
      'Ett hem i gamla stan',
      'Ljus lägenhet med charmiga detaljer, fullt utrustat kök och gångavstånd till stadens kaféer och sevärdheter.',
      'Stockholm',
      1850,
      2,
    ],
    [
      'Havsnära på västkusten',
      'Ett rymligt hus bland klippor och salta vindar. Njut av kvällssolen från terrassen och promenader vid havet.',
      'Göteborg',
      2400,
      6,
    ],
    [
      'Fjällro med utsikt',
      'Mysig fjällstuga med bastu och panoramautsikt. Här finns plats för både stora äventyr och små pauser.',
      'Åre',
      1700,
      5,
    ],
    [
      'En helg på Österlen',
      'Bo på en liten gård omgiven av äppelodlingar och böljande landskap. Nära till stränder, gårdsbutiker och konst.',
      'Österlen',
      1100,
      3,
    ],
    [
      'Stadsliv i Malmö',
      'En välplanerad lägenhet med balkong och närhet till restauranger, parker och strandpromenaden.',
      'Malmö',
      950,
      2,
    ],
  ];
  for (const [title, description, location, price, guests] of sample) {
    await admin.query(
      'INSERT INTO public.properties(owner_id,title,description,location,price_per_night,max_guests) SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS(SELECT 1 FROM public.properties WHERE owner_id=$1 AND title=$2)',
      [rows[0].id, title, description, location, price, guests],
    );
  }
  console.log(
    'Databas, RLS och sex exempelboenden är klara. Demo: vard@stayfinder.test / StayFinder2026!',
  );
} finally {
  await admin.end();
  await pool.end();
  await authPool.end();
}
