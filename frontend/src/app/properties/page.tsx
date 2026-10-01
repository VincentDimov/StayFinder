import type { Property } from '@stayfinder/shared';
import { serverApi } from '@/lib/server-api';
import { PropertyCard } from '@/components/PropertyCard';
type Search = Record<string, string | string[] | undefined>;
export default async function Properties({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['location', 'max_price', 'guests', 'sort', 'check_in', 'check_out']) {
    const v = params[key];
    if (typeof v === 'string' && v) query.set(key, v);
  }
  const properties = await serverApi<Property[]>('/properties?' + query);
  const value = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  return (
    <main className="section">
      <span className="eyebrow">VART GÅR DIN NÄSTA RESA?</span>
      <h1 className="page-title">Hitta en plats att trivas på.</h1>
      <form className="filter-form" action="/properties">
        <label>
          Plats
          <input name="location" defaultValue={value('location')} placeholder="Alla platser" />
        </label>
        <label>
          Maxpris per natt
          <input
            name="max_price"
            type="number"
            min="1"
            defaultValue={value('max_price')}
            placeholder="SEK"
          />
        </label>
        <label>
          Gäster
          <input name="guests" type="number" min="1" max="100" defaultValue={value('guests')} />
        </label>
        <label>
          Incheckning
          <input name="check_in" type="date" defaultValue={value('check_in')} />
        </label>
        <label>
          Utcheckning
          <input name="check_out" type="date" defaultValue={value('check_out')} />
        </label>
        <label>
          Sortera
          <select name="sort" defaultValue={value('sort') || 'price_asc'}>
            <option value="price_asc">Lägst pris först</option>
            <option value="price_desc">Högst pris först</option>
          </select>
        </label>
        <button className="button" type="submit">
          Sök ↗
        </button>
      </form>
      <p className="result-count">{properties.length} boenden att upptäcka</p>
      <div className="property-grid">
        {properties.map((p, i) => (
          <PropertyCard key={p.id} property={p} index={i} />
        ))}
      </div>
      {!properties.length ? (
        <div className="empty">
          <h2>Ingen träff just nu</h2>
          <p>Prova en annan plats, fler datum eller ett högre maxpris.</p>
        </div>
      ) : null}
    </main>
  );
}
