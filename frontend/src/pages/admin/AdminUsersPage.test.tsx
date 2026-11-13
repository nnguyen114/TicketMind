import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/renderApp';
import { AdminUsersPage } from './AdminUsersPage';

const BASE = 'http://api.test';
const ME = '11111111-1111-1111-1111-111111111111';
const SAM = '22222222-2222-2222-2222-222222222222';
const LUIS = '33333333-3333-3333-3333-333333333333';

function setup() {
  const users = [
    {
      id: ME,
      email: 'dana@example.com',
      displayName: 'Dana',
      role: 'ADMIN',
      active: true,
      locked: false,
    },
    {
      id: SAM,
      email: 'sam@example.com',
      displayName: 'Sam',
      role: 'AGENT',
      active: true,
      locked: false,
    },
    {
      id: LUIS,
      email: 'luis@example.com',
      displayName: 'Luis',
      role: 'USER',
      active: true,
      locked: true,
    },
  ];
  const calls: string[] = [];
  server.use(
    http.post(`${BASE}/auth/refresh`, () =>
      HttpResponse.json({
        accessToken: 't',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: { id: ME, email: 'dana@example.com', displayName: 'Dana', role: 'ADMIN' },
      }),
    ),
    http.get(`${BASE}/users/all`, () => HttpResponse.json(users)),
    http.get(`${BASE}/users`, () => HttpResponse.json([])),
    http.patch(`${BASE}/users/:id/active`, async ({ params, request }) => {
      const { active } = (await request.json()) as { active: boolean };
      calls.push(`active ${String(params.id)} ${active}`);
      const u = users.find((x) => x.id === params.id);
      if (u) u.active = active;
      return HttpResponse.json(u);
    }),
    http.post(`${BASE}/users/:id/unlock`, ({ params }) => {
      calls.push(`unlock ${String(params.id)}`);
      const u = users.find((x) => x.id === params.id);
      if (u) u.locked = false;
      return HttpResponse.json(u);
    }),
  );
  renderWithProviders(<AdminUsersPage />);
  return calls;
}

describe('AdminUsersPage', () => {
  it('draws the last-admin and self guards as disabled controls with the reason', async () => {
    setup();
    const role = await screen.findByLabelText('Role for Dana');
    expect(role).toBeDisabled();
    expect(screen.getByText('At least one admin is required.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Dana active' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Sam active' })).toBeEnabled();
  });

  it('asks before deactivating, and only then calls the API', async () => {
    const calls = setup();
    await userEvent.click(await screen.findByRole('switch', { name: 'Sam active' }));
    const confirm = screen.getByRole('alertdialog', { name: /deactivating sam/i });
    expect(within(confirm).getByText(/signed out within 15 minutes/i)).toBeInTheDocument();
    expect(calls).toEqual([]);

    await userEvent.click(within(confirm).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(calls).toEqual([`active ${SAM} false`]));
    expect(await screen.findByText('Deactivated')).toBeInTheDocument();
  });

  it('unlocks a locked account and filters by search', async () => {
    const calls = setup();
    expect(await screen.findByText('Locked')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(calls).toEqual([`unlock ${LUIS}`]));

    await userEvent.type(screen.getByRole('searchbox'), 'sam');
    expect(screen.queryByText('Luis')).not.toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
  });
});
