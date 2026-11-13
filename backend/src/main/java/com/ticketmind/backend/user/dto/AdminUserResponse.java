package com.ticketmind.backend.user.dto;

import com.ticketmind.backend.user.User;
import com.ticketmind.backend.user.UserRole;

import java.time.Instant;
import java.util.UUID;

// The admin view adds whether the account is locked out. Still no hash,
// counters or timestamps: the admin page needs a yes/no and an Unlock button.
public record AdminUserResponse(
		UUID id, String email, String displayName, UserRole role, boolean active, boolean locked) {

	public static AdminUserResponse from(User user, Instant now) {
		return new AdminUserResponse(user.getId(), user.getEmail(), user.getDisplayName(),
				user.getRole(), user.isActive(), user.isLocked(now));
	}
}
