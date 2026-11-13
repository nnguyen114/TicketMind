import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTicket, ticketKeys } from '@/api/tickets';
import { useAuth } from '@/auth/useAuth';
import { isStaff } from '@/domain/user';
import { StatusBadge } from '@/components/StatusBadge';
import { Icon } from '@/components/icons';
import { LINK_BUTTON_CLASS, LINK_SECONDARY_CLASS } from '@/components/ui';

/** "Got it." Nothing about AI processing here: that is internal plumbing. */
export function TicketSubmittedPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const ticket = useQuery({ queryKey: ticketKeys.detail(id), queryFn: () => getTicket(id) });

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8">
      <div
        role="status"
        className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
      >
        <div className="flex size-[72px] items-center justify-center rounded-full bg-green-100 text-green-800">
          <Icon name="check" size={36} />
        </div>
        <h1 className="text-[26px] font-bold">Got it.</h1>
        <p className="text-[17px] text-zinc-700">We’ll update you here.</p>
        {ticket.data ? (
          <div className="mt-3 w-full rounded-xl border border-zinc-200 bg-white p-4 text-left">
            <StatusBadge
              status={ticket.data.status}
              audience="submitter"
              className="mb-1.5 text-[13px] font-semibold text-zinc-700"
            />
            <p className="font-semibold">{ticket.data.title}</p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2.5">
        <Link
          to={`/tickets/${id}`}
          className={`${LINK_BUTTON_CLASS} min-h-[52px] rounded-xl text-base`}
        >
          View ticket
        </Link>
        <Link to="/tickets" className={`${LINK_SECONDARY_CLASS} min-h-[52px] rounded-xl text-base`}>
          {isStaff(user?.role) ? 'Back to the queue' : 'Back to my tickets'}
        </Link>
      </div>
    </div>
  );
}
