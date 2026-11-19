"""Bounded, redacted PR recording diagnostics; never upload auth or checkout files."""

import json
import os
from pathlib import Path

import core

NAME = "pr-video-recording-report.json"


def safe(value, depth=0):
    if depth > 8:
        return "[nested diagnostics omitted]"
    if isinstance(value, dict):
        return {
            safe(str(key), depth + 1): safe(item, depth + 1)
            for key, item in list(value.items())[:40]
        }
    if isinstance(value, (list, tuple)):
        return [safe(item, depth + 1) for item in value[:40]]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    text = str(value)
    secrets = {
        item
        for key, item in os.environ.items()
        if len(item) >= 8
        and any(
            marker in key.upper()
            for marker in ("TOKEN", "SECRET", "PASSWORD", "API_KEY")
        )
    }
    for secret in sorted(secrets, key=len, reverse=True):
        text = text.replace(secret, "***")
    if len(text) > 8000:
        return text[:4000] + "\n[diagnostic text shortened]\n" + text[-4000:]
    return text


def _tail(path, root):
    if (
        path.is_symlink()
        or not path.resolve().is_relative_to(root.resolve())
        or not path.is_file()
    ):
        return None
    with path.open("rb") as stream:
        size = path.stat().st_size
        stream.seek(max(0, size - 65536))
        text = stream.read(65536).decode("utf-8", errors="replace")
    if size > 65536:
        text = text.partition("\n")[2]  # omit a partial first line/token
    return safe(text)


def checkpoint(run, phase, result=None, error=None):
    run = Path(run)
    report = core.load(run / NAME) or {"schemaVersion": 1, "events": []}
    if report.get("phase") != phase:
        report.pop("result", None)
        report["events"].append(phase)
    report["phase"] = phase
    if result is not None:
        report["result"] = safe(result)
    if error is not None:
        report["error"] = safe(str(error))
    logs = {}
    paths = [
        run / "keeper.log",
        run / "setup.log",
        *sorted((run / "gaps").glob("pr-flow-*/worker.log")),
    ]
    for path in paths[:6]:
        try:
            text = _tail(path, run)
        except OSError:
            continue
        if text:
            logs[str(path.relative_to(run))] = text
    report["logs"] = logs
    core.save(run / NAME, report)
    return report


def reason(result):
    details = {
        key: result[key]
        for key in ("problems", "unfixed", "rejected", "degraded", "next", "note")
        if result.get(key)
    }
    return (
        json.dumps(safe(details), ensure_ascii=False)[:2500]
        if details
        else "No reviewed film was returned; inspect the recording report."
    )
