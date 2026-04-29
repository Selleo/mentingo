#!/bin/bash
set -eo pipefail

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# jq filter to extract final result
final_result='select(.type == "result").result // empty'


echo "=== Ralph starting ($1 iterations) ==="

for ((i=1; i<=$1; i++)); do
  echo ""
  echo "--- Iteration $i/$1 ---"

  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  echo "[commits] Fetching last 6 commits..."
  commits=$(git log -n 6 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")

  echo "[issues] Fetching open issues..."
  issues=$(gh issue list --state open --json number,title,body,comments)
  issue_count=$(echo "$issues" | jq 'length')
  issue_titles=$(echo "$issues" | jq -r '.[].title' 2>/dev/null)
  echo "[issues] Found $issue_count open issues:"
  echo "$issue_titles" | sed 's/^/  - /'

  echo "[prompt] Loading ralph/prompt.md"
  prompt=$(cat ralph/prompt.md)

  echo "[claude] Sending prompt..."
  claude \
    --dangerously-skip-permissions \
    --verbose \
    --print \
    --output-format stream-json \
    -- \
    "Previous commits: $commits $issues $prompt" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    echo ""
    echo "=== Ralph complete after $i iterations ==="
    exit 0
  fi

  echo "[result] No stop signal, continuing..."
done

echo ""
echo "=== Ralph finished all $1 iterations (no stop signal received) ==="


