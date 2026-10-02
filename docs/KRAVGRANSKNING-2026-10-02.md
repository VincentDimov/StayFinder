# Kravgranskning av StayFinder – 2026-10-02

**Slutbedömning efter kompletterande webbläsartest:** Granskad kod och genomförda API-, SQL- och webbläsartester ger stöd för samtliga G1–G16 och VG1–VG7. På din begäran ingår teckenkodningsfrågan inte i bedömningen. Webbläsarflödena som tidigare återstod har nu testats; se [sluttestet](WEBBLASARTEST-2026-10-02.md).

Publicerad app: https://stayfinder-tau-sepia.vercel.app.
Supabase-projekt: xcniskfsojxkebdjbzkw.

Detta är en granskning av befintlig implementation. Ingen applikationskod, databasregel eller deployment har ändrats. Granskningens egna testkonton, boenden och bokningar har städats. Direkta SQL-prov i molnet rullades tillbaka.

## G-kriterier

”Verifierat” avser granskad kod och redovisade API-, SQL- och webbläsarprov. Bedömningen bygger på dessa konkreta fall. Tabellen nedan har uppdaterats efter det kompletterande webbläsartestet.

| Kriterium | Bedömning | Belägg och begränsning |
|---|---|---|
| G1 Konto, login, logout | Verifierat | Värd/gäst registrerades via frontend. Felaktig/giltig login och logout provades via formulär/knappar. |
| G2 Bestående session och identitet | Verifierat | API-identitet och bestående HttpOnly/Secure-cookie verifierades tidigare; inloggning efter verklig webbläsaromladdning verifierades för både värd och gäst. |
| G3 Olika navigation | Verifierat | Verkliga registreringar/login/logout växlade navigationen till respektive från namn, bokningar och värdlänkar. |
| G4 Publik lista och detalj | Verifierat | Publika API-anrop och publicerade list-/detaljsidor fungerar. GET /properties och GET /properties/:id. |
| G5 Plats, maxpris, gäster | Verifierat | Kombinerade API-filter och det riktiga sökformuläret testades; plats + maxpris 1000 + 3 gäster gav exakt testboendet. |
| G6 Skyddade boendeskrivningar | Verifierat i API och molndatabas | Anonym POST/PUT/DELETE ger 401. RLS blockerar INSERT utan identitet och ändring/borttagning av annans boende. requireUser och boendepolicies. |
| G7 Skapa via frontendformulär | Verifierat | Riktigt formulär sparade boende med pris 850 kr/kapacitet 3 och öppnade detaljsidan. Redigering sparade nytt pris 900 kr. |
| G8 Backendsortering på pris | Verifierat | Testboenden med pris 1000/1500 får rätt ordning i båda riktningarna. SQL använder ORDER BY med validerat sorteringsval. |
| G9 Boka från detalj / loginuppmaning | Verifierat | Inloggad gäst bokade med detaljsidans formulär; utloggad detaljsida visade loginuppmaning. |
| G10 Ogiltig bokning och begripligt fel | Verifierat enligt avgränsningen | E-post/noll gäster/omvända datum stoppades med begriplig formulärvalidering. API nekar ogiltiga uppgifter. Krockfel visades direkt i formuläret. |
| G11 Nätter och total före bokning | Verifierat | Reacts riktiga prisruta uppdaterades från 3 nätter/2 700 kr till 4 nätter/3 600 kr vid ändrat datum. |
| G12 Se, ändra, ta bort bokningar | Verifierat | Gästens skapande, redigering, avbokning och borttagning testades via UI; värden såg och bekräftade bokningen. API/SQL provades tidigare. |
| G13 Laddning, felvy, egen 404 | Verifierat | Verklig laddningsvy observerades. Klientfel och sidfel provocerades; återförsök återställde data när orsaken avhjälpts. Raderat boende gav egen 404. |
| G14 Statuskoder | Verifierat | 200 läsning/ändring, 201 skapande, 204 radering/logout, 400 ogiltiga data/JSON, 401 oinloggad, 403 förbjuden roll/Origin, 404 saknad/otillgänglig resurs, 409 krock. |
| G15 Databasskydd | Verifierat i Supabase | Boenden/bokningar har ENABLE och FORCE RLS; privata konton/sessioner har RLS och rollpolicies. API-/auth-roller saknar SUPERUSER/BYPASSRLS. anon/authenticated saknar tabellgrants till appdata. 32 direkta SQL-prov passerade. |
| G16 Typad frontend/backend | Verifierat genom kod och kompilator | Gemensamma modeller i shared/index.ts, strict TypeScript, typade databas-/API-anrop och Zod för indata. Båda delarna klarar typecheck och produktionsbygge. |

## VG-kriterier och underlag för muntlig genomgång

