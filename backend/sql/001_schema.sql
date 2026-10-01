BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='stayfinder_api') THEN
    CREATE ROLE stayfinder_api LOGIN PASSWORD 'stayfinder_local_api' NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='stayfinder_auth') THEN
    CREATE ROLE stayfinder_auth LOGIN PASSWORD 'stayfinder_local_auth' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE stayfinder_api SET timezone = 'Europe/Stockholm';
ALTER ROLE stayfinder_auth SET timezone = 'Europe/Stockholm';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS private.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL CHECK (email = lower(email)),
  name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS private.sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES private.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
GRANT USAGE ON SCHEMA private TO stayfinder_auth;
GRANT SELECT, INSERT ON private.users TO stayfinder_auth;
GRANT SELECT, INSERT, DELETE ON private.sessions TO stayfinder_auth;
CREATE OR REPLACE FUNCTION public.actor_id() RETURNS uuid LANGUAGE sql STABLE
  SET search_path = pg_catalog AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

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
  CONSTRAINT no_double_booking EXCLUDE USING gist
    (property_id WITH =, daterange(check_in, check_out, '[)') WITH &&)
    WHERE (status <> 'cancelled')
);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS properties_owner_idx ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS properties_price_idx ON public.properties(price_per_night);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON private.sessions(expires_at);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_read ON public.properties;
CREATE POLICY property_read ON public.properties FOR SELECT TO stayfinder_api USING (true);
DROP POLICY IF EXISTS property_insert ON public.properties;
CREATE POLICY property_insert ON public.properties FOR INSERT TO stayfinder_api WITH CHECK(owner_id = public.actor_id());
DROP POLICY IF EXISTS property_update ON public.properties;
CREATE POLICY property_update ON public.properties FOR UPDATE TO stayfinder_api
  USING(owner_id = public.actor_id()) WITH CHECK(owner_id = public.actor_id());
DROP POLICY IF EXISTS property_delete ON public.properties;
CREATE POLICY property_delete ON public.properties FOR DELETE TO stayfinder_api USING(owner_id = public.actor_id());
DROP POLICY IF EXISTS booking_read ON public.bookings;
CREATE POLICY booking_read ON public.bookings FOR SELECT TO stayfinder_api USING(
  user_id = public.actor_id() OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=public.actor_id())
);
DROP POLICY IF EXISTS booking_insert ON public.bookings;
CREATE POLICY booking_insert ON public.bookings FOR INSERT TO stayfinder_api WITH CHECK(user_id = public.actor_id());
DROP POLICY IF EXISTS booking_update ON public.bookings;
CREATE POLICY booking_update ON public.bookings FOR UPDATE TO stayfinder_api
  USING(user_id = public.actor_id() OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=public.actor_id()))
  WITH CHECK(user_id = public.actor_id() OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=public.actor_id()));
DROP POLICY IF EXISTS booking_delete ON public.bookings;
CREATE POLICY booking_delete ON public.bookings FOR DELETE TO stayfinder_api USING(
  user_id = public.actor_id() OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=public.actor_id())
);
GRANT USAGE ON SCHEMA public TO stayfinder_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties, public.bookings TO stayfinder_api;

-- Private definer functions only expose a yes/no availability answer, never guest data.
-- They must see all reservations, including those hidden by the caller's RLS policy.
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
REVOKE ALL ON FUNCTION private.is_available(uuid,date,date) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO stayfinder_api;
GRANT EXECUTE ON FUNCTION private.is_available(uuid,date,date) TO stayfinder_api;

CREATE OR REPLACE FUNCTION private.guard_property() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.id<>OLD.id OR NEW.owner_id<>OLD.owner_id OR NEW.created_at<>OLD.created_at THEN
      RAISE EXCEPTION 'Boendets ägare och identitet kan inte ändras.' USING ERRCODE='P0001';
    END IF;
    IF EXISTS(SELECT 1 FROM public.bookings WHERE property_id=OLD.id AND status<>'cancelled' AND guests>NEW.max_guests) THEN
      RAISE EXCEPTION 'Kapaciteten får inte understiga antalet gäster i en aktiv bokning.' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_property() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_property ON public.properties;
