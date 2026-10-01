'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@stayfinder/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from './AuthProvider';
export function AuthForm({ register = false }: { register?: boolean }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { setUser } = useAuth();
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
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
      setError(errorMessage(e));
    } finally {
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
