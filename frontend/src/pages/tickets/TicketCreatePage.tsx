import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createTicket, TICKET_BODY_MAX, TICKET_TITLE_MAX, ticketKeys } from '@/api/tickets';
import { FormField, FormTextArea } from '@/components/FormField';
import { Button, ErrorText, PageHeading } from '@/components/ui';
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

export function TicketCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '' },
  });

  const { mutation, errorMessage } = useApiMutation({
    mutationFn: createTicket,
    onSuccess: (ticket) => {
      void qc.invalidateQueries({ queryKey: ticketKeys.all });
      navigate(`/tickets/${ticket.id}`, { replace: true });
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  return (
    <div className="max-w-2xl">
      <PageHeading>Open a ticket</PageHeading>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          label="Title"
          placeholder="Short summary of the issue"
          maxLength={TICKET_TITLE_MAX}
          {...register('title')}
          error={errors.title?.message}
        />
        <FormTextArea
          label="Description"
          id="description"
          rows={8}
          placeholder="Steps to reproduce, expected vs. actual, screenshots pasted below…"
          {...register('description')}
          error={errors.description?.message}
        />
        {errorMessage ? <ErrorText>{errorMessage}</ErrorText> : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Submitting…' : 'Submit ticket'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/tickets')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
