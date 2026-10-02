import type { ApiError } from '@stayfinder/shared';
// Webbläsaren använder samma webbplats via /api om ingen annan API-adress har konfigurerats.
export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';
// Bevarar HTTP-status och fältfel i ett Error-objekt som formulären kan visa.
export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
// Skickar sessionscookies, undviker cache och anger JSON-format när anropet har en body.
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl + path, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  return readResponse<T>(response);
}
// Tolkar API-svaret, omvandlar misslyckade anrop till ApiFailure och hanterar tomma 204-svar.
export async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = (await response
      .json()
      .catch(() => ({ error: 'Servern kunde inte svara.' }))) as ApiError;
    throw new ApiFailure(data.error, response.status, data.fields);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
// Gör okända fel och API-fel till läsbara meddelanden med svenska namn på formulärfälten.
export function errorMessage(error: unknown): string {
  if (error instanceof ApiFailure && error.fields) {
    const labels: Record<string, string> = {
      email: 'E-post',
      guests: 'Antal gäster',
      check_in: 'Incheckning',
      check_out: 'Utcheckning',
      password: 'Lösenord',
      name: 'Namn',
      title: 'Titel',
      description: 'Beskrivning',
      location: 'Plats',
      price_per_night: 'Pris',
      max_guests: 'Max gäster',
    };
    return `${error.message} ${Object.entries(error.fields)
      .map(([key, value]) => `${labels[key] ?? key}: ${value.join(' ')}`)
      .join(' · ')}`;
  }
  return error instanceof Error ? error.message : 'Något gick fel. Försök igen.';
}
