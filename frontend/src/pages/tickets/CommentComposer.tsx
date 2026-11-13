import { useState } from 'react';
import { addComment } from '@/api/tickets';
import { Button, ErrorText } from '@/components/ui';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useInvalidateTicket } from './useInvalidateTicket';

/**
 * Controlled, so the AI card's "Use as reply" can fill it and the draft lives
 * in the page rather than in here. Cmd/Ctrl+Enter sends.
 */
export function CommentComposer({
  ticketId,
  label,
  value,
  onChange,
}: {
  ticketId: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  // The whole ticket, not just its history: a submitter's reply moves a
  // WAITING ticket back to IN_PROGRESS, which the header and queue show.
  const invalidate = useInvalidateTicket(ticketId);
  const [emptyError, setEmptyError] = useState<string | null>(null);

  const { mutation, errorMessage } = useApiMutation<unknown, string>({
    mutationFn: (body: string) => addComment(ticketId, body),
    onSuccess: () => {
      onChange('');
      invalidate();
    },
  });

  const error = emptyError ?? errorMessage;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setEmptyError(null);
        const trimmed = value.trim();
        if (!trimmed) {
          setEmptyError('Write a reply before sending.');
          return;
        }
        if (!mutation.isPending) mutation.mutate(trimmed);
      }}
      className="flex flex-col gap-2.5 rounded-xl border border-zinc-300 bg-white p-3 focus-within:ring-2 focus-within:ring-brand-600 shadow-[0_-4px_12px_rgba(24,24,27,0.04)]"
    >
      <label htmlFor="comment" className="text-xs font-semibold text-zinc-700">
        {label}
      </label>
      <textarea
        id="comment"
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Write a reply"
        aria-invalid={error ? true : undefined}
        aria-describedby="comment-shortcut"
        className="min-h-16 resize-y text-zinc-900 outline-none"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <div className="flex items-center justify-end gap-3">
        <span id="comment-shortcut" className="hidden text-xs text-zinc-500 sm:inline">
          ⌘/Ctrl + Enter to send
        </span>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Sending…' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}
