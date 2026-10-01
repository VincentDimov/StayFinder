'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Property, type Booking, type BookingInput, nights, money } from '@stayfinder/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from './AuthProvider';
export function BookingForm({
  property,
  booking,
  onSaved,
}: {
  property: Property;
  booking?: Booking;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [start, setStart] = useState(booking?.check_in ?? '');
  const [end, setEnd] = useState(booking?.check_out ?? '');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const count = nights(start, end);
  const rate = booking
    ? booking.total_price / nights(booking.check_in, booking.check_out)
    : property.price_per_night;
  const dateError = start && end && end <= start ? 'Utcheckning måste vara efter incheckning.' : '';
  if (!user)
    return (
      <div className="panel">
        <h2>Gör plats för en paus.</h2>
        <p>Logga in för att boka detta boende.</p>
        <Link className="button" href="/login">
          Logga in och boka ↗
        </Link>
      </div>
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const data: BookingInput = {
      email: String(form.get('email')),
      guests: Number(form.get('guests')),
      check_in: start,
      check_out: end,
    };
    try {
      await api<Booking>(
        booking ? `/bookings/${booking.id}` : `/properties/${property.id}/bookings`,
        { method: booking ? 'PUT' : 'POST', body: JSON.stringify(data) },
      );
      if (onSaved) onSaved();
      else router.push('/bookings');
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="panel form-stack booking-form" onSubmit={submit}>
      <h2>
        {booking ? (
          'Ändra bokning'
        ) : (
          <>
            {' '}
            {money(rate)} <small>/ natt</small>
          </>
        )}
      </h2>
      <div className="form-row">
        <label>
          Incheckning
          <input
            name="check_in"
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Utcheckning
          <input
            name="check_out"
            type="date"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {dateError ? (
        <p className="error" role="alert">
          {dateError}
        </p>
      ) : null}
      <label>
        Antal gäster
        <input
          name="guests"
          type="number"
          min="1"
          max={property.max_guests}
          required
          defaultValue={booking?.guests ?? 1}
        />
      </label>
      <label>
        E-post för bokningen
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={booking?.email ?? user.email}
        />
      </label>
      <div className="price-summary">
        <span>
          {count} {count === 1 ? 'natt' : 'nätter'} × {money(rate)}
        </span>
        <strong>{money(count * rate)}</strong>
      </div>
      <small>
        Priset fastställs på servern. Incheckningsdagen ingår; utcheckningsdagen ingår inte.
      </small>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button" disabled={pending || count === 0}>
        {pending ? 'Sparar…' : booking ? 'Spara bokning' : 'Boka din paus'} ↗
      </button>
    </form>
  );
}
