import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listTickets, ticketKeys, type PagedTickets } from '@/api/tickets';
import { useAuth } from '@/auth/useAuth';
import { isStaff } from '@/domain/user';
import { SUBMITTER_STATUS_LABELS, type TicketStatus } from '@/domain/ticket';
import { Icon, type IconName } from '@/components/icons';
import { Button, ErrorText, LINK_BUTTON_CLASS, PageHeading } from '@/components/ui';
import { formatRelative } from '@/lib/formatDate';
import { formatError } from '@/lib/errorMessages';
import { AgentWorkspace } from './AgentWorkspace';

export function TicketListPage() {
  const { user } = useAuth();
  return isStaff(user?.role) ? <AgentWorkspace /> : <MyTickets />;
}

const PAGE_SIZE = 20;

/** A submitter's own tickets, as cards sized for a phone. */
function MyTickets() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, Number(params.get('page') ?? '0') || 0);
  const query = useQuery({
    queryKey: ticketKeys.list({ view: 'ALL', sort: 'RECENTLY_UPDATED', page }),
    queryFn: () => listTickets({ sort: 'RECENTLY_UPDATED', page, size: PAGE_SIZE }),
  });
  const totalPages = query.data?.totalPages ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <PageHeading>My tickets</PageHeading>
        <Link to="/tickets/new" className={LINK_BUTTON_CLASS}>
          <Icon name="plus" />
          New ticket
        </Link>
      </div>

      {query.isPending ? (
        <p className="text-zinc-500">Loading tickets…</p>
      ) : query.isError ? (
        <ErrorText>{formatError(query.error)}</ErrorText>
      ) : query.data.content.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-600">
          <p className="font-semibold text-zinc-900">You haven’t opened any tickets yet.</p>
          <p className="mt-1 text-[13px]">When something goes wrong, open one and we’ll help.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {query.data.content.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-[13px] text-zinc-600">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => setParams({ page: String(page - 1) })}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setParams({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const CARD_STATUS: Record<TicketStatus, { icon: IconName; className: string }> = {
  OPEN: { icon: 'inbox', className: 'text-zinc-700' },
  IN_PROGRESS: { icon: 'clock', className: 'text-brand-800' },
  WAITING: { icon: 'message', className: 'font-bold text-orange-800' },
  RESOLVED: { icon: 'checkCircle', className: 'text-green-800' },
  CLOSED: { icon: 'lock', className: 'text-zinc-600' },
};

function TicketCard({ ticket }: { ticket: PagedTickets['content'][number] }) {
  const waiting = ticket.status === 'WAITING';
  const status = CARD_STATUS[ticket.status];
  return (
    <li>
      <Link
        to={`/tickets/${ticket.id}`}
        className={`block rounded-xl p-4 text-zinc-900 hover:no-underline ${
          waiting
            ? 'border-[1.5px] border-orange-600 bg-orange-50'
            : 'border border-zinc-200 bg-white hover:border-zinc-300'
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${status.className}`}
          >
            <Icon name={status.icon} />
            {SUBMITTER_STATUS_LABELS[ticket.status]}
          </span>
          {waiting ? (
            <span className="ml-auto rounded-full bg-orange-700 px-2 py-0.5 text-xs font-bold text-white">
              Reply needed
            </span>
          ) : null}
        </div>
        <p className="mb-1 text-base font-semibold">{ticket.title}</p>
        <p className="text-[13px] text-zinc-600">Updated {formatRelative(ticket.updatedAt)}</p>
      </Link>
    </li>
  );
}
