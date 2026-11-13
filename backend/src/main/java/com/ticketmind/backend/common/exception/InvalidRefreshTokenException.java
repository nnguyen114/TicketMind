package com.ticketmind.backend.common.exception;

/**
 * Its own type purely so {@code RefreshTokenService.rotate} can name it in
 * {@code @Transactional(noRollbackFor = ...)}. The family-wide revocation
 * triggered by a re-used token is a bulk UPDATE that the rolling-back outer
 * transaction would otherwise undo, silently disabling reuse detection.
 */
public final class InvalidRefreshTokenException extends ApiException {

	public InvalidRefreshTokenException() {
		super(ErrorCode.INVALID_REFRESH_TOKEN);
	}
}
