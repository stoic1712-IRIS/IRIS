# Wave 0 Workstation Certification

**Project:** STOIC-IRIS

**Date:** 2026-08-04

**Branch:** `iris/governance-repository-foundation`

**Baseline revision:** `cca945f`

**Status:** Decision gate passed and evidence canonical

## Host Platform

- Manufacturer: ASUS
- Model: System Product Name
- Processor: AMD Ryzen 5 9600X, 6 cores and 12 logical processors
- Host memory: 31.16 GB
- Windows storage: 930.47 GB total, 723.59 GB free
- GPU: NVIDIA GeForce RTX 3090
- GPU memory: 24 GB

## WSL and Ubuntu

- Default distribution: Ubuntu
- WSL version: 2
- Ubuntu version: Ubuntu 26.04 LTS (Resolute Raccoon)
- Ubuntu security maintenance: Main/Restricted packages supported through 2031
- WSL memory: 15 GiB
- WSL swap: 4 GiB
- Ubuntu storage: 1007 GB total, approximately 954 GB available

Two Ubuntu packages were deferred through normal phased deployment:

- `python3-software-properties`
- `software-properties-common`

This is a non-blocking operating-system update condition. No forced installation was performed.

## Container Runtime

- Docker Desktop: 4.85.0
- Docker Engine: 29.6.2
- Docker Linux context: `desktop-linux`
- Disposable `hello-world` container: Passed
- NVIDIA CUDA container GPU access: Passed
- Test containers used `--rm` cleanup

## Development Tools

- Node.js: 24.19.0 LTS
- npm: 11.17.0
- pnpm: 11.20.0
- Python: 3.14.4
- Git: 2.53.0
- Visual Studio Code: 1.131.0

## Local Model Runtime

- Ollama: 0.32.5
- LM Studio CLI: installed
- Test model: `qwen3:8b`
- Ollama model identity: `500a1f067a9f`
- Download size: 5.2 GB
- Runtime allocation: 100% GPU
- Runtime memory: 10.0 GB
- Tested context: 32,768 tokens

## Structured-Response Test

The local Ollama API returned schema-constrained JSON and PowerShell parsed it successfully:

```json
{
  "status": "ready",
  "gpu_vram_gb": 24,
  "model": "qwen3:8b"
}
```

## Security and Limitations

- Ubuntu Pro is not attached and is not required for standard LTS maintenance.
- WSL reported a speculative return-stack CPU status. Other reported CPU vulnerability classes were mitigated or not affected. This observation should remain documented and be reassessed with future firmware, Windows, and WSL updates.
- LM Studio is installed but did not contain a local LLM and its API server was not running. Ollama satisfied the requirement for at least one verified local model API.
- The downloaded CUDA and Ollama model images remain stored locally.
- Automated workstation diagnostics are implemented in `scripts/diagnostics/workstation.ps1`, and the latest output is preserved in `evidence/wave-0/workstation-diagnostics.txt`.

## Decision Gate

The measured workstation has no identified blocker for local STOIC-IRIS development. Wave 0 technical verification passes.

The reproducible diagnostic script has been executed, its output has been preserved, and the evidence has been reviewed without unresolved error markers. Permanent Wave 0 completion now requires committing this reviewed evidence on the governed branch.

## Rollback

This evidence exists only on the working branch until committed. Before publication, it can be removed without affecting `main`. The repository baseline remains recoverable at merge commit `cca945f`.
