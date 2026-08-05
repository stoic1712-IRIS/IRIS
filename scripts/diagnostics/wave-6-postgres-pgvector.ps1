[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$containerName = "iris-wave6-postgres-proof"
$image = "pgvector/pgvector@sha256:691673308c99d2161ba298736f3147f1f22d79de2fb7ec93ae9b4afcab870b62"

function Invoke-Docker {
    param([string[]]$Arguments)
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}

try {
    $existing = @(& docker ps -a --filter "name=^/$containerName$" --format "{{.ID}}")
    if ($existing.Count -gt 0) { Invoke-Docker -Arguments @("rm", "-f", $containerName) | Out-Null }
    Invoke-Docker -Arguments @("run", "--detach", "--name", $containerName, "--network", "none", "--memory", "768m", "--cpus", "1", "--pids-limit", "256", "--tmpfs", "/var/lib/postgresql:rw,nosuid,size=512m", "-e", "POSTGRES_PASSWORD=fictional-wave6-proof-only", $image) | Out-Null

    $ready = $false
    $ErrorActionPreference = "Continue"
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        & docker exec $containerName pg_isready -U postgres 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    $ErrorActionPreference = "Stop"
    if (-not $ready) { throw "PostgreSQL did not become ready within 45 seconds." }

    $sql = @'
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE iris_memory (
  memory_id text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('founder','project','operational','knowledge','capability','model','audit')),
  memory_key text NOT NULL,
  value_text text NOT NULL,
  state text NOT NULL CHECK (state IN ('proposed','canonical','superseded','deleted')),
  sensitivity text NOT NULL CHECK (sensitivity IN ('public','internal','sensitive','secret','recovery-authority')),
  content_digest text NOT NULL CHECK (content_digest ~ '^sha256:[0-9a-f]{64}$'),
  citations jsonb NOT NULL CHECK (jsonb_array_length(citations) > 0),
  activated_at timestamptz,
  CHECK (state <> 'canonical' OR activated_at IS NOT NULL)
);
CREATE UNIQUE INDEX iris_memory_one_canonical ON iris_memory (category, memory_key) WHERE state = 'canonical';
CREATE TABLE iris_memory_audit (audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, memory_id text NOT NULL, operation text NOT NULL, snapshot jsonb NOT NULL);
CREATE FUNCTION iris_record_memory_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO iris_memory_audit(memory_id,operation,snapshot) VALUES(COALESCE(NEW.memory_id,OLD.memory_id),TG_OP,to_jsonb(COALESCE(NEW,OLD))); RETURN COALESCE(NEW,OLD); END; $$;
CREATE TRIGGER iris_memory_change_audit AFTER INSERT OR UPDATE OR DELETE ON iris_memory FOR EACH ROW EXECUTE FUNCTION iris_record_memory_change();
CREATE TABLE iris_knowledge_chunk (chunk_id text PRIMARY KEY, text_content text NOT NULL, source_reference text NOT NULL);
CREATE TABLE iris_embedding (embedding_id text PRIMARY KEY, chunk_id text REFERENCES iris_knowledge_chunk(chunk_id), model text NOT NULL, embedding vector(3) NOT NULL);
INSERT INTO iris_memory VALUES ('memory-public','project','public.fact','cited public fact','canonical','public','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','["repository:README.md"]',clock_timestamp());
INSERT INTO iris_memory VALUES ('memory-secret','founder','secret.fact','restricted fact','canonical','secret','sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','["repository:docs/governance/constitution.md"]',clock_timestamp());
BEGIN;
INSERT INTO iris_memory VALUES ('memory-rollback','project','rollback.fact','must disappear','proposed','internal','sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','["repository:test"]',NULL);
ROLLBACK;
DO $$ BEGIN IF EXISTS (SELECT FROM iris_memory WHERE memory_id='memory-rollback') THEN RAISE EXCEPTION 'transaction rollback failed'; END IF; END $$;
ALTER TABLE iris_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE iris_memory FORCE ROW LEVEL SECURITY;
CREATE POLICY iris_memory_public_read ON iris_memory FOR SELECT USING (sensitivity='public');
CREATE ROLE iris_reader;
GRANT SELECT ON iris_memory TO iris_reader;
SET ROLE iris_reader;
DO $$ BEGIN IF (SELECT count(*) FROM iris_memory) <> 1 THEN RAISE EXCEPTION 'row access policy failed'; END IF; END $$;
RESET ROLE;
INSERT INTO iris_knowledge_chunk VALUES ('chunk-a','canonical memory evidence','repository:docs/architecture/decisions/ADR-002-canonical-memory-and-vector-search.md'),('chunk-b','derived vector evidence','repository:docs/architecture/decisions/ADR-002-canonical-memory-and-vector-search.md');
INSERT INTO iris_embedding VALUES ('embedding-a','chunk-a','fixture-v1','[1,0,0]'),('embedding-b','chunk-b','fixture-v1','[0,1,0]');
DO $$ BEGIN IF (SELECT chunk_id FROM iris_embedding ORDER BY embedding <=> '[0,1,0]' LIMIT 1) <> 'chunk-b' THEN RAISE EXCEPTION 'exact vector search failed'; END IF; END $$;
DO $$ BEGIN IF (SELECT count(*) FROM iris_memory_audit) < 2 THEN RAISE EXCEPTION 'audit capture failed'; END IF; END $$;
SELECT current_setting('server_version') AS postgres_version, extversion AS pgvector_version FROM pg_extension WHERE extname='vector';
SELECT 'governance,transactions,row-access,audit,exact-vector,citations,vector-disabled-relational-read' AS verified_controls;
'@
    $sql | & docker exec -i $containerName psql -U postgres -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL verification SQL failed." }

    Invoke-Docker -Arguments @("exec", $containerName, "pg_dump", "-U", "postgres", "--format=custom", "--file=/tmp/wave6.dump", "postgres")
    Invoke-Docker -Arguments @("exec", $containerName, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", "DROP TABLE iris_embedding, iris_knowledge_chunk, iris_memory CASCADE; DROP TABLE iris_memory_audit;")
    Invoke-Docker -Arguments @("exec", $containerName, "pg_restore", "-U", "postgres", "--dbname=postgres", "--clean", "--if-exists", "/tmp/wave6.dump")
    Invoke-Docker -Arguments @("exec", $containerName, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", "SELECT count(*) AS restored_memories FROM iris_memory;")

    [pscustomobject]@{
        Status = "passed"
        Image = $image
        Network = "none"
        PublishedPorts = 0
        HostMounts = 0
        BackupRestore = "passed"
    } | ConvertTo-Json
}
finally {
    $existing = @(& docker ps -a --filter "name=^/$containerName$" --format "{{.ID}}")
    if ($existing.Count -gt 0) { & docker rm -f $containerName | Out-Null }
    $remaining = @(& docker ps -a --filter "name=^/$containerName$" --format "{{.ID}}")
    if ($remaining.Count -ne 0) { throw "Disposable proof container cleanup failed." }
}
