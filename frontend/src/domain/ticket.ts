/**
 * The ticket vocabulary, owned by the app rather than by the HTTP layer.
 *
 * <p>These used to live inside `api/tickets.ts`, which meant `lib/` and
 * `components/` had to import from the transport module just to name a status.
 * Everything now depends downward on this file, including `api/`.
 */

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const TICKET_HISTORY_EVENTS = [
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'TRIAGED',
  'COMMENT',
  'RESOLVED',
  'REOPENED',
] as const;
export type TicketHistoryEvent = (typeof TICKET_HISTORY_EVENTS)[number];

export const TICKET_SORTS = [
  'NEWEST',
  'OLDEST',
  'RECENTLY_UPDATED',
  'PRIORITY_HIGH_FIRST',
  'PRIORITY_LOW_FIRST',
] as const;
export type TicketSort = (typeof TICKET_SORTS)[number];

// Mirrors the backend's @Size on CreateTicketRequest / UpdateTicketRequest.
// Declared once so the form schema, the maxLength attribute and the inline
// edit form cannot disagree.
export const TICKET_TITLE_MAX = 200;
export const TICKET_BODY_MAX = 20_000;

/** What a submitter sees instead of the internal status name. */
export const SUBMITTER_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Received',
  IN_PROGRESS: 'We’re working on it',
  WAITING: 'Waiting on you',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

// The agent queue's saved views. Mirrors the backend's TicketView.
export const TICKET_VIEWS = [
  'ALL',
  'MINE',
  'UNASSIGNED',
  'URGENT',
  'WAITING',
  'UNTRIAGED',
] as const;
export type TicketView = (typeof TICKET_VIEWS)[number];

export const VIEW_LABELS: Record<TicketView, string> = {
  ALL: 'All',
  MINE: 'Mine',
  UNASSIGNED: 'Unassigned',
  URGENT: 'Critical & High',
  WAITING: 'Waiting on customer',
  UNTRIAGED: 'Not triaged',
};

// Claude usually answers within a few seconds; give it a wide margin, then
// give up rather than polling a ticket that is never going to be triaged.
export const TRIAGE_POLL_INTERVAL_MS = 3_000;
export const TRIAGE_POLL_WINDOW_MS = 2 * 60 * 1_000;

export type TriageState = 'done' | 'analyzing' | 'gave_up';

/** Where automatic triage stands for a ticket, from its timestamps alone. */
export function triageState(
  ticket: { triagedAt?: string | null | undefined; createdAt: string },
  now: number = Date.now(),
): TriageState {
  if (ticket.triagedAt) return 'done';
  return now - new Date(ticket.createdAt).getTime() < TRIAGE_POLL_WINDOW_MS
    ? 'analyzing'
    : 'gave_up';
}
