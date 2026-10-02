"""The model calls: Claude Opus 5.5 through the Claude Code CLI, on a Claude subscription.

- ``cli``: one call through `claude -p` with the subscription it is signed in with: a person's `/login` on their own
  machine, the company's Claude for Teams token (CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`) in CI. An
  Anthropic API key in the environment is left out of every call: it would take precedence over the subscription;
- ``agent``: no call; the prompt is written to a file for the running coding agent to hand to an Opus sub-agent.
RELEASE_FILM_LLM picks one explicitly. A call that fails (rate limits, an overloaded service, a timeout) is tried again
a few times; one that still fails hands the prompt to the agent (``provider: agent`` with the reason).
"""
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

import core

MODEL = 'claude-opus-5-5'  # every call, the scene workers' too, with the effort the call names
EFFORT = 'medium'  # a call that names no effort
ATTEMPTS = 3  # a failing call is tried this many times when the failure passes (rate limits, an overloaded API)
TRANSIENT = ('rate limit', 'rate_limit', '429', 'overloaded', '529', '500', '502', '503', 'internal server error',
             'request timed out', 'connection', 'temporarily')
# every Claude Code call runs on the subscription: an API key would take precedence over it; no Bash in these calls,
# so the CLI's subprocess scrub (which needs bubblewrap, and which GitHub Actions would turn on) stays off
SUBSCRIPTION = {'ANTHROPIC_API_KEY': None, 'ANTHROPIC_AUTH_TOKEN': None, 'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB': '0'}
SUBSCRIPTION_LOGINS = ('claude.ai', 'oauth_token')  # `claude auth status` authMethod of a /login and of a CI token
# what no model reads (Read rules cover Grep and Glob too): the process environment (/proc: a CI token lives there), the
# Claude Code login (~/.claude) and a checkout's git credentials (.git/config); checked with the CLI, 2026-09-28
PRIVATE = ('Read(//proc/**)', 'Read(~/.claude/**)', 'Read(//**/.git/config)')


def choose():
    wanted = os.environ.get('RELEASE_FILM_LLM', 'auto')
    if wanted != 'auto':
        return wanted
    return 'cli' if shutil.which('claude') else 'agent'


def capabilities(provider=None):
    """What this run can do with models: the text calls, the review and the scene workers all run in the Claude Code
    CLI (the review and the workers read files and images)."""
    cli_there = (provider or choose()) == 'cli'
    return {'text': cli_there, 'review': cli_there, 'workers': cli_there}


def signed_in():
    """Whether the Claude Code CLI can call a model on a Claude subscription (`claude auth status`, asked as the calls
    run: without an API key). An older CLI without the command, or an answer it cannot read, counts as yes: the calls
    themselves then find out."""
    try:
        done = subprocess.run(['claude', 'auth', 'status', '--json'], capture_output=True, text=True, timeout=30,
                              stdin=subprocess.DEVNULL, env=core.environ(SUBSCRIPTION))
        answer = json.loads(done.stdout or 'null')
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return True
    if not isinstance(answer, dict):
        return True
    method = answer.get('authMethod')
    return answer.get('loggedIn') is not False and (method is None or method in SUBSCRIPTION_LOGINS)


def degraded(run, what, why):
    """Records in the run (degraded.json, the film's summary) that a step was left out for want of a model, and says
    so on stderr: a film made without its scene workers or review must not pass for a whole one."""
    path = Path(run) / 'degraded.json'
    found = core.load(path) or {}
    if found.get(what) != why:
        found[what] = why
        core.save(path, found)
    print(f'release-film: DEGRADED: {what}: {why}', file=sys.stderr, flush=True)


