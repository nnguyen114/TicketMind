package com.ticketmind.backend.ticket;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * The ticket module's side of triage: reads the fields the RAG service needs
 * and persists what it sends back.
 *
 * <p>Deliberately a separate bean from the orchestration in
 * {@code TicketTriageService}: that class must not hold a database transaction
 * open across the (multi-second) call to Claude, while the ticket update and
 * its TRIAGED history row must land atomically. Calling a
 * {@code @Transactional} method on the same class would self-invoke past the
 * proxy and split them into two transactions.
 */
@Component
public class TicketTriageWriter implements TicketTriageGateway {

	private final TicketRepository ticketRepository;
	private final TicketHistoryRepository historyRepository;
	private final ObjectMapper objectMapper;
	private final Clock clock;

	public TicketTriageWriter(
			TicketRepository ticketRepository,
			TicketHistoryRepository historyRepository,
			ObjectMapper objectMapper,
			Clock clock) {
		this.ticketRepository = ticketRepository;
		this.historyRepository = historyRepository;
		this.objectMapper = objectMapper;
		this.clock = clock;
	}

	// No @Transactional: findById runs in the repository's own transaction and
	// every field copied out here is eager, so there is nothing for a
	// surrounding transaction to keep open.
	@Override
	public Optional<TriageTarget> load(UUID ticketId) {
		return ticketRepository.findById(ticketId)
				.map(t -> new TriageTarget(
						t.getTitle(), t.getDescription(), t.getCategory(), t.getTriagedAt() != null));
	}

	@Override
	@Transactional
	public boolean apply(UUID ticketId, TriageOutcome outcome, boolean force) {
		Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
		if (ticket == null) {
			// Deleted between the triage call and the write-back.
			return false;
		}
		if (ticket.getTriagedAt() != null && !force) {
			// A concurrent triage won the race; first result wins so the
			// history stays a single TRIAGED entry.
			return false;
		}

		Instant now = clock.instant();
		ticket.applyTriage(
				outcome.category(), outcome.priority(), outcome.suggestedResolution(), now);

		Map<String, Object> payload = new LinkedHashMap<>();
		payload.put("category", outcome.category());
		payload.put("priority", outcome.priority().name());
		payload.put("summary", outcome.summary());
		payload.put("retriggered", force);
		payload.put("citations", outcome.citationIds());
		// actor is null: triage is performed by the system, not a user. The
		// actor_id column is nullable precisely for this case.
		historyRepository.save(TicketHistory.record(
				ticket, null, TicketHistoryEventType.TRIAGED, toJson(payload), now));
		return true;
	}

	private String toJson(Map<String, ?> payload) {
		try {
			return objectMapper.writeValueAsString(payload);
		} catch (JacksonException e) {
			throw new IllegalStateException("failed to serialise triage history payload", e);
		}
	}
}
