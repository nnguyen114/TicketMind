package com.ticketmind.backend.ticket;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface TicketRepository extends JpaRepository<Ticket, UUID> {

	@EntityGraph(attributePaths = {"submitter", "assignee"})
	Optional<Ticket> findWithUsersById(UUID id);

	// The count query is spelled out: derived from the fetch-join version it
	// reported the wrong total once the assignee filter joined on `a`.
	@Query(value = """
			SELECT t FROM Ticket t
			LEFT JOIN FETCH t.submitter
			LEFT JOIN FETCH t.assignee a
			WHERE (:status IS NULL OR t.status = :status)
			  AND (:submitterId IS NULL OR t.submitter.id = :submitterId)
			  AND (:assigneeId IS NULL OR a.id = :assigneeId)
			  AND (:unassigned = false OR a IS NULL)
			  AND (:urgent = false OR t.priority IN (
			        com.ticketmind.backend.ticket.TicketPriority.HIGH,
			        com.ticketmind.backend.ticket.TicketPriority.CRITICAL))
			  AND (:untriaged = false OR t.triagedAt IS NULL)
			  AND (:activeOnly = false OR t.status NOT IN (
			        com.ticketmind.backend.ticket.TicketStatus.RESOLVED,
			        com.ticketmind.backend.ticket.TicketStatus.CLOSED))
			""",
			countQuery = """
			SELECT count(t) FROM Ticket t
			LEFT JOIN t.assignee a
			WHERE (:status IS NULL OR t.status = :status)
			  AND (:submitterId IS NULL OR t.submitter.id = :submitterId)
			  AND (:assigneeId IS NULL OR a.id = :assigneeId)
			  AND (:unassigned = false OR a IS NULL)
			  AND (:urgent = false OR t.priority IN (
			        com.ticketmind.backend.ticket.TicketPriority.HIGH,
			        com.ticketmind.backend.ticket.TicketPriority.CRITICAL))
			  AND (:untriaged = false OR t.triagedAt IS NULL)
			  AND (:activeOnly = false OR t.status NOT IN (
			        com.ticketmind.backend.ticket.TicketStatus.RESOLVED,
			        com.ticketmind.backend.ticket.TicketStatus.CLOSED))
			""")
	Page<Ticket> search(
			@Param("status") TicketStatus status,
			@Param("submitterId") UUID submitterId,
			@Param("assigneeId") UUID assigneeId,
			@Param("unassigned") boolean unassigned,
			@Param("urgent") boolean urgent,
			@Param("untriaged") boolean untriaged,
			@Param("activeOnly") boolean activeOnly,
			Pageable pageable);
}
