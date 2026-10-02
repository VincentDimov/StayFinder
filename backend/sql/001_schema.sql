-- Installerar schemat som en transaktion så att ett fel inte lämnar en delvis genomförd migration.
BEGIN;
-- btree_gist ger GiST stöd för UUID-jämförelse i regeln som stoppar dubbelbokning.
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Skapar separata API- och autentiseringsroller utan superuser eller rätt att kringgå RLS.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='stayfinder_api') THEN
    CREATE ROLE stayfinder_api LOGIN PASSWORD 'stayfinder_local_api' NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='stayfinder_auth') THEN
    CREATE ROLE stayfinder_auth LOGIN PASSWORD 'stayfinder_local_auth' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
-- Använder svensk tidszon för datumregler och låter inte vanliga roller skapa objekt i public.
ALTER ROLE stayfinder_api SET timezone = 'Europe/Stockholm';
ALTER ROLE stayfinder_auth SET timezone = 'Europe/Stockholm';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- Isolerar konton och sessioner från det offentliga boendeschemat.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
-- Sparar kontots ID, unik normaliserad e-post, namn och lösenordshash.
CREATE TABLE IF NOT EXISTS private.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL CHECK (email = lower(email)),
  name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
  password_hash text NOT NULL
);
-- Sparar sessionshashar och utgångstid; kontoborttagning rensar även kontots sessioner.
CREATE TABLE IF NOT EXISTS private.sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES private.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
-- Ger autentiseringsrollen bara de schema- och tabellrättigheter som konto- och sessionsflödet behöver.
GRANT USAGE ON SCHEMA private TO stayfinder_auth;
GRANT SELECT, INSERT ON private.users TO stayfinder_auth;
GRANT SELECT, INSERT, DELETE ON private.sessions TO stayfinder_auth;
-- Läser den verifierade användarens transaktionslokala ID som backend sätter före SQL-anrop.
CREATE OR REPLACE FUNCTION public.actor_id() RETURNS uuid LANGUAGE sql STABLE
  SET search_path = pg_catalog AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Boenden tillhör en värd och har CHECK-regler för textlängd, nattpris och kapacitet.
CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES private.users(id),
  title text NOT NULL CHECK(length(title) BETWEEN 3 AND 100),
  description text NOT NULL CHECK(length(description) BETWEEN 10 AND 3000),
  location text NOT NULL CHECK(length(location) BETWEEN 2 AND 100),
  price_per_night integer NOT NULL CHECK(price_per_night BETWEEN 1 AND 1000000),
  max_guests integer NOT NULL CHECK(max_guests BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Bokningar kopplar gäst och boende till en vistelse, kontaktuppgifter, status och serverberäknat pris.
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES private.users(id),
  email text NOT NULL CHECK(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  guests integer NOT NULL CHECK(guests BETWEEN 1 AND 100),
  check_in date NOT NULL,
  check_out date NOT NULL CHECK(check_out > check_in),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')),
  total_price bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Stoppar överlappande aktiva bokningar även vid samtidighet. Intervallet [) inkluderar incheckning men inte utcheckning.
  CONSTRAINT no_double_booking EXCLUDE USING gist
    (property_id WITH =, daterange(check_in, check_out, '[)') WITH &&)
    WHERE (status <> 'cancelled')
);
-- Index gör uppslag av användarens bokningar, värdens boenden, priser och sessionsutgång snabbare.
CREATE INDEX IF NOT EXISTS bookings_user_idx ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS properties_owner_idx ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS properties_price_idx ON public.properties(price_per_night);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON private.sessions(expires_at);
-- Aktiverar och tvingar radbaserad åtkomstkontroll, RLS, för boenden och bokningar.
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;
-- Alla API-besökare får läsa boenden.
DROP POLICY IF EXISTS property_read ON public.properties;
CREATE POLICY property_read ON public.properties FOR SELECT TO stayfinder_api USING (true);
-- Ett nytt boende måste tillhöra den verifierade användaren.
DROP POLICY IF EXISTS property_insert ON public.properties;
CREATE POLICY property_insert ON public.properties FOR INSERT TO stayfinder_api WITH CHECK(owner_id = public.actor_id());
-- Bara ägaren får uppdatera boendet och ägarskapet får inte bytas i uppdateringen.
DROP POLICY IF EXISTS property_update ON public.properties;
CREATE POLICY property_update ON public.properties FOR UPDATE TO stayfinder_api
  USING(owner_id = public.actor_id()) WITH CHECK(owner_id = public.actor_id());
-- Bara ägaren får ta bort sitt boende.
DROP POLICY IF EXISTS property_delete ON public.properties;
CREATE POLICY property_delete ON public.properties FOR DELETE TO stayfinder_api USING(owner_id = public.actor_id());
-- Bara bokningens gäst eller boendets värd får läsa bokningsraden.
DROP POLICY IF EXISTS booking_read ON public.bookings;
CREATE POLICY booking_read ON public.bookings FOR SELECT TO stayfinder_api USING(
  user_id = public.actor_id() OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=public.actor_id())
);
-- Nya bokningar måste använda den verifierade gästens ID.
DROP POLICY IF EXISTS booking_insert ON public.bookings;
CREATE POLICY booking_insert ON public.bookings FOR INSERT TO stayfinder_api WITH CHECK(user_id = public.actor_id());
-- Bara gästen eller värden kan nå raden för uppdatering; triggern begränsar vad var och en får ändra.
DROP POLICY IF EXISTS booking_update ON public.bookings;
CREATE POLICY booking_update ON public.bookings FOR UPDATE TO stayfinder_api
  USING(user_id = public.actor_id() OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=public.actor_id()))
  WITH CHECK(user_id = public.actor_id() OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=public.actor_id()));
