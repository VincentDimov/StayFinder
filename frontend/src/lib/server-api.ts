import 'server-only';
import { cookies } from 'next/headers';
import { app } from '@stayfinder/backend/app';
import { readResponse } from './api';
export async function serverApi<T>(path: string): Promise<T> {
  return readResponse<T>(
    await app.request(path, {
      headers: { Cookie: (await cookies()).toString() },
    }),
  );
}
