import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { initials, isStaff, ROLE_LABELS } from '@/domain/user';
import { formatError } from '@/lib/errorMessages';
import { Button, ErrorText } from '@/components/ui';
import { Icon } from '@/components/icons';

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-base font-bold text-zinc-900">
      <Icon name="ticket" size={22} className="text-brand-600" />
      TicketMind
    </span>
  );
}

const NAV_CLASS = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1.5 ${
    isActive ? 'bg-brand-50 font-semibold text-brand-800' : 'text-zinc-600 hover:text-zinc-900'
  }`;

export function AppShell() {
  const { user, status } = useAuth();

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-zinc-200 bg-white px-5 py-2.5">
        <Link to="/" className="hover:no-underline">
          <Logo />
        </Link>
        {isStaff(user?.role) ? (
          <nav aria-label="Main" className="flex gap-1">
            <NavLink to="/tickets" className={NAV_CLASS}>
              Queue
            </NavLink>
            {user?.role === 'ADMIN' ? (
              <NavLink to="/admin/users" className={NAV_CLASS}>
                Users
              </NavLink>
            ) : null}
          </nav>
        ) : null}
        {user ? <AccountMenu /> : null}
      </header>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      {status === 'expired' && user ? <SessionExpiredDialog email={user.email} /> : null}
    </div>
  );
}

/**
 * A disclosure, not an ARIA menu: one name, one button. It closes on Escape
 * and when focus or a click lands outside it.
 */
function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [open]);

  if (!user) return null;
  return (
    <div
      ref={rootRef}
      className="relative ml-auto"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={`Account menu for ${user.displayName}`}
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex size-9 items-center justify-center rounded-full bg-brand-800 text-[13px] font-semibold text-white"
      >
        {initials(user.displayName)}
      </button>
      <div
        id="account-menu"
        hidden={!open}
        className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg"
      >
        <p className="font-semibold" data-testid="current-user">
          {user.displayName}
        </p>
        <p className="text-xs text-zinc-600">
          {user.email} · {ROLE_LABELS[user.role]}
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            void logout();
          }}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}

/**
 * Shown over the current page when the session ends under a signed-in user.
 * The page underneath stays mounted, so an unsent reply survives the re-login.
 */
function SessionExpiredDialog({ email }: { email: string }) {
  const { login, logout } = useAuth();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expired-heading"
        className="flex w-full max-w-sm flex-col gap-3.5 rounded-xl bg-white p-6 shadow-2xl"
      >
        <h2 id="session-expired-heading" className="text-lg font-bold">
          Your session expired, sign in again
        </h2>
        <p className="text-[13px] text-zinc-600">
          Anything you were typing is kept and will be here when you’re back.
        </p>
        <form
          className="flex flex-col gap-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setPending(true);
            login({ email, password })
              .then(() => queryClient.invalidateQueries())
              .catch((cause: unknown) => setError(formatError(cause)))
              .finally(() => setPending(false));
          }}
        >
          <label htmlFor="session-password" className="font-semibold">
            Password for {email}
          </label>
          <input
            ref={inputRef}
            id="session-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 rounded-lg border border-zinc-300 px-3"
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button type="submit" disabled={pending || !password} className="min-h-11">
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <button
          type="button"
          className="text-[13px] text-brand-600 hover:underline"
          onClick={() => {
            // Going anonymous sends ProtectedRoute to /login; the logout call
            // itself may 401 with the session already gone, which is fine.
            void logout().catch(() => undefined);
          }}
        >
          Sign in as someone else
        </button>
      </div>
    </div>
  );
}
