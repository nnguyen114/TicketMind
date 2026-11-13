package com.ticketmind.backend.user;

public enum UserRole {
	USER, AGENT, ADMIN;

	/**
	 * Staff see and act on every ticket; a USER only ever sees their own. This
	 * is the single definition of that split - it was previously spelled out
	 * verbatim in both TicketService and TicketTriageService.
	 */
	public boolean isStaff() {
		return this == AGENT || this == ADMIN;
	}
}
