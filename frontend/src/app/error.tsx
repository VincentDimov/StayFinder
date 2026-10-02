'use client';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
// Visar ett felmeddelande och en återförsöksknapp när ett fel når Next.js felgräns.
export default function ErrorView({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  // Uppdaterar serverdata och återställer felgränsen inom en React-transition.
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
