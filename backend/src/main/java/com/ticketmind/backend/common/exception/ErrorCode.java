package com.ticketmind.backend.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Every error this API can return, paired with the status it answers with.
 *
 * <p>One enum rather than one class per error: the codes are a contract the
 * frontend keys off (see {@code src/lib/errorMessages.ts}), and a contract is
 * easier to keep honest when the whole of it fits on one screen. Nothing here
 * carries a message, because messages are never serialised - {@code ApiError}
 * has no field for one.
 */
public enum ErrorCode {

	ACCOUNT_LOCKED(HttpStatus.LOCKED, "account_locked"),
	AGENT_REQUIRED(HttpStatus.BAD_REQUEST, "agent_required"),
	EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT, "email_already_registered"),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "invalid_credentials"),

	// Its own type, because RefreshTokenService.rotate names that type in
	// `noRollbackFor` to keep family revocation from being rolled back. Building
	// a plain ApiException here would silently disable reuse detection, so the
	// enum hands back the right type rather than trusting call sites to.
	INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "invalid_refresh_token") {
		@Override
		public ApiException exception() {
			return new InvalidRefreshTokenException();
		}
	},

	INVALID_TICKET_STATE(HttpStatus.CONFLICT, "invalid_ticket_state"),
	LAST_ADMIN(HttpStatus.CONFLICT, "last_admin"),
	PASSWORD_POLICY(HttpStatus.BAD_REQUEST, "password_policy"),

	// Carries Retry-After, so it must be constructed with the wait: use
	// `new RateLimitExceededException(seconds)`.
	RATE_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "rate_limit_exceeded"),

	TICKET_NOT_FOUND(HttpStatus.NOT_FOUND, "ticket_not_found"),
	TRIAGE_DISABLED(HttpStatus.SERVICE_UNAVAILABLE, "triage_disabled"),
	TRIAGE_FAILED(HttpStatus.BAD_GATEWAY, "triage_failed"),
	USER_NOT_FOUND(HttpStatus.NOT_FOUND, "user_not_found"),

	// Raised by GlobalExceptionHandler for framework-level failures rather than
	// thrown by domain code, but part of the same wire contract.
	VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "validation_error"),
	FORBIDDEN(HttpStatus.FORBIDDEN, "forbidden"),
	NOT_FOUND(HttpStatus.NOT_FOUND, "not_found"),
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error");

	private final HttpStatus status;
	private final String code;

	ErrorCode(HttpStatus status, String code) {
		this.status = status;
		this.code = code;
	}

	public HttpStatus status() {
		return status;
	}

	public String code() {
		return code;
	}

	/** Method-reference friendly, for {@code orElseThrow(TICKET_NOT_FOUND::exception)}. */
	public ApiException exception() {
		return new ApiException(this);
	}
}
