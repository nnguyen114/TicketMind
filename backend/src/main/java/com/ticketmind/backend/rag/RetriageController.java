package com.ticketmind.backend.rag;

import com.ticketmind.backend.security.jwt.JwtPrincipal;
import com.ticketmind.backend.ticket.TicketService;
import com.ticketmind.backend.ticket.dto.TicketResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * The one triage operation a human can start.
 *
 * <p>Lives in the rag package rather than alongside the other ticket endpoints:
 * routing it through {@code TicketController} made the ticket package import
 * rag, which closed a dependency cycle between the two. The URL stays under
 * {@code /tickets} because that is the resource being acted on.
 *
 * <p>Staff only, and synchronous: the caller clicked a button and needs the
 * answer, so this reports 502 triage_failed rather than degrading quietly the
 * way the automatic post-commit path does.
 */
@RestController
public class RetriageController {

	private final TicketTriageService triageService;
	private final TicketService ticketService;

	public RetriageController(TicketTriageService triageService, TicketService ticketService) {
		this.triageService = triageService;
		this.ticketService = ticketService;
	}

	@PostMapping("/tickets/{id}/triage")
	public TicketResponse retriage(
			@AuthenticationPrincipal JwtPrincipal principal,
			@PathVariable UUID id) {
		triageService.retriage(principal, id);
		return TicketResponse.from(ticketService.get(principal, id));
	}
}
