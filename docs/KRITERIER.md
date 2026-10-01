# Kriterier och kodreferenser

Implementationen omfattar samtliga G-krav och samtliga sju VG-val. Funktionella tester ersätter inte elevens muntliga förklaring eller lärarens bedömning.

| Krav | Lösning                                                                              | Var finns koden?                                                      |
| ---- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| G1   | Registrering, inloggning och utloggning                                              | `backend/src/auth.ts`, `app.ts`, `AuthForm.tsx`, `Nav.tsx`            |
| G2   | Sju dagars databassession, HttpOnly-cookie och aktuell användare                     | `/auth/me`, `layout.tsx`, `AuthProvider.tsx`                          |
| G3   | Navigeringen växlar mellan besökare och inloggad användare                           | `Nav.tsx`                                                             |
| G4   | Publik boendelista och egen detaljsida                                               | `app.ts`, `app/properties/page.tsx`, `app/properties/[id]/page.tsx`   |
| G5   | Kombinerbara filter på plats, högsta nattpris och antal gäster                       | `filters` i `validation.ts`, `GET /properties`                        |
| G6   | Inloggning i API:t och RLS för samtliga skrivoperationer                             | `requireUser`, policies i `001_schema.sql`                            |
| G7   | Typat frontendformulär skapar boende                                                 | `PropertyForm.tsx`, `app/properties/new/page.tsx`                     |
| G8   | SQL sorterar pris stigande/fallande                                                  | `GET /properties`, tillåtna sorteringsvärden                          |
| G9   | Bokning på detaljsidan; besökare får inloggningslänk                                 | `BookingForm.tsx`                                                     |
| G10  | Zod, databasregler och synliga formulärfel                                           | `validation.ts`, `guard_booking`, `errorMessage`, `BookingForm.tsx`   |
| G11  | Antal nätter och pris visas före bokningen                                           | `shared/index.ts`, `BookingForm.tsx`                                  |
| G12  | Lista, ändra och ta bort bokningar även per boende                                   | `GET /bookings?property_id=...`, `BookingList.tsx`, PUT/DELETE-routes |
| G13  | Laddningsvy, felvy, tomt resultat och egen 404                                       | `loading.tsx`, `error.tsx`, `not-found.tsx`, `BookingList.tsx`        |
| G14  | 200, 201, 204, 400, 401, 403, 404 och 409                                            | `app.ts` och API-testerna                                             |
| G15  | RLS, separata begränsade roller, triggers och constraints                            | `backend/sql/001_schema.sql`                                          |
| G16  | Strict TypeScript, gemensamma modeller och runtime-validering                        | `shared/index.ts`, tsconfig-filer, `validation.ts`                    |
| VG1  | Oföränderligt ägarskap; gäst ser egna bokningar, värd ser sina boendens bokningar    | RLS och identitetskontroller i databastriggers                        |
| VG2  | Överlappning nekas, även vid ändring och samtidiga anrop; angränsande datum fungerar | `no_double_booking` GiST exclusion constraint                         |
| VG3  | Kapacitet hämtas och låses i databasen; sänkning av kapacitet kontrolleras           | `guard_booking`, `guard_property`                                     |
| VG4  | Värden bekräftar, båda kan avboka, terminal status låses                             | PATCH status-route och `guard_booking`                                |
| VG5  | Förfluten incheckning samt ändring/avbokning av påbörjad bokning nekas               | `guard_booking`, `CURRENT_DATE`                                       |
| VG6  | Serverberäknat pris, sparat pris och skydd mot klientens pris                        | `guard_booking`; indata i API:t ignorerar `total_price`               |
| VG7  | Tillgänglighet för ett datumintervall kombineras med filter och sortering            | `private.is_available`, `GET /properties`, `filters`                  |

Testerna finns i `backend/tests/integration.test.ts`. Alla VG-val provas med nekade anrop; relevanta databasregler provas också genom direkta SQL-anrop med applikationsrollen. Se `TESTPROTOKOLL.md` för körresultat och browserkontroller.
