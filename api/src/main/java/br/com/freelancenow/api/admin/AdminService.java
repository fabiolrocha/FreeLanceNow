package br.com.freelancenow.api.admin;

import br.com.freelancenow.api.catalog.*;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.users.*;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class AdminService {
    private final AdminAccess access;
    private final UserRepository users;
    private final CategoryRepository categories;
    private final AuditService audit;
    private final AuditRepository events;
    private final org.springframework.jdbc.core.JdbcTemplate db;

    public AdminService(
            AdminAccess access,
            UserRepository users,
            CategoryRepository categories,
            AuditService audit,
            AuditRepository events,
            org.springframework.jdbc.core.JdbcTemplate db) {
        this.access = access;
        this.users = users;
        this.categories = categories;
        this.audit = audit;
        this.events = events;
        this.db = db;
    }

    public List<AdminDtos.UserView> users(Jwt jwt) {
        access.require(jwt);
        return users
                .findAll(
                        org.springframework.data.domain.Sort.by("createdAt")
                                .descending()
                                .and(org.springframework.data.domain.Sort.by("id")))
                .stream()
                .map(AdminDtos.UserView::from)
                .toList();
    }

    @Transactional
    public AdminDtos.UserView status(Jwt jwt, UUID id, AdminDtos.UserStatus r) {
        var actor = access.require(jwt);
        var u = users.lockById(id).orElseThrow(() -> missing("Usuário"));
        if (u.getRole() == Role.ADMIN)
            throw new ApiException(
                    HttpStatus.CONFLICT, "Administradores não podem ser suspensos por este fluxo.");
        if (u.isActive() != r.active()) {
            var before = Boolean.toString(u.isActive());
            u.setActive(r.active());
            audit.record(
                    actor,
                    "USER_STATUS",
                    "USER",
                    id,
                    before,
                    Boolean.toString(u.isActive()),
                    r.reason().trim());
        }
        return AdminDtos.UserView.from(u);
    }

    public List<AdminDtos.CategoryView> categories(Jwt jwt) {
        access.require(jwt);
        return categories.findAll(org.springframework.data.domain.Sort.by("name")).stream()
                .map(AdminDtos.CategoryView::from)
                .toList();
    }

    @Transactional
    public AdminDtos.CategoryView create(Jwt jwt, AdminDtos.CreateCategory r) {
        var actor = access.require(jwt);
        var name = r.name().trim();
        var slug =
                Normalizer.normalize(name, Normalizer.Form.NFD)
                        .replaceAll("\\p{M}", "")
                        .toLowerCase(Locale.ROOT)
                        .replaceAll("[^a-z0-9]+", "-")
                        .replaceAll("^-|-$", "");
        if (slug.isBlank())
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um nome de categoria válido.");
        var c = categories.saveAndFlush(new Category(name, slug));
        audit.record(
                actor,
                "CATEGORY_CREATED",
                "CATEGORY",
                c.getId(),
                "",
                c.getName() + " / active=true",
                "");
        return AdminDtos.CategoryView.from(c);
    }

    @Transactional
    public AdminDtos.CategoryView update(Jwt jwt, UUID id, AdminDtos.UpdateCategory r) {
        var actor = access.require(jwt);
        var c = categories.lockById(id).orElseThrow(() -> missing("Categoria"));
        var before = c.getName() + " / active=" + c.isActive();
        c.update(r.name().trim(), r.active());
        categories.flush();
        audit.record(
                actor,
                "CATEGORY_UPDATED",
                "CATEGORY",
                id,
                before,
                c.getName() + " / active=" + c.isActive(),
                "");
        return AdminDtos.CategoryView.from(c);
    }

    public List<AuditEvent.View> audit(Jwt jwt) {
        access.require(jwt);
        return events.findTop200ByOrderByCreatedAtDescIdDesc().stream()
                .map(AuditEvent::view)
                .toList();
    }

    public Map<String, Long> metrics(Jwt jwt, java.time.LocalDate from, java.time.LocalDate to) {
        access.require(jwt);
        if (from != null && to != null && from.isAfter(to))
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "O início do período deve anteceder o fim.");
        var result = new LinkedHashMap<String, Long>();
        var zone = java.time.ZoneId.of("America/Sao_Paulo");
        var start =
                java.sql.Timestamp.from(
                        (from == null ? java.time.LocalDate.of(1970, 1, 1) : from)
                                .atStartOfDay(zone)
                                .toInstant());
        var end =
                java.sql.Timestamp.from(
                        (to == null ? java.time.LocalDate.of(9998, 12, 30) : to)
                                .plusDays(1)
                                .atStartOfDay(zone)
                                .toInstant());
        for (var entry :
                Map.of(
                                "users",
                                "app_user",
                                "services",
                                "service_listing",
                                "contracts",
                                "contract",
                                "reviews",
                                "review",
                                "reports",
                                "content_report")
                        .entrySet()) {
            result.put(
                    entry.getKey(),
                    db.queryForObject(
                            "select count(*) from "
                                    + entry.getValue()
                                    + " where created_at>=? and created_at<?",
                            Long.class,
                            start,
                            end));
        }
        result.put(
                "pendingReports",
                db.queryForObject(
                        "select count(*) from content_report where status='PENDING' and"
                            + " created_at>=? and created_at<?",
                        Long.class,
                        start,
                        end));
        result.put(
                "disputes",
                db.queryForObject(
                        "select count(*) from contract where status='EM_DISPUTA' and created_at>=?"
                            + " and created_at<?",
                        Long.class,
                        start,
                        end));
        return result;
    }

    private ApiException missing(String entity) {
        return new ApiException(HttpStatus.NOT_FOUND, entity + " não encontrado.");
    }
}
