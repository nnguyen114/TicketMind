import { useQuery } from '@tanstack/react-query';
import { getHistory, getTicket, ticketKeys } from '@/api/tickets';
import { LIVE_REFRESH_MS, TRIAGE_POLL_INTERVAL_MS, triageState } from '@/domain/ticket';

/**
 * A ticket and its history. Triage runs after the backend commits the ticket,
 * so a fresh one arrives untriaged: poll fast until it lands or the triage
 * window closes, then fall back to the slow refresh that picks up replies.
 */
export function useTicket(id: string) {
  const ticket = useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => getTicket(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data && triageState(query.state.data) === 'analyzing'
        ? TRIAGE_POLL_INTERVAL_MS
        : LIVE_REFRESH_MS,
  });
  const history = useQuery({
    queryKey: ticketKeys.history(id),
    queryFn: () => getHistory(id),
    enabled: Boolean(id),
    // The TRIAGED row lands with the triage itself; replies land any time.
    refetchInterval: () =>
      ticket.data && triageState(ticket.data) === 'analyzing'
        ? TRIAGE_POLL_INTERVAL_MS
        : LIVE_REFRESH_MS,
  });
  return { ticket, history };
}
