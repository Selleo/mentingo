"""Execute selected real dataset cases locally and record verified Langfuse experiments.

The repository-owned coordinator uses its native runner and v4 recorder.
--check is local-only; the normal command executes models/apps and uploads results.
Credentials are loaded only from the shell or explicitly named env files.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, urlencode, urlsplit

from manage import OWNER, ProjectClient, digest, validate_manifest
from record import item_identity, normalize_report

ROOT = Path(__file__).resolve().parents[2]
PROJECTS = {
    "mentingo": (
        "cmiitc20o00qtad07rwd8bx29",
        "apps/api/test/evaluations/feature-catalogue.v1.json",
        "docs/langfuse/remote-setup.json",
        "apps/api",
    )
}


def private_json(path, value):
    """Keep captured prompts/results private and never print their payloads."""
    path = Path(path)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as target:
        json.dump(value, target, ensure_ascii=False, indent=2)
        target.write("\n")
    path.chmod(0o600)


def resolved_path(value, base):
    """Interpret relative config paths relative to the config file, not package cwd."""
    path = Path(value).expanduser()
    return (base / path).resolve() if not path.is_absolute() else path.resolve()


def load_config(path):
    """Validate a bounded explicit selection before executing any runner or network call."""
    path = Path(path).resolve()
    config = json.loads(path.read_text())
    profile = config.get("project")
    if profile not in PROJECTS:
        raise ValueError("project must be mentingo")
    base = path.parent
    repo = resolved_path(config.get("repo", str(ROOT)), base)
    project_id, manifest_path, setup_path, cwd = PROJECTS[profile]
    manifest = json.loads((repo / manifest_path).read_text())
    setup = json.loads((repo / setup_path).read_text())
    features = validate_manifest(manifest)
    if (
        manifest.get("project") != profile
        or setup.get("project", {}).get("id") != project_id
    ):
        raise ValueError("Local project/setup identity mismatch")
    selected_features = config.get("features")
    if (
        not isinstance(selected_features, list)
        or not selected_features
        or len(set(selected_features)) != len(selected_features)
    ):
        raise ValueError("Explicit unique features list is required")
    known = {
        feature.get("featureId", feature.get("id")): feature for feature in features
    }
    if any((feature not in known for feature in selected_features)):
        raise ValueError("Unknown feature selection")
    cases = config.get("cases", [])
    if not isinstance(cases, list) or len(set(cases)) != len(cases):
        raise ValueError("cases must be a unique list")
    selected = [
        (known[f], item)
        for f in selected_features
        for item in known[f]["items"]
        if not cases or item["id"] in cases
    ]
    if (
        not selected
        or len(selected) > 200
        or set(cases) - {item["id"] for _, item in selected}
    ):
        raise ValueError("Unknown/empty case selection or more than 200 cases")
    prefix = config.get("runName")
    if (
        not isinstance(prefix, str)
        or not prefix.strip()
        or len(prefix) > 100
        or any((ch in prefix for ch in "/\\\r\n"))
    ):
        raise ValueError("runName must be a short filesystem-safe label")
    interpreter = config.get("python", sys.executable)
    python = (
        shutil.which(interpreter)
        if "/" not in interpreter
        else os.path.abspath(os.path.join(base, os.path.expanduser(interpreter)))
    )
    if not python or not Path(python).is_file():
        raise ValueError("Configured Python interpreter does not exist")
    timeout = config.get("timeoutSeconds", 300)
    if (
        not isinstance(timeout, int)
        or isinstance(timeout, bool)
        or (not 1 <= timeout <= 3600)
    ):
        raise ValueError("timeoutSeconds must be 1..3600")
    for key in ("promptSnapshots", "appConfig"):
        if config.get(key):
            config[key] = str(resolved_path(config[key], base))
            if not Path(config[key]).is_file():
                raise ValueError(key + " file does not exist")
    roots = config.get("mediaRoots", [])
    if not isinstance(roots, list) or any(
        (not isinstance(root, str) for root in roots)
    ):
        raise ValueError("mediaRoots must be an explicit list of directories")
    config["mediaRoots"] = [str(resolved_path(root, base)) for root in roots]
    if any((not Path(root).is_dir() for root in config["mediaRoots"])):
        raise ValueError("Explicit mediaRoots directories must exist before execution")
    config.update(
        profile=profile,
        repo=str(repo),
        python=python,
        timeoutSeconds=timeout,
        projectId=project_id,
        manifestPath=str(repo / manifest_path),
        setupPath=str(repo / setup_path),
        cwd=str(repo / cwd),
        outputDir=str(
            resolved_path(config.get("outputDir", "./experiment-runs"), base)
        ),
        configBase=str(base),
    )
    return (config, manifest, setup, selected)


def execution_env(config):
    """Load only explicitly named dotenv files using the configured existing Python environment."""
    env = dict(os.environ)
    paths = config.get("envFiles", [])
    if not isinstance(paths, list):
        raise ValueError("envFiles must be a list of explicit paths")
    for value in paths:
        path = resolved_path(value, Path(config["configBase"]))
        if not path.is_file():
            raise ValueError("Explicit env file does not exist")
        result = subprocess.run(
            [
                config["python"],
                "-c",
                "import json,sys; from dotenv import dotenv_values; print(json.dumps(dict(dotenv_values(sys.argv[1]))))",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
            env={**env, "PYTHON_DOTENV_DISABLED": "1"},
        )
        if result.returncode:
            raise ValueError(
                "Reading explicit envFiles requires python-dotenv in configured Python"
            )
        env.update(
            {
                key: value
                for key, value in json.loads(result.stdout).items()
                if value is not None
            }
        )
    env.update(
        PYTHON_DOTENV_DISABLED="1",
        LANGFUSE_TRACING_ENABLED="false",
        OTEL_SDK_DISABLED="true",
    )
    return env


def local_preflight(config, selected, env):
    """Check credentials/dependencies locally without assuming a running app is healthy."""
    for name in ("LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"):
        if not env.get(name):
            raise ValueError("Missing " + name)
    if not (env.get("LANGFUSE_BASE_URL") or env.get("LANGFUSE_HOST")):
        raise ValueError("Missing LANGFUSE_BASE_URL")
    model = config.get("model")
    if model is not None:
        if not isinstance(model, dict) or set(model) - {
            "model",
            "apiKeyEnv",
            "baseURL",
            "timeoutMs",
        }:
            raise ValueError(
                "model accepts only model, apiKeyEnv, baseURL and timeoutMs; never literal credentials"
            )
        if not re.fullmatch("[A-Z_][A-Z0-9_]*", str(model.get("apiKeyEnv", ""))):
            raise ValueError("apiKeyEnv must name an environment variable")
        endpoint = urlsplit(model.get("baseURL", "https://api.openai.com/v1"))
        if (
            endpoint.scheme != "https"
            or endpoint.username
            or endpoint.password
            or endpoint.query
            or endpoint.fragment
            or (not endpoint.hostname)
            or (
                endpoint.scheme != "https"
                and (
                    not (
                        endpoint.scheme == "http"
                        and endpoint.hostname in ("localhost", "127.0.0.1", "::1")
                    )
                )
            )
        ):
            raise ValueError(
                "Model endpoint must use HTTPS or local HTTP without embedded credentials"
            )
    if (
        model
        and "timeoutMs" in model
        and (
            not isinstance(model["timeoutMs"], int)
            or isinstance(model["timeoutMs"], bool)
            or (not 1000 <= model["timeoutMs"] <= 120000)
        )
    ):
        raise ValueError("model.timeoutMs must be 1000..120000")
    needs_model = any(
        (
            item["input"]["task"]["kind"] in ("prompt", "embedding")
            for _, item in selected
        )
    )
    if model is not None:
        if (
            not isinstance(model, dict)
            or not isinstance(model.get("model"), str)
            or (not model["model"].strip())
            or (not isinstance(model.get("apiKeyEnv"), str))
            or (not env.get(model["apiKeyEnv"]))
        ):
            raise ValueError(
                "model requires explicit model name and populated apiKeyEnv"
            )
    elif needs_model:
        raise ValueError("Selected tasks require model configuration")
    if any(
        (
            item["input"]["task"]["kind"] in ("app", "assistant", "audio")
            for _, item in selected
        )
    ) and (not config.get("appConfig")):
        raise ValueError(
            "Native Core tasks require appConfig and a launched disposable environment"
        )
    probe = subprocess.run(
        [
            config["python"],
            "-c",
            "from opentelemetry.sdk.trace import TracerProvider; from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter",
        ],
        capture_output=True,
        timeout=30,
        env=env,
    )
    if probe.returncode:
        raise ValueError(
            "Configured Python needs opentelemetry-sdk and opentelemetry-exporter-otlp-proto-http"
        )
    if not shutil.which("pnpm", path=env.get("PATH")):
        raise ValueError("pnpm is required for the Core runner")


def published_preflight(client, config, manifest, setup, selected):
    """Fence project and every input/oracle before spending tokens or mutating fixtures."""
    client.verify_project()
    datasets = {d["featureId"]: d for d in setup["datasets"]}
    for feature, item in selected:
        feature_id = feature.get("featureId", feature.get("id"))
        dataset = datasets.get(feature_id)
        if (
            not dataset
            or dataset["name"] != feature["datasetName"]
            or dataset.get("manifestSha256") != digest(feature)
        ):
            raise ValueError(
                "Local setup differs from selected feature; explicitly synchronize configuration first"
            )
        published = client.request(
            "GET",
            "/api/public/dataset-items/"
            + quote(item_identity(config["profile"], feature_id, item["id"]), safe=""),
        )
        metadata = published.get("metadata", {})
        if (
            published.get("datasetId") != dataset["id"]
            or published.get("status") != "ACTIVE"
            or metadata.get("owner") != OWNER
            or (metadata.get("caseId") != item["id"])
            or (metadata.get("featureId") != feature_id)
            or (digest(published.get("input")) != digest(item["input"]))
            or (
                digest(published.get("expectedOutput"))
                != digest(item["expectedOutput"])
            )
        ):
            raise ValueError(
                "Published dataset item/input/oracle mismatch; no case executed"
            )


def native_command(config, feature, item, report, model_file):
    """Use fixed native entrypoints and argv arrays; configuration cannot inject shell commands."""
    feature_id = feature.get("featureId", feature.get("id"))
    command = [
        "pnpm",
        "exec",
        "node",
        "--import",
        "tsx",
        "test/evaluations/run-feature.ts",
        "--mode",
        "run",
        "--feature",
        feature_id,
        "--case",
        item["id"],
        "--out",
        str(report),
    ]
    if config.get("model"):
        command += ["--provider-config", str(model_file), "--allow-model-requests"]
    if config.get("appConfig"):
        command += ["--app-config", config["appConfig"], "--allow-app-requests"]
    if config.get("promptSnapshots"):
        command += ["--prompt-snapshots", config["promptSnapshots"]]
    elif config.get("allowBundledPrompts"):
        command += ["--prompt-source", "local"]
    elif item["input"]["task"]["kind"] == "prompt":
        raise ValueError(
            "Core prompt tasks require promptSnapshots or explicit allowBundledPrompts"
        )
    return command


def run_native(config, feature, item, directory, env):
    """Run one case, retain failures/timeout and preserve source-provided actual evidence."""
    report = directory / (item["id"] + ".json")
    private_json(report, {})
    model_file = directory / "provider-config.json"
    if config.get("model"):
        private_json(model_file, config["model"])
    child_env = dict(env)
    command = native_command(config, feature, item, report, model_file)
    started = datetime.now(timezone.utc).isoformat()
    clock = time.monotonic()
    try:
        process = subprocess.run(
            command,
            cwd=config["cwd"],
            env=child_env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=config["timeoutSeconds"],
        )
        code = process.returncode
        result = json.loads(report.read_text())
        rows = result.get("results", [])
        if len(rows) != 1 or rows[0].get("caseId") != item["id"]:
            raise ValueError("Native report must contain exactly the selected case")
        row = rows[0]
        if (
            row.get("input") != item["input"]
            or row.get("expectedOutput") != item["expectedOutput"]
        ):
            raise ValueError("Native report input/oracle differs from selected fixture")
        if code not in (0, 2) and row.get("executionStatus", row.get("status")) not in (
            "failed",
            "not_run",
        ):
            raise ValueError("Runner exited with failure but reported success")
    except (
        subprocess.TimeoutExpired,
        ValueError,
        OSError,
        json.JSONDecodeError,
    ) as error:
        code = 1
        row = {
            "caseId": item["id"],
            "featureId": feature.get("featureId", feature.get("id")),
            "status": "failed",
            "input": item["input"],
            "expectedOutput": item["expectedOutput"],
            "output": None,
            "checks": {},
            "metadata": {"runnerFailure": type(error).__name__},
        }
    source_commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=config["repo"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    dirty = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=config["repo"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    row["metadata"] = {
        **row.get("metadata", {}),
        "repositoryDirty": bool(dirty.stdout.strip()),
        "repositoryCommit": source_commit.stdout.strip(),
        "runnerStartedAt": started,
        "runnerFinishedAt": datetime.now(timezone.utc).isoformat(),
        "runnerElapsedMs": round((time.monotonic() - clock) * 1000),
        "runnerExitCode": code,
    }
    return row


def read_pages(client, path, parameters, max_pages=100):
    """Follow documented cursor pagination with an explicit loop/cycle bound."""
    rows, seen = ([], set())
    query = dict(parameters)
    for _ in range(max_pages):
        response = client.request("GET", path + "?" + urlencode(query))
        data = response.get("data")
        if not isinstance(data, list) or any(
            (not isinstance(row, dict) for row in data)
        ):
            raise ValueError("Invalid Langfuse readback page")
        rows.extend(data)
        cursor = response.get("meta", {}).get("cursor")
        if not cursor:
            return rows
        if not isinstance(cursor, str) or cursor in seen:
            raise ValueError("Repeated or invalid Langfuse pagination cursor")
        seen.add(cursor)
        query["cursor"] = cursor
    raise ValueError("Langfuse readback pagination limit exceeded")


def id_batches(values, size=100):
    """Keep comma-list/filter URLs bounded while batching ordinary 67-item runs."""
    unique = sorted(set(values))
    return [unique[start : start + size] for start in range(0, len(unique), size)]


def receipt_rows(receipt):
    """Reject empty/ambiguous receipts before accepting unrelated indexed data."""
    rows = receipt.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Receipt must contain recorded case rows")
    cases, roots = (set(), set())
    for row in rows:
        required = ("caseId", "experimentId", "traceId", "observationId", "featureId")
        if not isinstance(row, dict) or any(
            (not isinstance(row.get(key), str) or not row[key] for key in required)
        ):
            raise ValueError("Receipt row is missing exact experiment/root identity")
        root = (row["traceId"], row["observationId"])
        if row["caseId"] in cases or root in roots:
            raise ValueError("Receipt contains duplicate case or observation identity")
        cases.add(row["caseId"])
        roots.add(root)
    return rows


def verify_recording(client, receipt, since, attempts=30, profile=None):
    """Batch exact ingestion and root-bound feature scores; poll only pending work."""
    if (
        not isinstance(attempts, int)
        or isinstance(attempts, bool)
        or (not 1 <= attempts <= 30)
    ):
        raise ValueError("Readback attempts must be between 1 and 30")
    rows = receipt_rows(receipt)
    experiments, observations, scores = (set(), set(), {})
    expected_roots = {(row["traceId"], row["observationId"]) for row in rows}

    def quality_for(row):
        name = f"regression/{profile}/experiment-{row['featureId']}/v1"
        return next(
            (
                score
                for score in scores.get((row["traceId"], row["observationId"]), [])
                if score.get("name") == name
            ),
            None,
        )

    for attempt in range(attempts):
        until = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
        for batch in id_batches(
            (
                row["experimentId"]
                for row in rows
                if row["experimentId"] not in experiments
            )
        ):
            data = read_pages(
                client,
                "/api/public/experiments",
                {
                    "fromStartTime": since,
                    "toStartTime": until,
                    "id": ",".join(batch),
                    "fields": "core",
                    "limit": 100,
                },
            )
            experiments.update(
                (row.get("id") for row in data if row.get("id") in batch)
            )
        missing = [
            row
            for row in rows
            if (row["traceId"], row["observationId"]) not in observations
        ]
        for batch in id_batches((row["traceId"] for row in missing)):
            filters = [
                {
                    "type": "stringOptions",
                    "column": "traceId",
                    "operator": "any of",
                    "value": batch,
                },
                {
                    "type": "string",
                    "column": "environment",
                    "operator": "=",
                    "value": "regression-experiment",
                },
                {
                    "type": "datetime",
                    "column": "startTime",
                    "operator": ">=",
                    "value": since,
                },
                {
                    "type": "datetime",
                    "column": "startTime",
                    "operator": "<",
                    "value": until,
                },
            ]
            data = read_pages(
                client,
                "/api/public/v2/observations",
                {"fields": "core", "limit": 1000, "filter": json.dumps(filters)},
            )
            observations.update(
                (
                    (row.get("traceId"), row.get("id"))
                    for row in data
                    if (row.get("traceId"), row.get("id")) in expected_roots
                )
            )
        pending_quality = [row for row in rows if quality_for(row) is None]
        for batch in id_batches((row["traceId"] for row in pending_quality)):
            data = read_pages(
                client,
                "/api/public/v3/scores",
                {"traceId": ",".join(batch), "limit": 100, "fields": "details,subject"},
            )
            for score in data:
                subject = score.get("subject") or {}
                root = (subject.get("traceId"), subject.get("id"))
                if subject.get("kind") == "observation" and root in expected_roots:
                    retained = scores.setdefault(root, [])
                    identity = score.get("id") or (
                        score.get("name"),
                        score.get("source"),
                    )
                    retained[:] = [
                        old
                        for old in retained
                        if (old.get("id") or (old.get("name"), old.get("source")))
                        != identity
                    ]
                    retained.append(score)
        pending = [
            row
            for row in rows
            if row["experimentId"] not in experiments
            or (row["traceId"], row["observationId"]) not in observations
            or quality_for(row) is None
        ]
        if not pending:
            break
        if attempt + 1 < attempts:
            time.sleep(2)
    result = []
    for row in rows:
        quality = quality_for(row)
        result.append(
            {
                "caseId": row["caseId"],
                "experimentId": row["experimentId"],
                "traceUrl": row.get("traceUrl"),
                "verified": row["experimentId"] in experiments
                and (row["traceId"], row["observationId"]) in observations,
                "executionStatus": row["status"],
                "judgeStatus": (
                    quality.get("value", "score_available")
                    if quality
                    else "pending_or_not_configured"
                ),
                "judgeRootVerified": quality is not None,
                "scores": [
                    {
                        key: score.get(key)
                        for key in ("name", "value", "comment", "subject")
                    }
                    for score in scores.get((row["traceId"], row["observationId"]), [])
                ],
            }
        )
    return result


def verify_receipt(config_path, receipt_path):
    """Read an existing receipt with LF auth only: no models, apps, OTLP or upload."""
    config_path, receipt_path = (
        Path(config_path).resolve(),
        Path(receipt_path).resolve(),
    )
    config = json.loads(config_path.read_text())
    profile = config.get("project")
    if profile not in PROJECTS:
        raise ValueError("project must be mentingo")
    receipt = json.loads(receipt_path.read_text())
    receipt_rows(receipt)
    expected_id = PROJECTS[profile][0]
    if receipt.get("project", {}).get("id") != expected_id:
        raise ValueError("Receipt and configured Langfuse project do not match")
    env = dict(os.environ)
    paths = config.get("envFiles", [])
    if not isinstance(paths, list):
        raise ValueError("envFiles must be a list of explicit paths")
    if paths:
        try:
            from dotenv import dotenv_values
        except ImportError:
            raise ValueError(
                "Use shell LF credentials or install python-dotenv for envFiles"
            ) from None
        for value in paths:
            path = resolved_path(value, config_path.parent)
            if not path.is_file():
                raise ValueError("Explicit env file does not exist")
            env.update(
                {
                    key: value
                    for key, value in dotenv_values(path).items()
                    if value is not None
                }
            )
    for name in ("LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"):
        if not env.get(name):
            raise ValueError("Missing " + name)
    origin = env.get("LANGFUSE_BASE_URL") or env.get("LANGFUSE_HOST")
    if not origin:
        raise ValueError("Missing LANGFUSE_BASE_URL")
    client = ProjectClient(
        origin, env["LANGFUSE_PUBLIC_KEY"], env["LANGFUSE_SECRET_KEY"], expected_id
    )
    if client.verify_project().get("id") != expected_id:
        raise ValueError("Readback credential project does not match receipt")
    stamp = re.search("\\d{8}T\\d{6}Z", str(receipt.get("runName", "")))
    started = (
        datetime.strptime(stamp.group(), "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        if stamp
        else datetime.fromtimestamp(receipt_path.stat().st_mtime, timezone.utc)
    )
    cases = verify_recording(
        client, receipt, (started - timedelta(hours=1)).isoformat(), profile=profile
    )
    output = receipt_path.parent / ("verification-" + uuid.uuid4().hex[:12] + ".json")
    result = {
        "mode": "verified_existing_receipt",
        "project": profile,
        "receipt": str(receipt_path),
        "verificationReport": str(output),
        "cases": cases,
        "noModelOrAppRequests": True,
        "noRecordingRequests": True,
        "semanticAcceptance": "pending_uncalibrated_review",
    }
    private_json(output, result)
    return result


def execute(path, check=False):
    """Preflight, execute, upload and verify one explicitly configured experiment selection."""
    config, manifest, setup, selected = load_config(path)
    env = execution_env(config)
    local_preflight(config, selected, env)
    for feature, item in selected:
        native_command(config, feature, item, Path("report.json"), Path("model.json"))
    if check:
        return {
            "mode": "checked_local_only",
            "project": config["profile"],
            "cases": [item["id"] for _, item in selected],
            "noRemoteRequests": True,
        }
    client = ProjectClient(
        env.get("LANGFUSE_BASE_URL") or env["LANGFUSE_HOST"],
        env["LANGFUSE_PUBLIC_KEY"],
        env["LANGFUSE_SECRET_KEY"],
        config["projectId"],
    )
    published_preflight(client, config, manifest, setup, selected)
    since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    run_name = (
        config["runName"]
        + "-"
        + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        + "-"
        + uuid.uuid4().hex[:6]
    )
    directory = Path(config["outputDir"]) / run_name
    directory.mkdir(mode=448, parents=True, exist_ok=False)
    rows = []
    for feature, item in selected:
        print(json.dumps({"stage": "executing", "caseId": item["id"]}), flush=True)
        rows.append(run_native(config, feature, item, directory, env))
    report = {
        "schemaVersion": 1,
        "project": config["profile"],
        "model": {},
        "results": rows,
    }
    normalize_report(report, manifest)
    report_path = directory / "results.json"
    receipt_path = directory / "receipt.json"
    private_json(report_path, report)
    setup_path = directory / "setup.json"
    private_json(setup_path, {**setup, "profile": config["profile"]})
    exported = subprocess.run(
        [
            config["python"],
            str(ROOT / "scripts/langfuse/record.py"),
            "--setup",
            str(setup_path),
            "--manifest",
            config["manifestPath"],
            "--report",
            str(report_path),
            "--run-name",
            run_name,
            "--receipt",
            str(receipt_path),
            "--apply",
            *[
                argument
                for root in config.get("mediaRoots", [])
                for argument in ("--media-root", root)
            ],
        ],
        cwd=ROOT,
        env={**env, "OTEL_SDK_DISABLED": "false"},
        capture_output=True,
        timeout=max(180, 60 * len(rows)),
    )
    if exported.returncode:
        raise ValueError(
            "Langfuse export failed; actual results are retained at " + str(report_path)
        )
    receipt = json.loads(receipt_path.read_text())
    verified = verify_recording(client, receipt, since, profile=config["profile"])
    summary = {
        "mode": "executed_and_recorded",
        "project": config["profile"],
        "runName": run_name,
        "report": str(report_path),
        "receipt": str(receipt_path),
        "cases": verified,
        "semanticAcceptance": "pending_uncalibrated_review",
    }
    private_json(directory / "summary.json", summary)
    return summary


def result_exit_code(result, require_pass=False):
    """Keep recording success distinct from an explicitly requested semantic regression gate."""
    rows = result.get("cases")
    if not isinstance(rows, list) or not rows:
        raise ValueError("A regression result must contain executed case outcomes")
    return int(
        any(
            (
                not row.get("verified")
                or row.get("executionStatus") in ("failed", "not_run")
                or (
                    require_pass
                    and (
                        row.get("judgeStatus") != "pass"
                        or not row.get("judgeRootVerified")
                    )
                )
                for row in rows
            )
        )
    )


def main():
    """The named experiment command explicitly runs providers/apps and records to Langfuse."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--check",
        action="store_true",
        help="Local prerequisite validation only; no models/apps/Langfuse calls",
    )
    mode.add_argument(
        "--verify-receipt",
        type=Path,
        help="Read existing receipt only; no model/app/upload",
    )
    parser.add_argument(
        "--require-pass",
        action="store_true",
        help="Fail unless every executed case has a verified root-bound feature-judge pass",
    )
    args = parser.parse_args()
    if args.check and args.require_pass:
        parser.error(
            "--require-pass requires execution or an existing receipt, not --check"
        )
    try:
        result = (
            verify_receipt(args.config, args.verify_receipt)
            if args.verify_receipt
            else execute(args.config, args.check)
        )
    except (
        ValueError,
        OSError,
        KeyError,
        RuntimeError,
        TypeError,
        subprocess.SubprocessError,
    ) as error:
        print(
            (
                str(error)
                if isinstance(error, ValueError)
                else "Experiment failed: " + type(error).__name__
            ),
            file=sys.stderr,
        )
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.check:
        return 0
    return result_exit_code(result, args.require_pass)


if __name__ == "__main__":
    raise SystemExit(main())
