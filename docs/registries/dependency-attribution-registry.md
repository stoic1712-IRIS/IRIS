# Dependency Attribution Registry

**Status:** Canonical baseline

## Entry Schema

Each entry must include identity, category, purpose, owner, source, exact version or digest, license, obligations, transitive dependencies, install behavior, network and telemetry, secrets and permissions, security findings, portability, removal, evidence, decision, approver, and review date.

## Current Recorded Technologies

| Identity | Category | Current role | Pin or observed version | License/terms status | Adoption status | Required next review |
| --- | --- | --- | --- | --- | --- | --- |
| Microsoft Windows | Operating system | Host environment | Windows 11; exact build not yet recorded | Proprietary terms; use only | Existing environment | Record build and support status |
| Ubuntu | Operating system | WSL2 development environment | 26.04 LTS | Ubuntu package licenses vary; use only | Verified environment | Preserve package-source and security evidence |
| Docker Desktop / Engine | Container runtime | Disposable evaluation and build runtime | Desktop 4.85.0; Engine 29.6.2 | Terms and component licenses require formal review | Existing tool; not redistribution-approved | Review Desktop terms, Engine notices, telemetry, and update behavior |
| NVIDIA driver / CUDA container | GPU runtime | Local GPU inference and disposable test | Driver 610.88; `nvidia/cuda:12.9.1-base-ubuntu24.04` | NVIDIA terms require formal review | Existing test dependency | Record immutable image digest and redistribution limits |
| Node.js | Development runtime | Future TypeScript baseline | 24.19.0 LTS | Open-source licenses; formal attribution review pending | Installed tool | Review distribution notices before packaging |
| npm | Package manager | Bundled Node.js tooling | 11.17.0 | Open-source; formal review pending | Installed tool | Record source and license |
| pnpm | Package manager | Planned workspace manager | 11.20.0 | Open-source; formal review pending | Installed tool, not yet project-pinned | Review license and pin project version before scaffold |
| Python | Development runtime | Diagnostics and support tooling | 3.14.4 | PSF license family; formal review pending | Installed tool | Record source and notices if distributed |
| Git | Version control | Canonical repository history | 2.53.0 | GPL; use only, not embedded | Installed tool | Record exact distribution source |
| Visual Studio Code | Editor | Founder development environment | 1.131.0 | Microsoft product terms | Existing tool | No redistribution planned |
| Ollama | Model runtime | Verified local inference API | 0.32.5 | Formal product/source review pending | Existing evaluated runtime | Review exact source, license, telemetry, update and API behavior in Wave 2 |
| LM Studio | Model laboratory/API fallback | CLI installed; server stopped in evidence | CLI commit `71bd99c` | Proprietary product terms; API use only unless terms allow more | Existing evaluation tool | Review terms, network behavior, and data paths in Wave 2 |
| Qwen3 8B via Ollama | Local model | Structured-response workstation test | Ollama ID `500a1f067a9f` | Registry reports Apache-2.0; formal model-card and attribution review pending | Evaluation only | Record upstream model identity, files, license, and limitations before adoption |

No entry above authorizes redistribution, embedding, rebranding, or commercial distribution.
