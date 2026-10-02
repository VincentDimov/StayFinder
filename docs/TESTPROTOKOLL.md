# Testprotokoll

Verifierat i Windows med Node.js 22.20.0, Docker Desktop, PostgreSQL 17, Hono 4.13.12 och Next.js 16.3.8.

## Automatiska kontroller

| Kontroll            | Resultat                                                |
| ------------------- | ------------------------------------------------------- |
| `npm run typecheck` | Backend och frontend utan typfel                        |
| `npm test`          | 12 rapporterade tester, 12 godkända, 0 misslyckade      |
| `npm run build`     | Backend kompilerar, frontendens produktionsbygge lyckas |
| `npm audit`         | 0 kända sårbarheter                                     |

Testfilen använder Hono-appens riktiga request-handler och en riktig PostgreSQL-container, inte en mockad databas. Därutöver används direkta SQL-anrop med den begränsade API-rollen. Eleven kan upprepa kontrollerna med kommandona i README.

Testerna omfattar bland annat sessionsåterkallelse, publika boenden, filter/sortering, ogiltig JSON, validering, ägarskap, RLS, dold bokningsdata, kapacitet, statusroller, passerade datum, priser, tillgänglighet och borttagning. Två samtidiga bokningar för samma period ger **201 och 409**. En uppdatering med samma datum lyckas; en uppdatering som överlappar en annan bokning ger 409. SQL-anrop kan inte ändra ägare eller kringgå reglerna.

## Verifierat i lokal testwebbläsare

Den anslutna browser-pluginen saknade en tillgänglig webbläsare. Därför användes agent-browser med en separat lokal Chrome-session, utan åtkomst till användarens vanliga webbläsarprofil.

| Flöde                          | Observerat resultat                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Startsida och boendelista      | Meny, boenden, länkar och bilder visas                                                      |
| Registrering                   | Testkonto skapades via formuläret och menyn växlade till inloggat läge                      |
| Omladdning                     | Inloggningen bestod och API:t identifierade samma konto                                     |
| Sökformulär                    | Dalarna, maxpris 1500 och två gäster gav en träff: Skogsstugan vid sjön                     |
| Detalj och prisförhandsvisning | 10–13 november 2026 gav tre nätter och 3750 kr                                              |
| Skapa bokning                  | Bokningen sparades och visades på Mina bokningar som väntande                               |
| Ändra bokning                  | Ändring från en till två gäster sparades; totalen var fortsatt 3750 kr                      |
| Skapa boende                   | Titel, beskrivning, plats, pris 850 och kapacitet tre sparades via formuläret               |
| Ändra boende                   | Ägarens formulär öppnades och ändring till pris 900 sparades                                |
| Värdens vy                     | Demovärden såg gästens bokning och hade en Bekräfta-knapp                                   |
| Bekräftelse                    | Värdens knapp ändrade bokningen till Bekräftad                                              |
| Avbokning                      | Värdens knapp ändrade den bekräftade bokningen till Avbokad och ändringsknapparna försvann  |
| Egen 404                       | Saknad UUID gav appens text: Den här platsen finns inte                                     |
| Felvy och återhämtning         | Databasavbrott gav egen felvy; efter omstart hämtade Försök igen listan och användaren igen |
| Responsiv vy                   | Kontrollerad i 390 × 844 och skrivbordsvy; bilder och navigering anpassas                   |

Datumfälten fylldes genom DOM-värdesättning med input/change-händelser eftersom testverktygets vanliga fill-kommando inte fyllde Chromes segmenterade datumfält. Prisförhandsvisning och själva formulärskickningen kontrollerades därefter i det riktiga gränssnittet.

Avbrottstestet verifierade även att API-processen fortsätter när en inaktiv databasanslutning bryts. Poolens error-händelse hanteras; nästa anrop skapar en ny anslutning. Felvyn uppdaterar serverdata vid återförsök. Kontrollerade avbrott och saknade boenden förväntas ge server-/webbläsarloggar; dessa är inte oväntade fel under normal användning.

Skärmbilder finns under `screenshots/`. Tillfälliga integrations- och browsertestuppgifter städades efter verifieringen, så de sex exempelboendena finns kvar utan testbokningar.

## Vad detta inte ersätter

Repo- och driftlänkar finns i INLAMNING.md. Den muntliga kodgenomgången och betygssättningen kan inte genomföras av ett automatiskt test. Läraren bedömer också elevens egen förståelse. Molnpubliceringen verifierades 2026-10-02; se CLOUD_PUBLICERING.md.
