package com.ticketmind.backend.rag;

import com.ticketmind.backend.ticket.TicketLimits;
import com.ticketmind.backend.rag.dto.TriageResultPayload;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class RagClientTest {

	private static final String BASE_URL = "http://rag.test";
	private static final UUID TICKET_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");

	private MockRestServiceServer server;

	private RagClient clientWith(boolean enabled) {
		RestClient.Builder builder = RestClient.builder().baseUrl(BASE_URL);
		this.server = MockRestServiceServer.bindTo(builder).build();
		RagProperties properties = new RagProperties(
				enabled, URI.create(BASE_URL), "test-internal-key",
				Duration.ofSeconds(1), Duration.ofSeconds(2));
		return new RagClient(builder.defaultHeader("X-Internal-Key", "test-internal-key").build(), properties);
	}

	@Test
	void triageSendsSnakeCasePayloadWithInternalKeyAndParsesTheResponse() {
		RagClient client = clientWith(true);
		server.expect(requestTo(BASE_URL + "/triage"))
				.andExpect(method(org.springframework.http.HttpMethod.POST))
				.andExpect(header("X-Internal-Key", "test-internal-key"))
				.andExpect(jsonPath("$.ticket_id").value(TICKET_ID.toString()))
				.andExpect(jsonPath("$.title").value("Card charged twice"))
				.andExpect(jsonPath("$.body").value("I was billed 40 instead of 20"))
				.andRespond(withSuccess("""
						{
						  "category": "billing",
						  "priority": "HIGH",
						  "summary": "Customer was double-charged.",
						  "suggested_resolution": "Refund the duplicate charge.",
						  "citations": [{"external_id": "kb-1", "title": "Double charges", "score": 0.82}]
						}
						""", MediaType.APPLICATION_JSON));

		Optional<TriageResultPayload> result =
				client.triage(TICKET_ID, "Card charged twice", "I was billed 40 instead of 20");

		server.verify();
		assertThat(result).isPresent();
		assertThat(result.get().category()).isEqualTo("billing");
		assertThat(result.get().priority()).isEqualTo("HIGH");
		assertThat(result.get().summary()).isEqualTo("Customer was double-charged.");
		assertThat(result.get().suggestedResolution()).isEqualTo("Refund the duplicate charge.");
		assertThat(result.get().citationsOrEmpty()).singleElement()
				.satisfies(c -> {
					assertThat(c.externalId()).isEqualTo("kb-1");
					assertThat(c.score()).isEqualTo(0.82);
				});
	}

	@Test
	void triageReturnsEmptyWhenTheRagServiceReportsAnUpstreamFailure() {
		RagClient client = clientWith(true);
		// 502 upstream_error is what the RAG service returns when Claude's reply
		// could not be parsed, a real, expected condition, not a bug.
		server.expect(requestTo(BASE_URL + "/triage"))
				.andRespond(withStatus(HttpStatus.BAD_GATEWAY)
						.contentType(MediaType.APPLICATION_JSON)
						.body("{\"detail\":\"upstream_error\"}"));

		assertThat(client.triage(TICKET_ID, "t", "b")).isEmpty();
		server.verify();
	}

	@Test
	void triageReturnsEmptyWhenTheRagServiceIsUnreachable() {
		RagClient client = clientWith(true);
		server.expect(requestTo(BASE_URL + "/triage")).andRespond(withServerError());

		assertThat(client.triage(TICKET_ID, "t", "b")).isEmpty();
		server.verify();
	}

	@Test
	void triageMakesNoCallWhenTheIntegrationIsDisabled() {
		RagClient client = clientWith(false);
		// No expectations registered: verify() fails if anything was sent.
		assertThat(client.triage(TICKET_ID, "t", "b")).isEmpty();
		server.verify();
	}

	/**
	 * The RAG service answers 422 above 256 / 32000. RagClient used to truncate
	 * to those, which could never fire because the request DTOs already cap
	 * lower - and would have silently shortened a user's report if it had.
	 * Truncation is gone; this is the constraint that replaced it.
	 */
	@Test
	void ticketLimitsStayWithinWhatTheRagServiceAccepts() {
		assertThat(TicketLimits.TITLE_MAX)
				.as("raising this past the RAG service's title cap would start producing 422s")
				.isLessThanOrEqualTo(256);
		assertThat(TicketLimits.BODY_MAX)
				.as("raising this past the RAG service's body cap would start producing 422s")
				.isLessThanOrEqualTo(32_000);
	}

	@Test
	void triageSendsTheBodyThroughUnaltered() {
		RagClient client = clientWith(true);
		String body = "x".repeat(TicketLimits.BODY_MAX);
		server.expect(requestTo(BASE_URL + "/triage"))
				.andExpect(jsonPath("$.body").value(body))
				.andRespond(withSuccess("""
						{"category":"c","priority":"LOW","summary":"s","suggested_resolution":"r","citations":[]}
						""", MediaType.APPLICATION_JSON));

		assertThat(client.triage(TICKET_ID, "t", body)).isPresent();
		server.verify();
	}

	@Test
	void upsertSendsTheTicketIdAsExternalIdSoRepeatsAreIdempotent() {
		RagClient client = clientWith(true);
		server.expect(requestTo(BASE_URL + "/kb/documents"))
				.andExpect(method(org.springframework.http.HttpMethod.POST))
				.andExpect(header("X-Internal-Key", "test-internal-key"))
				.andExpect(jsonPath("$.external_id").value(TICKET_ID.toString()))
				.andExpect(jsonPath("$.category").value("billing"))
				.andRespond(withStatus(HttpStatus.CREATED)
						.contentType(MediaType.APPLICATION_JSON)
						.body("{\"id\":\"1\",\"external_id\":\"x\",\"title\":\"t\",\"category\":null,"
								+ "\"updated_at\":\"2026-01-01T00:00:00Z\"}"));

		assertThat(client.upsertKnowledgeBaseDocument(TICKET_ID, "t", "b", "billing")).isTrue();
		server.verify();
	}

	@Test
	void upsertReportsFailureRatherThanThrowing() {
		RagClient client = clientWith(true);
		server.expect(requestTo(BASE_URL + "/kb/documents"))
				.andRespond(withStatus(HttpStatus.UNAUTHORIZED)
						.contentType(MediaType.APPLICATION_JSON)
						.body("{\"detail\":\"unauthorized\"}"));

		assertThat(client.upsertKnowledgeBaseDocument(TICKET_ID, "t", "b", null)).isFalse();
		server.verify();
	}

	@Test
	void upsertMakesNoCallWhenTheIntegrationIsDisabled() {
		RagClient client = clientWith(false);
		assertThat(client.upsertKnowledgeBaseDocument(TICKET_ID, "t", "b", "c")).isFalse();
		server.verify();
	}

	@Test
	void contentTypeIsJson() {
		RagClient client = clientWith(true);
		server.expect(requestTo(BASE_URL + "/triage"))
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andRespond(withSuccess("""
						{"category":"c","priority":"LOW","summary":"s","suggested_resolution":"r","citations":[]}
						""", MediaType.APPLICATION_JSON));

		client.triage(TICKET_ID, "t", "b");
		server.verify();
	}
}
