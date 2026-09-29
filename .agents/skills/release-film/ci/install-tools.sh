#!/usr/bin/env bash
# What a release film needs on a fresh Ubuntu 24.04 host besides Node, git, gh, Python and Docker, as the GitHub-hosted
# runner (release-film.yml) installs it. The skill fetches edge-tts and Caddy itself on first use.
#
#   install-tools.sh
set -euo pipefail

CLAUDE_CODE_VERSION=2.1.283  # the Claude Code CLI the skill last ran with (film.py doctor checks its options)
PLAYWRIGHT_VERSION=1.61.1  # the list of Chromium's system libraries (a project's own tests bring their browser)

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

as_root apt-get update -qq
as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
  ffmpeg fonts-dejavu-core poppler-utils python3-venv >/dev/null
# Playwright calls apt through sudo itself; the project's own Playwright downloads the browser during the run.
npx --yes "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium >/dev/null
if [ -w "$(npm prefix -g)" ]; then
  npm install -g --silent "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"
else
  as_root npm install -g --silent "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"
fi
claude --version
