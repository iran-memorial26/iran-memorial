-- Allow api_usage rows without an API key (public MCP routes log by IP only).
-- Adds an (endpoint, created_at) index for the abuse-detection queries that
-- group by endpoint over a time window.

ALTER TABLE api_usage ALTER COLUMN api_key_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS api_usage_endpoint_created_at_idx
  ON api_usage (endpoint, created_at);
