# Kravgranskning av StayFinder – 2026-10-02

**Jag kan inte intyga 100 % kravuppfyllelse i den deployade versionen.** Koden har stöd för alla G1–G16 och VG1–VG7. De testade API- och databasreglerna fungerar, men flera felmeddelanden i Supabase har felaktigt kodade svenska tecken. Interaktiva webbläsarflöden har inte kunnat kontrolleras på nytt.

Publicerad app: https://stayfinder-tau-sepia.vercel.app.
Supabase-projekt: xcniskfsojxkebdjbzkw.

Detta är en granskning av befintlig implementation. Ingen applikationskod, databasregel eller deployment har ändrats. Granskningens egna testkonton, boenden och bokningar har städats. Direkta SQL-prov i molnet rullades tillbaka.

## G-kriterier

”Verifierat” avser granskad kod och relevanta API-/SQL-/HTML-prov, inte samtliga möjliga scenarier. ”Delvis verifierat” betyder att hela den publicerade användarupplevelsen ännu inte är bekräftad.

| Kriterium | Bedömning | Belägg och begränsning |
|---|---|---|
| G1 Konto, login, logout | API verifierat; frontend implementerad | Registrering 201, login 200, logout 204. Återkallad cookie identifierar ingen användare. backend/src/auth.ts, auth-rutter i app.ts, AuthForm.tsx. Formulärklick har inte testats på nytt. |
| G2 Bestående session och identitet | Verifierat i API och serverrendering | HttpOnly/Secure-cookie gäller sju dagar. /auth/me visar rätt användare; ny sidbegäran med samma cookie ger inloggad navigation. layout.tsx, AuthProvider.tsx. |
| G3 Olika navigation | Verifierat i publicerad HTML | Utloggad: Logga in/Skapa konto. Inloggad: namn, Mina bokningar, Bli värd/Logga ut. Nav.tsx. |
| G4 Publik lista och detalj | Verifierat | Publika API-anrop och publicerade list-/detaljsidor fungerar. GET /properties och GET /properties/:id. |
| G5 Plats, maxpris, gäster | Verifierat | Kombinerade filter och kapacitetsfilter ger rätt resultat. Kontroller finns i publicerad HTML. filters i validation.ts och SQL i app.ts. |
| G6 Skyddade boendeskrivningar | Verifierat i API och molndatabas | Anonym POST/PUT/DELETE ger 401. RLS blockerar INSERT utan identitet och ändring/borttagning av annans boende. requireUser och boendepolicies. |
| G7 Skapa via frontendformulär | Delvis verifierat | Formuläret finns i publicerad HTML; granskad kod skickar POST och API-skapande fungerar. Själva formulärskickningen i webbläsaren har inte testats på nytt. PropertyForm.tsx. |
| G8 Backendsortering på pris | Verifierat | Testboenden med pris 1000/1500 får rätt ordning i båda riktningarna. SQL använder ORDER BY med validerat sorteringsval. |
| G9 Boka från detalj / loginuppmaning | API/HTML verifierat; klickflöde återstår | Anonym detaljsida uppmanar till login; inloggad detaljsida har formulär. Bokning ger 201, anonym bokning 401. BookingForm.tsx. |
| G10 Ogiltig bokning och begripligt fel | Delvis uppfyllt | Fel e-post, noll gäster, omvända/ogiltiga datum nekas med 400. Formuläret visar fel via errorMessage. Flera databasmeddelanden har fel teckenkodning. Visuell felvisning har inte testats på nytt. |
| G11 Nätter och total före bokning | Delvis verifierat | nights och BookingForm.tsx räknar nätter/pris från datumfälten. Prisrutan finns i publicerad HTML. Dynamisk uppdatering efter datumval har inte testats i webbläsare denna gång. |
| G12 Se, ändra, ta bort bokningar | API/SQL verifierat; frontend implementerad | Lista per boende fungerar; gästen kan ändra/radera egen bokning. BookingList.tsx erbjuder åtgärderna. Värdens ändringsrätt gäller status; gästens gäller egna bokningsuppgifter. |
| G13 Laddning, felvy, egen 404 | Delvis verifierat | loading.tsx, error.tsx och not-found.tsx finns. Publicerat saknat boende visar egen 404-text. Laddningsvy, renderad felvy och återförsök har inte provocerats i webbläsare denna gång. |
| G14 Statuskoder | Verifierat | 200 läsning/ändring, 201 skapande, 204 radering/logout, 400 ogiltiga data/JSON, 401 oinloggad, 403 förbjuden roll/Origin, 404 saknad/otillgänglig resurs, 409 krock. |
| G15 Databasskydd | Verifierat i Supabase | Boenden/bokningar har ENABLE och FORCE RLS; privata konton/sessioner har RLS och rollpolicies. API-/auth-roller saknar SUPERUSER/BYPASSRLS. anon/authenticated saknar tabellgrants till appdata. 32 direkta SQL-prov passerade. |
| G16 Typad frontend/backend | Verifierat genom kod och kompilator | Gemensamma modeller i shared/index.ts, strict TypeScript, typade databas-/API-anrop och Zod för indata. Båda delarna klarar typecheck och produktionsbygge. |

