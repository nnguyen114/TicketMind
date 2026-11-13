import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeActive,
  changeRole,
  listAllUsers,
  unlockUser,
  userKeys,
  type AdminUser,
} from '@/api/users';
import { useAuth } from '@/auth/useAuth';
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/domain/user';
import { Icon } from '@/components/icons';
import { Button, ErrorText } from '@/components/ui';
import { formatError } from '@/lib/errorMessages';
import { useApiMutation } from '@/hooks/useApiMutation';

/**
 * Accounts, roles and lockouts. The guards the backend enforces (the last
 * active admin, deactivating yourself) are drawn as disabled controls with the
 * reason beside them, rather than discovered as an error after the click.
 */
export function AdminUsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: userKeys.all, queryFn: listAllUsers });
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['users'] });
  };
  const role = useApiMutation<unknown, { id: string; role: UserRole }>({
    mutationFn: ({ id, role: next }) => changeRole(id, next),
    onSuccess: refresh,
  });
  const active = useApiMutation<unknown, { id: string; active: boolean }>({
    mutationFn: ({ id, active: next }) => changeActive(id, next),
    onSuccess: () => {
      setConfirming(null);
      refresh();
    },
  });
  const unlock = useApiMutation<unknown, string>({ mutationFn: unlockUser, onSuccess: refresh });
  const error = role.errorMessage ?? active.errorMessage ?? unlock.errorMessage;

  const all = users.data ?? [];
  const activeAdmins = all.filter((u) => u.role === 'ADMIN' && u.active);
  const isLastAdmin = (u: AdminUser) => u.role === 'ADMIN' && u.active && activeAdmins.length === 1;
  const needle = search.trim().toLowerCase();
  // ponytail: filters the full list client-side; move to a server query once
  // accounts number in the thousands.
  const shown = needle
    ? all.filter(
        (u) =>
          u.displayName.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
      )
    : all;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-6 py-7">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-[22px] font-bold">Users</h1>
        <label className="flex w-80 max-w-full items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-zinc-500 focus-within:ring-2 focus-within:ring-brand-600">
          <Icon name="search" />
          <span className="sr-only">Search users</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email"
            className="min-w-0 flex-1 bg-transparent text-zinc-900 outline-none"
          />
        </label>
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {users.isPending ? (
        <p className="text-zinc-500">Loading users…</p>
      ) : users.isError ? (
        <ErrorText>{formatError(users.error)}</ErrorText>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs font-semibold text-zinc-600">
                <th className="border-b border-zinc-200 px-4 py-2.5">Name</th>
                <th className="border-b border-zinc-200 px-4 py-2.5">Email</th>
                <th className="border-b border-zinc-200 px-4 py-2.5">Role</th>
                <th className="border-b border-zinc-200 px-4 py-2.5">Active</th>
                <th className="border-b border-zinc-200 px-4 py-2.5">Sign-in</th>
                <th className="border-b border-zinc-200 px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                    No users match “{search}”.
                  </td>
                </tr>
              ) : null}
              {shown.map((u) => {
                const lastAdmin = isLastAdmin(u);
                const self = u.id === me?.id;
                const cell = 'border-b border-zinc-100 px-4 py-3 align-middle';
                return (
                  <tr key={u.id} className={confirming === u.id ? 'bg-zinc-50' : ''}>
                    <td className={`${cell} font-semibold ${u.active ? '' : 'text-zinc-600'}`}>
                      {u.displayName}
                    </td>
                    <td className={`${cell} ${u.active ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {u.email}
                    </td>
                    <td className={cell}>
                      <div className="flex flex-col gap-1">
                        <select
                          aria-label={`Role for ${u.displayName}`}
                          value={u.role}
                          disabled={lastAdmin || role.mutation.isPending}
                          title={lastAdmin ? 'At least one admin is required.' : undefined}
                          onChange={(event) =>
                            role.mutation.mutate({ id: u.id, role: event.target.value as UserRole })
                          }
                          className="w-36 rounded-md border border-zinc-300 bg-white px-2 py-1.5 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-600"
                        >
                          {USER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        {lastAdmin ? (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                            <Icon name="info" size={12} />
                            At least one admin is required.
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {confirming === u.id ? (
                      <td colSpan={3} className={cell}>
                        <div
                          role="alertdialog"
                          aria-label={`Confirm deactivating ${u.displayName}`}
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5"
                        >
                          <div className="flex-[1_1_260px]">
                            <p className="font-semibold text-red-800">
                              Deactivate {u.displayName}?
                            </p>
                            <p className="text-[13px] text-zinc-700">
                              They’ll be signed out within 15 minutes.
                            </p>
                          </div>
                          <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={active.mutation.isPending}
                            onClick={() => active.mutation.mutate({ id: u.id, active: false })}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className={cell}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={u.active}
                            aria-label={`${u.displayName} active`}
                            disabled={
                              (u.active && (lastAdmin || self)) || active.mutation.isPending
                            }
                            title={
                              u.active && self
                                ? 'You cannot deactivate yourself.'
                                : u.active && lastAdmin
                                  ? 'At least one admin is required.'
                                  : undefined
                            }
                            onClick={() =>
                              u.active
                                ? setConfirming(u.id)
                                : active.mutation.mutate({ id: u.id, active: true })
                            }
                            className={`flex h-6 w-10 rounded-full p-0.5 disabled:cursor-not-allowed ${
                              u.active
                                ? 'justify-end bg-brand-600 disabled:bg-[#93A6E0]'
                                : 'justify-start bg-zinc-400'
                            }`}
                          >
                            <span className="size-5 rounded-full bg-white" />
                          </button>
                        </td>
                        <td className={cell}>
                          {!u.active ? (
                            <span className="text-zinc-600">Deactivated</span>
                          ) : u.locked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                              <Icon name="lock" size={12} />
                              Locked
                            </span>
                          ) : (
                            <span className="text-zinc-600">OK</span>
                          )}
                        </td>
                        <td className={cell}>
                          {u.active && u.locked ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={unlock.mutation.isPending}
                              onClick={() => unlock.mutation.mutate(u.id)}
                            >
                              Unlock
                            </Button>
                          ) : null}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
