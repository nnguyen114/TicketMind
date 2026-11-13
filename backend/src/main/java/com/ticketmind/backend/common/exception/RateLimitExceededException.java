package com.ticketmind.backend.common.exception;

import org.springframework.http.HttpHeaders;

/** The one error that carries a response header, so it keeps its own type. */
public final class RateLimitExceededException extends ApiException {

	private final long retryAfterSeconds;

	public RateLimitExceededException(long retryAfterSeconds) {
		super(ErrorCode.RATE_LIMIT_EXCEEDED);
		this.retryAfterSeconds = retryAfterSeconds;
	}

	public long retryAfterSeconds() {
		return retryAfterSeconds;
	}

	@Override
	public HttpHeaders headers() {
		HttpHeaders headers = new HttpHeaders();
		headers.add(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
		return headers;
	}
}
