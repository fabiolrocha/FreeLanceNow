package br.com.freelancenow.api.reviews;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.catalog.ServiceRepository;
import br.com.freelancenow.api.catalog.ServiceStatus;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.contracts.ContractRepository;
import br.com.freelancenow.api.contracts.ContractStatus;
import br.com.freelancenow.api.users.Role;
import br.com.freelancenow.api.users.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ReviewService {
    public record RatingSummary(Double averageRating, long reviewCount) {
        public static final RatingSummary EMPTY = new RatingSummary(null, 0L);
    }

    private final ReviewRepository reviews;
    private final ContractRepository contracts;
    private final ServiceRepository services;
    private final UserRepository users;
    private final CurrentUser current;
    private final Clock clock;

    public ReviewService(
            ReviewRepository reviews,
            ContractRepository contracts,
            ServiceRepository services,
            UserRepository users,
            CurrentUser current,
            Clock clock) {
        this.reviews = reviews;
        this.contracts = contracts;
        this.services = services;
        this.users = users;
        this.current = current;
        this.clock = clock;
    }

    @Transactional
    public ReviewDtos.ReviewView create(Jwt jwt, UUID contractId, ReviewDtos.CreateReview request) {
        var u = current.require(jwt);
        var c = contracts.lockById(contractId).orElseThrow(this::contractNotFound);
        if (u.getRole() != Role.CLIENT || !c.getClient().getId().equals(u.getId()))
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente o cliente desta contratação pode avaliá-la.");
        if (c.getStatus() != ContractStatus.CONCLUIDO || c.getCompletedAt() == null)
            throw new ApiException(
                    HttpStatus.CONFLICT, "A avaliação exige uma contratação concluída.");
        if (reviews.existsByContractId(c.getId()))
            throw new ApiException(HttpStatus.CONFLICT, "Esta contratação já foi avaliada.");
        var now = Instant.now(clock);
        if (now.isBefore(c.getCompletedAt()))
            throw new ApiException(HttpStatus.CONFLICT, "A contratação ainda não foi concluída.");
        if (now.isAfter(c.getCompletedAt().plus(Duration.ofDays(7))))
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "O prazo de 7 dias para avaliar esta contratação expirou.");
        var saved = reviews.save(new Review(c, request.rating(), request.comment(), now));
        return ReviewDtos.ReviewView.from(saved);
    }

    @Transactional
    public ReviewDtos.ReviewView reply(Jwt jwt, UUID contractId, ReviewDtos.ReplyReview request) {
        var u = current.require(jwt);
        var c = contracts.lockById(contractId).orElseThrow(this::contractNotFound);
        if (u.getRole() != Role.FREELANCER || !c.getFreelancer().getId().equals(u.getId()))
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Somente o profissional desta contratação pode responder à avaliação.");
        var review =
                reviews.findByContractId(c.getId())
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND, "Avaliação não encontrada."));
        if (review.getReply() != null)
            throw new ApiException(HttpStatus.CONFLICT, "Esta avaliação já foi respondida.");
        review.registerReply(request.reply(), Instant.now(clock));
        return ReviewDtos.ReviewView.from(review);
    }

    public List<ReviewDtos.ReviewView> listByFreelancer(UUID freelancerId) {
        users.findById(freelancerId)
                .filter(u -> u.isActive() && u.getRole() == Role.FREELANCER)
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND, "Profissional não encontrado."));
        return reviews.findByFreelancerIdOrderByCreatedAtDesc(freelancerId).stream()
                .filter(r -> !r.isHidden())
                .map(ReviewDtos.ReviewView::from)
                .toList();
    }

    public List<ReviewDtos.ReviewView> listByService(UUID serviceId) {
        services.findById(serviceId)
                .filter(s -> s.getStatus() == ServiceStatus.ACTIVE && s.getFreelancer().isActive())
                .orElseThrow(
                        () -> new ApiException(HttpStatus.NOT_FOUND, "Serviço não encontrado."));
        return reviews.findByServiceIdOrderByCreatedAtDesc(serviceId).stream()
                .filter(r -> !r.isHidden())
                .map(ReviewDtos.ReviewView::from)
                .toList();
    }

    public Map<UUID, RatingSummary> ratingSummaries(Collection<UUID> freelancerIds) {
        if (freelancerIds.isEmpty()) return Map.of();
        return reviews.statsByFreelancerIds(freelancerIds).stream()
                .collect(
                        Collectors.toMap(
                                ReviewRepository.RatingStats::getFreelancerId,
                                s ->
                                        new RatingSummary(
                                                s.getAverageRating() == null
                                                        ? null
                                                        : BigDecimal.valueOf(s.getAverageRating())
                                                                .setScale(1, RoundingMode.HALF_UP)
                                                                .doubleValue(),
                                                s.getReviewCount())));
    }

    public RatingSummary ratingSummary(UUID freelancerId) {
        return ratingSummaries(List.of(freelancerId))
                .getOrDefault(freelancerId, RatingSummary.EMPTY);
    }

    private ApiException contractNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Contratação não encontrada.");
    }
}
