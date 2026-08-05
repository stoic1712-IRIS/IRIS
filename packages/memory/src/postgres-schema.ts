export const postgresMemoryMigration001 = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE iris_memory (
  memory_id text PRIMARY KEY CHECK (memory_id ~ '^memory_[0-9a-f-]{36}$'),
  category text NOT NULL CHECK (category IN ('founder','project','operational','knowledge','capability','model','audit')),
  memory_key text NOT NULL,
  value_text text NOT NULL,
  state text NOT NULL CHECK (state IN ('proposed','canonical','superseded','deleted')),
  sensitivity text NOT NULL CHECK (sensitivity IN ('public','internal','sensitive','secret','recovery-authority')),
  content_digest text NOT NULL CHECK (content_digest ~ '^sha256:[0-9a-f]{64}$'),
  citations jsonb NOT NULL CHECK (jsonb_array_length(citations) > 0),
  provenance jsonb NOT NULL,
  supersedes_memory_id text REFERENCES iris_memory(memory_id),
  created_at timestamptz NOT NULL,
  activated_at timestamptz,
  CHECK (state <> 'canonical' OR activated_at IS NOT NULL)
);

CREATE UNIQUE INDEX iris_memory_one_canonical
  ON iris_memory (category, memory_key)
  WHERE state = 'canonical';

CREATE TABLE iris_memory_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  memory_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  snapshot jsonb NOT NULL
);

CREATE FUNCTION iris_record_memory_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO iris_memory_audit (memory_id, operation, snapshot)
  VALUES (COALESCE(NEW.memory_id, OLD.memory_id), TG_OP, to_jsonb(COALESCE(NEW, OLD)));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER iris_memory_change_audit
  AFTER INSERT OR UPDATE OR DELETE ON iris_memory
  FOR EACH ROW EXECUTE FUNCTION iris_record_memory_change();

CREATE TABLE iris_knowledge_chunk (
  chunk_id text PRIMARY KEY,
  document_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  text_content text NOT NULL,
  source_reference text NOT NULL,
  content_digest text NOT NULL,
  UNIQUE (document_id, ordinal)
);

CREATE TABLE iris_embedding (
  embedding_id text PRIMARY KEY,
  chunk_id text NOT NULL REFERENCES iris_knowledge_chunk(chunk_id) ON DELETE CASCADE,
  model text NOT NULL,
  source_digest text NOT NULL,
  embedding vector(3) NOT NULL
);

ALTER TABLE iris_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY iris_memory_public_read ON iris_memory FOR SELECT USING (sensitivity = 'public');

REVOKE UPDATE, DELETE, TRUNCATE ON iris_memory_audit FROM PUBLIC;
`;

export const postgresMemoryMigration001Rollback = `
DROP TABLE IF EXISTS iris_embedding;
DROP TABLE IF EXISTS iris_knowledge_chunk;
DROP TRIGGER IF EXISTS iris_memory_change_audit ON iris_memory;
DROP FUNCTION IF EXISTS iris_record_memory_change;
DROP TABLE IF EXISTS iris_memory_audit;
DROP TABLE IF EXISTS iris_memory;
`;
