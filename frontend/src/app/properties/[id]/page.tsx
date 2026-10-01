import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Property } from '@stayfinder/shared';
import { serverApi } from '@/lib/server-api';
import { ApiFailure } from '@/lib/api';
import { BookingForm } from '@/components/BookingForm';
import { PropertyActions } from '@/components/PropertyActions';
import { BookingList } from '@/components/BookingList';
export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let property: Property;
  try {
    property = await serverApi<Property>(`/properties/${id}`);
  } catch (e) {
    if (e instanceof ApiFailure && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
  return (
    <main className="section">
      <Link className="back-link" href="/properties">
        ← Alla boenden
      </Link>
      <span className="eyebrow">{property.location}</span>
      <h1 className="page-title">{property.title}</h1>
      <div className="detail-art">
        <Image
          src="/cabin.svg"
          alt={`Illustration av ${property.title}`}
          fill
          sizes="90vw"
          priority
        />
        <span>En plats för upp till {property.max_guests} gäster</span>
      </div>
      <div className="detail-grid">
        <section>
          <h2>Välkommen till ditt nästa andrum.</h2>
          <p className="description">{property.description}</p>
          <div className="amenities">
            <span>⌂ Eget boende</span>
            <span>♧ {property.location}</span>
            <span>☀ Upp till {property.max_guests} gäster</span>
          </div>
          <PropertyActions property={property} />
        </section>
        <BookingForm property={property} />
      </div>
      <section className="booking-section">
        <h2>Bokningar för detta boende</h2>
        <p>Som gäst ser du dina egna bokningar. Som värd ser du alla bokningar för ditt boende.</p>
        <BookingList propertyId={property.id} />
      </section>
    </main>
  );
}
