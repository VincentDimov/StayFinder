# Sluttest i webbläsare – StayFinder, 2026-10-02

Den publicerade appen på https://stayfinder-tau-sepia.vercel.app testades i en separat Chrome-session med agent-browser. Värd och gäst använde varsin isolerad session och nya testkonton. Inga befintliga användarkonton eller bokningar ändrades.

**Alla nedan redovisade scenarier fungerade.** Den tidigare frågan om teckenkodning har enligt din instruktion lämnats utanför bedömningen.

| Scenario | Observerat resultat |
|---|---|
| Registrering via formulär | Både värd- och gästkonto skapades; menyn växlade till inloggat läge. |
| Bestående session | Värden förblev inloggad efter omladdning; gästens login verifierades också efter omladdning. |
| Felaktig login | Fel lösenord gav ”Fel e-postadress eller lösenord.” i formuläret. |
| Giltig login och logout | Login öppnade boendelistan; logout återställde Logga in/Skapa konto för båda sessionerna. |
| Skapa boende | Formuläret sparade eget boende med nattpris 850 kr och kapacitet 3; detaljsidan öppnades. |
| Redigera boende | Värdens formulär ändrade nattpriset till 900 kr; detaljsidan visade det nya priset. |
| Kombinerade frontendfilter | Plats + maxpris 1000 + 3 gäster + fallande sortering gav exakt testboendet och rätt URL-parametrar. |
| Utloggad detaljsida | Visade ”Logga in för att boka detta boende.” och inloggningslänk. |
| Omvända bokningsdatum | Visade ”Utcheckning måste vara efter incheckning.”, noll nätter och spärrad bokningsknapp. |
| Tre nätter | 2026-11-10 till 2026-11-13 gav 3 nätter och 2 700 kr före bokningen. |
| Fyra nätter | Ändrad utcheckning till 2026-11-14 uppdaterade priset direkt till 3 600 kr. |
| Ogiltig e-post | Webbläsarens formulärvalidering stoppade ”fel” och förklarade att @ saknades. |
| Noll gäster | Valideringen stoppade 0 och förklarade att värdet måste vara minst 1. |
| Skapa bokning | Bokningsknappen sparade 2 gäster/3 nätter/2 700 kr och öppnade Mina bokningar. |
| Redigera bokning | Gästen sparade 3 gäster och utcheckning 2026-11-14; listan visade 3 600 kr och rätt datum. |
| Serverfel i bokningsformulär | Överlappande försök visade ”Boendet är redan bokat under den valda perioden.” direkt i formuläret. |
| Värdens roll | Värden såg gästens bokning och kunde bekräfta den. Status blev Bekräftad. |
| Gästens avbokning | Gästen avbokade den bekräftade bokningen. Status blev Avbokad; Ändra/Avboka försvann. |
| Ta bort bokning | Gästens knapp och bekräftelsedialog raderade bokningen; listan blev tom. |
| Ta bort boende | Värdens knapp och bekräftelsedialog raderade testboendet; de sex ordinarie boendena återstod. |
| Laddningsvy | Omladdning visade appens ”Hittar din nästa paus…” innan boendelistan renderades. |
| Fel vid klientens datahämtning | Testsessionsnätet bröts medan appen var laddad. Åtgärden visade fel med Försök igen; även ett efterföljande GET-återförsök misslyckades och behöll felvyn. |
| Återhämtning av bokningslistan | Nätet återställdes och Försök igen hämtade den bekräftade bokningen; felmeddelandet försvann och sessionen bestod. |
| Sidans felgräns | /properties?guests=invalid gav appens egen ”Vi kunde inte hämta uppgifterna.” och Försök igen-knapp. |
| Sidans återförsök | Med ogiltig parameter kvar visades felet fortsatt, som väntat. Efter navigation till giltig /properties och Försök igen återställdes boendelistan. |
| Egen saknat-boende-sida | Den raderade detaljsidan visade ”Den här platsen finns inte.” med tillbaka-länk. |
| Städning | Bokning och boende raderades via UI; testkonton raderades separat med exakt matchning. Båda testsessionerna loggades ut och stängdes. |

## Metod och praktiska gränser

Formulären skickades med sina riktiga knappar. Chromes segmenterade datumkontroller sattes med den inbyggda input-settern och input/change-händelser, varefter Reacts verkliga prisruta, validering och formulärskickning kontrollerades. Datumändringar gjordes först när klientrenderingen var klar.

Nätavbrottet gällde endast gästens testwebbläsare. Vercel eller Supabase stoppades inte. Sidans felgräns provocerades med en ogiltig sökparameter, alltså ett riktigt misslyckat dataanrop. Inget felresultat mockades.

Bokningslistans nätverksfel visades som ”Failed to fetch” tillsammans med Försök igen. Återförsök hämtade data korrekt efter återställd anslutning. Den generella sidfelvyn hade svensk rubrik och återförsöksknapp.

Verktyget krävde att knappar utanför skärmen först scrollades fram och att JavaScript-bekräftelsedialoger besvarades separat. Tidiga verktygsförsök som inte aktiverade knappar eller missade klientrenderingen användes inte som belägg för lyckade tester; åtgärderna upprepades och slutresultaten observerades.

Ingen applikationskod, databasregel eller deployment ändrades. Historiska VG5-fixtures har fortsatt endast testats i den lokala integrationstesten från föregående granskning.

## Underlag

Detaljerad åtgärdslogg finns i test-results/browser-final/actions.log. Skärmbilder finns i samma Git-ignorerade mapp:

- booking-price.png: dynamisk prisvisning.
- booking-conflict.png: serverns krockfel i formuläret.
- bookings-error.png och bookings-recovered.png: klientfel och återhämtning.
- page-error.png och page-recovered.png: sidfel och återställd boendelista.
- filtered-property.png: kombinerat filter via sökformulär.
- property-not-found.png: egen 404 efter borttagning.

De här resultaten kompletterar 71 tidigare moln-API-kontroller, 32 direkta SQL-kontroller i Supabase, 12 HTML/HTTP-kontroller, lokala integrationstester, TypeScript-kontroller och produktionsbygge. Under den begärda avgränsningen ger granskningen stöd för samtliga G1–G16 och VG1–VG7.
