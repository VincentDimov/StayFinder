import { z } from 'zod';
// Kontrollerar att resurs-ID:n är giltiga UUID innan de används i SQL.
export const uuid = z.uuid();
// Accepterar kalenderdatum i ISO-format, YYYY-MM-DD.
const date = z.iso.date();
// Kräver en incheckning och en senare utcheckning; ISO-datum kan jämföras som strängar.
export const period = z
  .object({ check_in: date, check_out: date })
  .refine((v) => v.check_out > v.check_in, {
    message: 'Utcheckning måste vara efter incheckning.',
    path: ['check_out'],
  });
// Validerar e-post och lösenordslängd och normaliserar e-postadressen till gemener.
export const credentials = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
// Registrering använder samma kontoregler och kräver dessutom ett namn.
export const registration = credentials.extend({ name: z.string().trim().min(2).max(80) });
// Tillåter endast boendets redigerbara fält med gränser för text, heltalspris och kapacitet.
export const propertyInput = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(3000),
  location: z.string().trim().min(2).max(100),
  price_per_night: z.number().int().min(1).max(1000000),
  max_guests: z.number().int().min(1).max(100),
});
// Validerar bokningens kontaktuppgifter, gästantal och datum. Ägare, status och pris bestäms på servern.
export const bookingInput = z
  .object({
    email: z.email().max(254),
    guests: z.number().int().min(1).max(100),
    check_in: date,
    check_out: date,
  })
  .refine((v) => v.check_out > v.check_in, {
    message: 'Utcheckning måste vara efter incheckning.',
    path: ['check_out'],
  });
// Klienten får begära bekräftelse eller avbokning; databasen kontrollerar vem som får göra övergången.
export const statusInput = z.object({ status: z.enum(['confirmed', 'cancelled']) });
// Omvandlar URL-parametrarnas siffror, begränsar sorteringsvalen och kontrollerar att en sökperiod har båda datumen.
export const filters = z
  .object({
    location: z.string().trim().max(100).optional(),
    max_price: z.coerce.number().int().min(1).max(1000000).optional(),
    guests: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.enum(['price_asc', 'price_desc']).default('price_asc'),
    check_in: date.optional(),
    check_out: date.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.check_in || value.check_out) &&
      (!value.check_in || !value.check_out || value.check_out <= value.check_in)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Ange en giltig in- och utcheckning.',
        path: ['check_out'],
      });
  });
