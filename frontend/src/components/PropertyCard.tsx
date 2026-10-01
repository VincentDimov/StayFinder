import Link from 'next/link';
import Image from 'next/image';
import { money, type Property } from '@stayfinder/shared';
export function PropertyCard({ property, index = 0 }: { property: Property; index?: number }) {
  return (
    <Link href={`/properties/${property.id}`} className="property-card">
      <div className={`property-image scene-${index % 6}`}>
        <Image
          src="/cabin.svg"
          alt={`Illustration av ett boende i ${property.location}`}
          width={600}
          height={420}
          loading={index < 3 ? 'eager' : 'lazy'}
        />
        <span className="property-badge">{property.max_guests} gäster</span>
        <span className="card-arrow" aria-hidden="true">
          ↗
        </span>
      </div>
      <div className="card-meta">
        <span>{property.location}</span>
        <span>Eget boende</span>
      </div>
      <h3>{property.title}</h3>
      <p className="card-price">
        {money(property.price_per_night)} <span>/ natt</span>
      </p>
    </Link>
  );
}
