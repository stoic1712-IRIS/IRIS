# Wave 2 Disposable Candidate Evaluation

**Status:** Decision gate passed and evidence canonical

**Date:** 2026-08-04

**Branch:** `iris/wave-2-external-technology-evaluation`

## Scope and Safety Boundary

The evaluation used only fictional data and credentials. Candidate services received no canonical-repository mount, host secret, external account, public port, or paid resource. Docker services shared the internal `iris-wave2-eval-net` network. OpenClaw was probed with networking disabled, a read-only root filesystem, dropped Linux capabilities, `no-new-privileges`, bounded CPU and memory, and an empty temporary state directory.

## Evaluated Pins

| Candidate | Pin | Observed image digest or revision |
| --- | --- | --- |
| PostgreSQL + pgvector | `pgvector/pgvector:0.8.6-pg18` | `sha256:691673308c99d2161ba298736f3147f1f22d79de2fb7ec93ae9b4afcab870b62` |
| NATS JetStream | `nats:2.14.4-alpine` | `sha256:f2123f533c2b0cada0a5c5ec434fb2b8cfe1cf220215ef9d7517e1372917ad66` |
| Qdrant | `qdrant/qdrant:v1.18.3-unprivileged` | `sha256:affb67e1d6f2f93d7d20b90d238a7d4b974d36351c162e73bda794e4b2e03483` |
| Redis | `redis:8.10.0-alpine` | `sha256:978f0e01593e65eed801f2402944efcd936d43b5027e4908a7897baf88ed6241` |
| Chroma | `chromadb/chroma:1.5.9` | `sha256:1e0b73a187a28757c572acba508c46f48c9e8b0acaf5c20e6d95cdedce1acdf6` |
| OpenClaw | `ghcr.io/openclaw/openclaw:2026.7.1-2` | image `sha256:8789721d2e9b24b780a1504b56deb4c6bd5c7dbf96a1dd117e7c45c2ed72c8ac`; source revision `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c` |
| Hivemind | Git tag `2026.07.01` | commit `49e0c74d9bb13f6d82670b54c2a4d4506f172f88` |

## Observed Functional Results

### PostgreSQL and pgvector

- PostgreSQL reported version `18.4`.
- The `vector` extension installed successfully.
- Two three-dimensional vectors were inserted.
- Exact distance ordering returned the identical vector first with distance zero.
- Result: pass for the bounded persistence and vector-extension probe.

### NATS JetStream

- Server reported `2.14.4`, JetStream API level 4, strict mode, file storage, and acknowledgements.
- A file-backed `IRIS_EVAL` stream was created on `iris.eval.>`.
- A fictional event was published and retrieved as stream sequence 1.
- Result: pass for bounded persistence and replay.

### Redis Streams

- Redis started with append-only persistence enabled.
- A fictional stream entry was appended, a consumer group was created, and the entry was delivered through the group.
- Redis warned that authentication was not configured and local clients could connect.
- Result: functional pass; security and licensing remain adverse selection factors.

### Qdrant

- First startup failed under a read-only root because `/qdrant/snapshots/tmp` was not writable.
- Logs also reported telemetry enabled by default.
- Bounded repair added a dedicated snapshot volume and `QDRANT__TELEMETRY_DISABLED=true` while preserving the read-only root and unprivileged image.
- The repaired service started. A collection and two fictional vectors were created. Querying `[1,0,0]` returned the identical vector with score 1 before the orthogonal vector with score 0.
- Result: functional pass only with explicit hardening requirements.

### Chroma

- Chroma `1.5.9` started with persistent storage and reported `No telemetry is configured`.
- The v2 heartbeat endpoint returned successfully.
- Result: basic service pass; no differentiating requirement over PostgreSQL/pgvector was established.

### OpenClaw

- The image declared MIT licensing, source revision `0790d9f`, Node `24.16.0`, non-root user `node`, and gateway health endpoint on port 18789.
- The CLI ran in a networkless, read-only, capability-dropped container after the temporary state directory was assigned to UID/GID 1000.
- `openclaw security audit --deep` reported `1 critical`, `3 warn`, and `1 info` in an unconfigured state.
- Critical: loopback gateway authentication was absent.
- Warnings: trusted proxies absent, HTTP tool invocation unauthenticated, and the deep gateway probe unavailable because the gateway was intentionally not started.
- Attack-surface report: elevated tools enabled, browser control enabled, and the trust model is one trusted operator rather than hostile multi-tenant isolation.
- Result: useful execution patterns, but direct adoption cannot satisfy IRIS authority boundaries without an IRIS-owned adapter, explicit authentication, sandbox enforcement, and independent audit.

### Hivemind

- The pinned repository resolved to an AGPL-3.0 project with eleven Compose services: cache, database, application, connector, SDK proxy, workspace, Docker proxy, Signal CLI, two worker services, and a browser sidecar.
- The topology mounts the host Docker socket into a proxy and exposes Docker control through an internal TCP endpoint.
- The installer can install OS packages, install and enable Docker, modify Docker-group membership, generate environment secrets, build or pull images, start services, and probe or install Ollama.
- No bootstrap was executed because these host-level actions exceed the minimum-permission evaluation boundary and were unnecessary to establish architecture and license findings.
- Result: study patterns only; do not embed or run against canonical resources.

## Existing Runtime Recheck

- Ollama `0.32.5` remained available with `qwen3:8b`, digest `500a1f067a9f782620b40bee6f7b0c89e17ae61f686b92c24933e4ca4b2b8b41`.
- LM Studio CLI commit remained `71bd99c`; its server was stopped.

## Failure Visibility

The Qdrant read-only-root failure and the initial Windows-to-container JSON quoting failures are preserved. The latter were transport-command errors; the same Qdrant API operations passed when issued from a pinned Node `24.19.0-alpine` container on the internal network.

## Cleanup Requirement

Before this evaluation is declared complete, all `iris-wave2-*` containers, volumes, and network and the temporary Hivemind checkout must be removed. Provider state must then show no remaining evaluation containers, networks, or volumes. Pulled immutable images may be retained only if explicitly reported; they are cache, not running resources.

## Cleanup Result

- All five named evaluation containers were force-stopped and removed after testing.
- All six named evaluation volumes and the `iris-wave2-eval-net` network were removed.
- A provider-state query returned no remaining container, volume, or network whose name begins with `iris-wave2`.
- Pulled immutable images remain in Docker's local image cache; they are stopped and hold no evaluation volume state.
- The temporary read-only Hivemind source checkout at `C:\Users\Admin\AppData\Local\Temp\iris-wave2-eval-20260804` was moved to the Windows Recycle Bin during the Waves 0-12 closure audit on 2026-08-05. Its original path is absent. The operation is recoverable through the Recycle Bin and removed no credential, generated environment, container, or provider state.