## VG-kriterier och underlag för muntlig genomgång

| Kriterium | Bedömning | Var och varför | Testade fall |
|---|---|---|---|
| VG1 Ägarskap | Verifierat | API hämtar identitet ur verifierad session. RLS/triggers skyddar rader och identitet. API kräver login; databasen skyddar även direkta SQL-skrivningar. | Annans boende kan inte ändras/raderas; tredje gäst ser inga bokningar; värd ser boendets bokningar; bokningsägare kan inte bytas; skickat user_id ignoreras. |
| VG2 Ingen dubbelbokning | Verifierat | no_double_booking är en GiST exclusion constraint på boende och datumintervall [). API mappar 23P01 till 409/BOOKING_CONFLICT. Databasen samordnar samtidiga skrivningar. | Krock vid INSERT/UPDATE; egna oförändrade datum fungerar; angränsande datum fungerar; samtidiga anrop ger 201/409; avbokad bokning blockerar inte. |
| VG3 Kapacitet | Verifierat | guard_booking läser/låser aktuell boenderad; guard_property kontrollerar kapacitetssänkning. Databasen använder betrodda uppgifter. | För många gäster via API/SQL nekas; sänkning under aktiv boknings gästantal nekas. Feltextens teckenkodning behöver rättas. |
| VG4 Status och roller | Regel verifierad; feltexter behöver rättas | API accepterar confirmed/cancelled. guard_booking kontrollerar roll/övergång och låser avbokad bokning, även vid direkt SQL. | Gäst kan inte bekräfta; värd bekräftar pending; gäst avbokar confirmed; värd avbokar pending; återgång till pending nekas; cancelled kan inte redigeras/återaktiveras; värd kan inte ändra gästens uppgifter. |
| VG5 Tidsregler | Lokalt verifierat; molnskydd granskat och delvis provat | guard_booking använder CURRENT_DATE med Europe/Stockholm. Serverns datum används i databasen. | Förfluten ny incheckning nekas via moln-API/SQL. Ändring/avbokning/radering efter passerad incheckning testades lokalt. Motsvarande molnfunktion granskades; historisk fixture skapades inte i produktion. |
| VG6 Serverpris | Verifierat | API utesluter klientpris. Databastrigger räknar/sparar totalen och ignorerar direkt SQL-prismanipulation. Databasen är här en del av backend. | Klientpris 1 blir 3000 för tre nätter à 1000; direkt prisändring ignoreras; nytt boendepris ändrar inte gammal total; ändrade datum använder ursprungligt nattpris. |
| VG7 Ledighetssökning | Verifierat | API validerar period och kombinerar filter/sortering. private.is_available ser dolda bokningar och lämnar endast booleskt resultat. SECURITY DEFINER behövs för att se alla reservationer; fast search_path och begränsad EXECUTE skyddar funktionen. | Upptaget boende försvinner ur kombinerad sökning; dold bokning påverkar ledighet; saknat slutdatum, omvänd period och ogiltigt kalenderdatum nekas; SQL-funktionen nekar ogiltig period. |

Minst fyra VG-regler fungerar enligt provningen. VG1, VG2, VG3, VG6 och VG7 kontrollerades både genom moln-API och direkt SQL. VG-betyg förutsätter fortfarande samtliga G-krav och din egen muntliga motivering.

## Konkreta fynd

