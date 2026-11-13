export const USER_ROLES = ['USER', 'AGENT', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Staff see every ticket; a USER only ever sees their own. */
export function isStaff(role: UserRole | undefined | null): boolean {
  return role === 'AGENT' || role === 'ADMIN';
}
