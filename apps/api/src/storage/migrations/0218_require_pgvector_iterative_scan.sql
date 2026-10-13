DO $$
DECLARE
  installed_version text;
  version_parts text[];
BEGIN
  SELECT extversion INTO installed_version FROM pg_extension WHERE extname = 'vector';
  version_parts := regexp_match(coalesce(installed_version, ''), '^([0-9]+)\.([0-9]+)');
  IF version_parts IS NULL OR (version_parts[1]::integer = 0 AND version_parts[2]::integer < 8) THEN
    RAISE EXCEPTION 'Hybrid search requires pgvector >= 0.8.0 for strict iterative HNSW scans; installed version: %. Upgrade the database pgvector extension before retrying migrations.', coalesce(installed_version, 'not installed');
  END IF;
END $$;
