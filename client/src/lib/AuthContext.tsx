import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, login as apiLogin } from '../api/auth';
import type { Role, User } from '../types/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  role: Role | null;
  isOwner: boolean;
  isStaff: boolean;
  isLoading: boolean;
  can: (permissionId: string) => boolean;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => void;
  quickSwitch: (username: string, pin: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'wm_auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setToken(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await getMe();
        setUser(currentUser);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (username: string, pin: string) => {
    setIsLoading(true);
    try {
      const res = await apiLogin(username, pin);
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const quickSwitch = async (username: string, pin: string) => {
    await login(username, pin);
  };

  const refreshUser = async () => {
    try {
      const freshUser = await getMe();
      setUser(freshUser);
    } catch {
      // ignore
    }
  };

  const isOwner = user?.role === 'PEMILIK';
  const isStaff = user?.role === 'STAF';

  const can = (permissionId: string): boolean => {
    if (!user) return false;
    if (user.role === 'PEMILIK') return true;
    return user.permissions ? user.permissions.includes(permissionId) : false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role ?? null,
        isOwner,
        isStaff,
        isLoading,
        can,
        login,
        logout,
        quickSwitch,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
