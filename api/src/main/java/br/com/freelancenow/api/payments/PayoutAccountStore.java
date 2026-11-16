package br.com.freelancenow.api.payments;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/** Rows of {@code payout_account}: the freelancer's Stripe account id and its readiness. */
@Component
class PayoutAccountStore {
    private final JdbcTemplate db;
    private final Clock clock;

    PayoutAccountStore(JdbcTemplate db, Clock clock) {
        this.db = db;
        this.clock = clock;
    }

    record Stored(
            UUID userId,
            String accountId,
            boolean detailsSubmitted,
            boolean transfersEnabled,
            boolean payoutsEnabled,
            List<String> currentlyDue) {}

    Stored find(UUID userId) {
        var rows =
                db.query(
                        "select user_id, stripe_account_id, details_submitted, transfers_enabled,"
                                + " payouts_enabled, currently_due from payout_account"
                                + " where user_id = ?",
                        (rs, n) ->
                                new Stored(
                                        rs.getObject("user_id", UUID.class),
                                        rs.getString("stripe_account_id"),
                                        rs.getBoolean("details_submitted"),
                                        rs.getBoolean("transfers_enabled"),
                                        rs.getBoolean("payouts_enabled"),
                                        split(rs.getString("currently_due"))),
                        userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** The freelancer who owns this Stripe account, or null. */
    UUID ownerOf(String accountId) {
        var ids =
                db.queryForList(
                        "select user_id from payout_account where stripe_account_id = ?",
                        UUID.class,
                        accountId);
        return ids.isEmpty() ? null : ids.get(0);
    }

    /** The account id if released money can be transferred to it now, else null. */
    String readyAccountId(UUID userId) {
        var s = find(userId);
        return s != null && s.transfersEnabled() ? s.accountId() : null;
    }

    Stored save(UUID userId, PaymentGateway.ConnectedAccount a) {
        var now = Timestamp.from(Instant.now(clock));
        String due = String.join(",", a.currentlyDue());
        if (due.length() > 2000) due = due.substring(0, 2000);
        db.update(
                "insert into payout_account (user_id, stripe_account_id, details_submitted,"
                        + " transfers_enabled, payouts_enabled, currently_due, created_at,"
                        + " updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
                        + " on conflict (user_id) do update set"
                        + " details_submitted = excluded.details_submitted,"
                        + " transfers_enabled = excluded.transfers_enabled,"
                        + " payouts_enabled = excluded.payouts_enabled,"
                        + " currently_due = excluded.currently_due,"
                        + " updated_at = excluded.updated_at",
                userId,
                a.id(),
                a.detailsSubmitted(),
                a.transfersEnabled(),
                a.payoutsEnabled(),
                due,
                now,
                now);
        return new Stored(
                userId,
                a.id(),
                a.detailsSubmitted(),
                a.transfersEnabled(),
                a.payoutsEnabled(),
                a.currentlyDue());
    }

    private static List<String> split(String s) {
        if (s == null || s.isBlank()) return List.of();
        return Arrays.stream(s.split(",")).filter(x -> !x.isBlank()).toList();
    }
}
