'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type Property } from '@stayfinder/shared';
import { useAuth } from './AuthProvider';
import { api, errorMessage } from '@/lib/api';
// Visar värdens åtgärder för ett boende och hanterar borttagning med bekräftelse.
export function PropertyActions({ property }: { property: Property }) {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (user?.id !== property.owner_id) return null;
  // Tar bort boendet via API:t och återgår till listan; API-fel visas om exempelvis bokningar blockerar borttagningen.
  async function remove() {
    if (!window.confirm('Vill du ta bort boendet?')) return;
    // Markerar att anropet pågår så att användaren inte skickar samma åtgärd flera gånger.
    setPending(true);
    try {
      await api<void>(`/properties/${property.id}`, { method: 'DELETE' });
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
    <div className="owner-actions">
      <Link className="button secondary small" href={`/properties/${property.id}/edit`}>
        Ändra boende
      </Link>
      <button className="button danger small" disabled={pending} onClick={() => void remove()}>
        Ta bort boende
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
