package com.ticketmind.backend.ticket;

/**
 * Detached copy of the ticket fields triage needs.
 *
 * <p>A record rather than the entity: the automatic path runs on the RAG
 * executor with no session open, so a lazy proxy escaping onto that thread
 * would fail on first access.
 */
public record TriageTarget(String title, String description, String category, boolean triaged) {
}
