package com.ticketmind.backend;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the direction of the ticket/rag dependency.
 *
 * <p>The triage subsystem is built on top of the ticket domain, so
 * {@code rag -> ticket} is expected. The reverse is not: a single import the
 * other way makes the two packages mutually dependent, and the re-triage
 * endpoint introduced exactly that by living in {@code TicketController}.
 *
 * <p>The second rule is the one that matters more. The ticket module owns its
 * own tables, and triage reaches them through
 * {@code TicketTriageGateway}. Letting the rag package hold a repository
 * directly is what allowed a second writer of {@code ticket_history} to appear,
 * with its own copy of the payload-building logic.
 *
 * <p>Source-file scanning rather than bytecode: it needs no extra dependency,
 * and an import statement is precisely the thing being constrained.
 */
class ArchitectureBoundaryTest {

	private static final Path SOURCE_ROOT = Path.of("src/main/java/com/ticketmind/backend");

	@Test
	void ticketPackageDoesNotDependOnRag() throws IOException {
		assertThat(importsMatching("ticket", Pattern.compile("^import com\\.ticketmind\\.backend\\.rag\\.")))
				.as("the ticket package must not import from rag; triage depends on tickets, not the reverse")
				.isEmpty();
	}

	@Test
	void ragPackageReachesTicketsOnlyThroughTheGateway() throws IOException {
		assertThat(importsMatching("rag", Pattern.compile("^import com\\.ticketmind\\.backend\\.ticket\\..*Repository;")))
				.as("rag must go through TicketTriageGateway rather than holding a ticket repository")
				.isEmpty();
	}

	/** Every offending line, as "File.java: the import", so a failure names the culprit. */
	private static List<String> importsMatching(String packageName, Pattern forbidden) throws IOException {
		Path dir = SOURCE_ROOT.resolve(packageName);
		assertThat(dir).as("source directory for package " + packageName).exists();
		try (Stream<Path> files = Files.walk(dir)) {
			return files
					.filter(p -> p.toString().endsWith(".java"))
					.flatMap(p -> readLines(p).stream()
							.filter(line -> forbidden.matcher(line).find())
							.map(line -> p.getFileName() + ": " + line.trim()))
					.toList();
		}
	}

	private static List<String> readLines(Path file) {
		try {
			return Files.readAllLines(file);
		} catch (IOException e) {
			throw new IllegalStateException("could not read " + file, e);
		}
	}
}
