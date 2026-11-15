package br.com.freelancenow.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Gives every API request an id and writes one log line when it ends. The id comes from the
 * X-Request-Id header when it is safe to reuse (Render sends one), otherwise it is generated. It
 * goes back in the response header and into the MDC, so every log line of the request carries it
 * and a user can quote it when reporting a problem.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLogFilter extends OncePerRequestFilter {
    static final String HEADER = "X-Request-Id";
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._-]{8,64}");
    private static final Logger log = LoggerFactory.getLogger("http");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader(HEADER);
        String id =
                incoming != null && SAFE_ID.matcher(incoming).matches()
                        ? incoming
                        : UUID.randomUUID().toString();
        long start = System.nanoTime();
        MDC.put("requestId", id);
        response.setHeader(HEADER, id);
        try {
            chain.doFilter(request, response);
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            int status = response.getStatus();
            // Only method, path and status: query strings and bodies may carry personal data.
            if (status >= 500)
                log.error("{} {} {} {}ms", request.getMethod(), request.getRequestURI(), status, ms);
            else
                log.info("{} {} {} {}ms", request.getMethod(), request.getRequestURI(), status, ms);
            MDC.remove("requestId");
        }
    }
}
