import { notFound } from 'next/navigation';
import type { Property } from '@stayfinder/shared';
import { serverApi } from '@/lib/server-api';
import { ApiFailure } from '@/lib/api';
import { PropertyForm } from '@/components/PropertyForm';
// Hämtar boendet till redigeringsformuläret, som kontrollerar att besökaren är värden.
export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let property: Property;
  try {
    property = await serverApi<Property>(`/properties/${id}`);
  } catch (e) {
    // Ogiltigt eller saknat boende leder till 404-vyn. Andra fel lämnas till sidans felgräns.
    if (e instanceof ApiFailure && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
  return (
    <main className="form-page">
      <PropertyForm property={property} />
    </main>
  );
}
