import { createContext } from 'react';
import type { AuthResponse, AuthenticatedUser, LoginRequest, RegisterRequest } from '@/api/auth';

// 'expired': the session ended underneath a signed-in user (refresh failed).
// The user and the page stay put so a re-login keeps whatever they were typing.
export type AuthStatus = 'loading' | 'authenticated' | 'expired' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  login: (request: LoginRequest) => Promise<AuthResponse>;
  register: (request: RegisterRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
