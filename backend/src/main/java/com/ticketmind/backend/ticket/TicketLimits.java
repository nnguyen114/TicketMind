package com.ticketmind.backend.ticket;

/**
 * The lengths a ticket's user-authored text is allowed to be.
 *
 * <p>Constants rather than literals because three layers depend on them
 * agreeing: the request DTOs enforce them, the RAG client relies on them being
 * at or below what the RAG service accepts (256 / 32000), and the frontend
 * mirrors them so a user sees the limit before the round-trip. They were
 * previously written out separately in each place, with the RAG client's copy
 * set higher than the DTOs' — which made its truncation unreachable while
 * looking necessary.
 */
public final class TicketLimits {

	public static final int TITLE_MAX = 200;
	public static final int BODY_MAX = 20_000;

	private TicketLimits() {
	}
}
