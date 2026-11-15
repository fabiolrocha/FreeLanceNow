-- Feed publications show a professional's work. Clients state what they need as demands,
-- so free-text posts written by client accounts leave the feed (kept for moderation history).
UPDATE feed_post SET hidden = TRUE
WHERE NOT hidden AND author_id IN (SELECT id FROM app_user WHERE role <> 'FREELANCER');
