package br.com.freelancenow.api.reviews;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ReviewController {
    private final ReviewService reviews;

    public ReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @PostMapping("/contracts/{id}/review")
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewDtos.ReviewView create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ReviewDtos.CreateReview request) {
        return reviews.create(jwt, id, request);
    }

    @PostMapping("/contracts/{id}/review/reply")
    public ReviewDtos.ReviewView reply(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ReviewDtos.ReplyReview request) {
        return reviews.reply(jwt, id, request);
    }

    @GetMapping("/freelancers/{id}/reviews")
    public List<ReviewDtos.ReviewView> listByFreelancer(@PathVariable UUID id) {
        return reviews.listByFreelancer(id);
    }

    @GetMapping("/services/{id}/reviews")
    public List<ReviewDtos.ReviewView> listByService(@PathVariable UUID id) {
        return reviews.listByService(id);
    }
}
