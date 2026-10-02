'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { type Booking, type Property, money } from '@stayfinder/shared';
import { useAuth } from './AuthProvider';
import { api, errorMessage } from '@/lib/api';
import { BookingForm } from './BookingForm';
// Översätter databasens statusvärden till svenska etiketter.
const statuses = { pending: 'Väntande', confirmed: 'Bekräftad', cancelled: 'Avbokad' };
// Visar användarens bokningar, antingen alla eller de som hör till ett valt boende. RLS begränsar svaret.
export function BookingList({ propertyId }: { propertyId?: string }) {
  const { user } = useAuth();
  // Håller listan, laddningsläget, fel, öppen redigering och den bokning vars åtgärd pågår i lokalt tillstånd.
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ booking: Booking; property: Property } | null>(null);
  const [busy, setBusy] = useState('');
  // Hämtar bokningar med sessionscookien och återställer laddningsläget även vid fel.
  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setBookings(
        await api<Booking[]>('/bookings' + (propertyId ? '?property_id=' + propertyId : '')),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [user, propertyId]);
  // Hämtar listan igen när användaren eller boendefiltret ändras.
  useEffect(() => {
    void load();
  }, [load]);
  // Öppnar redigering eller skickar statusändring/borttagning och läser sedan in den uppdaterade listan.
  async function action(booking: Booking, kind: 'confirmed' | 'cancelled' | 'delete' | 'edit') {
    if (kind === 'delete' && !window.confirm('Vill du ta bort bokningen?')) return;
    setBusy(booking.id);
    setError('');
    try {
      // Redigeringsformuläret behöver även boendets kapacitet och prisuppgifter.
      if (kind === 'edit') {
        setEditing({
          booking,
          property: await api<Property>(`/properties/${booking.property_id}`),
        });
      } else {
        await api<Booking | void>(
          `/bookings/${booking.id}` + (kind === 'delete' ? '' : '/status'),
          {
            method: kind === 'delete' ? 'DELETE' : 'PATCH',
            ...(kind === 'delete' ? {} : { body: JSON.stringify({ status: kind }) }),
          },
        );
        await load();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  }
  if (!user)
    return (
      <p>
        <Link href="/login">Logga in</Link> för att se och hantera bokningar.
      </p>
    );
  return (
    <div aria-busy={loading}>
      {error ? (
        <p className="error" role="alert">
          {error}{' '}
          <button className="text-button" onClick={() => void load()}>
            Försök igen
          </button>
        </p>
      ) : null}
      {loading ? (
        <p role="status">Hämtar bokningar…</p>
      ) : bookings.length === 0 ? (
        <p className="empty">
          Här finns inga bokningar ännu. <Link href="/properties">Hitta din nästa paus ↗</Link>
        </p>
      ) : (
        <div className="bookings-grid">
          {bookings.map((b) => (
            <article className="panel booking-card" key={b.id}>
              <div className="booking-card-heading">
                <Link href={`/properties/${b.property_id}`}>
                  <h3>{b.property_title ?? 'Boende'}</h3>
                </Link>
                <span className={`status ${b.status}`}>{statuses[b.status]}</span>
              </div>
              <p>
                {b.check_in} → {b.check_out}
              </p>
              <p>
                {b.guests} gäster · {money(b.total_price)}
              </p>
              <p className="muted">{b.email}</p>
              {/* Knappvalen beror på gäst, värd och status. Databasen avgör dessutom vilka åtgärder som är tillåtna. */}
              <div className="actions">
                {b.status !== 'cancelled' ? (
                  <>
                    {b.user_id === user.id ? (
                      <button
                        disabled={busy === b.id}
                        className="button small secondary"
                        onClick={() => void action(b, 'edit')}
                      >
                        Ändra
                      </button>
                    ) : null}
                    {b.owner_id === user.id && b.status === 'pending' ? (
                      <button
                        disabled={busy === b.id}
                        className="button small"
                        onClick={() => void action(b, 'confirmed')}
                      >
                        Bekräfta
                      </button>
                    ) : null}
                    <button
                      disabled={busy === b.id}
                      className="button small secondary"
                      onClick={() => void action(b, 'cancelled')}
                    >
                      Avboka
                    </button>
                  </>
                ) : null}
                <button
                  disabled={busy === b.id}
                  className="button small danger"
                  onClick={() => void action(b, 'delete')}
                >
                  Ta bort
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {/* Öppnar samma bokningsformulär med befintliga värden och laddar om listan efter sparande. */}
      {editing ? (
        <section className="edit-booking">
          <h2>Ändra bokning</h2>
          <button className="text-button" onClick={() => setEditing(null)}>
            Stäng redigering ×
          </button>
          <BookingForm
            key={editing.booking.id}
            property={editing.property}
            booking={editing.booking}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
