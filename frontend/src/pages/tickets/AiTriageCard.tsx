import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import {
  getTicket,
  retriageTicket,
  ticketKeys,
  type HistoryEntry,
  type TicketDetail,
} from '@/api/tickets';
import { triageState } from '@/domain/ticket';
import { PriorityLabel } from '@/components/PriorityBadge';
import { Icon } from '@/components/icons';
import { AiTag, Button } from '@/components/ui';
import { formatError } from '@/lib/errorMessages';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useInvalidateTicket } from './useInvalidateTicket';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ticket ids the most recent triage drew on, from its history row. */
function citedTicketIds(history: HistoryEntry[] | undefined): string[] {
  const latest = history?.filter((entry) => entry.eventType === 'TRIAGED').at(-1);
  if (!latest) return [];
  try {
    const payload = JSON.parse(latest.payload) as { citations?: unknown };
    return Array.isArray(payload.citations)
      ? payload.citations.filter((id): id is string => typeof id === 'string' && UUID.test(id))
      : [];
  } catch {
    return [];
  }
}

/**
 * The AI's suggestion for a ticket, styled as a suggestion: dashed violet
 * outline, "Suggested by AI", never mixed into the ticket's own properties.
 * Staff only.
 */
export function AiTriageCard({
  ticket,
  history,
  onUseAsReply,
}: {
  ticket: TicketDetail;
  history: HistoryEntry[] | undefined;
  onUseAsReply: (text: string) => void;
}) {
  const invalidate = useInvalidateTicket(ticket.id);
  const retriage = useApiMutation({
    mutationFn: () => retriageTicket(ticket.id),
    onSuccess: invalidate,
  });
  const error = retriage.mutation.error;
  const code = error instanceof ApiError ? error.code : null;
  const state = retriage.mutation.isPending ? 'analyzing' : triageState(ticket);

  let body;
  if (state === 'analyzing') {
    body = <Analyzing />;
  } else if (code === 'triage_disabled') {
    body = (
      <div className="flex flex-col gap-1.5">
        <p className="font-semibold text-zinc-700">Triage unavailable</p>
        <p className="text-[13px] text-zinc-600">AI triage is switched off for this deployment.</p>
      </div>
    );
  } else if (error) {
    body = (
      <div className="flex flex-col gap-2.5">
        <p className="flex items-center gap-1.5 font-semibold text-amber-800">
          <Icon name="warning" />
          Triage failed
        </p>
        <p className="text-[13px] text-zinc-700">
          {code === 'triage_failed'
            ? 'The AI provider is busy, try again in a minute.'
            : formatError(error)}
        </p>
        <Button
          variant="aiOutline"
          className="self-start"
          onClick={() => retriage.mutation.mutate()}
        >
          Try again
        </Button>
      </div>
    );
  } else if (state === 'gave_up') {
    body = (
      <div className="flex flex-col gap-2.5">
        <p className="font-semibold">Not triaged yet</p>
        <p className="text-[13px] text-zinc-600">
          The AI did not return a result within 2 minutes.
        </p>
        <Button variant="ai" className="self-start" onClick={() => retriage.mutation.mutate()}>
          Run triage
        </Button>
      </div>
    );
  } else {
    body = (
      <Suggestion
        ticket={ticket}
        citedIds={citedTicketIds(history)}
        onUseAsReply={onUseAsReply}
        onRerun={() => retriage.mutation.mutate()}
      />
    );
  }

  return (
    <section
      aria-label="Suggested by AI"
      className="rounded-xl border-[1.5px] border-dashed border-violet-500 bg-white p-3.5"
    >
      <div className="mb-3 flex items-center gap-2">
        <AiTag />
        <span className="font-semibold text-zinc-700">Suggested by AI</span>
      </div>
      {body}
      {/* Announced when a pending triage lands while the card is on screen. */}
      <p className="sr-only" aria-live="polite">
        {state === 'done' && !error
          ? `Triage complete: ${ticket.category ?? 'uncategorised'}, ${ticket.priority?.toLowerCase() ?? 'no priority'}`
          : ''}
      </p>
    </section>
  );
}

function Analyzing() {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] text-zinc-700">Analyzing this ticket…</p>
      <div className="tm-shimmer h-3.5 w-[70%]" />
      <div className="tm-shimmer h-3.5 w-[55%]" />
      <div className="tm-shimmer h-14 w-full" />
    </div>
  );
}

function Suggestion({
  ticket,
  citedIds,
  onUseAsReply,
  onRerun,
}: {
  ticket: TicketDetail;
  citedIds: string[];
  onUseAsReply: (text: string) => void;
  onRerun: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="w-[72px] text-xs text-zinc-600">Category</span>
        <span className="font-semibold">{ticket.category ?? 'Uncategorised'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-[72px] text-xs text-zinc-600">Priority</span>
        <PriorityLabel priority={ticket.priority} />
      </div>
      {ticket.suggestedResolution ? (
        <div className="mt-1">
          <p className="mb-1 text-xs text-zinc-600">Suggested resolution</p>
          <p className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-2.5 text-[13px] text-zinc-800">
            {ticket.suggestedResolution}
          </p>
          <Button
            variant="aiOutline"
            className="mt-2 w-full"
            onClick={() => onUseAsReply(ticket.suggestedResolution ?? '')}
          >
            Use as reply
          </Button>
        </div>
      ) : null}
      <Citations ids={citedIds} />
      <button
        type="button"
        onClick={onRerun}
        className="self-start text-xs text-violet-800 hover:underline"
      >
        Run triage again
      </button>
    </div>
  );
}

/**
 * The resolved tickets retrieval matched. Only ids are stored with the triage,
 * so titles are looked up; ids that are not tickets (seeded knowledge-base
 * articles) or that fail to load are left out rather than shown as blanks.
 */
function Citations({ ids }: { ids: string[] }) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ticketKeys.detail(id),
      queryFn: () => getTicket(id),
      retry: false,
    })),
  });
  const found = results.flatMap((r) => (r.data ? [r.data] : []));
  if (found.length === 0) return null;
  return (
    <details open className="border-t border-zinc-100 pt-2.5">
      <summary className="cursor-pointer text-[13px] font-semibold text-zinc-700">
        Based on {found.length} similar resolved {found.length === 1 ? 'ticket' : 'tickets'}
      </summary>
      <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
        {found.map((t) => (
          <li key={t.id}>
            <Link to={`/tickets/${t.id}`} className="text-brand-600 hover:underline">
              {t.title}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
