package com.ticketmind.backend.user.dto;

import jakarta.validation.constraints.NotNull;

public record ChangeActiveRequest(@NotNull Boolean active) {
}
