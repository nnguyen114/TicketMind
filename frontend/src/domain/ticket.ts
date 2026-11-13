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
