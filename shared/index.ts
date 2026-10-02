// De offentliga kontouppgifterna som frontend och backend delar; lösenordshash ingår aldrig.
export type User = { id: string; email: string; name: string };
// Beskriver ett boende, dess värd, kapacitet och pris per natt.
export type Property = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  location: string;
  price_per_night: number;
  max_guests: number;
  created_at: string;
};
// Bokningens tre möjliga tillstånd används i både databasflödet och gränssnittet.
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
// Beskriver en bokning. Titel och värdens ID kan följa med när API:t kopplar ihop bokning och boende.
export type Booking = {
  id: string;
  property_id: string;
  user_id: string;
  email: string;
  guests: number;
  check_in: string;
  check_out: string;
  status: BookingStatus;
  total_price: number;
  created_at: string;
  property_title?: string;
  owner_id?: string;
};
// Plockar ut fälten som ett boendeformulär får skicka; ägarens ID bestäms av sessionen.
export type PropertyInput = Pick<
  Property,
  'title' | 'description' | 'location' | 'price_per_night' | 'max_guests'
>;
// Plockar ut bokningsuppgifterna som gästen kan ändra och utesluter pris, status och identitet.
export type BookingInput = Pick<Booking, 'email' | 'guests' | 'check_in' | 'check_out'>;
// Gemensamt format för API-fel med felkod och eventuella meddelanden för enskilda formulärfält.
export type ApiError = { error: string; code: string; fields?: Record<string, string[]> };
// Beräknar antal nätter mellan två ISO-datum och ger noll för en ogiltig eller tom period.
export function nights(start: string, end: string): number {
  const difference = (Date.parse(end) - Date.parse(start)) / 86400000;
  return Number.isFinite(difference) && difference > 0 ? difference : 0;
}
// Visar kronor enligt svenska formatregler utan decimaler.
export const money = (value: number): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(value);
