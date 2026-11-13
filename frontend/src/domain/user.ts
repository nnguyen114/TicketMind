export const USER_ROLES = ['USER', 'AGENT', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Staff see every ticket; a USER only ever sees their own. */
export function isStaff(role: UserRole | undefined | null): boolean {
  return role === 'AGENT' || role === 'ADMIN';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  USER: 'Submitter',
  AGENT: 'Agent',
  ADMIN: 'Admin',
};

/** "Maya Chen" → "MC", for the avatar button. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
