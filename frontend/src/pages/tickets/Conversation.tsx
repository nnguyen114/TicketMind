import type { ReactNode } from 'react';
import type { HistoryEntry, TicketDetail } from '@/api/tickets';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  SUBMITTER_STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@/domain/ticket';
import { Icon, type IconName } from '@/components/icons';
import { STATUS_ICONS } from '@/components/statusIcons';
import { formatAbsolute, formatRelative } from '@/lib/formatDate';

type Audience = 'staff' | 'submitter';

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asStatus(value: unknown): TicketStatus | null {
  return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value)
    ? (value as TicketStatus)
    : null;
}

function asPriority(value: unknown): TicketPriority | null {
  return typeof value === 'string' && (TICKET_PRIORITIES as readonly string[]).includes(value)
    ? (value as TicketPriority)
    : null;
}

interface SystemLine {
  icon: IconName;
  ai?: boolean;
  text: ReactNode;
}

/**
 * The one-line rendering of a non-comment event, or null when this audience
 * should not see it. Submitters see status changes in their own wording and
 * nothing about assignment, edits or triage: that is internal plumbing.
 */
function describeEvent(
  entry: HistoryEntry,
  audience: Audience,
  staffNames: Map<string, string>,
): SystemLine | null {
  const payload = parsePayload(entry.payload);
  const actor = entry.actor?.displayName ?? 'System';
  switch (entry.eventType) {
    case 'CREATED':
    case 'COMMENT':
      return null;
    case 'STATUS_CHANGED':
    case 'RESOLVED':
    case 'REOPENED': {
      const to = asStatus(payload.to);
      if (audience === 'submitter') {
        return to
          ? { icon: STATUS_ICONS[to], text: <>Status changed to {SUBMITTER_STATUS_LABELS[to]}</> }
          : null;
      }
      return {
        icon: to ? STATUS_ICONS[to] : 'clock',
        text: to ? (
          <>
            {actor} set status to {STATUS_LABELS[to]}
          </>
        ) : (
          <>{actor} changed the status</>
        ),
      };
    }
    default:
      if (audience === 'submitter') return null;
  }
  switch (entry.eventType) {
    case 'ASSIGNED': {
      const assigneeId = typeof payload.assigneeId === 'string' ? payload.assigneeId : null;
      if (!assigneeId) return { icon: 'circle', text: <>{actor} unassigned this</> };
      if (assigneeId === entry.actor?.id)
        return { icon: 'circle', text: <>{actor} took this ticket</> };
      return {
        icon: 'circle',
        text: (
          <>
            {actor} assigned this to {staffNames.get(assigneeId) ?? 'another agent'}
          </>
        ),
      };
    }
    case 'UPDATED':
      return { icon: 'circle', text: <>{actor} edited the ticket</> };
    case 'TRIAGED': {
      const category = typeof payload.category === 'string' ? payload.category : null;
      const priority = asPriority(payload.priority);
      const what = category && priority ? ` as ${category} · ${PRIORITY_LABELS[priority]}` : '';
      return {
        icon: 'sparkle',
        ai: true,
        text: payload.retriggered === true ? <>Re-triaged{what}</> : <>System triaged this{what}</>,
      };
    }
    default:
      return null;
  }
}

function MessageCard({
  author,
  role,
  at,
  body,
}: {
  author: string;
  role: string;
  at: string;
  body: string;
}) {
  return (
    <li className="rounded-xl border border-zinc-200 bg-white px-4 py-3.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{author}</span>
        <span className="text-xs text-zinc-500" title={formatAbsolute(at)}>
          {role} · {formatRelative(at)}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-zinc-800">{body}</p>
    </li>
  );
}

/**
 * The original report, then comments as cards and every other event as a
 * compact line, so the people talking are not drowned out by the plumbing.
 */
export function Conversation({
  ticket,
  entries,
  audience,
  staffNames = new Map(),
  viewerId,
}: {
  ticket: TicketDetail;
  entries: HistoryEntry[];
  audience: Audience;
  staffNames?: Map<string, string>;
  viewerId?: string | undefined;
}) {
  const submitterId = ticket.submitter?.id;
  const roleOf = (id: string | undefined) => {
    if (audience === 'submitter' && id && id === viewerId) return 'You';
    return id && id === submitterId ? 'Submitter' : 'Agent';
  };

  return (
    <ol aria-label="Conversation" className="flex flex-col gap-3.5">
      <MessageCard
        author={ticket.submitter?.displayName ?? 'Unknown'}
        role={roleOf(submitterId)}
        at={ticket.createdAt}
        body={ticket.description}
      />
      {entries.map((entry) => {
        if (entry.eventType === 'COMMENT') {
          const payload = parsePayload(entry.payload);
          return (
            <MessageCard
              key={entry.id}
              author={entry.actor?.displayName ?? 'System'}
              role={roleOf(entry.actor?.id)}
              at={entry.createdAt}
              body={typeof payload.body === 'string' ? payload.body : ''}
            />
          );
        }
        const line = describeEvent(entry, audience, staffNames);
        if (!line) return null;
        return (
          <li key={entry.id} className="flex items-center gap-2 px-1 text-xs text-zinc-600">
            <Icon name={line.icon} size={14} className={line.ai ? 'text-violet-700' : ''} />
            <span>{line.text}</span>
            <span className="text-zinc-500" title={formatAbsolute(entry.createdAt)}>
              · {formatRelative(entry.createdAt)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
