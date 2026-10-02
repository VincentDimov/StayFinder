// Visar en tillgänglig laddningsvy medan Next.js väntar på sidans serverdata.
export default function Loading() {
  return (
    <main className="section" role="status">
      <span className="eyebrow">SNART ÄR DU FRAMME</span>
      <h1 className="page-title">Hittar din nästa paus…</h1>
      <div className="property-grid">
        {[1, 2, 3].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    </main>
  );
}