-- Bara gästen eller boendets värd kan nå raden för borttagning.
DROP POLICY IF EXISTS booking_delete ON public.bookings;
CREATE POLICY booking_delete ON public.bookings FOR DELETE TO stayfinder_api USING(
  user_id = public.actor_id() OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=public.actor_id())
);
-- Tabellrättigheter ger API-rollen CRUD-åtkomst, men varje rad omfattas fortfarande av RLS.
GRANT USAGE ON SCHEMA public TO stayfinder_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties, public.bookings TO stayfinder_api;

-- Ledighetskontrollen ser alla reservationer men lämnar aldrig ut andra gästers uppgifter.
-- Returnerar bara ledig/upptagen. SECURITY DEFINER ser även bokningar som är dolda för den som söker. Fast search_path skyddar objektuppslag.
CREATE OR REPLACE FUNCTION private.is_available(pid uuid, start_date date, end_date date)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF start_date IS NULL OR end_date IS NULL OR end_date<=start_date THEN
    RAISE EXCEPTION 'Ange en giltig in- och utcheckning.' USING ERRCODE='P0001';
  END IF;
  RETURN NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.property_id=pid
    AND b.status <> 'cancelled' AND daterange(b.check_in,b.check_out,'[)') && daterange(start_date,end_date,'[)'));
END;
$$;
-- Begränsar körning av ledighetsfunktionen till API-rollen.
REVOKE ALL ON FUNCTION private.is_available(uuid,date,date) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO stayfinder_api;
GRANT EXECUTE ON FUNCTION private.is_available(uuid,date,date) TO stayfinder_api;

-- Skyddar boendets identitet och hindrar en kapacitetsminskning som skulle göra aktiva bokningar ogiltiga.
CREATE OR REPLACE FUNCTION private.guard_property() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    -- ID, ägare och skapandetid är oföränderliga.
    IF NEW.id<>OLD.id OR NEW.owner_id<>OLD.owner_id OR NEW.created_at<>OLD.created_at THEN
      RAISE EXCEPTION 'Boendets ägare och identitet kan inte ändras.' USING ERRCODE='P0001';
    END IF;
    -- En aktiv boknings gästantal får inte överstiga boendets nya kapacitet.
    IF EXISTS(SELECT 1 FROM public.bookings WHERE property_id=OLD.id AND status<>'cancelled' AND guests>NEW.max_guests) THEN
      RAISE EXCEPTION 'Kapaciteten får inte understiga antalet gäster i en aktiv bokning.' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- Kopplar boendeskyddet till varje UPDATE; funktionen ska köras genom triggern.
REVOKE ALL ON FUNCTION private.guard_property() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_property ON public.properties;
CREATE TRIGGER guard_property BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION private.guard_property();

