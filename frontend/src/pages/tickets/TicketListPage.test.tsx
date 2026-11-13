import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/renderApp';
import { TicketListPage } from './TicketListPage';

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
          displayName: 'User One',
          role,
        },
      }),
    ),
  );
}

function ticketPage(status: string | undefined, page: number, view?: string) {
  return {
    content: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        title: `Ticket page ${page}${status ? ` (${status})` : ''}${view ? ` [${view}]` : ''}`,
        status: status ?? 'OPEN',
        priority: 'MEDIUM',
        category: null,
        submitter: {
          id: '11111111-1111-1111-1111-111111111111',
          displayName: 'User One',
          email: 'user@example.com',
        },
        assignee: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    page,
    size: 20,
    totalElements: 30,
    totalPages: 2,
  };
}

describe('TicketListPage', () => {
  it('shows a submitter their tickets as cards and paginates', async () => {
    authedRefresh('USER');
    server.use(
      http.get(`${BASE}/tickets`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '0');
        return HttpResponse.json(ticketPage(undefined, page));
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/tickets" element={<TicketListPage />} />
      </Routes>,
      { route: '/tickets' },
    );

    expect(await screen.findByText('Ticket page 0')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Ticket page 1')).toBeInTheDocument();
  });

  it('flags a ticket that is waiting on the submitter', async () => {
    authedRefresh('USER');
    server.use(http.get(`${BASE}/tickets`, () => HttpResponse.json(ticketPage('WAITING', 0))));

    renderWithProviders(<TicketListPage />, { route: '/tickets' });
    expect(await screen.findByText('Waiting on you')).toBeInTheDocument();
    expect(screen.getByText('Reply needed')).toBeInTheDocument();
  });

  it('renders an empty state when a submitter has no tickets', async () => {
    authedRefresh('USER');
    server.use(
      http.get(`${BASE}/tickets`, () =>
        HttpResponse.json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      ),
    );

    renderWithProviders(<TicketListPage />, { route: '/tickets' });
    expect(await screen.findByText(/haven.t opened any tickets/i)).toBeInTheDocument();
  });

  it('sends the saved view an agent picks to the API', async () => {
    authedRefresh('AGENT');
    server.use(
      http.get(`${BASE}/tickets`, ({ request }) => {
        const view = new URL(request.url).searchParams.get('view') ?? undefined;
        return HttpResponse.json(ticketPage(undefined, 0, view));
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/tickets" element={<TicketListPage />} />
      </Routes>,
      { route: '/tickets' },
    );

    expect(await screen.findByText('Ticket page 0')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Waiting on customer' }));
    expect(await screen.findByText('Ticket page 0 [WAITING]')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Waiting on customer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('sorts the agent queue by urgency unless told otherwise', async () => {
    authedRefresh('AGENT');
    const seen: string[] = [];
    server.use(
      http.get(`${BASE}/tickets`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('sort') ?? 'none');
        return HttpResponse.json(ticketPage(undefined, 0));
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/tickets" element={<TicketListPage />} />
      </Routes>,
      { route: '/tickets' },
    );

    await waitFor(() => expect(seen).toContain('PRIORITY_HIGH_FIRST'));
    await userEvent.selectOptions(await screen.findByLabelText(/sort/i), 'NEWEST');
    await waitFor(() => expect(seen).toContain('NEWEST'));
  });

  it('restores the sort from the URL on load', async () => {
    authedRefresh('AGENT');
    const seen: string[] = [];
    server.use(
      http.get(`${BASE}/tickets`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('sort') ?? 'none');
        return HttpResponse.json(ticketPage(undefined, 0));
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/tickets" element={<TicketListPage />} />
      </Routes>,
      { route: '/tickets?sort=PRIORITY_LOW_FIRST' },
    );

    await waitFor(() => expect(seen).toContain('PRIORITY_LOW_FIRST'));
    expect(await screen.findByLabelText(/sort/i)).toHaveValue('PRIORITY_LOW_FIRST');
  });

  it('moves focus down the queue with j', async () => {
    authedRefresh('AGENT');
    server.use(http.get(`${BASE}/tickets`, () => HttpResponse.json(ticketPage(undefined, 0))));

    renderWithProviders(
      <Routes>
        <Route path="/tickets" element={<TicketListPage />} />
      </Routes>,
      { route: '/tickets' },
    );

    const row = (await screen.findByText('Ticket page 0')).closest('a');
    await userEvent.keyboard('j');
    expect(row).toHaveFocus();
  });

  it('puts tickets waiting on the submitter first', async () => {
    authedRefresh('USER');
    const base = ticketPage(undefined, 0);
    const row = base.content[0]!;
    server.use(
      http.get(`${BASE}/tickets`, () =>
        HttpResponse.json({
          ...base,
          totalPages: 1,
          content: [
            { ...row, id: '22222222-2222-2222-2222-222222222221', title: 'Newest, open' },
            {
              ...row,
              id: '22222222-2222-2222-2222-222222222223',
              title: 'Older, waiting',
              status: 'WAITING',
            },
          ],
        }),
      ),
    );

    renderWithProviders(<TicketListPage />, { route: '/tickets' });
    await screen.findByText('Older, waiting');
    const titles = screen
      .getAllByText(/^(Newest, open|Older, waiting)$/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Older, waiting', 'Newest, open']);
  });
});
