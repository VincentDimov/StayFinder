'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@stayfinder/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from './AuthProvider';
// Återanvänder samma formulär för registrering och inloggning genom flaggan register.
export function AuthForm({ register = false }: { register?: boolean }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { setUser } = useAuth();
  const router = useRouter();
  // Skickar formuläret till rätt kontorutt, uppdaterar användarkontexten och visar fel om anropet misslyckas.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Markerar att anropet pågår så att användaren inte skickar samma åtgärd flera gånger.
    setPending(true);
    setError('');
    // Läser namngivna formulärfält som ett objekt som kan skickas som JSON.
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      setUser(
        await api<User>(register ? '/auth/register' : '/auth/login', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      );
      router.push('/properties');
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
    <form onSubmit={submit} className="panel form-stack">
      <span className="eyebrow">DIN NÄSTA RESA BÖRJAR HÄR</span>
      <h1>{register ? 'Välkommen till StayFinder' : 'Välkommen tillbaka'}</h1>
      <p>
        {register
          ? 'Skapa ett konto för att boka boenden och dela din egen plats.'
          : 'Logga in för att planera nästa paus.'}
      </p>
      {/* Namn behövs bara när ett nytt konto skapas. */}
      {register ? (
        <label>
          Namn
          <input name="name" autoComplete="name" minLength={2} maxLength={80} required />
        </label>
      ) : null}
      <label>
        E-post
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Lösenord
        <input
          name="password"
          type="password"
          minLength={10}
          maxLength={128}
          autoComplete={register ? 'new-password' : 'current-password'}
          required
        />
        <small>Minst 10 tecken.</small>
      </label>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button" disabled={pending}>
        {pending ? 'Ett ögonblick…' : register ? 'Skapa konto' : 'Logga in'} ↗
      </button>
      <p>
        {register ? 'Har du redan ett konto?' : 'Ny här?'}{' '}
        <Link href={register ? '/login' : '/register'}>
          {register ? 'Logga in' : 'Skapa konto'}
        </Link>
      </p>
    </form>
  );
}
