import 'server-only';
import { cookies } from 'next/headers';
import { app } from '@stayfinder/backend/app';
import { readResponse } from './api';
// Serverkomponenter anropar Hono direkt och skickar besökarens cookies vidare. Det undviker en extra HTTP-runda till den egna webbplatsen.
export async function serverApi<T>(path: string): Promise<T> {
  return readResponse<T>(
    await app.request(path, {
      headers: { Cookie: (await cookies()).toString() },
    }),
  );
}
