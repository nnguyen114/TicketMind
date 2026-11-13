import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/renderApp';
import { CommentComposer } from './CommentComposer';

const BASE = 'http://api.test';
const TICKET_ID = '33333333-3333-3333-3333-333333333333';

function anonymousRefresh() {
  server.use(
    http.post(`${BASE}/auth/refresh`, () =>
      HttpResponse.json({ status: 401, code: 'invalid_refresh_token' }, { status: 401 }),
    ),
  );
}

// The composer is controlled; this is the smallest parent that owns the draft.
function Composer() {
  const [value, setValue] = useState('');
  return <CommentComposer ticketId={TICKET_ID} label="Reply" value={value} onChange={setValue} />;
}

describe('CommentComposer', () => {
  it('rejects empty comments client-side without hitting the network', async () => {
    anonymousRefresh();
    renderWithProviders(<Composer />);
    await userEvent.click(await screen.findByRole('button', { name: /send reply/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/write a reply/i);
  });

  it('posts a trimmed body and clears the textarea on success', async () => {
    anonymousRefresh();
    let received: string | null = null;
    server.use(
      http.post(`${BASE}/tickets/${TICKET_ID}/comments`, async ({ request }) => {
        const body = (await request.json()) as { body: string };
        received = body.body;
        return HttpResponse.json({
          id: '44444444-4444-4444-4444-444444444444',
          eventType: 'COMMENT',
          actor: null,
          payload: JSON.stringify({ body: body.body }),
          createdAt: new Date().toISOString(),
        });
      }),
    );

    renderWithProviders(<Composer />);
    const textarea = await screen.findByLabelText(/^reply$/i);
    await userEvent.type(textarea, '   Looking at logs   ');
    await userEvent.click(screen.getByRole('button', { name: /send reply/i }));

    await waitFor(() => expect(received).toBe('Looking at logs'));
    expect(textarea).toHaveValue('');
  });

  it('surfaces server errors from the API envelope', async () => {
    anonymousRefresh();
    server.use(
      http.post(`${BASE}/tickets/${TICKET_ID}/comments`, () =>
        HttpResponse.json({ status: 409, code: 'invalid_ticket_state' }, { status: 409 }),
      ),
    );

    renderWithProviders(<Composer />);
    await userEvent.type(await screen.findByLabelText(/^reply$/i), 'Something');
    await userEvent.click(screen.getByRole('button', { name: /send reply/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not allowed/i));
  });

  it('sends on Cmd/Ctrl+Enter', async () => {
    anonymousRefresh();
    let received: string | null = null;
    server.use(
      http.post(`${BASE}/tickets/${TICKET_ID}/comments`, async ({ request }) => {
        received = ((await request.json()) as { body: string }).body;
        return HttpResponse.json({
          id: '44444444-4444-4444-4444-444444444444',
          eventType: 'COMMENT',
          actor: null,
          payload: JSON.stringify({ body: received }),
          createdAt: new Date().toISOString(),
        });
      }),
    );

    renderWithProviders(<Composer />);
    await userEvent.type(
      await screen.findByLabelText(/^reply$/i),
      'Quick one{Control>}{Enter}{/Control}',
    );
    await waitFor(() => expect(received).toBe('Quick one'));
  });
});
