package com.ticketmind.backend.ticket;

import java.util.Optional;

public enum TicketPriority {
	LOW,
	MEDIUM,
	HIGH,
	CRITICAL;

	/**
	 * Parse a priority arriving from outside the process, returning empty rather
	 * than throwing for anything unrecognised.
	 *
	 * <p>The RAG service constrains its reply to these same four values, but
	 * that is an out-of-process contract. An unknown value must be rejected here
	 * rather than reaching the {@code tickets_priority_check} constraint, where
	 * it would fail the whole write.
	 */
	public static Optional<TicketPriority> parse(String raw) {
		if (raw == null) {
			return Optional.empty();
		}
		try {
			return Optional.of(valueOf(raw.trim().toUpperCase()));
		} catch (IllegalArgumentException ex) {
			return Optional.empty();
		}
	}
}
