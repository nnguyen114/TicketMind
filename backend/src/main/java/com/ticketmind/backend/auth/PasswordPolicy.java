package com.ticketmind.backend.auth;

import com.ticketmind.backend.common.exception.ErrorCode;
import com.ticketmind.backend.common.exception.ApiException;
import com.ticketmind.backend.security.AuthProperties;
import org.springframework.stereotype.Component;

@Component
public class PasswordPolicy {

	private static final int MAX_LENGTH = 256;

	private final AuthProperties properties;

	public PasswordPolicy(AuthProperties properties) {
		this.properties = properties;
	}

	public void verify(String rawPassword, String email) {
		if (rawPassword == null) {
			throw new ApiException(ErrorCode.PASSWORD_POLICY, "missing");
		}
		int len = rawPassword.length();
		if (len < properties.passwordMinLength()) {
			throw new ApiException(ErrorCode.PASSWORD_POLICY, "too_short");
		}
		if (len > MAX_LENGTH) {
			throw new ApiException(ErrorCode.PASSWORD_POLICY, "too_long");
		}
		if (email != null && rawPassword.equalsIgnoreCase(email)) {
			throw new ApiException(ErrorCode.PASSWORD_POLICY, "contains_email");
		}
	}
}
