import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  changeTicketStatus,
  TICKET_BODY_MAX,
  TICKET_TITLE_MAX,
  updateTicket,
  type TicketDetail,
} from '@/api/tickets';
import { useAuth } from '@/auth/useAuth';
import { isStaff } from '@/domain/user';
import { FormField, FormTextArea } from '@/components/FormField';
import { StatusBadge } from '@/components/StatusBadge';
import { Icon } from '@/components/icons';
import { Button, Card, ErrorText, SectionHeading } from '@/components/ui';
import { formatError } from '@/lib/errorMessages';
import { useApiMutation } from '@/hooks/useApiMutation';
import { AgentWorkspace } from './AgentWorkspace';
import { CommentComposer } from './CommentComposer';
import { Conversation } from './Conversation';
import { useInvalidateTicket } from './useInvalidateTicket';
import { useTicket } from './useTicket';

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  return isStaff(user?.role) ? <AgentWorkspace selectedId={id} /> : <SubmitterTicket id={id} />;
}

/**
 * A submitter's view of their ticket: their wording for the status, the
 * conversation without internal events, and no AI output — a draft nobody has
 * checked yet is not something to show a customer.
 */
function SubmitterTicket({ id }: { id: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const invalidate = useInvalidateTicket(id);
  const { ticket, history } = useTicket(id);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  if (ticket.isPending) {
    return <p className="mx-auto w-full max-w-2xl px-5 py-6 text-zinc-500">Loading ticket…</p>;
  }
  if (ticket.isError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <ErrorText className="text-base">{formatError(ticket.error)}</ErrorText>
        <Link to="/tickets" className="mt-4 inline-block text-brand-600 hover:underline">
          ← My tickets
        </Link>
      </div>
    );
  }

  const t = ticket.data;
  const isOwner = user?.id === t.submitter?.id;
  const open = isOwner && t.status === 'OPEN';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-5">
      <Link to="/tickets" className="inline-flex items-center gap-1 text-[13px] text-brand-600">
        <Icon name="back" size={14} />
        My tickets
      </Link>
      <div>
        <StatusBadge
          status={t.status}
          audience="submitter"
          className={`text-[13px] font-semibold ${t.status === 'WAITING' ? 'text-orange-800' : 'text-zinc-700'}`}
        />
        <h1 className="mt-1 text-2xl font-bold break-words">{t.title}</h1>
        {t.status === 'WAITING' ? (
          <p className="mt-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-[13px] text-orange-900">
            We need a reply from you to keep going.
          </p>
        ) : null}
      </div>

      {editing ? (
        <EditTicket ticket={t} onDone={() => setEditing(false)} onSaved={invalidate} />
      ) : history.isError ? (
        <ErrorText>{formatError(history.error)}</ErrorText>
      ) : (
        <Conversation
          ticket={t}
          entries={history.data ?? []}
          audience="submitter"
          viewerId={user?.id}
        />
      )}

      {open && !editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start text-[13px] text-brand-600 hover:underline"
        >
          Edit ticket
        </button>
      ) : null}

      {t.status !== 'CLOSED' ? (
        <CommentComposer ticketId={t.id} label="Reply" value={draft} onChange={setDraft} />
      ) : null}

      {open ? (
        <SubmitterClose
          ticket={t}
          onClosed={() => {
            invalidate();
            navigate('/tickets');
          }}
        />
      ) : null}
    </div>
  );
}

function EditTicket({
  ticket,
  onDone,
  onSaved,
}: {
  ticket: TicketDetail;
  onDone: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [blankError, setBlankError] = useState<string | null>(null);
  const { mutation, errorMessage } = useApiMutation({
    mutationFn: () =>
      updateTicket(ticket.id, { title: title.trim(), description: description.trim() }),
    onSuccess: () => {
      onSaved();
      onDone();
    },
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setBlankError(null);
        if (!title.trim() || !description.trim()) {
          setBlankError('Title and description are required.');
          return;
        }
        mutation.mutate();
      }}
    >
      <FormField
        label="Title"
        id="edit-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={TICKET_TITLE_MAX}
      />
      <FormTextArea
        label="Description"
        id="edit-description"
        rows={6}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={TICKET_BODY_MAX}
      />
      {(blankError ?? errorMessage) ? <ErrorText>{blankError ?? errorMessage}</ErrorText> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SubmitterClose({ ticket, onClosed }: { ticket: TicketDetail; onClosed: () => void }) {
  const { mutation, errorMessage } = useApiMutation({
    mutationFn: () => changeTicketStatus(ticket.id, 'CLOSED'),
    onSuccess: () => onClosed(),
  });
  return (
    <Card>
      <SectionHeading>Close this ticket</SectionHeading>
      <p className="mt-1 text-[13px] text-zinc-600">
        If your issue is sorted, you can close the ticket. It cannot be reopened afterwards.
      </p>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Closing…' : 'Close ticket'}
      </Button>
      {errorMessage ? <ErrorText className="mt-2">{errorMessage}</ErrorText> : null}
    </Card>
  );
}
