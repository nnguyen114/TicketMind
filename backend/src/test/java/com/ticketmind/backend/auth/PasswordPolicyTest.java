package com.ticketmind.backend.auth;

import com.ticketmind.backend.common.exception.ApiException;
import com.ticketmind.backend.common.exception.ErrorCode;
import com.ticketmind.backend.security.AuthProperties;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordPolicyTest {

	private final AuthProperties properties = new AuthProperties(12, 12, 5, Duration.ofMinutes(15), null);
	private final PasswordPolicy policy = new PasswordPolicy(properties);

	@Test
	void acceptsPasswordAtOrAboveMinLength() {
		assertThatCode(() -> policy.verify("correct horse battery staple", "u@example.com"))
				.doesNotThrowAnyException();
	}

	@Test
	void rejectsTooShortPassword() {
		assertRejects("short1!", "u@example.com", "too_short");
	}

	@Test
	void rejectsExcessivelyLongPassword() {
		assertRejects("a".repeat(300), "u@example.com", "too_long");
	}

	@Test
	void rejectsPasswordEqualToEmail() {
		assertRejects("alice@example.com", "ALICE@example.com", "contains_email");
	}

	@Test
	void rejectsNullPassword() {
		assertRejects(null, "u@example.com", "missing");
	}

	/**
	 * Every rejection answers the same wire code; the reason survives only as the
	 * exception message, which is for logs. Asserting both keeps the distinction
	 * visible - a client cannot tell these four cases apart, and that is
	 * deliberate.
	 */
	private void assertRejects(String password, String email, String reason) {
		assertThatThrownBy(() -> policy.verify(password, email))
				.isInstanceOf(ApiException.class)
				.hasMessage(reason)
				.extracting(thrown -> ((ApiException) thrown).code())
				.isEqualTo(ErrorCode.PASSWORD_POLICY.code());
	}
}
