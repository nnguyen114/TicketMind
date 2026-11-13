import { z } from 'zod';
import { apiFetch } from './client';
import {
  TICKET_HISTORY_EVENTS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketSort,
  type TicketStatus,
} from '@/domain/ticket';

export type { TicketPriority, TicketSort, TicketStatus } from '@/domain/ticket';

const ticketStatusSchema = z.enum(TICKET_STATUSES);
const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);
const ticketHistoryEventSchema = z.enum(TICKET_HISTORY_EVENTS);

const userSummarySchema = z
  .object({
    id: z.string().uuid(),
    displayName: z.string(),
    email: z.string(),
  })
  .nullable();

const ticketSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema.nullable().optional(),
  category: z.string().nullable().optional(),
  submitter: userSummarySchema,
  assignee: userSummarySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ticketDetailSchema = ticketSummarySchema.extend({
  description: z.string(),
  suggestedResolution: z.string().nullable().optional(),
  triagedAt: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
});
export type TicketDetail = z.infer<typeof ticketDetailSchema>;

const pagedTicketsSchema = z.object({
  content: z.array(ticketSummarySchema),
  page: z.number().int(),
  size: z.number().int(),
  totalElements: z.number().int(),
  totalPages: z.number().int(),
});
export type PagedTickets = z.infer<typeof pagedTicketsSchema>;

const historyEntrySchema = z.object({
  id: z.string().uuid(),
  eventType: ticketHistoryEventSchema,
  actor: userSummarySchema,
  payload: z.string(),
  createdAt: z.string(),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type { TicketHistoryEvent } from '@/domain/ticket';

interface ListParams {
  status?: TicketStatus | undefined;
  sort?: TicketSort | undefined;
  page?: number;
  size?: number;
}

// The cache keys for every ticket query, in one place. Query keys are matched
// by prefix, so `detail(id)` also covers `history(id)` — anything invalidating
// the detail does not additionally need to name the history.
export const ticketKeys = {
  all: ['tickets'] as const,
  list: (params: { status: TicketStatus | null; sort: TicketSort; page: number }) =>
    ['tickets', params] as const,
  detail: (id: string) => ['ticket', id] as const,
  history: (id: string) => ['ticket', id, 'history'] as const,
};

/** Every endpoint below is "call it, then parse it" — this is that, once. */
async function parsed<T>(
  schema: z.ZodType<T>,
  path: string,
  options?: Parameters<typeof apiFetch>[1],
): Promise<T> {
  return schema.parse(await apiFetch<unknown>(path, options));
}

export async function listTickets(params: ListParams = {}): Promise<PagedTickets> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.sort) search.set('sort', params.sort);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.size !== undefined) search.set('size', String(params.size));
  const query = search.toString();
  return parsed(pagedTicketsSchema, `/tickets${query ? `?${query}` : ''}`);
}

export async function getTicket(id: string): Promise<TicketDetail> {
  return parsed(ticketDetailSchema, `/tickets/${id}`);
}

export async function createTicket(input: {
  title: string;
  description: string;
}): Promise<TicketDetail> {
  return parsed(ticketDetailSchema, '/tickets', { method: 'POST', body: input });
}

export async function updateTicket(
  id: string,
  input: { title: string; description: string },
): Promise<TicketDetail> {
  return parsed(ticketDetailSchema, `/tickets/${id}`, { method: 'PATCH', body: input });
}

export async function changeTicketStatus(id: string, status: TicketStatus): Promise<TicketDetail> {
  return parsed(ticketDetailSchema, `/tickets/${id}/status`, { method: 'POST', body: { status } });
}

export async function assignTicket(id: string, assigneeId: string | null): Promise<TicketDetail> {
  return parsed(ticketDetailSchema, `/tickets/${id}/assign`, {
    method: 'POST',
    body: { assigneeId },
  });
}

export async function retriageTicket(id: string): Promise<TicketDetail> {
  return parsed(ticketDetailSchema, `/tickets/${id}/triage`, { method: 'POST' });
}

export async function addComment(id: string, body: string): Promise<HistoryEntry> {
  return parsed(historyEntrySchema, `/tickets/${id}/comments`, { method: 'POST', body: { body } });
}

export async function getHistory(id: string): Promise<HistoryEntry[]> {
  return parsed(z.array(historyEntrySchema), `/tickets/${id}/history`);
}

export { TICKET_BODY_MAX, TICKET_SORTS, TICKET_STATUSES, TICKET_TITLE_MAX } from '@/domain/ticket';
