import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Conversation } from './Conversation';
import type { HistoryEntry, TicketDetail, TicketHistoryEvent } from '@/api/tickets';

const ALICE = {
  id: '11111111-1111-1111-1111-111111111111',
  displayName: 'Alice',
  email: 'a@x.test',
};
const DANA = { id: '22222222-2222-2222-2222-222222222222', displayName: 'Dana', email: 'd@x.test' };
const KENJI_ID = '33333333-3333-3333-3333-333333333333';

const ticket: TicketDetail = {
  id: '44444444-4444-4444-4444-444444444444',
  title: 'Payments 500',
  description: 'The payments page errors after a card update.',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  category: 'Billing',
  submitter: ALICE,
  assignee: DANA,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  suggestedResolution: null,
  triagedAt: null,
  resolvedAt: null,
};

let seq = 0;
function entry(
  eventType: TicketHistoryEvent,
  payload: Record<string, unknown> = {},
  actor: HistoryEntry['actor'] = DANA,
): HistoryEntry {
  seq += 1;
  return {
    id: `${eventType}-${seq}`,
    eventType,
    actor,
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
  };
}

const history = [
  entry('CREATED', {}, ALICE),
  entry('TRIAGED', { category: 'Billing', priority: 'HIGH' }, null),
  entry('ASSIGNED', { assigneeId: DANA.id }),
  entry('ASSIGNED', { assigneeId: KENJI_ID }),
  entry('STATUS_CHANGED', { from: 'OPEN', to: 'IN_PROGRESS' }),
  entry('COMMENT', { body: 'Was the card saved first?' }),
  entry('UPDATED', {}, ALICE),
];

describe('Conversation', () => {
  it('leads with the original report and shows comments as cards', () => {
    render(<Conversation ticket={ticket} entries={history} audience="staff" />);
    expect(screen.getByText(ticket.description)).toBeInTheDocument();
    expect(screen.getByText('Was the card saved first?')).toBeInTheDocument();
    expect(screen.getAllByText(/^Submitter ·/)).toHaveLength(1);
    expect(screen.getByText(/^Agent ·/)).toBeInTheDocument();
  });

  it('gives staff a one-line summary of every internal event', () => {
    const names = new Map([[KENJI_ID, 'Kenji']]);
    render(<Conversation ticket={ticket} entries={history} audience="staff" staffNames={names} />);
    expect(screen.getByText('System triaged this as Billing · High')).toBeInTheDocument();
    expect(screen.getByText('Dana took this ticket')).toBeInTheDocument();
    expect(screen.getByText('Dana assigned this to Kenji')).toBeInTheDocument();
    expect(screen.getByText('Dana set status to In progress')).toBeInTheDocument();
    expect(screen.getByText('Alice edited the ticket')).toBeInTheDocument();
  });

  it('hides triage, assignment and edits from the submitter and words status their way', () => {
    render(
      <Conversation ticket={ticket} entries={history} audience="submitter" viewerId={ALICE.id} />,
    );
    expect(screen.queryByText(/triaged/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/assigned|took this/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
    expect(screen.getByText('Status changed to We’re working on it')).toBeInTheDocument();
    expect(screen.getByText(/^You ·/)).toBeInTheDocument();
  });

  it('survives an unparseable payload', () => {
    const bad: HistoryEntry = { ...entry('STATUS_CHANGED'), payload: 'not json' };
    render(<Conversation ticket={ticket} entries={[bad]} audience="staff" />);
    expect(screen.getByText('Dana changed the status')).toBeInTheDocument();
  });
});