CREATE TRIGGER guard_property BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION private.guard_property();

CREATE OR REPLACE FUNCTION private.guard_booking() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE p public.properties; actor uuid := public.actor_id();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Du måste logga in.' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN
    IF actor<>OLD.user_id AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=OLD.property_id AND owner_id=actor) THEN
      RAISE EXCEPTION 'Du saknar behörighet.' USING ERRCODE='42501';
    END IF;
    IF OLD.check_in < CURRENT_DATE THEN RAISE EXCEPTION 'En påbörjad bokning kan inte tas bort.' USING ERRCODE='P0001'; END IF;
    RETURN OLD;
  END IF;
  SELECT * INTO p FROM public.properties WHERE id=NEW.property_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boendet finns inte.' USING ERRCODE='23503'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.user_id<>actor OR NEW.status<>'pending' THEN
      RAISE EXCEPTION 'Bokningen måste tillhöra gästen och börja som väntande.' USING ERRCODE='42501';
    END IF;
  ELSE
    IF actor<>OLD.user_id AND actor<>p.owner_id THEN RAISE EXCEPTION 'Du saknar behörighet.' USING ERRCODE='42501'; END IF;
    IF NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR NEW.property_id<>OLD.property_id OR NEW.created_at<>OLD.created_at THEN
      RAISE EXCEPTION 'Bokningens identitet och ägare kan inte ändras.' USING ERRCODE='42501';
    END IF;
    IF OLD.status='cancelled' THEN RAISE EXCEPTION 'En avbokad bokning kan inte ändras.' USING ERRCODE='P0001'; END IF;
    IF OLD.check_in<CURRENT_DATE THEN RAISE EXCEPTION 'En påbörjad bokning kan inte ändras eller avbokas.' USING ERRCODE='P0001'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status='confirmed' AND (OLD.status<>'pending' OR p.owner_id<>actor) THEN
        RAISE EXCEPTION 'Bara värden kan bekräfta en väntande bokning.' USING ERRCODE='42501';
      END IF;
      IF NEW.status NOT IN ('confirmed','cancelled') THEN
        RAISE EXCEPTION 'Otillåten statusändring.' USING ERRCODE='P0001';
      END IF;
    END IF;
    IF actor<>OLD.user_id AND (NEW.email,NEW.guests,NEW.check_in,NEW.check_out) IS DISTINCT FROM (OLD.email,OLD.guests,OLD.check_in,OLD.check_out) THEN
      RAISE EXCEPTION 'Bara gästen kan ändra bokningsuppgifter.' USING ERRCODE='42501';
    END IF;
    NEW.total_price := OLD.total_price;
  END IF;
  IF NEW.check_in<CURRENT_DATE THEN RAISE EXCEPTION 'Incheckningen får inte ligga i det förflutna.' USING ERRCODE='P0001'; END IF;
  IF NEW.guests>p.max_guests THEN RAISE EXCEPTION 'För många gäster för detta boende.' USING ERRCODE='P0001'; END IF;
  IF TG_OP='INSERT' THEN
    NEW.total_price := (NEW.check_out-NEW.check_in)::bigint * p.price_per_night;
  ELSIF (NEW.check_in,NEW.check_out) IS DISTINCT FROM (OLD.check_in,OLD.check_out) THEN
    -- Recalculate using the original nightly rate; later property price changes do not affect this booking.
    NEW.total_price := (NEW.check_out-NEW.check_in)::bigint * (OLD.total_price/(OLD.check_out-OLD.check_in));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_booking() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_booking ON public.bookings;
CREATE TRIGGER guard_booking BEFORE INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.guard_booking();
COMMIT;
