#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: start-founder-command-center.sh <iris-root> <command-center-root>" >&2
  exit 64
fi

iris_root=$1
command_center_root=$2
voice_root="$HOME/.local/share/stoic-iris/voice-runtime"
voice_python="$voice_root/.venv/bin/python"
voice_service="$iris_root/scripts/runtime/iris-voice-service.py"
voice_log="$voice_root/voice-service.log"
gateway_pid=""

source "$HOME/.nvm/nvm.sh"
export IRIS_ROOT="$iris_root"

if [[ ! -x "$voice_python" ]]; then
  echo "IRIS voice runtime is not installed." >&2
  exit 1
fi
if [[ ! -f "$voice_service" ]]; then
  echo "IRIS voice service was not found." >&2
  exit 1
fi

"$voice_python" "$voice_service" --host 127.0.0.1 --port 8765 \
  >"$voice_log" 2>&1 &
voice_pid=$!

cleanup_runtime() {
  if [[ -n "$gateway_pid" ]]; then
    kill "$gateway_pid" 2>/dev/null || true
    wait "$gateway_pid" 2>/dev/null || true
  fi
  kill "$voice_pid" 2>/dev/null || true
  wait "$voice_pid" 2>/dev/null || true
}
trap cleanup_runtime EXIT INT TERM

voice_ready=0
for _attempt in $(seq 1 60); do
  if curl --silent --fail --max-time 1 \
    http://127.0.0.1:8765/health >/dev/null 2>&1; then
    voice_ready=1
    break
  fi
  if ! kill -0 "$voice_pid" 2>/dev/null; then
    tail -n 30 "$voice_log" >&2
    exit 1
  fi
  sleep 0.5
done

if [[ "$voice_ready" -ne 1 ]]; then
  tail -n 30 "$voice_log" >&2
  echo "IRIS voice runtime did not become ready." >&2
  exit 1
fi

echo "IRIS neural voice is ready on loopback."
cd "$command_center_root"
node scripts/local-gateway.mjs &
gateway_pid=$!
wait "$gateway_pid"
