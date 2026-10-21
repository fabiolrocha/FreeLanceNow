package br.com.freelancenow.api.moderation;

import br.com.freelancenow.api.admin.*;
import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.catalog.*;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.feed.FeedPost;
import br.com.freelancenow.api.reviews.*;

import jakarta.persistence.*;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class ModerationService {
    private final CurrentUser current;
    private final AdminAccess admin;
    private final ReportRepository reports;
    private final ServiceRepository services;
    private final ReviewRepository reviews;
    private final AuditService audit;
    private final Clock clock;
    private final EntityManager em;

    public ModerationService(
            CurrentUser current,
            AdminAccess admin,
            ReportRepository reports,
            ServiceRepository services,
            ReviewRepository reviews,
            AuditService audit,
            Clock clock,
            EntityManager em) {
        this.current = current;
        this.admin = admin;
        this.reports = reports;
        this.services = services;
        this.reviews = reviews;
        this.audit = audit;
        this.clock = clock;
        this.em = em;
    }

    @Transactional
    public ContentReport.View create(Jwt jwt, ReportDtos.Create r) {
        var u = current.require(jwt);
        if (r.comment().trim().length() < 40)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Descreva a denúncia com pelo menos 40 caracteres.");
        String title, content;
        if (r.targetType() == ContentReport.Target.SERVICE) {
            var s =
                    services.findById(r.targetId())
                            .filter(
                                    x ->
                                            x.getStatus() == ServiceStatus.ACTIVE
                                                    && !x.isModerated()
                                                    && x.getFreelancer().isActive())
                            .orElseThrow(this::missing);
            title = s.getTitle();
            content = s.getDescription();
        } else if (r.targetType() == ContentReport.Target.POST) {
            var post = em.find(FeedPost.class, r.targetId());
            if (post == null || !post.isVisible()) throw missing();
            title = "Publicação profissional";
            content = post.getText();
        } else {
            var v =
                    reviews.findById(r.targetId())
                            .filter(x -> !x.isHidden() && x.getFreelancer().isActive())
                            .orElseThrow(this::missing);
            title = v.getContract().getTitle();
            content = v.getComment() + (v.getReply() == null ? "" : " / Resposta: " + v.getReply());
        }
        return reports.saveAndFlush(new ContentReport(u, r, title, content, Instant.now(clock)))
                .view();
    }

    public List<ContentReport.View> list(Jwt jwt) {
        admin.require(jwt);
        return reports.findAllByOrderByCreatedAtDescIdDesc().stream()
                .map(ContentReport::view)
                .toList();
    }

    @Transactional
    public ContentReport.View decide(Jwt jwt, UUID id, ReportDtos.Decision r) {
        var actor = admin.require(jwt);
        if (r.status() == ContentReport.Status.PENDING)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Selecione manter ou remover o conteúdo.");
        var report = reports.lockById(id).orElseThrow(this::missing);
        if (report.getStatus() != ContentReport.Status.PENDING)
            throw new ApiException(HttpStatus.CONFLICT, "Esta denúncia já foi decidida.");
        if (r.status() == ContentReport.Status.REMOVED) {
            if (report.getTargetType() == ContentReport.Target.SERVICE) {
                var s =
                        em.find(
                                ServiceListing.class,
                                report.getTargetId(),
                                LockModeType.PESSIMISTIC_WRITE);
                if (s == null) throw missing();
                s.moderate();
            } else if (report.getTargetType() == ContentReport.Target.POST) {
                var post =
                        em.find(
                                FeedPost.class,
                                report.getTargetId(),
                                LockModeType.PESSIMISTIC_WRITE);
                if (post == null) throw missing();
                post.hide();
            } else {
                var review =
                        em.find(Review.class, report.getTargetId(), LockModeType.PESSIMISTIC_WRITE);
                if (review == null) throw missing();
                review.hide();
            }
        }
        report.decide(actor, r.status(), r.note(), Instant.now(clock));
        audit.record(
                actor,
                "REPORT_DECIDED",
                "REPORT",
                id,
                "PENDING",
                r.status().name(),
                r.note().trim());
        return report.view();
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "Conteúdo ou denúncia não encontrado.");
    }
}
