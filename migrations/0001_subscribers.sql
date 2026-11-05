-- Update list. Only people who tick the box are here. Unsubscribing deletes the row.
CREATE TABLE subscribers (
  email TEXT PRIMARY KEY,          -- lower-cased
  riding TEXT,                     -- the riding they wrote from, if any
  consent_text TEXT NOT NULL,      -- the exact wording they agreed to (proof of consent under CASL)
  source TEXT,                     -- share tag that brought them, e.g. bubble-fb
  created_at TEXT NOT NULL,        -- ISO time they joined
  token TEXT NOT NULL UNIQUE,      -- random; used in the unsubscribe link
  confirmed_at TEXT                -- set when they confirm from the first email
);
