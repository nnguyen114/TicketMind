package com.ticketmind.backend.common.exception;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * Any failure the global handler is allowed to translate into an API error
 * envelope. The {@link ErrorCode} decides the status and the machine-readable
 * code; the exception message is for logs and stack traces only and is never
 * serialised to the client.
 */
public class ApiException extends RuntimeException {

	private final ErrorCode error;

	public ApiException(ErrorCode error) {
		super(error.code());
		this.error = error;
	}

	/** @param detail context for the log, never sent to the client. */
	public ApiException(ErrorCode error, String detail) {
		super(detail);
		this.error = error;
	}

	public HttpStatus status() {
		return error.status();
	}

	public String code() {
		return error.code();
	}

	/**
	 * Extra response headers this failure needs. Overridden rather than
	 * type-tested in the handler, so a future error that carries a header does
	 * not add another branch there.
	 */
	public HttpHeaders headers() {
		return HttpHeaders.EMPTY;
	}
}
