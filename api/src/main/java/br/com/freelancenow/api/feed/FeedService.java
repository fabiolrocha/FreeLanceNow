package br.com.freelancenow.api.feed;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.catalog.*;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.users.*;

import jakarta.persistence.*;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class FeedService {
    private final CurrentUser current;
    private final FeedPostRepository posts;
    private final ServiceRepository services;
    private final CategoryRepository categories;
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager em;
    private final Clock clock;

    public FeedService(
            CurrentUser current,
            FeedPostRepository posts,
            ServiceRepository services,
            CategoryRepository categories,
            NamedParameterJdbcTemplate jdbc,
            EntityManager em,
            Clock clock) {
        this.current = current;
        this.posts = posts;
        this.services = services;
        this.categories = categories;
        this.jdbc = jdbc;
        this.em = em;
        this.clock = clock;
    }

    // Visibility is applied before pagination, so counts and cards use the same authorization.
    private static final String SOURCE =
            """
            FROM (
              SELECT p.id, 'UPDATE' AS type,p.author_id, 'Publicação profissional' AS title,p.text,p.created_at,
                     p.category_id,p.service_id,NULL::numeric AS price,NULL::integer AS days,NULL::varchar AS city
              FROM feed_post p LEFT JOIN service_listing linked ON linked.id=p.service_id
              WHERE NOT p.hidden AND (p.service_id IS NULL OR (linked.status='ACTIVE' AND NOT linked.moderated))
              UNION ALL
              SELECT s.id,'SERVICE',s.freelancer_id,s.title,s.description,s.created_at,s.category_id,s.id,s.price,s.delivery_days,NULL::varchar
              FROM service_listing s WHERE s.status='ACTIVE' AND NOT s.moderated
              UNION ALL
              SELECT d.id,'DEMAND',d.client_id,d.title,d.description,d.created_at,d.category_id,NULL::uuid,d.budget,d.days,d.city
              FROM demand d WHERE d.status='OPEN' AND (:role <> 'CLIENT' OR d.client_id=:viewer)
            ) f JOIN app_user u ON u.id=f.author_id AND u.active
            LEFT JOIN category c ON c.id=f.category_id
            WHERE (:kind='' OR f.type=:kind) AND (:category='' OR f.category_id::text=:category)
            """;

    public CatalogDtos.PageView<FeedDtos.Item> list(
            Jwt jwt, int page, int size, FeedDtos.Kind kind, UUID categoryId) {
        var u = current.require(jwt);
        if (page < 0 || size < 1 || size > 100 || page > 1000000)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Página ou tamanho inválido.");
        var args = new HashMap<String, Object>();
        args.put("viewer", u.getId());
        args.put("role", u.getRole().name());
        args.put("kind", kind == null ? "" : kind.name());
        args.put("category", categoryId == null ? "" : categoryId.toString());
        args.put("limit", size);
        args.put("offset", (long) page * size);
        long total = jdbc.queryForObject("SELECT count(*) " + SOURCE, args, Long.class);
        var items =
                jdbc.query(
                        "SELECT f.*,u.name AS author_name,u.role AS author_role,u.city AS"
                            + " author_city,c.name AS category_name "
                                + SOURCE
                                + " ORDER BY f.created_at DESC,f.id DESC,f.type ASC LIMIT :limit"
                                + " OFFSET :offset",
                        args,
                        (rs, n) ->
                                new FeedDtos.Item(
                                        rs.getObject("id", UUID.class),
                                        FeedDtos.Kind.valueOf(rs.getString("type")),
                                        new FeedDtos.Author(
                                                rs.getObject("author_id", UUID.class),
                                                rs.getString("author_name"),
                                                Role.valueOf(rs.getString("author_role")),
                                                rs.getString("author_city")),
                                        rs.getString("title"),
                                        rs.getString("text"),
                                        rs.getTimestamp("created_at").toInstant(),
                                        rs.getObject("category_id") == null
                                                ? null
                                                : new FeedDtos.CategoryView(
                                                        rs.getObject("category_id", UUID.class),
                                                        rs.getString("category_name")),
                                        rs.getObject("service_id", UUID.class),
                                        rs.getBigDecimal("price"),
                                        rs.getObject("days", Integer.class),
                                        rs.getString("city")));
        return new CatalogDtos.PageView<>(
                items, page, size, total, (int) ((total + size - 1) / size));
    }

    @Transactional
    public FeedDtos.Item create(Jwt jwt, FeedDtos.Create r) {
        var u = current.require(jwt);
        if (u.getRole() == Role.ADMIN)
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Use uma conta de cliente ou freelancer para publicar.");
        if (r.text().trim().isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "Escreva sua publicação.");
        ServiceListing service = null;
        Category category = null;
        if (r.serviceId() != null) {
            service =
                    services.findById(r.serviceId())
                            .orElseThrow(
                                    () ->
                                            new ApiException(
                                                    HttpStatus.BAD_REQUEST, "Serviço inválido."));
            if (!service.getFreelancer().getId().equals(u.getId()))
                throw new ApiException(HttpStatus.FORBIDDEN, "Selecione um serviço seu.");
            if (service.isModerated() || service.getStatus() != ServiceStatus.ACTIVE)
                throw new ApiException(
                        HttpStatus.BAD_REQUEST, "O serviço precisa estar publicado.");
            category = service.getCategory();
        }
        if (r.categoryId() != null) {
            var requested =
                    categories
                            .findById(r.categoryId())
                            .filter(Category::isActive)
                            .orElseThrow(
                                    () ->
                                            new ApiException(
                                                    HttpStatus.BAD_REQUEST, "Categoria inválida."));
            if (category != null && !category.getId().equals(requested.getId()))
                throw new ApiException(
                        HttpStatus.BAD_REQUEST, "A categoria deve ser a do serviço.");
            category = requested;
        }
        var now = Instant.now(clock);
        var p = posts.saveAndFlush(new FeedPost(u, r.text(), category, service, now));
        return new FeedDtos.Item(
                p.getId(),
                FeedDtos.Kind.UPDATE,
                new FeedDtos.Author(u.getId(), u.getName(), u.getRole(), u.getCity()),
                "Publicação profissional",
                p.getText(),
                now,
                category == null
                        ? null
                        : new FeedDtos.CategoryView(category.getId(), category.getName()),
                r.serviceId(),
                null,
                null,
                null);
    }

    @Transactional
    public void hide(Jwt jwt, UUID id) {
        var u = current.require(jwt);
        var post = em.find(FeedPost.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (post == null)
            throw new ApiException(HttpStatus.NOT_FOUND, "Publicação não encontrada.");
        if (!post.getAuthor().getId().equals(u.getId()))
            throw new ApiException(HttpStatus.FORBIDDEN, "Você só pode retirar suas publicações.");
        post.hide();
    }
}
