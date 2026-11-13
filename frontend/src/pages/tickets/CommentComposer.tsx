import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addComment, ticketKeys } from '@/api/tickets';
import { FormTextArea } from '@/components/FormField';
import { Button } from '@/components/ui';
import { useApiMutation } from '@/hooks/useApiMutation';

export function CommentComposer({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [emptyError, setEmptyError] = useState<string | null>(null);

  const { mutation, errorMessage } = useApiMutation<unknown, string>({
    mutationFn: (value: string) => addComment(ticketId, value),
    onSuccess: () => {
      setBody('');
      // Deliberately narrower than useInvalidateTicket: a comment adds a
      // history row and changes nothing the list or the detail renders.
      void qc.invalidateQueries({ queryKey: ticketKeys.history(ticketId) });
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setEmptyError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setEmptyError('Comment cannot be empty.');
      return;
    }
    mutation.mutate(trimmed);
  };

  const error = emptyError ?? errorMessage;

  return (
    <form onSubmit={submit} className="mt-6">
      <FormTextArea
        label="Add a comment"
        id="comment"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Share an update, question, or resolution notes…"
        error={error ?? undefined}
      />
      <div className="mt-2 flex justify-end">
        <Button type="submit" disabled={mutation.isPending} className="text-sm">
          {mutation.isPending ? 'Posting…' : 'Post comment'}
        </Button>
      </div>
    </form>
  );
}
