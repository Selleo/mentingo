#!/bin/bash
set -eo pipefail

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <prompt-file> <iterations>"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required to stream pi JSON events"
  exit 1
fi

PROMPT_FILE="$1"
ITERATIONS="$2"
# Set AFK_PI_SHOW_THINKING=0 to only show thinking start/end markers.
export AFK_PI_SHOW_THINKING="${AFK_PI_SHOW_THINKING:-1}"

# pi is installed under node v24 via nvm; bash scripts don't load the zsh alias,
# and the project .nvmrc pins an older node that fails pi's engine checks.
PI_BIN="${PI_BIN:-/Users/lukaszwalczak/.nvm/versions/node/v24.11.0/bin/pi}"
if [ ! -x "$PI_BIN" ]; then
  echo "Error: pi binary not found at $PI_BIN (override with PI_BIN=...)"
  exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: prompt file '$PROMPT_FILE' not found"
  exit 1
fi

# Human-readable live stream from `pi --mode json`.
# This prints text deltas immediately, thinking markers/content, and one line per tool used.
stream_events='
  def trunc(n): tostring | if length > n then .[0:n-3] + "..." else . end;

  if .type == "message_update" then
    .assistantMessageEvent as $event |
    if $event.type == "text_delta" then
      $event.delta
    elif $event.type == "thinking_start" then
      "\n[thinking]\n"
    elif $event.type == "thinking_delta" then
      if env.AFK_PI_SHOW_THINKING == "0" then "" else "\u001b[2m" + $event.delta + "\u001b[0m" end
    elif $event.type == "thinking_end" then
      "\n[/thinking]\n"
    else
      empty
    end
  elif .type == "tool_execution_start" then
    "\n[tool] " + .toolName + " " + (((.args // {}) | tojson) | trunc(300)) + "\n"
  elif .type == "auto_retry_start" then
    "\n[retry] attempt " + (.attempt | tostring) + "/" + (.maxAttempts | tostring) + " after " + (.delayMs | tostring) + "ms: " + .errorMessage + "\n"
  elif .type == "compaction_start" then
    "\n[compaction:start] " + .reason + "\n"
  elif .type == "compaction_end" then
    "\n[compaction:end] " + .reason + (if .aborted then " aborted" else "" end) + "\n"
  else
    empty
  end
'

stop_signal='
  select(.type == "agent_end") |
  any(.messages[]?;
    .role == "assistant" and
    any(.content[]?;
      .type == "text" and ((.text // "") | contains("<promise>NO MORE TASKS</promise>"))
    )
  )
'

tmpfiles=()
trap 'rm -f "${tmpfiles[@]}"' EXIT

echo "=== Ralph starting ($ITERATIONS iterations, prompt: $PROMPT_FILE) ==="

for ((i=1; i<=$ITERATIONS; i++)); do
  echo ""
  echo "--- Iteration $i/$ITERATIONS ---"

  tmpfile=$(mktemp)
  tmpfiles+=("$tmpfile")

  echo "[prompt] Loading $PROMPT_FILE"
  prompt=$(cat "$PROMPT_FILE")

  echo "[pi] Sending prompt (JSON streaming mode)..."
  "$PI_BIN" \
    --mode json \
    "$prompt" \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_events"

  echo ""

  if jq -e "$stop_signal" "$tmpfile" >/dev/null; then
    echo ""
    echo "=== Ralph complete after $i/$ITERATIONS iterations ==="
    exit 0
  fi

  echo "[result] No stop signal, continuing..."
done

echo ""
echo "=== Ralph finished all $ITERATIONS iterations (no stop signal received) ==="
