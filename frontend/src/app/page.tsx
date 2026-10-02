import Link from 'next/link';
import Image from 'next/image';
import type { Property } from '@stayfinder/shared';
import { serverApi } from '@/lib/server-api';
import { PropertyCard } from '@/components/PropertyCard';
// Startsidan hämtar boenden på servern och visar sökning, utvalda kort och en länk för nya värdar.
export default async function Home() {
  const properties = await serverApi<Property[]>('/properties');
  return (
    <main>
      {/* Introducerar tjänsten med en huvudlänk till boenden och en prioriterad illustrationsbild. */}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">NÄRA BORTA. LÅNGT FRÅN VARDAGEN.</span>
          <h1>
            Hitta din
            <br />
            nästa <em>paus.</em>
          </h1>
          <p>
            En stuga vid sjön. Ett hem mitt i staden.
            <br />
            Upptäck platser att längta till och trivas i.
          </p>
          <Link className="button" href="/properties">
            Utforska våra boenden <span>↗</span>
          </Link>
          <div className="hero-note">
            <span>✦</span> Personliga platser, riktiga upplevelser
          </div>
        </div>
        <div className="hero-art">
          <Image
            src="/cabin.svg"
            alt="En röd stuga bland tallar vid en stilla sjö"
            fill
            priority
            sizes="(max-width: 700px) 100vw, 55vw"
          />
          <div className="hero-caption">
            <span>DITT NÄSTA ANDRUM</span>
            <strong>Lite närmare naturen.</strong>
          </div>
          <span className="art-label">STAY A LITTLE LONGER ↗</span>
        </div>
      </section>
      {/* Snabbsökningen skickar plats och gästantal som GET-parametrar till boendesidan. */}
      <section className="search-band">
        <form action="/properties" className="quick-search">
          <label>
            Vart vill du åka?
            <input name="location" placeholder="Stad, region eller favoritplats" />
          </label>
          <label>
            Antal gäster
            <input type="number" name="guests" min="1" max="100" placeholder="2" />
          </label>
          <button className="button" type="submit">
            Hitta boende ↗
          </button>
        </form>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">VÄLJ DIN EGEN TAKT</span>
            <h2>Platser för nästa kapitel</h2>
          </div>
          <Link href="/properties">Se alla boenden ↗</Link>
        </div>
        {/* Visar högst sex boenden från API-listan; varje kort länkar till sin detaljsida. */}
        <div className="property-grid">
          {properties.slice(0, 6).map((p, i) => (
            <PropertyCard key={p.id} property={p} index={i} />
          ))}
        </div>
        {properties.length === 0 ? (
          <p className="empty">
            Här kommer snart nya boenden. Skapa det första genom att bli värd.
          </p>
        ) : null}
      </section>
      {/* Länkar till formuläret där en inloggad användare kan skapa ett eget boende. */}
      <section className="host-banner">
        <div>
          <span className="eyebrow">HAR DU EN PLATS ATT DELA?</span>
          <h2>Öppna dörren för nya minnen.</h2>
          <p>Skapa ett boende och välkomna dina första gäster.</p>
        </div>
        <Link className="button" href="/properties/new">
          Bli värd ↗
        </Link>
      </section>
    </main>
  );
}
