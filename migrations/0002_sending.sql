-- When the confirmation email went out (rows unconfirmed 14 days after it are deleted by `scripts/mail.mjs prune`).
ALTER TABLE subscribers ADD COLUMN confirm_sent_at TEXT;
-- One row per update per address, so a re-run of `scripts/mail.mjs send` never emails anyone twice.
CREATE TABLE sends (
  campaign TEXT NOT NULL,
  email TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (campaign, email)
);
