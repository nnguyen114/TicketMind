import { useQuery } from '@tanstack/react-query';
import { getHistory, getTicket, ticketKeys } from '@/api/tickets';
import { TRIAGE_POLL_INTERVAL_MS, triageState } from '@/domain/ticket';

/**
 * A ticket and its history. Triage runs after the backend commits the ticket,
 * so a fresh one arrives untriaged: poll until it lands, and stop at the
 * triage window so a ticket that is never triaged does not poll forever.
 */
export function useTicket(id: string) {
  const ticket = useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => getTicket(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data && triageState(query.state.data) === 'analyzing'
        ? TRIAGE_POLL_INTERVAL_MS
        : false,
  });
  const history = useQuery({
    queryKey: ticketKeys.history(id),
    queryFn: () => getHistory(id),
    enabled: Boolean(id),
    // The TRIAGED row lands with the triage itself.
    refetchInterval: () =>
      ticket.data && triageState(ticket.data) === 'analyzing' ? TRIAGE_POLL_INTERVAL_MS : false,
  });
  return { ticket, history };
}
