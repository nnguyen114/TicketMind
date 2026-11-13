import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/renderApp';
import { TicketDetailPage } from './TicketDetailPage';

const BASE = 'http://api.test';
const TICKET_ID = '33333333-3333-3333-3333-333333333333';
const SUBMITTER_ID = '11111111-1111-1111-1111-111111111111';
const AGENT_ID = '22222222-2222-2222-2222-222222222222';

interface UserOpts {
  role: 'USER' | 'AGENT' | 'ADMIN';
  id: string;
  displayName: string;
}

function authedRefresh(user: UserOpts) {
  server.use(
    http.post(`${BASE}/auth/refresh`, () =>
      HttpResponse.json({
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: {
          id: user.id,
          email: `${user.displayName.toLowerCase()}@example.com`,
          displayName: user.displayName,
          role: user.role,
        },
      }),
    ),
  );
}

function ticket(
  overrides: Partial<{
    status: string;
    assignee: { id: string; displayName: string; email: string } | null;
    title: string;
    description: string;
    category: string | null;
    suggestedResolution: string | null;
    triagedAt: string | null;
    createdAt: string;
  }> = {},
) {
  return {
    id: TICKET_ID,
    title: overrides.title ?? 'Cannot log in',
    description: overrides.description ?? 'I keep getting a 500.',
    status: overrides.status ?? 'OPEN',
    priority: 'MEDIUM',
    category: overrides.category ?? null,
    suggestedResolution: overrides.suggestedResolution ?? null,
    triagedAt: overrides.triagedAt ?? null,
    submitter: {
      id: SUBMITTER_ID,
      displayName: 'Alice',
      email: 'alice@example.com',
    },
    assignee: overrides.assignee ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function history() {
  return [
    {
      id: '44444444-4444-4444-4444-444444444444',
      eventType: 'CREATED',
      actor: {
        id: SUBMITTER_ID,
        displayName: 'Alice',
        email: 'alice@example.com',
      },
      payload: '{}',
      createdAt: new Date().toISOString(),
    },
  ];
}

// Agents get the workspace, which also loads the queue and the staff roster.
function agentBackground() {
  server.use(
    http.get(`${BASE}/tickets`, () =>
      HttpResponse.json({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 }),
    ),
    http.get(`${BASE}/users`, () =>
      HttpResponse.json([
        { id: AGENT_ID, email: 'bob@example.com', displayName: 'Bob', role: 'AGENT', active: true },
      ]),
    ),
  );
}

function renderDetail() {
  renderWithProviders(
    <Routes>
      <Route path="/tickets/:id" element={<TicketDetailPage />} />
      <Route path="/tickets" element={<div>tickets list</div>} />
    </Routes>,
    { route: `/tickets/${TICKET_ID}` },
  );
}

const LONG_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const AGENT = { id: AGENT_ID, displayName: 'Bob', role: 'AGENT' } as const;
const SUBMITTER = { id: SUBMITTER_ID, displayName: 'Alice', role: 'USER' } as const;

describe('TicketDetailPage', () => {
  it('polls an untriaged ticket and fills the AI card once triage lands', async () => {
    authedRefresh(AGENT);
    agentBackground();
    let calls = 0;
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () => {
        calls += 1;
        // Triage runs asynchronously on the backend, so the first read of a
        // freshly created ticket has no result yet.
        return HttpResponse.json(
          calls === 1
            ? ticket()
            : ticket({
                category: 'auth',
                suggestedResolution: 'Reset the password and resend the link.',
                triagedAt: new Date().toISOString(),
              }),
        );
      }),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
    );

    renderDetail();

    expect(await screen.findByText(/analyzing this ticket/i)).toBeInTheDocument();
    expect(
      await screen.findByText('Reset the password and resend the link.', undefined, {
        timeout: 8000,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/analyzing this ticket/i)).not.toBeInTheDocument();
  }, 15000);

  it('offers Run triage once the automatic pass has given up', async () => {
    authedRefresh(AGENT);
    agentBackground();
    let triaged = false;
    const done = ticket({
      createdAt: LONG_AGO,
      category: 'billing',
      suggestedResolution: 'Refund the duplicate charge.',
      triagedAt: new Date().toISOString(),
    });
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json(triaged ? done : ticket({ createdAt: LONG_AGO })),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
      http.post(`${BASE}/tickets/${TICKET_ID}/triage`, () => {
        triaged = true;
        return HttpResponse.json(done);
      }),
    );

    renderDetail();

    expect(await screen.findByText('Not triaged yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /run triage/i }));
    expect(await screen.findByText('Refund the duplicate charge.')).toBeInTheDocument();
  });

  it('names a provider failure and offers a retry', async () => {
    authedRefresh(AGENT);
    agentBackground();
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json(ticket({ createdAt: LONG_AGO })),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
      http.post(`${BASE}/tickets/${TICKET_ID}/triage`, () =>
        HttpResponse.json({ status: 502, code: 'triage_failed' }, { status: 502 }),
      ),
    );

    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: /run triage/i }));

    expect(await screen.findByText(/AI provider is busy/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('offers no retry when triage is switched off', async () => {
    authedRefresh(AGENT);
    agentBackground();
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json(ticket({ createdAt: LONG_AGO })),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
      http.post(`${BASE}/tickets/${TICKET_ID}/triage`, () =>
        HttpResponse.json({ status: 503, code: 'triage_disabled' }, { status: 503 }),
      ),
    );

    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: /run triage/i }));

    expect(await screen.findByText(/switched off for this deployment/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again|run triage/i })).not.toBeInTheDocument();
  });

  it('puts the suggested resolution into the reply box on Use as reply', async () => {
    authedRefresh(AGENT);
    agentBackground();
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json(
          ticket({
            category: 'auth',
            suggestedResolution: 'Reset the password.',
            triagedAt: new Date().toISOString(),
          }),
        ),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
    );

    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: /use as reply/i }));

    expect(screen.getByLabelText(/reply to alice/i)).toHaveValue('Reset the password.');
    expect(screen.queryByText(/analyzing this ticket/i)).not.toBeInTheDocument();
  });

  it('changes status from the stepper', async () => {
    authedRefresh(AGENT);
    agentBackground();
    let sent: string | null = null;
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json(ticket({ createdAt: LONG_AGO })),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
      http.post(`${BASE}/tickets/${TICKET_ID}/status`, async ({ request }) => {
        sent = ((await request.json()) as { status: string }).status;
        return HttpResponse.json(ticket({ status: sent }));
      }),
    );

    renderDetail();
    const stepper = await screen.findByRole('list', { name: 'Status' });
    expect(within(stepper).getByRole('button', { name: /open/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await userEvent.click(within(stepper).getByRole('button', { name: /resolved/i }));
    await waitFor(() => expect(sent).toBe('RESOLVED'));
  });

  it('assigns and unassigns from the properties panel', async () => {
    authedRefresh(AGENT);
    agentBackground();
    let currentAssignee: { id: string; displayName: string; email: string } | null = null;
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json(ticket({ assignee: currentAssignee, createdAt: LONG_AGO })),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
      http.post(`${BASE}/tickets/${TICKET_ID}/assign`, async ({ request }) => {
        const body = (await request.json()) as { assigneeId: string | null };
        currentAssignee = body.assigneeId
          ? { id: AGENT_ID, displayName: 'Bob', email: 'bob@example.com' }
          : null;
        return HttpResponse.json(ticket({ assignee: currentAssignee }));
      }),
    );

    renderDetail();
    const assignee = await screen.findByLabelText('Assignee');
    await screen.findByRole('option', { name: 'Bob' });

    await userEvent.selectOptions(assignee, AGENT_ID);
    await waitFor(() => expect(assignee).toHaveValue(AGENT_ID));

    await userEvent.selectOptions(assignee, '');
    await waitFor(() => expect(assignee).toHaveValue(''));
  });

  it('shows a submitter their ticket without any AI output', async () => {
    authedRefresh(SUBMITTER);
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json(
          ticket({ suggestedResolution: 'Internal draft.', triagedAt: new Date().toISOString() }),
        ),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
    );

    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Cannot log in' })).toBeInTheDocument();
    expect(screen.getByText('I keep getting a 500.')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit ticket/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close ticket/i })).toBeInTheDocument();
    expect(screen.queryByText('Internal draft.')).not.toBeInTheDocument();
    expect(screen.queryByText(/suggested by ai/i)).not.toBeInTheDocument();
  });

  it('lets a submitter edit an open ticket', async () => {
    authedRefresh(SUBMITTER);
    let currentTitle = 'Cannot log in';
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json(ticket({ title: currentTitle })),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
      http.patch(`${BASE}/tickets/${TICKET_ID}`, async ({ request }) => {
        const body = (await request.json()) as { title: string; description: string };
        currentTitle = body.title;
        return HttpResponse.json(ticket({ title: body.title, description: body.description }));
      }),
    );

    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: /edit ticket/i }));
    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Login broken');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Login broken' })).toBeInTheDocument(),
    );
  });

  it('lets a submitter close their own open ticket', async () => {
    authedRefresh(SUBMITTER);
    let closed = false;
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json(ticket({ status: closed ? 'CLOSED' : 'OPEN' })),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
      http.post(`${BASE}/tickets/${TICKET_ID}/status`, async ({ request }) => {
        const body = (await request.json()) as { status: string };
        closed = body.status === 'CLOSED';
        return HttpResponse.json(ticket({ status: 'CLOSED' }));
      }),
    );

    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: /close ticket/i }));
    expect(await screen.findByText('tickets list')).toBeInTheDocument();
  });

  it('renders an error state and back link when the ticket fetch fails', async () => {
    authedRefresh(SUBMITTER);
    server.use(
      http.get(`${BASE}/tickets/${TICKET_ID}`, () =>
        HttpResponse.json({ status: 404, code: 'not_found' }, { status: 404 }),
      ),
      http.get(`${BASE}/tickets/${TICKET_ID}/history`, () => HttpResponse.json(history())),
    );

    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not find/i);
    expect(screen.getByRole('link', { name: /my tickets/i })).toBeInTheDocument();
  });
});
