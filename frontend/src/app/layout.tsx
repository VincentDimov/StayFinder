import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import type { User } from '@stayfinder/shared';
import { serverApi } from '@/lib/server-api';
import { AuthProvider } from '@/components/AuthProvider';
import { Nav } from '@/components/Nav';
import './globals.css';
export const metadata: Metadata = {
  title: 'StayFinder · Hitta din nästa paus',
  description: 'Hitta och boka personliga boenden i Sverige.',
};
export default async function RootLayout({ children }: { children: ReactNode }) {
  let user: User | null = null;
  try {
    user = (await serverApi<{ user: User | null }>('/auth/me')).user;
  } catch {
    /* Pages show the API error; navigation stays usable. */
  }
  return (
    <html lang="sv">
      <body>
        <AuthProvider initialUser={user}>
          <Nav />
          {children}
          <footer>
            <span className="brand">stayfinder.</span>
            <p>Små pauser. Stora minnen.</p>
            <span>Byggt för att hitta hem, någon annanstans.</span>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
