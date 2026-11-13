package com.ticketmind.backend.common.web;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The servlet path, derived the one way that works everywhere.
 *
 * <p>Not {@code getServletPath()}: that is populated from the container's
 * servlet mapping and comes back empty under MockMvc, which once silently
 * disabled the actuator exemption inside the very test written to prove it
 * worked. Both security filters need this, so it lives in one place rather
 * than being reimplemented alongside a copy of this explanation.
 */
public final class RequestPaths {

	private RequestPaths() {
	}

	public static String of(HttpServletRequest request) {
		return request.getRequestURI().substring(request.getContextPath().length());
	}
}
