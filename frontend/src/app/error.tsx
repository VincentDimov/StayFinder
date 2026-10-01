'use client';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
export default function ErrorView({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }
  return (
    <main className="section empty">
      <h1>Vi kunde inte hämta uppgifterna.</h1>
      <p>Kontrollera att API:t och databasen är igång. Försök sedan igen.</p>
      <button className="button" onClick={retry}>
        Försök igen ↗
      </button>
    </main>
  );
}
