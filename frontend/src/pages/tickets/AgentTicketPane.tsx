import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  assignTicket,
  changeTicketStatus,
  TICKET_STATUSES,
  type TicketDetail,
  type TicketStatus,
} from '@/api/tickets';
import { listStaff, userKeys } from '@/api/users';
import { STATUS_LABELS } from '@/domain/ticket';
import { PriorityLabel } from '@/components/PriorityBadge';
import { Icon } from '@/components/icons';
import { STATUS_ICONS } from '@/components/statusIcons';
import { ErrorText } from '@/components/ui';
import { formatAbsolute, formatRelative } from '@/lib/formatDate';
import { formatError } from '@/lib/errorMessages';
import { useApiMutation } from '@/hooks/useApiMutation';
import { AiTriageCard } from './AiTriageCard';
import { CommentComposer } from './CommentComposer';
import { Conversation } from './Conversation';
import { useInvalidateTicket } from './useInvalidateTicket';
import { useTicket } from './useTicket';

const SELECT_CLASS =
  'rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:bg-zinc-100';

/** The open ticket in the agent workspace: conversation in the middle, properties on the right. */
export function AgentTicketPane({ id }: { id: string }) {
  const { ticket, history } = useTicket(id);
  const staff = useQuery({ queryKey: userKeys.staff, queryFn: listStaff });
  // Keyed by ticket so switching tickets never carries a draft across.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const staffNames = useMemo(
    () => new Map((staff.data ?? []).map((m) => [m.id, m.displayName])),
    [staff.data],
  );

  if (ticket.isPending) return <p className="p-6 text-zinc-500">Loading ticket…</p>;
  if (ticket.isError) return <ErrorText className="p-6">{formatError(ticket.error)}</ErrorText>;

  const t = ticket.data;
  const draft = drafts[t.id] ?? '';
  const setDraft = (next: string) => setDrafts((all) => ({ ...all, [t.id]: next }));
  const firstName = t.submitter?.displayName.split(/\s+/)[0];

  return (
    // relative: keeps absolutely positioned content (the AI card's screen-reader
    // live region) inside this scroll box instead of stretching the page.
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <TicketHeader ticket={t} />
      <div className="flex flex-1 flex-wrap">
        <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-4 px-6 py-5">
          {history.isError ? (
            <ErrorText>{formatError(history.error)}</ErrorText>
          ) : (
            <Conversation
              ticket={t}
              entries={history.data ?? []}
              audience="staff"
              staffNames={staffNames}
            />
          )}
          {/* Sticky here, not on the form: a sticky element only sticks within its parent. */}
          <div className="sticky bottom-0 mt-auto pb-1">
            <CommentComposer
              ticketId={t.id}
              label={firstName ? `Reply to ${firstName}` : 'Reply'}
              value={draft}
              onChange={setDraft}
            />
          </div>
        </div>
        <aside
          aria-label="Ticket properties"
          className="flex min-w-[280px] max-w-[360px] flex-[1_1_300px] flex-col gap-4 px-6 py-5 lg:pl-0"
        >
          <AiTriageCard
            ticket={t}
            history={history.data}
            onUseAsReply={(text) => {
              setDraft(text);
              document.getElementById('comment')?.focus();
            }}
          />
          <Properties ticket={t} staff={staff.data ?? []} />
        </aside>
      </div>
    </div>
  );
}

function TicketHeader({ ticket }: { ticket: TicketDetail }) {
  const invalidate = useInvalidateTicket(ticket.id);
  const status = useApiMutation<unknown, TicketStatus>({
    mutationFn: (next) => changeTicketStatus(ticket.id, next),
    onSuccess: invalidate,
  });
  const closed = ticket.status === 'CLOSED';

  return (
    <div className="border-b border-zinc-200 bg-white px-6 pt-4 pb-3">
      <p className="text-xs text-zinc-600" title={formatAbsolute(ticket.createdAt)}>
        Opened {formatRelative(ticket.createdAt)} by {ticket.submitter?.displayName ?? 'Unknown'}
      </p>
      <h1 className="mt-1 mb-3.5 text-xl font-bold leading-tight break-words">{ticket.title}</h1>
      {/* Every move but staying put is allowed, until CLOSED, which is final. */}
      <ol aria-label="Status" className="flex flex-wrap items-center gap-1.5">
        {TICKET_STATUSES.map((s, i) => {
          const current = s === ticket.status;
          return (
            <Fragment key={s}>
              {i > 0 ? <li aria-hidden className="h-px w-4 bg-zinc-300" /> : null}
              <li>
                <button
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  disabled={current || closed || status.mutation.isPending}
                  title={closed && !current ? 'Closed tickets cannot be reopened' : undefined}
                  onClick={() => status.mutation.mutate(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] ${
                    current
                      ? 'border-brand-600 bg-brand-600 font-semibold text-white'
                      : closed
                        ? 'cursor-not-allowed border-dashed border-zinc-300 bg-zinc-100 text-zinc-500'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Icon name={STATUS_ICONS[s]} size={14} />
                  {STATUS_LABELS[s]}
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
      {status.errorMessage ? <ErrorText className="mt-2">{status.errorMessage}</ErrorText> : null}
    </div>
  );
}

function Properties({
  ticket,
  staff,
}: {
  ticket: TicketDetail;
  staff: Array<{ id: string; displayName: string; active: boolean }>;
}) {
  const invalidate = useInvalidateTicket(ticket.id);
  const status = useApiMutation<unknown, TicketStatus>({
    mutationFn: (next) => changeTicketStatus(ticket.id, next),
    onSuccess: invalidate,
  });
  const assign = useApiMutation<unknown, string | null>({
    mutationFn: (assigneeId) => assignTicket(ticket.id, assigneeId),
    onSuccess: invalidate,
  });
  const error = status.errorMessage ?? assign.errorMessage;
  const assignable = staff.filter((m) => m.active || m.id === ticket.assignee?.id);

  return (
    <section
      aria-label="Properties"
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3.5"
    >
      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Status
        <select
          id="status-select"
          value={ticket.status}
          disabled={ticket.status === 'CLOSED' || status.mutation.isPending}
          onChange={(event) => status.mutation.mutate(event.target.value as TicketStatus)}
          className={SELECT_CLASS}
        >
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1 text-xs text-zinc-600">
        Priority
        <span className="text-sm text-zinc-900">
          <PriorityLabel priority={ticket.priority} />
        </span>
      </div>
      <div className="flex flex-col gap-1 text-xs text-zinc-600">
        Category
        <span className="text-sm font-semibold text-zinc-900">
          {ticket.category ?? <span className="font-normal text-zinc-500">Not set</span>}
        </span>
      </div>
      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Assignee
        <select
          value={ticket.assignee?.id ?? ''}
          disabled={assign.mutation.isPending}
          onChange={(event) => assign.mutation.mutate(event.target.value || null)}
          className={SELECT_CLASS}
        >
          <option value="">Unassigned</option>
          {assignable.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </label>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </section>
  );
}
