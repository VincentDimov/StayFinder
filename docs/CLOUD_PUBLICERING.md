# StayFinder – molnpublicering

Verifierat 2026-10-02.

- Webb: https://stayfinder-tau-sepia.vercel.app
- GitHub: https://github.com/VincentDimov/StayFinder (privat).
- Vercel: projekt `stayfinder`, konto/team `jobapplication`, rotmapp `frontend`.
- Supabase: projekt `stayfinder`, ref `xcniskfsojxkebdjbzkw`, organisation Ventsislav Dimov, region Stockholm (`eu-north-1`).
- Serverfunktionerna körs i Vercels Stockholm-region (`arn1`). GitHub-pushar till `main` startar produktionsbyggen.

## Databas och autentisering

Databasen har `public.properties`, `public.bookings`, `private.users` och `private.sessions`. RLS är aktiverat på samtliga tabeller och tvingat på boenden och bokningar. Serverrollerna `stayfinder_api` och `stayfinder_auth` saknar SUPERUSER och BYPASSRLS. Ingen administratörsnyckel används av webbappen.

Appen använder Supabase PostgreSQL via transaktionspoolern på port 6543. Användaridentiteten sätts transaktionslokalt, så att den inte följer med när en anslutning återanvänds. TLS verifierar CA och värdnamn; SSL krävs på databasen. Supabases officiella rotcertifikat är installerat som servervariabel på Vercel.

Inloggning och sessioner hanteras av Hono-servern och lagras i det privata schemat. Supabase Auth används inte. Webbläsaren får en Secure/HttpOnly-cookie och anropar samma domän under `/api`. Serversidor anropar Hono direkt.

Skyddade servervariabler: `DATABASE_URL`, `AUTH_DATABASE_URL`, `DATABASE_CA`. `FRONTEND_URL` anger produktionsdomänen; `NEXT_PUBLIC_API_URL=/api` är offentlig och innehåller inga hemligheter. Lokala molnuppgifter finns i `.cloud-secrets/` och följer inte med Git eller publiceringen. Molnvärdens unika inloggning finns i `.cloud-secrets/demo-host.json`; det dokumenterade lokala demolösenordet fungerar bara lokalt.

## Verifiering

- TypeScript-kontroller och Next.js produktionsbygge: godkända.
- Lokal integrationssvit: 12 godkända tester.
- 24 API-anrop mot Supabase direkt och via den publicerade Vercel-adressen: godkända. Registrering, session, login/logout, boenden, bokningar, pris, ägarskap, kapacitet, dubbelbokning, datumfiltrering, statusändringar och nekad CSRF-Origin kontrollerades.
- Direkt SQL med en annan gästs identitet visade inga av den testade gästens bokningar.
- Webbläsare: startsida med Supabase-boenden, login, boendedetalj, bokningsformulär, bokning för tre nätter/3750 kr, omladdning med sparad session och avbokning: godkända.
- Inga JavaScript-fel i testwebbläsaren och inga felmeddelanden i Vercels kontrollerade produktionslogg.
- Supabases säkerhetskontroll: inga anmärkningar. Det saknade indexet för sessionsanvändare lades till. Oanvända index behålls för framtida prisfilter och sessionsstädning; [förklaring av indexkontrollen](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
- Testbokningar, testboenden och testkonton städades bort. Kvar: sex exempelboenden och inga testbokningar.

## Reproducerbar installation

Schema finns i `supabase/migrations/`. Lösenord till serverroller måste provisioneras separat och får aldrig lagras i migrationer. `backend/sql/001_schema.sql`, Compose och `.env.example` är för lokal utveckling och har lokala utvecklingslösenord. Kör inte den lokala setupen oförändrad mot molnet.
