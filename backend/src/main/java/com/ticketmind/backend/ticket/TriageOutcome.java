package com.ticketmind.backend.ticket;

import java.util.List;

/**
 * A triage result in the ticket module's own vocabulary.
 *
 * <p>{@code priority} is already a {@link TicketPriority}, so the wire format's
 * string-to-enum conversion happens at the boundary that owns the wire format
 * rather than inside the code that writes the row.
 */
public record TriageOutcome(
		String category,
		TicketPriority priority,
		String suggestedResolution,
		String summary,
		List<String> citationIds) {
}
