import { BookingList } from '@/components/BookingList';
// Visar bokningslistan som hämtar sessionsanvändarens bokningar på klienten.
export default function Bookings() {
  return (
    <main className="section">
      <span className="eyebrow">DINA PLANER, PÅ ETT STÄLLE</span>
      <h1 className="page-title">Nästa paus & dina gäster.</h1>
      <p>Hantera egna resor och bokningar för de boenden du delar.</p>
      <BookingList />
    </main>
  );
}
