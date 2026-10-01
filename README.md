# StayFinder

En bokningstjänst byggd utifrån **WEBB25 → Backend 2 – Typescript → Individuell Uppgift: StayFinder** i kursmaterialet `FullStackUtbildning/src/data/courseData.ts`, inklusive de sammanslagna G- och VG-kraven.

Projektet innehåller Hono-backend, Next.js-frontend och riktig PostgreSQL med RLS. Samtliga G1–G16 och VG1–VG7 är implementerade. Se [kriterielistan](docs/KRITERIER.md) för kodreferenser och [testprotokollet](docs/TESTPROTOKOLL.md) för vad som faktiskt har kontrollerats.

## Kom igång på Windows

Du behöver Node.js 20.9 eller senare, npm och en startad Docker Desktop med Linux-containers.

```powershell
cd "C:\Users\Vince\Desktop\Fullstack open source\Backend2\Individuell Uppgift\StayFinder"
npm ci
Copy-Item .env.example .env
npm run db:start
npm run db:setup
npm run dev
```

Öppna **http://localhost:3000**. API:t finns på **http://localhost:4000** och databasen på `localhost:54329`. Kommandot `db:setup` kan köras igen; det återskapar inte befintliga tabeller och duplicerar inte exempelboendena.

Demovärd: **vard@stayfinder.test**, lösenord **StayFinder2026!**. Registrera ett eget gästkonto för att testa att ägarskap och olika roller fungerar. Demovärden äger de sex exempelboendena. Boendebilderna är lokala illustrationer.

`Ctrl+C` stoppar webb och API. `docker compose stop` stoppar databasen och behåller innehållet. Använd samma värdnamn, `localhost`, i webbläsaren och miljövariablerna så att sessionscookien fungerar.

## Kontroller

```powershell
npm run typecheck
npm test
npm run build
npm audit
```

Testerna kräver en startad, initierad lokal databas. De använder tre tillfälliga konton och egna boenden; dessa tas bort efter körningen. De testar API-anrop och direkta SQL-anrop med applikationens begränsade databasroll, inklusive samtidiga bokningar. Kör dem mot en utvecklingsdatabas.

För att köra produktionsbygget lokalt: starta API:t med `npm run start -w backend` och webbappen med `npm run start -w frontend` i två terminaler efter `npm run build`.

## Struktur

```text
backend/src/       Hono, autentisering, validering och databasanrop
backend/sql/       Schema, RLS, databasregler och lokala testverktyg
backend/scripts/   Initiering och exempeldata
backend/tests/     Automatiska integrations- och behörighetstester
frontend/src/app/  Next.js-sidor, laddningsvy, felvy och 404
frontend/src/components/  Interaktiva och typade formulär
shared/            Gemensamma modeller och prisformatering
tests/api.http     Manuella HTTP-anrop, både lyckade och nekade
docs/              Kriterier, arkitektur, kodgenomgång och verifiering
```

## Viktiga val

- PostgreSQL används som det likvärdiga alternativ som uppgiften tillåter. Lokalt används Docker. För Supabase används samma PostgreSQL-schema med separata begränsade databasroller och egna lösenord.
- Ogenomskinliga sessioner lagras i databasen; webbläsaren får en `HttpOnly`-cookie. Lösenord lagras som saltade scrypt-hashar och sessionsnycklar som SHA-256-hashar.
- API:t använder två begränsade databasroller. Rollen för boenden och bokningar saknar `SUPERUSER` och `BYPASSRLS`. Administratörsanslutningen används enbart vid setup och teststädning.
- In- och utcheckning är kalenderdatum. PostgreSQL använder `Europe/Stockholm` för tidsregler. Utcheckningsdagen ingår inte i bokningen, så två gäster kan byta samma dag.
- Databasen räknar och sparar totalpriset vid bokning. Vid ändrade datum används den ursprungliga bokningens nattpris. Ändringar av boendets pris påverkar därför inte befintliga bokningar.
- Gäster ändrar sina egna bokningsuppgifter. Värden kan bekräfta eller avboka, men inte byta gästens datum eller e-post. Båda kan ta bort en bokning som ännu inte börjat. Avbokning behåller historiken; borttagning tar bort raden.
- Ett boende med bokningshistorik kan inte tas bort förrän bokningarna tagits bort, på grund av främmande nyckeln. Kapaciteten kan inte sänkas under antalet gäster i en aktiv bokning.

## Inlämning

Se [INLAMNING.md](docs/INLAMNING.md), [API-anrop](tests/api.http) och [guide för muntlig genomgång](docs/KODGENOMGANG.md). Backend och frontend finns i ett gemensamt repo med tydliga separata mappar. GitHub-repo: [VincentDimov/StayFinder](https://github.com/VincentDimov/StayFinder). Den muntliga genomgången genomförs av dig: läs guiden, demonstrera appen och se till att du kan förklara koden.

Lokala databaslösenord i Compose och `.env.example` är endast utvecklingsvärden. För extern drift ska egna databasroller/lösenord och HTTPS användas, och frontend/API bör ligga under samma webbplats för cookieflödet.

## Dokumentation som användes

- [Hono på Node.js](https://hono.dev/docs/getting-started/nodejs)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), samt den installerade versionens dokumentation under `node_modules/next/dist/docs`
- [PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL Range Types och exclusion constraints](https://www.postgresql.org/docs/current/rangetypes.html)

## Vercel och Supabase

På Vercel körs Hono-API:t som en Next.js-route under /api. Webbläsaren använder samma domän för sidor och API, och serversidorna anropar Hono direkt. Vercel-projektet heter stayfinder och använder frontend som rotmapp. Databasvariablerna DATABASE_URL och AUTH_DATABASE_URL krävs på Vercel. DATABASE_CA används för verifierad TLS. Inga databasuppgifter skickas till webbläsaren.

Supabase-projektets val och installation behöver slutföras innan produktionspubliceringen. Den lokala setupen innehåller utvecklingslösenord och ett demokonto och ska inte köras oförändrad mot molndatabasen.
