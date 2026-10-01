export type User = { id: string; email: string; name: string };
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
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
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
export type PropertyInput = Pick<
  Property,
  'title' | 'description' | 'location' | 'price_per_night' | 'max_guests'
>;
export type BookingInput = Pick<Booking, 'email' | 'guests' | 'check_in' | 'check_out'>;
export type ApiError = { error: string; code: string; fields?: Record<string, string[]> };
export function nights(start: string, end: string): number {
  const difference = (Date.parse(end) - Date.parse(start)) / 86400000;
  return Number.isFinite(difference) && difference > 0 ? difference : 0;
}
export const money = (value: number): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(value);
