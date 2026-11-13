package com.ticketmind.backend.ticket;

/**
 * The agent queue's saved views. Every view but ALL is a work queue, so it
 * leaves out RESOLVED and CLOSED tickets. A submitter's list ignores the view:
 * it is always their own tickets.
 */
public enum TicketView {
	ALL,
	MINE,
	UNASSIGNED,
	URGENT,
	WAITING,
	UNTRIAGED
}
