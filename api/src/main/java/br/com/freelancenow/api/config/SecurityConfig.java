package br.com.freelancenow.api.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.*;
import org.springframework.web.filter.CorsFilter;

import java.time.Clock;
import java.util.Arrays;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    JwtEncoder jwtEncoder(
            @Value("${app.jwt.secret}") String secret, JwtSecretValidator secretValidator) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(secretValidator.key(secret)));
    }

    @Bean
    JwtDecoder jwtDecoder(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.issuer}") String issuer,
            JwtSecretValidator secretValidator) {
        var decoder =
                NimbusJwtDecoder.withSecretKey(secretValidator.key(secret))
                        .macAlgorithm(MacAlgorithm.HS256)
                        .build();
        // Refresh and password-reset tokens share the signing key but carry a "purpose" claim;
        // only plain access tokens may authenticate API requests.
        OAuth2TokenValidator<Jwt> accessOnly =
                jwt ->
                        jwt.hasClaim("purpose")
                                ? OAuth2TokenValidatorResult.failure(
                                        new OAuth2Error(
                                                "invalid_token",
                                                "Token sem permissão de acesso.",
                                                null))
                                : OAuth2TokenValidatorResult.success();
        decoder.setJwtValidator(
                new DelegatingOAuth2TokenValidator<>(
                        JwtValidators.createDefaultWithIssuer(issuer), accessOnly));
        return decoder;
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, AuthRateLimitFilter rateLimit)
            throws Exception {
        var converter = new JwtAuthenticationConverter();
        var roles = new JwtGrantedAuthoritiesConverter();
        roles.setAuthoritiesClaimName("role");
        roles.setAuthorityPrefix("ROLE_");
        converter.setJwtGrantedAuthoritiesConverter(roles);
        return http.csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .addFilterAfter(rateLimit, CorsFilter.class)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        a ->
                                a.requestMatchers("/api/v1/auth/**", "/actuator/health", "/error")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.OPTIONS, "/**")
                                        .permitAll()
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/v1/categories",
                                                "/api/v1/services",
                                                "/api/v1/services/*",
                                                "/api/v1/services/*/reviews",
                                                "/api/v1/services/*/images/*",
                                                "/api/v1/freelancers",
                                                "/api/v1/freelancers/*",
                                                "/api/v1/freelancers/*/reviews",
                                                "/api/v1/users/*/avatar")
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                .oauth2ResourceServer(
                        o ->
                                o.jwt(j -> j.jwtAuthenticationConverter(converter))
                                        .authenticationEntryPoint(
                                                (req, res, ex) -> {
                                                    res.setStatus(401);
                                                    res.setContentType("application/problem+json");
                                                    res.getWriter()
                                                            .write(
                                                                    "{\"status\":401,\"title\":\"Unauthorized\",\"detail\":\"Entre"
                                                                        + " novamente para"
                                                                        + " continuar.\"}");
                                                }))
                .exceptionHandling(
                        e ->
                                e.accessDeniedHandler(
                                        (req, res, ex) -> {
                                            res.setStatus(403);
                                            res.setContentType("application/problem+json");
                                            res.getWriter()
                                                    .write(
                                                            "{\"status\":403,\"title\":\"Forbidden\",\"detail\":\"Seu"
                                                                + " perfil não permite esta"
                                                                + " ação.\"}");
                                        }))
                .build();
    }

    /**
     * The method name matters: Spring Security's {@code cors()} looks the source up by the bean
     * name {@code corsConfigurationSource}. Under any other name no CORS headers are sent, which
     * the Vite proxy hides locally but breaks a frontend on another origin (Vercel).
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${app.cors-origins}") String origins) {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(origins.split(",")));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type"));
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
