#!/usr/bin/env python3
"""Hide the CI's secrets in a recording's files before any of them leaves the runner (the run's report, the film and
its page, the project's knowledge): every value of the variables in SECRETS found in a file under the folders given
is replaced with ***. GitHub masks these values in the job's log, never in the files a run writes (a scene's thrown
error, a worker's transcript), and the report artifact is readable by everyone who can read the repository.

  redact.py <folder> [<folder> …]     prints {"redacted": [the files changed]}

The values come from this step's environment. Pictures and sound are left as they are (no text in them), and so are
the release's checkout and installed packages (never uploaded).
"""
import json
import os
from pathlib import Path
import sys

SECRETS = ('CLAUDE_CODE_OAUTH_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN')
SHORTEST = 16  # a shorter value is no token (and *** in its place everywhere would spoil the files)
MEDIA = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mp3', '.wav', '.m4a', '.ogg'}
SKIPPED = {'checkout', 'node_modules', '.git', 'toolchain'}  # folders no artifact takes a file from


def values(environ=None):
    """The secrets' values set in ``environ`` (this process's), longest first: one that holds another goes whole."""
    environ = os.environ if environ is None else environ
    found = {environ.get(name) or '' for name in SECRETS}
    return sorted((v for v in found if len(v) >= SHORTEST), key=len, reverse=True)


def redact(folders, secrets):
    """Replace every value of ``secrets`` in the files under ``folders``; returns the files changed."""
    wanted = [s.encode('utf-8') for s in secrets]
    changed = []
    if not wanted:
        return changed
    for folder in folders:
        for root, dirs, files in os.walk(folder):
            dirs[:] = sorted(d for d in dirs if d not in SKIPPED)
            for name in sorted(files):
                path = Path(root) / name
                if path.suffix.lower() in MEDIA or path.is_symlink() or not path.is_file():
                    continue
                data = path.read_bytes()
                hidden = data
                for secret in wanted:
                    hidden = hidden.replace(secret, b'***')
                if hidden != data:
                    path.write_bytes(hidden)
                    changed.append(str(path))
    return changed


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    changed = redact([f for f in sys.argv[1:] if Path(f).is_dir()], values())
    for path in changed:  # the files, never the values
        print(f'::warning::a secret was written to {path}: it is replaced with ***', file=sys.stderr)
    print(json.dumps({'redacted': changed}, indent=1))


if __name__ == '__main__':
    main()
