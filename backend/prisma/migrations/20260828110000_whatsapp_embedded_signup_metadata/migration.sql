-- Backfill legacy WhatsApp connection method metadata for existing rows.
UPDATE connected_accounts
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"connectionMethod":"manual_legacy"}'::jsonb
WHERE provider = 'meta_whatsapp'
  AND (
    metadata IS NULL
    OR NOT (metadata ? 'connectionMethod')
  );
