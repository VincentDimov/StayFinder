import { z } from 'zod';
export const uuid = z.uuid();
const date = z.iso.date();
export const period = z
  .object({ check_in: date, check_out: date })
  .refine((v) => v.check_out > v.check_in, {
    message: 'Utcheckning måste vara efter incheckning.',
    path: ['check_out'],
  });
export const credentials = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
export const registration = credentials.extend({ name: z.string().trim().min(2).max(80) });
export const propertyInput = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(3000),
  location: z.string().trim().min(2).max(100),
  price_per_night: z.number().int().min(1).max(1000000),
  max_guests: z.number().int().min(1).max(100),
});
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
export const statusInput = z.object({ status: z.enum(['confirmed', 'cancelled']) });
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