-- Databasens centrala bokningsskydd kontrollerar identitet, datum, kapacitet, status och pris även vid direkt SQL.
CREATE OR REPLACE FUNCTION private.guard_booking() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE p public.properties; actor uuid := public.actor_id();
BEGIN
  -- Alla bokningsändringar kräver en verifierad användaridentitet i transaktionen.
  IF actor IS NULL THEN RAISE EXCEPTION 'Du måste logga in.' USING ERRCODE='42501'; END IF;
  -- Borttagning kräver rätt gäst eller värd och nekas när incheckningsdatumet har passerat.
  IF TG_OP='DELETE' THEN
    IF actor<>OLD.user_id AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=OLD.property_id AND owner_id=actor) THEN
      RAISE EXCEPTION 'Du saknar behörighet.' USING ERRCODE='42501';
    END IF;
    IF OLD.check_in < CURRENT_DATE THEN RAISE EXCEPTION 'En påbörjad bokning kan inte tas bort.' USING ERRCODE='P0001'; END IF;
    RETURN OLD;
  END IF;
  -- Låser boendets rad under kontrollen så att kapacitet och samtidiga bokningsändringar samordnas.
  SELECT * INTO p FROM public.properties WHERE id=NEW.property_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boendet finns inte.' USING ERRCODE='23503'; END IF;
  IF TG_OP='INSERT' THEN
    -- En ny bokning tillhör sessionsanvändaren och måste börja med status pending.
    IF NEW.user_id<>actor OR NEW.status<>'pending' THEN
      RAISE EXCEPTION 'Bokningen måste tillhöra gästen och börja som väntande.' USING ERRCODE='42501';
    END IF;
  ELSE
    IF actor<>OLD.user_id AND actor<>p.owner_id THEN RAISE EXCEPTION 'Du saknar behörighet.' USING ERRCODE='42501'; END IF;
    -- Ett befintligt boknings-ID får inte flyttas till en annan gäst eller ett annat boende.
    IF NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR NEW.property_id<>OLD.property_id OR NEW.created_at<>OLD.created_at THEN
      RAISE EXCEPTION 'Bokningens identitet och ägare kan inte ändras.' USING ERRCODE='42501';
    END IF;
    -- Avbokade bokningar är avslutade och en passerad incheckning låser ändringar.
    IF OLD.status='cancelled' THEN RAISE EXCEPTION 'En avbokad bokning kan inte ändras.' USING ERRCODE='P0001'; END IF;
    IF OLD.check_in<CURRENT_DATE THEN RAISE EXCEPTION 'En påbörjad bokning kan inte ändras eller avbokas.' USING ERRCODE='P0001'; END IF;
    -- Bara värden får bekräfta en väntande bokning; andra statusbyten måste vara tillåtna avbokningar.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status='confirmed' AND (OLD.status<>'pending' OR p.owner_id<>actor) THEN
        RAISE EXCEPTION 'Bara värden kan bekräfta en väntande bokning.' USING ERRCODE='42501';
      END IF;
      IF NEW.status NOT IN ('confirmed','cancelled') THEN
        RAISE EXCEPTION 'Otillåten statusändring.' USING ERRCODE='P0001';
      END IF;
    END IF;
    -- Värden får hantera status, men gästen ensam får ändra kontaktuppgifter, gästantal och datum.
    IF actor<>OLD.user_id AND (NEW.email,NEW.guests,NEW.check_in,NEW.check_out) IS DISTINCT FROM (OLD.email,OLD.guests,OLD.check_in,OLD.check_out) THEN
      RAISE EXCEPTION 'Bara gästen kan ändra bokningsuppgifter.' USING ERRCODE='42501';
    END IF;
    -- Ignorerar försök att skriva ett eget pris på en befintlig bokning.
    NEW.total_price := OLD.total_price;
  END IF;
  -- Validerar framtida incheckning och att antalet gäster ryms i boendet.
  IF NEW.check_in<CURRENT_DATE THEN RAISE EXCEPTION 'Incheckningen får inte ligga i det förflutna.' USING ERRCODE='P0001'; END IF;
  IF NEW.guests>p.max_guests THEN RAISE EXCEPTION 'För många gäster för detta boende.' USING ERRCODE='P0001'; END IF;
  IF TG_OP='INSERT' THEN
    -- För nya bokningar beräknas totalen med boendets aktuella nattpris.
    NEW.total_price := (NEW.check_out-NEW.check_in)::bigint * p.price_per_night;
  ELSIF (NEW.check_in,NEW.check_out) IS DISTINCT FROM (OLD.check_in,OLD.check_out) THEN
    -- Vid ändrade datum används det ursprungliga nattpriset; senare prisändringar på boendet påverkar inte denna bokning.
    NEW.total_price := (NEW.check_out-NEW.check_in)::bigint * (OLD.total_price/(OLD.check_out-OLD.check_in));
  END IF;
  RETURN NEW;
END $$;
-- Kopplar skyddet till INSERT, UPDATE och DELETE så att reglerna inte kan kringgås via vanliga SQL-skrivningar.
REVOKE ALL ON FUNCTION private.guard_booking() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_booking ON public.bookings;
CREATE TRIGGER guard_booking BEFORE INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.guard_booking();
-- Bekräftar schema, åtkomstregler och triggers när hela migrationen har lyckats.
COMMIT;
