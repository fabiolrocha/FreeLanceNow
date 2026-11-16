package br.com.freelancenow.api.payments;

import jakarta.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class PaymentController {
    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    private final PaymentService payments;
    private final PayoutAccountService payoutAccounts;
    private final PaymentGateway gateway;

    public PaymentController(
            PaymentService payments,
            PayoutAccountService payoutAccounts,
            PaymentGateway gateway) {
        this.payments = payments;
        this.payoutAccounts = payoutAccounts;
        this.gateway = gateway;
    }

    @GetMapping("/contracts/{id}/payment")
    public PaymentDtos.ContractPayment contractPayment(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return payments.contractPayment(jwt, id);
    }

    @PostMapping("/contracts/{id}/payment")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentDtos.CheckoutStarted checkout(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody PaymentDtos.StartCheckout r) {
        return payments.checkout(jwt, id, r);
    }

    @GetMapping("/payments/{id}")
    public PaymentDtos.PaymentDetail detail(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return payments.detail(jwt, id);
    }

    @GetMapping("/users/me/wallet")
    public PaymentDtos.Wallet wallet(@AuthenticationPrincipal Jwt jwt) {
        return payments.wallet(jwt);
    }

    @PostMapping("/users/me/withdrawals")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentDtos.WithdrawalView withdraw(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PaymentDtos.RequestWithdrawal r) {
        return payments.withdraw(jwt, r);
    }

    @GetMapping("/users/me/payout-account")
    public PaymentDtos.PayoutAccountView payoutAccount(@AuthenticationPrincipal Jwt jwt) {
        return payoutAccounts.status(jwt);
    }

    @PostMapping("/users/me/payout-account/session")
    public PaymentDtos.AccountSessionStarted payoutAccountSession(
            @AuthenticationPrincipal Jwt jwt) {
        return payoutAccounts.session(jwt);
    }

    @PostMapping("/admin/payments/{id}/transfer")
    public PaymentDtos.PaymentView retryTransfer(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return payments.retryTransfer(jwt, id);
    }

    @PostMapping("/admin/payments/{id}/reversal-resolved")
    public ResponseEntity<Void> resolveReversal(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        payments.resolveReversal(jwt, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin/payments")
    public PaymentDtos.AdminSummary admin(@AuthenticationPrincipal Jwt jwt) {
        return payments.admin(jwt);
    }

    /**
     * Stripe calls this without a user token; the signature is the authentication. The raw body
     * is required to verify it. A 400 makes Stripe retry, so it is only used for bad signatures.
     */
    @PostMapping(value = "/payments/webhook", consumes = "*/*")
    public ResponseEntity<Void> webhook(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        PaymentGateway.GatewayEvent event;
        try {
            event = gateway.parseWebhook(payload, signature);
        } catch (PaymentGateway.InvalidWebhook e) {
            log.warn("Webhook recusado: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
        payments.handle(event);
        return ResponseEntity.ok().build();
    }
}