def complete(prompt, system, provider=None, effort=None, timeout=1800):
    """(text, usage) from Claude Opus 5.5; ('', {'provider': 'agent', 'fallback': why}) when the agent answers
    instead: no model to call, or one that kept failing (tried ATTEMPTS times when the failure looks transient)."""
    if (provider or choose()) != 'cli':
        return '', {'provider': 'agent'}
    error = None
    for attempt in range(ATTEMPTS):
        try:
            return cli(prompt, system, effort or EFFORT, timeout=timeout)
        except (RuntimeError, subprocess.TimeoutExpired, ValueError) as caught:
            error = caught
            if attempt + 1 < ATTEMPTS and any(word in str(caught).lower() for word in TRANSIENT):
                time.sleep(10 * (attempt + 1))
                continue
            break
    return '', {'provider': 'agent', 'fallback': str(error)[:500]}


def log(usage, system):
    """``usage``, also written as a line of the run's usage.jsonl (the run in RELEASE_FILM_RUN): what a film's model
    calls cost, step by step (the step named by its system prompt)."""
    run = os.environ.get('RELEASE_FILM_RUN')
    if run and Path(run).is_dir():
        line = dict(usage, step=' '.join(system.split())[:60],
                    utc=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'))
        with open(Path(run) / 'usage.jsonl', 'a', encoding='utf-8') as out:
            out.write(json.dumps(line, ensure_ascii=False) + '\n')
    return usage


def cli(prompt, system, effort, read=(), timeout=1800):
    """One answer from `claude -p`: Opus 5.5 at ``effort``, no tools (or only Read, for the folders in ``read``: images
    to look at), the system prompt replaced, run from an empty folder so no project CLAUDE.md is read, nothing kept of
    the session."""
    with tempfile.TemporaryDirectory() as folder:
        system_file = Path(folder) / 'system.txt'
        system_file.write_text(system, encoding='utf-8')
        tools = ['--tools', 'Read', '--allowedTools', 'Read', '--disallowedTools', *PRIVATE, '--permission-prompts', 'none'] \
            if read else ['--tools', '']
        dirs = [a for d in read for a in ('--add-dir', str(d))]
        try:
            out = core.sh(['claude', '-p', '--model', MODEL, '--effort', effort, *tools, *dirs, '--output-format', 'json',
                           '--no-session-persistence', '--strict-mcp-config', '--system-prompt-file', str(system_file)],
                          cwd=folder, input_text=prompt, timeout=timeout, check=False,
                          env=SUBSCRIPTION)
        except subprocess.TimeoutExpired:
            raise RuntimeError(f'claude -p gave no answer within {timeout} s')
    try:
        data = json.loads(out.stdout)
    except ValueError:
        raise RuntimeError(f'claude -p gave no answer (exit {out.returncode}): {(out.stderr or out.stdout)[-400:]}')
    # a list of every message with verbose output, else the result alone
    result = next((m for m in (data if isinstance(data, list) else [data]) if m.get('type') == 'result'), None)
    if not result or result.get('is_error') or result.get('subtype') != 'success':
        raise RuntimeError(f"claude -p failed: {(result or {}).get('result') or (result or {}).get('subtype') or out.stdout[-400:]}")
    usage = result.get('usage') or {}
    return result.get('result') or '', log({
        'provider': 'cli', 'model': MODEL, 'effort': effort, 'seconds': round((result.get('duration_ms') or 0) / 1000, 1),
        'input': usage.get('input_tokens', 0) + usage.get('cache_read_input_tokens', 0) + usage.get('cache_creation_input_tokens', 0),
        'output': usage.get('output_tokens', 0), 'thinking': (usage.get('output_tokens_details') or {}).get('thinking_tokens'),
        'usd_list': result.get('total_cost_usd')}, system)



def visual(prompt, system, effort, read=(), timeout=1800, provider=None):
    """One image review through the Claude Code CLI (it reads the pictures in ``read`` with its Read tool)."""
    selected = provider or choose()
    if selected != 'cli':
        raise RuntimeError(f'{selected} cannot review images: the Claude Code CLI is needed')
    return cli(prompt, system, effort, read=read, timeout=timeout)
