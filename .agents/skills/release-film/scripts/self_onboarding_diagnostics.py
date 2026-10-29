"""Bounded recorder startup logs, without generated secrets or browser sessions."""
import json
from pathlib import Path
import re
import sys

import core


LIMIT = 16_000


def startup_report(run):
    run = Path(run).resolve()
    generated = core.load(run/'secrets.json', {}) or {}
    secrets = sorted({value for value in generated.values() if isinstance(value, str) and len(value) >= 8}, key=len, reverse=True)
    results = run/'checkout/apps/web/test-results'
    paths = [run/'env.log', run/'keeper.log', *sorted(results.glob('**/error-context.md'))[:4]]
    report = []
    for path in paths:
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(run):
            continue
        # Provider/workflow credentials have already been redacted by the workflow.
        # These additional values are the run's generated fixture secrets.
        window = LIMIT * 4 + max((len(secret.encode()) for secret in secrets), default=0)
        with path.open('rb') as source:
            source.seek(0, 2)
            source.seek(max(0, source.tell() - window))
            text = source.read().decode('utf-8', errors='replace')
        for secret in secrets:
            text = text.replace(secret, '***')
        text = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', text)
        report.append({'file': str(path.relative_to(run)), 'tail': text[-LIMIT:]})
    return report


if __name__ == '__main__':
    for entry in startup_report(sys.argv[1]):
        # JSON keeps arbitrary log lines from becoming GitHub workflow commands.
        print(json.dumps(entry, ensure_ascii=False))
