import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignTicket,
  listTickets,
  ticketKeys,
  type PagedTickets,
  type TicketDetail,
} from '@/api/tickets';
import {
  LIVE_REFRESH_MS,
  TICKET_SORTS,
  TICKET_VIEWS,
  triageState,
  VIEW_LABELS,
  type TicketSort,
  type TicketView,
} from '@/domain/ticket';
import { useAuth } from '@/auth/useAuth';
import { PriorityBadge } from '@/components/PriorityBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Icon } from '@/components/icons';
import { Button, ErrorText } from '@/components/ui';
import { formatAge } from '@/lib/formatDate';
import { formatError } from '@/lib/errorMessages';
import { useApiMutation } from '@/hooks/useApiMutation';
import { AgentTicketPane } from './AgentTicketPane';
import { useInvalidateTicket } from './useInvalidateTicket';

const SORT_LABELS: Record<TicketSort, string> = {
  PRIORITY_HIGH_FIRST: 'Sorted by urgency',
  NEWEST: 'Newest first',
  OLDEST: 'Oldest first',
  RECENTLY_UPDATED: 'Recently updated',
  PRIORITY_LOW_FIRST: 'Least urgent first',
};

const DEFAULT_SORT: TicketSort = 'PRIORITY_HIGH_FIRST';
const PAGE_SIZE = 25;

function readView(raw: string | null): TicketView {
  return raw && (TICKET_VIEWS as readonly string[]).includes(raw) ? (raw as TicketView) : 'ALL';
}

function readSort(raw: string | null): TicketSort {
  return raw && (TICKET_SORTS as readonly string[]).includes(raw)
    ? (raw as TicketSort)
    : DEFAULT_SORT;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The staff screen: queue on the left, the open ticket on the right, so
 * picking a ticket never loses your place in the list. Below `lg` the two
 * stack and only one shows at a time.
 */
export function AgentWorkspace({ selectedId }: { selectedId?: string | undefined }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = readView(params.get('view'));
  const sort = readSort(params.get('sort'));
  const page = Math.max(0, Number(params.get('page') ?? '0') || 0);
  const query = params.toString();
  const rowRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const tickets = useQuery({
    queryKey: ticketKeys.list({ view, sort, page }),
    queryFn: () => listTickets({ view, sort, page, size: PAGE_SIZE }),
    refetchInterval: LIVE_REFRESH_MS,
  });

  const invalidateSelected = useInvalidateTicket(selectedId ?? '');
  const assignToMe = useApiMutation({
    mutationFn: () => assignTicket(selectedId ?? '', user?.id ?? null),
    onSuccess: invalidateSelected,
  });
  // useMutation's mutate is referentially stable, so the listener below is
  // registered once per selection rather than on every render.
  const assignMe = assignToMe.mutation.mutate;
  const queryClient = useQueryClient();

  const update = (next: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null) nextParams.delete(key);
      else nextParams.set(key, value);
    }
    setParams(nextParams);
  };

  // j/k move focus between rows (Enter then opens the focused link natively);
  // a/s/r act on the open ticket. Ignored while typing or with a modifier.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const rows = rowRefs.current.filter((row): row is HTMLAnchorElement => row !== null);
      if (event.key === 'j' || event.key === 'k') {
        if (rows.length === 0) return;
        event.preventDefault();
        const focused = rows.indexOf(document.activeElement as HTMLAnchorElement);
        const selected = rows.findIndex((row) => row.getAttribute('aria-current') === 'page');
        const from = focused >= 0 ? focused : selected;
        const step = event.key === 'j' ? 1 : -1;
        const next = from < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, from + step));
        rows[next]?.focus();
        return;
      }
      if (!selectedId) return;
      if (event.key === 'a' && user) {
        event.preventDefault();
        const open = queryClient.getQueryData<TicketDetail>(ticketKeys.detail(selectedId));
        // Already yours: re-assigning would only add a duplicate history row.
        if (open?.assignee?.id !== user.id) assignMe();
      } else if (event.key === 's' || event.key === 'r') {
        event.preventDefault();
        document.getElementById(event.key === 's' ? 'status-select' : 'comment')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, user, assignMe, queryClient]);

  // On desktop the workspace is exactly the viewport under the header, so the
  // queue and the pane scroll on their own; flex-none stops flex-1 from
  // overriding that height.
  return (
    <div className="flex flex-1 min-h-0 lg:h-[calc(100dvh-57px)] lg:flex-none">
      <section
        aria-label="Ticket queue"
        className={`${selectedId ? 'hidden lg:flex' : 'flex'} w-full lg:w-[28rem] xl:w-[32rem] shrink-0 flex-col border-r border-zinc-200 bg-white`}
      >
        <div
          role="tablist"
          aria-label="Saved views"
          className="flex overflow-x-auto border-b border-zinc-200 px-2 pt-2"
        >
          {TICKET_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={v === view}
              onClick={() => update({ view: v === 'ALL' ? null : v, page: null })}
              className={`whitespace-nowrap border-b-2 px-2 py-2 text-[13px] ${
                v === view
                  ? 'border-brand-600 font-semibold text-zinc-900'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2 text-xs text-zinc-600">
          <label className="flex items-center gap-2">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(event) =>
                update({
                  sort: event.target.value === DEFAULT_SORT ? null : event.target.value,
                  page: null,
                })
              }
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {tickets.data ? <span>{tickets.data.totalElements} tickets</span> : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tickets.isPending ? (
            <p className="p-4 text-zinc-500">Loading tickets…</p>
          ) : tickets.isError ? (
            <ErrorText className="p-4">{formatError(tickets.error)}</ErrorText>
          ) : tickets.data.content.length === 0 ? (
            <EmptyQueue view={view} />
          ) : (
            <ul>
              {tickets.data.content.map((ticket, index) => (
                <QueueRow
                  key={ticket.id}
                  ticket={ticket}
                  selected={ticket.id === selectedId}
                  href={`/tickets/${ticket.id}${query ? `?${query}` : ''}`}
                  rowRef={(node) => {
                    rowRefs.current[index] = node;
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        {tickets.data && tickets.data.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-xs text-zinc-600">
            <span>
              Page {page + 1} of {tickets.data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => update({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page + 1 >= tickets.data.totalPages}
                onClick={() => update({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}

        <ShortcutHints />
      </section>

      <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col`}>
        {selectedId ? (
          <>
            <Link
              to={`/tickets${query ? `?${query}` : ''}`}
              className="flex items-center gap-1 px-6 pt-3 text-[13px] text-brand-600 lg:hidden"
            >
              <Icon name="back" size={14} />
              Back to the queue
            </Link>
            {assignToMe.errorMessage ? (
              <ErrorText className="px-6 pt-3">{assignToMe.errorMessage}</ErrorText>
            ) : null}
            <AgentTicketPane id={selectedId} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-zinc-500">
            Select a ticket from the queue to open it here.
          </div>
        )}
      </div>
    </div>
  );
}

