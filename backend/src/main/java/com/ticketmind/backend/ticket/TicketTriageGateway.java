package com.ticketmind.backend.ticket;

import java.util.Optional;
import java.util.UUID;

/**
 * Everything the triage subsystem is allowed to do to a ticket.
 *
 * <p>This exists so the rag package never holds a ticket repository. Triage
 * used to write {@code tickets} and {@code ticket_history} directly, which made
 * it a second owner of the audit-trail invariant with its own copy of the
 * payload-building logic. Routing through one interface keeps every write to
 * those tables inside this package, and lets the orchestration be tested
 * against a fake with no database at all.
 */
public interface TicketTriageGateway {

	/** The fields triage needs, or empty when the ticket no longer exists. */
	Optional<TriageTarget> load(UUID ticketId);

	/**
	 * Apply a triage result and append its TRIAGED history row in one
	 * transaction.
	 *
	 * @param force when true an already-triaged ticket is overwritten. Only the
	 *              staff-initiated re-triage sets this: the automatic path must
	 *              stay first-write-wins so two listeners racing on the same
	 *              ticket cannot produce two TRIAGED rows.
	 * @return false when the ticket vanished mid-flight or was already triaged
	 *         and {@code force} is not set.
	 */
	boolean apply(UUID ticketId, TriageOutcome outcome, boolean force);
}
