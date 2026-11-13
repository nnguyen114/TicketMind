import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addComment, ticketKeys } from '@/api/tickets';
import { Button, ErrorText } from '@/components/ui';
import { useApiMutation } from '@/hooks/useApiMutation';

/**
 * Controlled, so the AI card's "Use as reply" can fill it and the draft lives
 * in the page rather than in here.
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
  const qc = useQueryClient();
  const [emptyError, setEmptyError] = useState<string | null>(null);

  const { mutation, errorMessage } = useApiMutation<unknown, string>({
    mutationFn: (body: string) => addComment(ticketId, body),
    onSuccess: () => {
      onChange('');
      // Deliberately narrower than useInvalidateTicket: a comment adds a
      // history row and changes nothing the list or the detail renders.
      void qc.invalidateQueries({ queryKey: ticketKeys.history(ticketId) });
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
        mutation.mutate(trimmed);
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
        placeholder="Write a reply"
        aria-invalid={error ? true : undefined}
        className="min-h-16 resize-y text-zinc-900 outline-none"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Sending…' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}
