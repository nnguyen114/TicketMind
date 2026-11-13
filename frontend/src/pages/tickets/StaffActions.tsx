import {
  assignTicket,
  changeTicketStatus,
  retriageTicket,
  TICKET_STATUSES,
  type TicketDetail,
  type TicketStatus,
} from '@/api/tickets';
import { useAuth } from '@/auth/useAuth';
import { FormSelect } from '@/components/FormField';
import { STATUS_LABELS } from '@/domain/ticket';
import { Button, Card, ErrorText, Muted, SectionHeading } from '@/components/ui';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useInvalidateTicket } from './useInvalidateTicket';

export function StaffActions({ ticket }: { ticket: TicketDetail }) {
  const { user } = useAuth();
  const invalidateTicket = useInvalidateTicket(ticket.id);

  const status = useApiMutation<unknown, TicketStatus>({
    mutationFn: (next: TicketStatus) => changeTicketStatus(ticket.id, next),
    onSuccess: invalidateTicket,
  });
  const retriage = useApiMutation({
    mutationFn: () => retriageTicket(ticket.id),
    onSuccess: invalidateTicket,
  });
  const assign = useApiMutation<unknown, string | null>({
    mutationFn: (assigneeId: string | null) => assignTicket(ticket.id, assigneeId),
    onSuccess: invalidateTicket,
  });

  const isAssignedToMe = user?.id === ticket.assignee?.id;
  const isClosed = ticket.status === 'CLOSED';
  const error = status.errorMessage ?? assign.errorMessage ?? retriage.errorMessage;

  return (
    <Card className="flex flex-col gap-3">
      <SectionHeading>Staff actions</SectionHeading>

      <div>
        <FormSelect
          label="Status"
          id="status-select"
          value={ticket.status}
          disabled={status.mutation.isPending || isClosed}
          onChange={(event) => status.mutation.mutate(event.target.value as TicketStatus)}
        >
          {TICKET_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </FormSelect>
        {isClosed ? (
          <p className="mt-1 text-xs text-slate-500">Closed tickets cannot be reopened.</p>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">Assignment</p>
        <p className="mt-1 text-sm text-slate-700">
          {ticket.assignee ? (
            <>
              Assigned to <span className="font-medium">{ticket.assignee.displayName}</span>
            </>
          ) : (
            <Muted>Unassigned</Muted>
          )}
        </p>
        <div className="mt-2 flex gap-2 flex-wrap">
          {!isAssignedToMe && user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => assign.mutation.mutate(user.id)}
              disabled={assign.mutation.isPending}
            >
              Take ticket
            </Button>
          ) : null}
          {ticket.assignee ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => assign.mutation.mutate(null)}
              disabled={assign.mutation.isPending}
            >
              Unassign
            </Button>
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">AI triage</p>
        <p className="mt-1 text-sm text-slate-700">
          {ticket.triagedAt ? (
            <>
              {ticket.category ?? 'uncategorised'} &middot;{' '}
              {ticket.priority?.toLowerCase() ?? 'no priority'}
            </>
          ) : (
            <Muted>Not triaged</Muted>
          )}
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => retriage.mutation.mutate()}
          disabled={retriage.mutation.isPending}
        >
          {retriage.mutation.isPending
            ? 'Analysing…'
            : ticket.triagedAt
              ? 'Re-run triage'
              : 'Run triage'}
        </Button>
        {!ticket.triagedAt ? (
          <p className="mt-1 text-xs text-slate-500">
            Automatic triage can fail on a provider rate limit. Re-running is safe.
          </p>
        ) : null}
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}
    </Card>
  );
}