| Kriterium | Bedömning | Var och varför | Testade fall |
|---|---|---|---|
| VG1 Ägarskap | Verifierat | API hämtar identitet ur verifierad session. RLS/triggers skyddar rader och identitet. API kräver login; databasen skyddar även direkta SQL-skrivningar. | Annans boende kan inte ändras/raderas; tredje gäst ser inga bokningar; värd ser boendets bokningar; bokningsägare kan inte bytas; skickat user_id ignoreras. |
| VG2 Ingen dubbelbokning | Verifierat | no_double_booking är en GiST exclusion constraint på boende och datumintervall [). API mappar 23P01 till 409/BOOKING_CONFLICT. Databasen samordnar samtidiga skrivningar. | Krock vid INSERT/UPDATE; egna oförändrade datum fungerar; angränsande datum fungerar; samtidiga anrop ger 201/409; avbokad bokning blockerar inte. |
| VG3 Kapacitet | Verifierat | guard_booking läser/låser aktuell boenderad; guard_property kontrollerar kapacitetssänkning. Databasen använder betrodda uppgifter. | För många gäster via API/SQL nekas; sänkning under aktiv boknings gästantal nekas. |
| VG4 Status och roller | Verifierat enligt avgränsningen | API accepterar confirmed/cancelled. guard_booking kontrollerar roll/övergång och låser avbokad bokning, även vid direkt SQL. | Gäst kan inte bekräfta; värd bekräftar pending; gäst avbokar confirmed; värd avbokar pending; återgång till pending nekas; cancelled kan inte redigeras/återaktiveras; värd kan inte ändra gästens uppgifter. |
| VG5 Tidsregler | Lokalt verifierat; molnskydd granskat och delvis provat | guard_booking använder CURRENT_DATE med Europe/Stockholm. Serverns datum används i databasen. | Förfluten ny incheckning nekas via moln-API/SQL. Ändring/avbokning/radering efter passerad incheckning testades lokalt. Motsvarande molnfunktion granskades; historisk fixture skapades inte i produktion. |
| VG6 Serverpris | Verifierat | API utesluter klientpris. Databastrigger räknar/sparar totalen och ignorerar direkt SQL-prismanipulation. Databasen är här en del av backend. | Klientpris 1 blir 3000 för tre nätter à 1000; direkt prisändring ignoreras; nytt boendepris ändrar inte gammal total; ändrade datum använder ursprungligt nattpris. |
| VG7 Ledighetssökning | Verifierat | API validerar period och kombinerar filter/sortering. private.is_available ser dolda bokningar och lämnar endast booleskt resultat. SECURITY DEFINER behövs för att se alla reservationer; fast search_path och begränsad EXECUTE skyddar funktionen. | Upptaget boende försvinner ur kombinerad sökning; dold bokning påverkar ledighet; saknat slutdatum, omvänd period och ogiltigt kalenderdatum nekas; SQL-funktionen nekar ogiltig period. |

Minst fyra VG-regler fungerar enligt provningen. VG1, VG2, VG3, VG6 och VG7 kontrollerades både genom moln-API och direkt SQL. VG-betyg förutsätter fortfarande samtliga G-krav och din egen muntliga motivering.

## Kompletterande webbläsartest

De tidigare återstående frontendflödena är genomförda och godkända i de redovisade fallen. Se [WEBBLASARTEST-2026-10-02.md](WEBBLASARTEST-2026-10-02.md) för resultat, metod, skärmbilder och felåterhämtning. Teckenkodningsfrågan ingår inte i bedömningen enligt din instruktion.

## Körresultat

| Kontroll | Resultat |
|---|---|
| Backend och frontend TypeScript | Båda godkända |
| npm test | 12 rapporterade tester godkända: 11 deltester och ett övergripande test. Riktig lokal PostgreSQL och direkta SQL-prov. |
| npm run build | Backend och Next.js produktionsbygge godkända |
| Publicerat API | 71 godkända assertions, inklusive 6 städkontroller. Provar status/data; korrekt svensk teckenkodning ingår inte i dessa assertions. |
| Direkt SQL i Supabase | 32 godkända assertions med stayfinder_api; all testdata rullades tillbaka |
| Publicerad HTML samt Origin/JSON | 12 godkända assertions |
| Kompletterande interaktiv webbläsarkontroll | Formulär, dynamiskt pris, laddning, fel, återförsök, roller, avbokning, borttagning och logout verifierade |
| Supabase security advisors | 0 anmärkningar |

Vercel-connectorn kunde inte lämna projektmetadata på grund av schema-/åtkomstfel. Den faktiska deploymenten testades via HTTPS. Deploymentens commit/hash har inte jämförts med arbetskatalogen. Många ändringar fanns redan i arbetskatalogen; dessa har lämnats orörda.

## Testanropsfiler

- [api-vercel.http](../tests/api-vercel.http): manuella namngivna requests för REST Client med molnadress, rollcookies, förväntad status och G/VG-referenser. Ändra runId/datum vid ny körning. Stäng av automatisk cookiehantering så att roller inte blandas.
- [cloud-api-audit.mjs](../tests/cloud-api-audit.mjs): körbara HTTP-anrop/assertions. Kör node tests/cloud-api-audit.mjs. API_BASE kan ange lokal API-adress. Skapar unika konton och egna boenden; bokningar/boenden städas och sessioner återkallas. Konton kvarstår vid fristående körning eftersom API:t saknar kontoborttagning. Granskningens konton har städats separat med exakta ID:n.
- [supabase-api-role-audit.mjs](../tests/supabase-api-role-audit.mjs): kör efter API-testet medan dess konton fortfarande finns. Läser DATABASE_URL/DATABASE_CA från .env; kör SQL med API-rollen och rullar tillbaka allt. Kör node tests/supabase-api-role-audit.mjs. Resultatet gäller databasen .env pekar på.
- [cloud-pages-audit.mjs](../tests/cloud-pages-audit.mjs): kontrollerar publicerad HTML och Origin/JSON-fel. Skapar ett testkonto och loggar ut; framtida körningars konto behöver städas separat.
- Befintliga tests/api.http och backend/tests/integration.test.ts innehåller lokala anrop/prov.

Detaljerade resultat finns i test-results/cloud-audit.json, test-results/supabase-audit.json och test-results/cloud-pages-audit.json. Mappen är Git-ignorerad. Resultatfilerna innehåller inga lösenord, databasanslutningssträngar eller sessionscookies.

## Slutkontroll inför inlämning

Webbläsarflödena som tidigare återstod har nu testats på den publicerade appen. Testdata och testsessioner har städats. Förbered din egen muntliga förklaring av reglernas placering och testfall; tabellerna ovan och webbläsarprotokollet ger underlaget.