1. **Felaktig teckenkodning i deployade databasfunktioner.** Faktiska Vercel-svar innehåller:
   - Kapacitet: FÃ¶r mÃ¥nga gÃ¤ster fÃ¶r detta boende.
   - Förfluten incheckning: Incheckningen fÃ¥r inte ligga i det fÃ¶rflutna.
   - Avbokad bokning: En avbokad bokning kan inte Ã¤ndras.

   Källfilerna har korrekt svenska. Felet finns i Supabases lagrade funktionssträngar. Återskapa berörda funktioner med korrekt UTF-8 via en ny migration och prova feltexterna igen. Detta berör G10 och VG-kravens begripliga/tydliga fel. Ingen sådan ändring har gjorts under granskningen.

2. **Interaktiva frontendflöden behöver slutverifieras.** Ingen Browser-session var tillgänglig. HTML-prov visar att rätt formulär/navigation renderas men bevisar inte klick, klienthydrering, dynamiskt pris, laddningsvy, renderad felvy eller återförsök. Äldre browseruppgifter i TESTPROTOKOLL.md ersätter inte en ny kontroll av nuvarande deployment.

3. **Implementerat är inte samma sak som fullständigt verifierat.** README/KRITERIER har starka påståenden om uppfyllelse. Använd denna rapport som aktuellt underlag och redovisa begränsningarna.

## Körresultat

| Kontroll | Resultat |
|---|---|
| Backend och frontend TypeScript | Båda godkända |
| npm test | 12 rapporterade tester godkända: 11 deltester och ett övergripande test. Riktig lokal PostgreSQL och direkta SQL-prov. |
| npm run build | Backend och Next.js produktionsbygge godkända |
| Publicerat API | 71 godkända assertions, inklusive 6 städkontroller. Provar status/data; korrekt svensk teckenkodning ingår inte i dessa assertions. |
| Direkt SQL i Supabase | 32 godkända assertions med stayfinder_api; all testdata rullades tillbaka |
| Publicerad HTML samt Origin/JSON | 12 godkända assertions; inga interaktiva browsertester |
| Supabase security advisors | 0 anmärkningar |

Vercel-connectorn kunde inte lämna projektmetadata på grund av schema-/åtkomstfel. Den faktiska deploymenten testades via HTTPS. Deploymentens commit/hash har inte jämförts med arbetskatalogen. Många ändringar fanns redan i arbetskatalogen; dessa har lämnats orörda.

## Testanropsfiler

- [api-vercel.http](../tests/api-vercel.http): manuella namngivna requests för REST Client med molnadress, rollcookies, förväntad status och G/VG-referenser. Ändra runId/datum vid ny körning. Stäng av automatisk cookiehantering så att roller inte blandas.
- [cloud-api-audit.mjs](../tests/cloud-api-audit.mjs): körbara HTTP-anrop/assertions. Kör node tests/cloud-api-audit.mjs. API_BASE kan ange lokal API-adress. Skapar unika konton och egna boenden; bokningar/boenden städas och sessioner återkallas. Konton kvarstår vid fristående körning eftersom API:t saknar kontoborttagning. Granskningens konton har städats separat med exakta ID:n.
- [supabase-api-role-audit.mjs](../tests/supabase-api-role-audit.mjs): kör efter API-testet medan dess konton fortfarande finns. Läser DATABASE_URL/DATABASE_CA från .env; kör SQL med API-rollen och rullar tillbaka allt. Kör node tests/supabase-api-role-audit.mjs. Resultatet gäller databasen .env pekar på.
- [cloud-pages-audit.mjs](../tests/cloud-pages-audit.mjs): kontrollerar publicerad HTML och Origin/JSON-fel. Skapar ett testkonto och loggar ut; framtida körningars konto behöver städas separat.
- Befintliga tests/api.http och backend/tests/integration.test.ts innehåller lokala anrop/prov.

Detaljerade resultat finns i test-results/cloud-audit.json, test-results/supabase-audit.json och test-results/cloud-pages-audit.json. Mappen är Git-ignorerad. Resultatfilerna innehåller inga lösenord, databasanslutningssträngar eller sessionscookies.

## Slutkontroll före inlämning

Efter rättad UTF-8: registrera/logga in/logga ut, ladda om, skapa/redigera/radera eget boende, välj bokningsdatum och kontrollera nätter/pris, skapa/redigera/avboka/radera bokning samt prova begripligt fel, laddningsvy och återförsök i en riktig webbläsare. Demonstrera värd/gäst i separata sessioner. Använd lokal testdatabas för historiska VG5-fixtures.
