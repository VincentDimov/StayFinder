'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { errorMessage } from '@/lib/api';
// Anpassar navigationen efter sessionen och visar inloggning eller användarens boende- och bokningslänkar.
export function Nav() {
  const { user, logout } = useAuth();
  const [error, setError] = useState('');
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" href="/" aria-label="StayFinder startsida">
          <span className="brand-symbol">⌂</span> stayfinder<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Huvudmeny">
          <Link href="/properties">Hitta boende</Link>
          {/* Visar kontolänkar och utloggning för inloggade besökare; annars visas inloggning och registrering. */}
          {user ? (
            <>
              <Link href="/properties/new">Bli värd</Link>
              <Link href="/bookings">Mina bokningar</Link>
              <span className="user-name">Hej, {user.name.split(' ')[0]}</span>
              <button
                className="button small secondary"
                onClick={() => {
                  void logout().catch((e) => setError(errorMessage(e)));
                }}
              >
                Logga ut
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Logga in</Link>
              <Link className="button small" href="/register">
                Skapa konto ↗
              </Link>
            </>
          )}
        </nav>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </header>
  );
}
