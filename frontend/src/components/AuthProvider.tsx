'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@stayfinder/shared';
import { api } from '@/lib/api';
type Auth = {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  // A refreshed server layout carries a freshly verified session. Keep the
  // client context in sync after recovery or session expiry.
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);
  const router = useRouter();
  async function logout() {
    await api<void>('/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
    router.refresh();
  }
  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider saknas.');
  return auth;
}
