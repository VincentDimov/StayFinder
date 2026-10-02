import Link from 'next/link';
// Visar en 404-vy och hjälper besökaren tillbaka till boendelistan.
export default function NotFound() {
  return (
    <main className="section empty">
      <span className="eyebrow">404 · EN LITEN OMVÄG</span>
      <h1>Den här platsen finns inte.</h1>
      <p>Boendet kan ha tagits bort. Det finns fler platser att upptäcka.</p>
      <Link className="button" href="/properties">
        Hitta ett annat boende ↗
      </Link>
    </main>
  );
}
