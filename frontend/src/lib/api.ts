import type { ApiError } from '@stayfinder/shared';
export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
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
  if (!response.ok) {
    const data = (await response
      .json()
      .catch(() => ({ error: 'Servern kunde inte svara.' }))) as ApiError;
    throw new ApiFailure(data.error, response.status, data.fields);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
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
