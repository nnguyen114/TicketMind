package com.ticketmind.backend.auth;

import com.ticketmind.backend.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A client that writes a fresh X-Forwarded-For on every request must still
 * land in one rate-limit bucket. The header is client-controlled; only the
 * socket peer (rewritten by Tomcat's RemoteIpValve for trusted proxies, which
 * MockMvc does not run) identifies the caller.
 */
@SpringBootTest(properties = "app.rate-limit.login.capacity=2")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class ForwardedForRateLimitTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private RateLimiterService rateLimiterService;

	@BeforeEach
	void reset() {
		rateLimiterService.reset();
	}

	@Test
	void forgedForwardedForDoesNotBuyFreshBuckets() throws Exception {
		String body = "{\"email\":\"nobody@example.com\",\"password\":\"wrong-password-12345\"}";
		for (int i = 0; i < 2; i++) {
			mockMvc.perform(post("/auth/login")
							.header("X-Forwarded-For", "203.0.113." + i)
							.contentType(MediaType.APPLICATION_JSON)
							.content(body))
					.andExpect(status().isUnauthorized());
		}
		mockMvc.perform(post("/auth/login")
						.header("X-Forwarded-For", "203.0.113.99")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isTooManyRequests());
	}
}
