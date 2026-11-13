package com.ticketmind.backend.user;

import com.ticketmind.backend.security.jwt.JwtPrincipal;
import com.ticketmind.backend.user.dto.AdminUserResponse;
import com.ticketmind.backend.user.dto.ChangeActiveRequest;
import com.ticketmind.backend.user.dto.ChangeRoleRequest;
import com.ticketmind.backend.user.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/users")
public class UserController {

	private final UserService userService;
	private final Clock clock;

	public UserController(UserService userService, Clock clock) {
		this.userService = userService;
		this.clock = clock;
	}

	/**
	 * Staff roster. Exists so an assignee picker has something to call, the
	 * ticket UI could previously only self-assign because no endpoint listed
	 * agents. Staff-only: a submitter has no business enumerating accounts.
	 */
	@GetMapping
	@PreAuthorize("hasAnyRole('AGENT','ADMIN')")
	public List<UserResponse> listStaff() {
		return userService.listStaff().stream().map(UserResponse::from).toList();
	}

	@GetMapping("/me")
	public UserResponse me(@AuthenticationPrincipal JwtPrincipal principal) {
		return UserResponse.from(userService.require(principal.id()));
	}

	@PatchMapping("/{id}/role")
	@PreAuthorize("hasRole('ADMIN')")
	public UserResponse changeRole(
			@AuthenticationPrincipal JwtPrincipal principal,
			@PathVariable UUID id,
			@Valid @RequestBody ChangeRoleRequest request) {
		return UserResponse.from(userService.changeRole(principal, id, request.role()));
	}

	@GetMapping("/all")
	@PreAuthorize("hasRole('ADMIN')")
	public List<AdminUserResponse> listAll() {
		var now = clock.instant();
		return userService.listAll().stream().map(u -> AdminUserResponse.from(u, now)).toList();
	}

	@PatchMapping("/{id}/active")
	@PreAuthorize("hasRole('ADMIN')")
	public AdminUserResponse changeActive(
			@AuthenticationPrincipal JwtPrincipal principal,
			@PathVariable UUID id,
			@Valid @RequestBody ChangeActiveRequest request) {
		return AdminUserResponse.from(userService.changeActive(principal, id, request.active()), clock.instant());
	}

	@PostMapping("/{id}/unlock")
	@PreAuthorize("hasRole('ADMIN')")
	public AdminUserResponse unlock(@PathVariable UUID id) {
		return AdminUserResponse.from(userService.unlock(id), clock.instant());
	}
}
