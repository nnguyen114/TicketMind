package com.ticketmind.backend.rag;

import com.ticketmind.backend.common.exception.ErrorCode;
import com.ticketmind.backend.common.exception.ApiException;
import com.ticketmind.backend.rag.dto.TriageResultPayload;
import com.ticketmind.backend.security.jwt.JwtPrincipal;
import com.ticketmind.backend.ticket.TicketPriority;
import com.ticketmind.backend.ticket.TicketTriageGateway;
import com.ticketmind.backend.ticket.TriageOutcome;
import com.ticketmind.backend.ticket.TriageTarget;
import com.ticketmind.backend.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Triage orchestration, exercised with no database.
 *
 * <p>This is the point of {@link TicketTriageGateway}: the branching that used
 * to require a Testcontainers Postgres to reach - already-triaged tickets,
 * tickets deleted mid-flight, priorities the database would reject - is now
 * decided against a fake, so each case is one assertion instead of a schema.
 */
class TicketTriageServiceTest {

	private static final UUID TICKET_ID = UUID.randomUUID();

	private FakeGateway gateway;
	private RagClient ragClient;
	private TicketTriageService service;

	@BeforeEach
	void setUp() {
		gateway = new FakeGateway();
		ragClient = mock(RagClient.class);
		when(ragClient.isEnabled()).thenReturn(true);
		service = new TicketTriageService(gateway, ragClient);
	}

	@Nested
	class AutomaticPath {

		@Test
		void writesTheOutcomeWithoutForcing() {
			gateway.target = new TriageTarget("Wifi down", "Floor 3 unreachable", null, false);
			whenRagReturns(payload("network", "HIGH"));

			service.triage(TICKET_ID);

			assertThat(gateway.applied).hasSize(1);
			assertThat(gateway.applied.getFirst().outcome().priority()).isEqualTo(TicketPriority.HIGH);
			assertThat(gateway.applied.getFirst().outcome().category()).isEqualTo("network");
			assertThat(gateway.applied.getFirst().force())
					.as("the automatic path must stay first-write-wins")
					.isFalse();
		}

		@Test
		void skipsATicketThatIsAlreadyTriaged() {
			gateway.target = new TriageTarget("Wifi down", "…", "network", true);

			service.triage(TICKET_ID);

			assertThat(gateway.applied).isEmpty();
		}

		@Test
		void skipsATicketThatNoLongerExists() {
			gateway.target = null;

			service.triage(TICKET_ID);

			assertThat(gateway.applied).isEmpty();
		}

		@Test
		void discardsAPriorityTheDatabaseWouldReject() {
			gateway.target = new TriageTarget("Wifi down", "…", null, false);
			whenRagReturns(payload("network", "SUPER_URGENT"));

			service.triage(TICKET_ID);

			assertThat(gateway.applied)
					.as("an unknown priority must never reach tickets_priority_check")
					.isEmpty();
		}
	}

	@Nested
	class StaffRetriage {

		@Test
		void forcesTheWriteSoTheAuditTrailGainsASecondRow() {
			gateway.target = new TriageTarget("Wifi down", "…", "network", true);
			whenRagReturns(payload("hardware", "CRITICAL"));

			service.retriage(staff(), TICKET_ID);

			assertThat(gateway.applied).hasSize(1);
			assertThat(gateway.applied.getFirst().force())
					.as("re-triage overwrites, unlike the automatic path")
					.isTrue();
		}

		@Test
		void hidesTicketExistenceFromANonStaffCaller() {
			gateway.target = new TriageTarget("Wifi down", "…", null, false);

			assertRetriageFails(submitter(), ErrorCode.TICKET_NOT_FOUND);

			assertThat(gateway.loadCount)
					.as("the role check must short-circuit before anything is read")
					.isZero();
		}

		@Test
		void reportsWhenTriageIsNotConfigured() {
			when(ragClient.isEnabled()).thenReturn(false);

			assertRetriageFails(staff(), ErrorCode.TRIAGE_DISABLED);
		}

		@Test
		void reportsAnUnusablePriorityRatherThanFailingSilently() {
			gateway.target = new TriageTarget("Wifi down", "…", null, false);
			whenRagReturns(payload("network", "SUPER_URGENT"));

			assertRetriageFails(staff(), ErrorCode.TRIAGE_FAILED);

			assertThat(gateway.applied).isEmpty();
		}

		@Test
		void reportsWhenTheRagServiceHasNoAnswer() {
			gateway.target = new TriageTarget("Wifi down", "…", null, false);
			when(ragClient.triage(any(), any(), any())).thenReturn(Optional.empty());

			assertRetriageFails(staff(), ErrorCode.TRIAGE_FAILED);
		}

		@Test
		void reportsWhenTheTicketVanishesBeforeTheWrite() {
			gateway.target = new TriageTarget("Wifi down", "…", null, false);
			gateway.applySucceeds = false;
			whenRagReturns(payload("network", "LOW"));

			assertRetriageFails(staff(), ErrorCode.TRIAGE_FAILED);
		}
	}

	@Test
	void citationsAreCarriedThroughAsExternalIdsOnly() {
		gateway.target = new TriageTarget("Wifi down", "…", null, false);
		when(ragClient.triage(any(), any(), any())).thenReturn(Optional.of(new TriageResultPayload(
				"network", "LOW", "a summary", "restart the AP",
				List.of(new TriageResultPayload.Citation("ticket-1", "Earlier outage", 0.91)))));

		service.triage(TICKET_ID);

		assertThat(gateway.applied.getFirst().outcome().citationIds()).containsExactly("ticket-1");
		assertThat(gateway.applied.getFirst().outcome().summary()).isEqualTo("a summary");
	}

	// ---------- helpers ----------

	private void assertRetriageFails(JwtPrincipal actor, ErrorCode expected) {
		assertThatThrownBy(() -> service.retriage(actor, TICKET_ID))
				.isInstanceOf(ApiException.class)
				.extracting(thrown -> ((ApiException) thrown).code())
				.isEqualTo(expected.code());
	}

	private void whenRagReturns(TriageResultPayload payload) {
		when(ragClient.triage(any(), any(), any())).thenReturn(Optional.of(payload));
	}

	private static TriageResultPayload payload(String category, String priority) {
		return new TriageResultPayload(category, priority, "summary", "resolution", List.of());
	}

	private static JwtPrincipal staff() {
		return new JwtPrincipal(UUID.randomUUID(), "agent@example.com", UserRole.AGENT);
	}

	private static JwtPrincipal submitter() {
		return new JwtPrincipal(UUID.randomUUID(), "user@example.com", UserRole.USER);
	}

	private record Applied(TriageOutcome outcome, boolean force) {
	}

	/**
	 * Stands in for the whole ticket module. That it fits in fifteen lines is
	 * the measure of how narrow the seam is.
	 */
	private static final class FakeGateway implements TicketTriageGateway {

		private TriageTarget target;
		private boolean applySucceeds = true;
		private int loadCount;
		private final List<Applied> applied = new ArrayList<>();

		@Override
		public Optional<TriageTarget> load(UUID ticketId) {
			loadCount++;
			return Optional.ofNullable(target);
		}

		@Override
		public boolean apply(UUID ticketId, TriageOutcome outcome, boolean force) {
			if (!applySucceeds) {
				return false;
			}
			applied.add(new Applied(outcome, force));
			return true;
		}
	}
}
