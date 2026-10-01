# Förberedelse för muntlig kodgenomgång, 8–10 minuter

Guiden är stöd för din förklaring. Du behöver själv förstå och kunna motivera koden som lämnas in.

## Demonstration, cirka tre minuter

1. Visa startsidan och filtrera boenden på plats, pris och gäster. Växla sortering och förklara att SQL sorterar resultatet.
2. Skapa ett gästkonto och ladda om sidan. Visa att namnet och den inloggade navigeringen består.
3. Öppna ett boende. Ange datum och visa antal nätter samt totalpris före bokning.
4. Boka och öppna Mina bokningar. Ändra antalet gäster och spara.
5. Logga in som demovärden. Visa bokningen och bekräfta den. Logga sedan in som gästen och avboka.
6. Visa minst ett nekat API-anrop: dubbelbokning, gäst som försöker bekräfta eller för många gäster.

## Förklara flödet, cirka två minuter

Följ `BookingForm.tsx → lib/api.ts → app.ts → validation.ts → db.ts → guard_booking/no_double_booking`.

Formuläret hjälper användaren att fylla i rätt uppgifter. Det skickar JSON och cookies till API:t. API:t verifierar sessionen och validerar uppgifterna med Zod. SQL körs i en transaktion med verifierat användar-ID. RLS avgör vilka rader användaren får hantera. Triggern hämtar aktuellt pris och kapacitet och kontrollerar status/datum. Exclusion constraint nekar överlappning. Det sparade resultatet returneras och visas i appen.

## Frågor du ska kunna svara på

**Autentisering eller auktorisering?** Sessionsuppslaget visar vem du är; RLS och rollkontroller avgör vad du får göra.

**Varför cookies i anropen?** API:t måste få sessionsnyckeln för att identifiera användaren. Fetch mellan olika portar behöver `credentials: 'include'`. Serverkomponenternas fetch har ingen automatisk webbläsarsession och skickar därför Cookie-headern själv.

**Varför räcker inte en gömd knapp?** Någon kan skicka ett HTTP-anrop direkt. `requireUser` och RLS måste fortfarande neka operationen.

**Varför ligger överlappningsregeln i databasen?** API-kontroller ensamma har en kapplöpning mellan kontroll och INSERT. Databasens exclusion constraint fungerar även vid samtidiga anrop och UPDATE.

**Varför använder några funktioner SECURITY DEFINER?** Tillgänglighet måste ta hänsyn till också dolda bokningar. Triggern behöver dessutom låsa boendet utan att gästen får rätt att ändra det. Funktionerna är privata, har låst sökväg, begränsade rättigheter och explicit identitetskontroll där de ändrar bokningsregler.

**Vad händer om priset ändras?** Nya bokningar använder det nya priset. Befintliga bokningar har ett sparat totalpris; vid datumändring används deras ursprungliga nattpris.

**Vilken del förutsätter ett betrott API?** Databasanvändaren är serverns roll. Servern måste sätta rätt användar-ID efter sessionskontroll, och dess databaslösenord får aldrig skickas till webbläsaren.

**Vilka gränsfall har du testat?** Ogiltig e-post/datum, noll och för många gäster, bakvänd period, förfluten incheckning, angränsande datum, uppdatering utan självkrock, dolda bokningar, två samtidiga bokningar, terminal status, påbörjade bokningar och manipulation av ägare/pris.

## Läs dessa delar innan genomgången

- `backend/src/auth.ts`: sessionsnyckel, hashning och cookie.
- `backend/src/db.ts`: BEGIN, användar-ID, COMMIT/ROLLBACK och anslutningspool.
- `backend/sql/001_schema.sql`: policies, no_double_booking och guard_booking.
- `backend/tests/integration.test.ts`: vilka anrop som måste lyckas och nekas.
- `frontend/src/components/BookingForm.tsx`: lokal prisförhandsvisning och API-fel.
