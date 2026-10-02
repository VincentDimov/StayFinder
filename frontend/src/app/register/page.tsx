import { AuthForm } from '@/components/AuthForm';
// Visar kontoformuläret i registreringsläge med ett extra namnfält.
export default function Register() {
  return (
    <main className="form-page">
      <AuthForm register />
    </main>
  );
}
