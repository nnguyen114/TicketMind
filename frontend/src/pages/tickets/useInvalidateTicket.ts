import { useQueryClient } from '@tanstack/react-query';
import { ticketKeys } from '@/api/tickets';

/**
 * What goes stale when a ticket is mutated, decided once. Invalidating the
 * detail key also covers that ticket's history, because query keys match by
 * prefix.
 */
export function useInvalidateTicket(ticketId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) });
    void qc.invalidateQueries({ queryKey: ticketKeys.all });
  };
}
