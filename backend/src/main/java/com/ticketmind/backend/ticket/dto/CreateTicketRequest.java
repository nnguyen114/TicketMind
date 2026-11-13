package com.ticketmind.backend.ticket.dto;

import jakarta.validation.constraints.NotBlank;
import com.ticketmind.backend.ticket.TicketLimits;
import jakarta.validation.constraints.Size;

public record CreateTicketRequest(
		@NotBlank @Size(max = TicketLimits.TITLE_MAX) String title,
		@NotBlank @Size(max = TicketLimits.BODY_MAX) String description) {
}
