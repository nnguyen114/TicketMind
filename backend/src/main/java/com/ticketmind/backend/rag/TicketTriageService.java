package com.ticketmind.backend.rag;

import com.ticketmind.backend.common.exception.ErrorCode;
import com.ticketmind.backend.common.exception.ApiException;
import com.ticketmind.backend.rag.dto.TriageResultPayload;
import com.ticketmind.backend.security.jwt.JwtPrincipal;
import com.ticketmind.backend.ticket.TicketPriority;
import com.ticketmind.backend.ticket.TicketTriageGateway;
import com.ticketmind.backend.ticket.TriageOutcome;
import com.ticketmind.backend.ticket.TriageTarget;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

/**
 * Orchestrates the two directions of the RAG integration.
 *
 * <p>Intentionally not {@code @Transactional} at the class level: both methods
 * make an outbound HTTP call that can take seconds, and holding a Hikari
 * connection for that long would exhaust the pool under load. Reads and the
 * write-back both go through {@link TicketTriageGateway}, which owns their
 * transactions; the network call happens with none open.
 */
@Service
public class TicketTriageService {

	private static final Logger log = LoggerFactory.getLogger(TicketTriageService.class);

	private final TicketTriageGateway tickets;
	private final RagClient ragClient;

	public TicketTriageService(TicketTriageGateway tickets, RagClient ragClient) {
		this.tickets = tickets;
		this.ragClient = ragClient;
	}

	/** Triage a freshly created ticket. No-op if it is already triaged. */
	public void triage(UUID ticketId) {
		Optional<TriageTarget> target = tickets.load(ticketId);
		if (target.isEmpty() || target.get().triaged()) {
			return;
		}
		Optional<TriageResultPayload> result =
				ragClient.triage(ticketId, target.get().title(), target.get().description());
		if (result.isEmpty()) {
			return;
		}
		Optional<TriageOutcome> outcome = toOutcome(ticketId, result.get());
		if (outcome.isEmpty()) {
			return;
		}
		if (tickets.apply(ticketId, outcome.get(), false)) {
			log.info("triaged ticket {} as {}/{}", ticketId,
					outcome.get().category(), outcome.get().priority());
		}
	}

	/**
	 * Staff-initiated re-triage. Unlike the automatic path this is synchronous
	 * and reports failure: the whole point is that somebody clicked a button
	 * and needs to know whether it worked, so silently degrading the way the
	 * post-commit listener does would be useless here.
	 *
	 * <p>It overwrites an existing result and appends a second TRIAGED row -
	 * the audit trail should record that a human asked for another opinion.
	 *
	 * <p>Motivating case: provider rate limits. Voyage's free tier allows 3
	 * requests a minute, so a burst of tickets leaves some untriaged through no
	 * fault of the ticket or the operator.
	 */
	public void retriage(JwtPrincipal actor, UUID ticketId) {
		if (!actor.role().isStaff()) {
			// Matches TicketService.assign: a non-staff caller learns nothing
			// about which ticket ids exist.
			throw new ApiException(ErrorCode.TICKET_NOT_FOUND);
		}
		if (!ragClient.isEnabled()) {
			throw new ApiException(ErrorCode.TRIAGE_DISABLED);
		}
		TriageTarget target = tickets.load(ticketId).orElseThrow(ErrorCode.TICKET_NOT_FOUND::exception);
		TriageResultPayload result = ragClient
				.triage(ticketId, target.title(), target.description())
				.orElseThrow(ErrorCode.TRIAGE_FAILED::exception);
		TriageOutcome outcome = toOutcome(ticketId, result).orElseThrow(ErrorCode.TRIAGE_FAILED::exception);
		if (!tickets.apply(ticketId, outcome, true)) {
			// The write found no ticket: it was deleted mid-flight.
			throw new ApiException(ErrorCode.TRIAGE_FAILED);
		}
		log.info("re-triaged ticket {} as {}/{}", ticketId, outcome.category(), outcome.priority());
	}

	/**
	 * Mirror a resolved ticket into the RAG knowledge base so later triage runs
	 * can retrieve it. Upsert-by-external-id makes repeated resolution
	 * idempotent, which matters because a ticket can be reopened and resolved
	 * again.
	 */
	public void publishResolvedTicket(UUID ticketId) {
		tickets.load(ticketId).ifPresent(target -> ragClient.upsertKnowledgeBaseDocument(
				ticketId, target.title(), target.description(), target.category()));
	}

	/**
	 * Translate the wire payload into the ticket module's vocabulary. Empty when
	 * the service sent a priority outside the four the database accepts, which
	 * is the one part of the reply this side cannot repair.
	 */
	private Optional<TriageOutcome> toOutcome(UUID ticketId, TriageResultPayload result) {
		Optional<TicketPriority> priority = TicketPriority.parse(result.priority());
		if (priority.isEmpty()) {
			log.warn("discarding triage for ticket {}: unknown priority {}",
					ticketId, result.priority());
			return Optional.empty();
		}
		return Optional.of(new TriageOutcome(
				result.category(),
				priority.get(),
				result.suggestedResolution(),
				result.summary(),
				result.citationsOrEmpty().stream()
						.map(TriageResultPayload.Citation::externalId)
						.toList()));
	}
}