type Row = PagedTickets['content'][number];

const AI_STATE = {
  done: { label: 'Triaged', className: 'text-violet-800' },
  analyzing: { label: 'Analyzing…', className: 'italic text-zinc-600' },
  gave_up: { label: 'Not triaged', className: 'font-semibold text-amber-800' },
} as const;

function QueueRow({
  ticket,
  selected,
  href,
  rowRef,
}: {
  ticket: Row;
  selected: boolean;
  href: string;
  rowRef: (node: HTMLAnchorElement | null) => void;
}) {
  const ai = AI_STATE[triageState(ticket)];
  return (
    <li>
      <Link
        ref={rowRef}
        to={href}
        aria-current={selected ? 'page' : undefined}
        className={`block border-b border-zinc-100 px-4 py-3 text-zinc-900 hover:bg-zinc-50 hover:no-underline focus-visible:-outline-offset-2 ${
          selected
            ? 'bg-brand-50 shadow-[inset_2px_0_0_var(--color-brand-600)] hover:bg-brand-50'
            : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          <span className="ml-auto text-xs text-zinc-500" title={ticket.createdAt}>
            {formatAge(ticket.createdAt)}
          </span>
        </div>
        <div className="mt-1 mb-1.5 truncate font-semibold">{ticket.title}</div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-zinc-600">
          <span>{ticket.submitter?.displayName ?? 'Unknown'}</span>
          <StatusBadge status={ticket.status} className="text-zinc-700" />
          <span>{ticket.assignee?.displayName ?? 'Unassigned'}</span>
          <span className={`inline-flex items-center gap-1 ${ai.className}`}>
            <Icon name="sparkle" size={12} />
            {ai.label}
          </span>
        </div>
      </Link>
    </li>
  );
}

function EmptyQueue({ view }: { view: TicketView }) {
  return (
    <div className="p-8 text-center text-zinc-600">
      <p className="font-semibold text-zinc-900">
        {view === 'ALL' ? 'No tickets yet.' : 'Queue’s clear.'}
      </p>
      <p className="mt-1 text-[13px]">
        {view === 'ALL'
          ? 'Tickets show up here as soon as someone submits one.'
          : `Nothing in “${VIEW_LABELS[view]}” right now.`}
      </p>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-zinc-300 bg-white px-1.5 font-sans">{children}</kbd>;
}

function ShortcutHints() {
  return (
    <div className="hidden lg:flex flex-wrap gap-x-3.5 gap-y-1.5 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-600">
      <span>
        <Kbd>j</Kbd> <Kbd>k</Kbd> move
      </span>
      <span>
        <Kbd>Enter</Kbd> open
      </span>
      <span>
        <Kbd>a</Kbd> assign to me
      </span>
      <span>
        <Kbd>s</Kbd> status
      </span>
      <span>
        <Kbd>r</Kbd> reply
      </span>
    </div>
  );
}
