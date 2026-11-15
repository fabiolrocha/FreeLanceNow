package br.com.freelancenow.api.favorites;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Saved services. The table has no entity: it is a plain pair of ids with a timestamp. */
@RestController
@RequestMapping("/api/v1")
public class FavoriteController {
    static final int LIMIT = 200;

    public record Favorites(List<UUID> serviceIds) {}

    private final CurrentUser current;
    private final JdbcTemplate db;
    private final Clock clock;

    public FavoriteController(CurrentUser current, JdbcTemplate db, Clock clock) {
        this.current = current;
        this.db = db;
        this.clock = clock;
    }

    /** Newest first. Listings that are no longer active stay saved but are left out. */
    @GetMapping("/users/me/favorites")
    public Favorites list(@AuthenticationPrincipal Jwt jwt) {
        var user = current.require(jwt);
        return new Favorites(
                db.queryForList(
                        "select f.service_id from favorite_service f join service_listing s on s.id"
                                + " = f.service_id where f.user_id = ? and s.status = 'ACTIVE'"
                                + " order by f.created_at desc",
                        UUID.class,
                        user.getId()));
    }

    @PutMapping("/services/{id}/favorite")
    @Transactional
    public ResponseEntity<Void> save(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        var user = current.require(jwt);
        Integer active =
                db.queryForObject(
                        "select count(*) from service_listing where id = ? and status = 'ACTIVE'",
                        Integer.class,
                        id);
        if (active == null || active == 0)
            throw new ApiException(HttpStatus.NOT_FOUND, "Serviço não encontrado.");
        Integer saved =
                db.queryForObject(
                        "select count(*) from favorite_service where user_id = ?",
                        Integer.class,
                        user.getId());
        if (saved != null && saved >= LIMIT)
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Você já salvou " + LIMIT + " serviços. Remova algum para salvar outro.");
        db.update(
                "insert into favorite_service (user_id, service_id, created_at) values (?, ?, ?)"
                        + " on conflict do nothing",
                user.getId(),
                id,
                Timestamp.from(Instant.now(clock)));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/services/{id}/favorite")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        db.update(
                "delete from favorite_service where user_id = ? and service_id = ?",
                current.require(jwt).getId(),
                id);
        return ResponseEntity.noContent().build();
    }
}
