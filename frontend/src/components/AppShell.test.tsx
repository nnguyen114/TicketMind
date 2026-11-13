import { describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/renderApp';
import { AppShell } from './AppShell';
import { tokenStore } from '@/api/tokenStore';

const BASE = 'http://api.test';

function authedRefresh(role: 'USER' | 'AGENT' | 'ADMIN' = 'USER') {
  server.use(
    http.post(`${BASE}/auth/refresh`, () =>
      HttpResponse.json({
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'user@example.com',
          displayName: 'Alice',
          role,
        },
      }),
    ),
  );
}

describe('AppShell', () => {
  it('renders the current user and outlet content', async () => {
    authedRefresh('AGENT');
    renderWithProviders(
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>outlet content</div>} />
        </Route>
      </Routes>,
      { route: '/' },
    );
    expect(await screen.findByText('outlet content')).toBeInTheDocument();
    expect(await screen.findByTestId('current-user')).toHaveTextContent(/alice/i);
    expect(screen.getByTestId('current-user')).toHaveTextContent(/alice/i);
    expect(screen.getByText(/· agent/i)).toBeInTheDocument();
  });

  it('logs out and clears the in-memory token', async () => {
    authedRefresh('USER');
    server.use(http.post(`${BASE}/auth/logout`, () => HttpResponse.json({})));

    renderWithProviders(
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>outlet</div>} />
        </Route>
      </Routes>,
      { route: '/' },
    );

    const menu = await screen.findByRole('button', { name: /account menu for alice/i });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() => expect(tokenStore.get()).toBeNull());
  });

  it('asks for the password over the page when the session expires, keeping the page', async () => {
    authedRefresh('AGENT');
    server.use(
      http.post(`${BASE}/auth/login`, async ({ request }) => {
        const body = (await request.json()) as { email: string };
        expect(body.email).toBe('user@example.com');
        return HttpResponse.json({
          accessToken: 'fresh-token',
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'user@example.com',
            displayName: 'Alice',
            role: 'AGENT',
          },
        });
      }),
    );

    renderWithProviders(
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<textarea aria-label="draft" defaultValue="half a reply" />} />
        </Route>
      </Routes>,
      { route: '/' },
    );
    await screen.findByTestId('current-user');

    // What apiFetch does when the background refresh fails.
    act(() => tokenStore.clear());

    const dialog = await screen.findByRole('dialog', { name: /session expired/i });
    expect(screen.getByLabelText('draft')).toHaveValue('half a reply');
    await userEvent.type(within(dialog).getByLabelText(/password for user@example.com/i), 'pw');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(tokenStore.get()).toBe('fresh-token');
    expect(screen.getByLabelText('draft')).toHaveValue('half a reply');
  });
});
