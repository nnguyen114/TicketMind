import { z } from 'zod';
import { apiFetch } from './client';
import { tokenStore } from './tokenStore';
import { USER_ROLES } from '@/domain/user';

const userRoleSchema = z.enum(USER_ROLES);
export type { UserRole } from '@/domain/user';

const authenticatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: userRoleSchema,
});

// Mirrors the backend's TokenResponse record. A field that drifts out of step
// makes parse() throw on an otherwise successful login, which surfaces as a
// generic error in the UI, so change both sides together. MSW fixtures follow
// this shape and cannot catch a mismatch on their own.
const authResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.string(),
  expiresAt: z.string(),
  user: authenticatedUserSchema,
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

function handleAuthPayload(payload: unknown): AuthResponse {
  const parsed = authResponseSchema.parse(payload);
  tokenStore.set(parsed.accessToken);
  return parsed;
}

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const payload = await apiFetch<unknown>('/auth/login', {
    method: 'POST',
    body: request,
    skipAuth: true,
  });
  return handleAuthPayload(payload);
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  const payload = await apiFetch<unknown>('/auth/register', {
    method: 'POST',
    body: request,
    skipAuth: true,
  });
  return handleAuthPayload(payload);
}

export async function silentRefresh(): Promise<AuthResponse | null> {
  try {
    const payload = await apiFetch<unknown>('/auth/refresh', {
      method: 'POST',
      skipAuth: true,
    });
    return handleAuthPayload(payload);
  } catch {
    tokenStore.clear();
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<unknown>('/auth/logout', { method: 'POST' });
  } finally {
    tokenStore.clear();
  }
}
