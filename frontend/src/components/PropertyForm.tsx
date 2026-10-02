'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Property } from '@stayfinder/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from './AuthProvider';
// Skapar ett nytt boende eller fyller formuläret med ett befintligt boende för redigering.
export function PropertyForm({ property }: { property?: Property }) {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  // Visar en inloggningslänk när besökaren saknar session. API:t kontrollerar också behörigheten.
  if (!user)
    return (
      <div className="empty">
        <h1>Dela din plats</h1>
        <p>Logga in för att skapa och hantera dina boenden.</p>
        <Link className="button" href="/login">
          Logga in ↗
        </Link>
      </div>
    );
  // Visar bara redigeringsformuläret för boendets värd; RLS skyddar även direktanrop till API:t.
  if (property && property.owner_id !== user.id)
    return <p className="error">Du kan bara ändra dina egna boenden.</p>;
  // Skickar POST för ett nytt boende eller PUT för ett befintligt och öppnar därefter detaljsidan.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Markerar att anropet pågår så att användaren inte skickar samma åtgärd flera gånger.
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    // Omvandlar formulärets pris och gästantal från text till tal innan API-valideringen.
    const data = {
      title: form.get('title'),
      description: form.get('description'),
      location: form.get('location'),
      price_per_night: Number(form.get('price_per_night')),
      max_guests: Number(form.get('max_guests')),
    };
    try {
      const result = await api<Property>(property ? `/properties/${property.id}` : '/properties', {
        method: property ? 'PUT' : 'POST',
        body: JSON.stringify(data),
      });
      router.push(`/properties/${result.id}`);
      router.refresh();
    } catch (e) {
      // Översätter anropsfelet till ett meddelande som kan visas i formuläret.
      setError(errorMessage(e));
    } finally {
      // Återaktiverar knappen efter anropet, både vid framgång och vid fel.
      setPending(false);
    }
  }
  return (
    <form className="panel form-stack" onSubmit={submit}>
      <span className="eyebrow">ETT HEM ATT DELA</span>
      <h1>{property ? 'Ändra ditt boende' : 'Välkomna världen till din plats.'}</h1>
      <label>
        Titel
        <input name="title" required minLength={3} maxLength={100} defaultValue={property?.title} />
      </label>
      <label>
        Beskrivning
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={3000}
          rows={5}
          defaultValue={property?.description}
        />
      </label>
      <label>
        Plats
        <input
          name="location"
          required
          minLength={2}
          maxLength={100}
          defaultValue={property?.location}
        />
      </label>
      {/* Pris och kapacitet har samma grundgränser som backendens validering. */}
      <div className="form-row">
        <label>
          Pris per natt (SEK)
          <input
            type="number"
            name="price_per_night"
            min="1"
            max="1000000"
            required
            defaultValue={property?.price_per_night}
          />
        </label>
        <label>
          Max antal gäster
          <input
            type="number"
            name="max_guests"
            min="1"
            max="100"
            required
            defaultValue={property?.max_guests}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <button className="button" disabled={pending}>
        {pending ? 'Sparar…' : property ? 'Spara ändringar' : 'Publicera boende'} ↗
      </button>
    </form>
  );
}
