import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createTicket, TICKET_BODY_MAX, TICKET_TITLE_MAX, ticketKeys } from '@/api/tickets';
import { FormField, FormTextArea } from '@/components/FormField';
import { Icon } from '@/components/icons';
import { Button, ErrorText } from '@/components/ui';
import { useApiMutation } from '@/hooks/useApiMutation';

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(TICKET_TITLE_MAX, `Title must be ${TICKET_TITLE_MAX} characters or fewer`),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(TICKET_BODY_MAX, 'Description is too long'),
});

type FormValues = z.infer<typeof schema>;

// The counter turns amber once the title is this close to the limit.
const TITLE_WARN_AT = 20;

export function TicketCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '' },
  });

  const { mutation, errorMessage } = useApiMutation({
    mutationFn: createTicket,
    onSuccess: (ticket) => {
      // Seed the cache so the confirmation page renders without a round trip.
      qc.setQueryData(ticketKeys.detail(ticket.id), ticket);
      void qc.invalidateQueries({ queryKey: ticketKeys.all });
      navigate(`/tickets/${ticket.id}/submitted`, { replace: true });
    },
  });

  const left = TICKET_TITLE_MAX - watch('title').length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col bg-white sm:my-6 sm:rounded-xl sm:border sm:border-zinc-200">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-3">
        <Link
          to="/tickets"
          aria-label="Back to my tickets"
          className="inline-flex size-11 items-center justify-center rounded-lg text-zinc-900"
        >
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-lg font-bold">New ticket</h1>
      </div>
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-1 flex-col gap-5 px-5 py-6"
        noValidate
      >
        <div>
          <FormField
            label="Title"
            placeholder="Short summary of the issue"
            maxLength={TICKET_TITLE_MAX}
            {...register('title')}
            error={errors.title?.message}
          />
          <p
            className={`mt-1 text-right text-[13px] font-semibold ${
              left <= TITLE_WARN_AT ? 'text-amber-800' : 'text-zinc-500'
            }`}
            aria-live="polite"
          >
            {left} characters left
          </p>
        </div>
        <FormTextArea
          label="Description"
          id="description"
          rows={10}
          hint="Include what you expected, what happened, and any error message."
          {...register('description')}
          error={errors.description?.message}
        />
        {errorMessage ? <ErrorText>{errorMessage}</ErrorText> : null}
        <Button
          type="submit"
          size="lg"
          disabled={mutation.isPending}
          className="mt-auto rounded-xl"
        >
          {mutation.isPending ? 'Submitting…' : 'Submit ticket'}
        </Button>
      </form>
    </div>
  );
}
