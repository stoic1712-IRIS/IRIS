#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: prepare-founder-runtime.sh <iris-root> <command-center-root>" >&2
  exit 64
fi

build_runtime_root() {
  local root=$1
  if [[ ! -d "$root" || ! -f "$root/package.json" ]]; then
    echo "Runtime source root is unavailable: $root" >&2
    exit 1
  fi
  (
    cd "$root"
    pnpm build
  )
}

require_prebuilt_artifact() {
  local artifact=$1
  if [[ ! -f "$artifact" ]]; then
    echo "Prebuilt runtime artifact is unavailable: $artifact" >&2
    exit 1
  fi
}

if [[ "${IRIS_RUNTIME_PREBUILT:-0}" == "1" ]]; then
  require_prebuilt_artifact "$1/packages/model-gateway/dist/index.js"
  require_prebuilt_artifact "$2/dist/index.html"
  exit 0
fi

build_runtime_root "$1"
build_runtime_root "$2"
