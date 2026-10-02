'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@stayfinder/shared';
import { api } from '@/lib/api';
// Beskriver det delade inloggningstillståndet och funktionerna för att uppdatera eller avsluta sessionen.
type Auth = {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
};
// Gör sessionsuppgifterna tillgängliga för alla komponenter under AuthProvider.
const AuthContext = createContext<Auth | null>(null);
// Startar klientens användartillstånd från den session som serverns layout redan har verifierat.
export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  // Synkroniserar klienten när en uppdaterad serverlayout verifierat sessionen på nytt,
  // exempelvis efter att sessionen löpt ut eller en anslutning återhämtat sig.
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);
  const router = useRouter();
  // Återkallar sessionen via API:t, tömmer klientens användare och uppdaterar startsidans serverdata.
  async function logout() {
    await api<void>('/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
    router.refresh();
  }
  // Delar användaren och sessionsfunktionerna med sidans underkomponenter.
  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>;
}
// Läser sessionskontexten och upptäcker om en komponent placerats utanför AuthProvider.
export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider saknas.');
  return auth;
}
