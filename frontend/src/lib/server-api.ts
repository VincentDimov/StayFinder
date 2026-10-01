import 'server-only';
import { cookies } from 'next/headers';
import { api } from './api';
export async function serverApi<T>(path: string): Promise<T> {
  return api<T>(path, { headers: { Cookie: (await cookies()).toString() } });
}
