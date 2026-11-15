package br.com.freelancenow.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Limits POST requests to the public auth endpoints (login, registration, refresh, password and
 * e-mail links) per client address, against password guessing and mass sign-ups (F10).
 *
 * <p>Fixed one-minute windows kept in memory: enough for a single API instance. Several instances
 * would each count separately; a shared store (e.g. Redis) would be needed then. It runs inside the
 * Spring Security chain right after CORS (see {@code SecurityConfig}), so the 429 carries the CORS
 * headers the browser needs to read it.
 * A limit of 0 turns the filter off (local development and tests).
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private static final Duration WINDOW = Duration.ofMinutes(1);
    private static final String BODY =
            "{\"status\":429,\"title\":\"Too Many Requests\",\"detail\":\"Muitas tentativas em"
                    + " pouco tempo. Aguarde um minuto e tente novamente.\"}";

    private final int limit;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private record Window(Instant start, AtomicInteger count) {}

    public AuthRateLimitFilter(
            @Value("${app.rate-limit.auth-per-minute:0}") int limit, Clock clock) {
        this.limit = limit;
        this.clock = clock;
    }

    /** Registered only inside the security chain, not a second time as a plain servlet filter. */
    @Bean
    static FilterRegistrationBean<AuthRateLimitFilter> authRateLimitRegistration(
            AuthRateLimitFilter filter) {
        var registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return limit <= 0
                || !"POST".equals(request.getMethod())
                || !request.getRequestURI().startsWith("/api/v1/auth/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var now = clock.instant();
        // Behind Render's proxy, server.forward-headers-strategy makes this the client address.
        var key = request.getRemoteAddr();
        var window =
                windows.compute(
                        key,
                        (k, w) ->
                                w == null || w.start().plus(WINDOW).isBefore(now)
                                        ? new Window(now, new AtomicInteger())
                                        : w);
        if (window.count().incrementAndGet() > limit) {
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType("application/problem+json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(BODY);
            return;
        }
        if (windows.size() > 10_000)
            windows.values().removeIf(w -> w.start().plus(WINDOW).isBefore(now));
        chain.doFilter(request, response);
    }
}
