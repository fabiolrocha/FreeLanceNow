package br.com.freelancenow.api.catalog;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.reviews.Review;
import br.com.freelancenow.api.reviews.ReviewService;
import br.com.freelancenow.api.users.*;

import jakarta.persistence.criteria.Predicate;

import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class CatalogService {
    private final ServiceRepository services;
    private final CategoryRepository categories;
    private final UserRepository users;
    private final CurrentUser current;
    private final ReviewService reviews;

    public CatalogService(
            ServiceRepository services,
            CategoryRepository categories,
            UserRepository users,
            CurrentUser current,
            ReviewService reviews) {
        this.services = services;
        this.categories = categories;
        this.users = users;
        this.current = current;
        this.reviews = reviews;
    }

    public List<CatalogDtos.CategoryView> categories() {
        return categories.findByActiveTrueOrderByNameAsc().stream()
                .map(CatalogDtos.CategoryView::from)
                .toList();
    }

    public CatalogDtos.PageView<CatalogDtos.ServiceView> search(
            String q,
            UUID categoryId,
            String city,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            BigDecimal minRating,
            int page,
            int size) {
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Preço mínimo deve ser menor que o máximo.");
        var result =
                services.findAll(
                        (root, query, cb) -> {
                            var filters = new ArrayList<Predicate>();
                            filters.add(cb.equal(root.get("status"), ServiceStatus.ACTIVE));
                            filters.add(cb.isFalse(root.get("moderated")));
                            filters.add(cb.isTrue(root.get("freelancer").get("active")));
                            if (q != null && !q.isBlank()) {
                                var term =
                                        "%"
                                                + q.trim()
                                                        .toLowerCase(Locale.ROOT)
                                                        .replace("%", "\\%")
                                                        .replace("_", "\\_")
                                                + "%";
                                filters.add(
                                        cb.or(
                                                cb.like(cb.lower(root.get("title")), term, '\\'),
                                                cb.like(
                                                        cb.lower(root.get("description")),
                                                        term,
                                                        '\\')));
                            }
                            if (categoryId != null)
                                filters.add(cb.equal(root.get("category").get("id"), categoryId));
                            if (city != null && !city.isBlank())
                                filters.add(
                                        cb.equal(
                                                cb.lower(root.get("freelancer").get("city")),
                                                city.trim().toLowerCase(Locale.ROOT)));
                            if (minPrice != null)
                                filters.add(cb.greaterThanOrEqualTo(root.get("price"), minPrice));
                            if (maxPrice != null)
                                filters.add(cb.lessThanOrEqualTo(root.get("price"), maxPrice));
                            if (minRating != null && query != null) {
                                var sub = query.subquery(Double.class);
                                var reviewRoot = sub.from(Review.class);
                                sub.select(cb.avg(reviewRoot.get("rating")))
                                        .where(
                                                cb.equal(
                                                        reviewRoot.get("freelancer").get("id"),
                                                        root.get("freelancer").get("id")),
                                                cb.isFalse(reviewRoot.get("hidden")));
                                filters.add(cb.greaterThanOrEqualTo(sub, minRating.doubleValue()));
                            }
                            return cb.and(filters.toArray(Predicate[]::new));
                        },
                        PageRequest.of(
                                page,
                                size,
                                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"))));
        var stats =
                reviews.ratingSummaries(
                        result.stream().map(s -> s.getFreelancer().getId()).distinct().toList());
        return new CatalogDtos.PageView<>(
                result.stream()
                        .map(
                                s -> {
                                    var st =
                                            stats.getOrDefault(
                                                    s.getFreelancer().getId(),
                                                    ReviewService.RatingSummary.EMPTY);
                                    return CatalogDtos.ServiceView.from(
                                            s, st.averageRating(), st.reviewCount());
                                })
                        .toList(),
                page,
                size,
                result.getTotalElements(),
                result.getTotalPages());
    }

    public CatalogDtos.ServiceView detail(UUID id) {
        var s = find(id);
        if (s.isModerated()
                || s.getStatus() != ServiceStatus.ACTIVE
                || !s.getFreelancer().isActive()) throw notFound();
        var st = reviews.ratingSummary(s.getFreelancer().getId());
        return CatalogDtos.ServiceView.from(s, st.averageRating(), st.reviewCount());
    }

    public List<CatalogDtos.ServiceView> mine(Jwt jwt) {
        var u = freelancer(jwt);
        var st = reviews.ratingSummary(u.getId());
        return services.findByFreelancerIdOrderByCreatedAtDesc(u.getId()).stream()
                .map(s -> CatalogDtos.ServiceView.from(s, st.averageRating(), st.reviewCount()))
                .toList();
    }

    @Transactional
    public CatalogDtos.ServiceView create(Jwt jwt, CatalogDtos.SaveService r) {
        var u = lockedFreelancer(jwt);
        checkLimit(u, null, r.status());
        var st = reviews.ratingSummary(u.getId());
        return CatalogDtos.ServiceView.from(
                services.save(new ServiceListing(u, category(r.categoryId()), r)),
                st.averageRating(),
                st.reviewCount());
    }

    @Transactional
    public CatalogDtos.ServiceView update(Jwt jwt, UUID id, CatalogDtos.SaveService r) {
        var u = lockedFreelancer(jwt);
        var s = owned(u, id);
        checkLimit(u, s, r.status());
        var cat =
                s.getCategory().getId().equals(r.categoryId())
                        ? s.getCategory()
                        : category(r.categoryId());
        s.update(cat, r);
        var st = reviews.ratingSummary(u.getId());
        return CatalogDtos.ServiceView.from(s, st.averageRating(), st.reviewCount());
    }

    @Transactional
    public CatalogDtos.ServiceView status(Jwt jwt, UUID id, ServiceStatus status) {
        var u = lockedFreelancer(jwt);
        var s = owned(u, id);
        checkLimit(u, s, status);
        s.setStatus(status);
        var st = reviews.ratingSummary(u.getId());
        return CatalogDtos.ServiceView.from(s, st.averageRating(), st.reviewCount());
    }

    private void checkLimit(User u, ServiceListing existing, ServiceStatus desired) {
        if (desired == ServiceStatus.ACTIVE
                && (existing == null || existing.getStatus() != ServiceStatus.ACTIVE)
                && services.countByFreelancerIdAndStatus(u.getId(), ServiceStatus.ACTIVE) >= 20)
            throw new ApiException(
                    HttpStatus.CONFLICT, "O limite é de 20 serviços ativos por freelancer.");
    }

    private User freelancer(Jwt jwt) {
        var u = current.require(jwt);
        if (u.getRole() != Role.FREELANCER)
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente freelancers podem gerenciar serviços.");
        return u;
    }

    private User lockedFreelancer(Jwt jwt) {
        var u = freelancer(jwt);
        return users.lockById(u.getId()).orElseThrow(this::notFound);
    }

    private ServiceListing owned(User u, UUID id) {
        var s = services.lockById(id).orElseThrow(this::notFound);
        if (!s.getFreelancer().getId().equals(u.getId()))
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Este serviço pertence a outro profissional.");
        if (s.isModerated())
            throw new ApiException(
                    HttpStatus.CONFLICT, "Este anúncio foi removido pela moderação.");
        return s;
    }

    private Category category(UUID id) {
        return categories
                .findById(id)
                .filter(Category::isActive)
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.BAD_REQUEST, "Selecione uma categoria ativa."));
    }

    private ServiceListing find(UUID id) {
        return services.findById(id).orElseThrow(this::notFound);
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Serviço não encontrado.");
    }
}
