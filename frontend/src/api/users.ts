import { z } from 'zod';
import { apiFetch } from './client';
import { USER_ROLES, type UserRole } from '@/domain/user';

const staffMemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(USER_ROLES),
  active: z.boolean(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

const adminUserSchema = staffMemberSchema.extend({ locked: z.boolean() });
export type AdminUser = z.infer<typeof adminUserSchema>;

export const userKeys = {
  staff: ['users', 'staff'] as const,
  all: ['users', 'all'] as const,
};

/** Agents and admins, for the assignee picker. Staff only. */
export async function listStaff(): Promise<StaffMember[]> {
  return z.array(staffMemberSchema).parse(await apiFetch<unknown>('/users'));
}

/** Every account with its lock state. Admin only. */
export async function listAllUsers(): Promise<AdminUser[]> {
  return z.array(adminUserSchema).parse(await apiFetch<unknown>('/users/all'));
}

export async function changeRole(id: string, role: UserRole): Promise<void> {
  await apiFetch<unknown>(`/users/${id}/role`, { method: 'PATCH', body: { role } });
}

export async function changeActive(id: string, active: boolean): Promise<void> {
  await apiFetch<unknown>(`/users/${id}/active`, { method: 'PATCH', body: { active } });
}

export async function unlockUser(id: string): Promise<void> {
  await apiFetch<unknown>(`/users/${id}/unlock`, { method: 'POST' });
}
