import { PropertyForm } from '@/components/PropertyForm';
// Öppnar boendeformuläret utan befintliga uppgifter så att ett nytt boende kan skapas.
export default function NewProperty() {
  return (
    <main className="form-page">
      <PropertyForm />
    </main>
  );
}
