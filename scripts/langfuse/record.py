"""Explicitly record already-executed, synthetic regression outputs in Langfuse.

This does not call a model or application. It exports OpenTelemetry experiment
attributes documented by Langfuse, avoiding deprecated dataset-run APIs. Span
duration measures capture ingestion; original execution timing stays in metadata.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import uuid
from pathlib import Path

from manage import OWNER, ProjectClient, digest, validate_manifest
from record_media import prepare_media, upload_media
from record_projection import project_judge_metadata, project_voice_output


def item_identity(profile, feature_id, case_id):
    """Keep published dataset-item correlation identical across setup, preflight and export."""
    value = OWNER + ":" + profile + ":" + feature_id + ":" + case_id
    return value if len(value) <= 255 else OWNER + ":" + digest(value)


def otlp_headers(client):
    """Select observations-first ingestion required for experiment synthesis."""
    return {
        "Authorization": client.authorization,
        "x-langfuse-ingestion-version": "4",
    }


def assert_new_trace(client, trace_id):
    existing = client.request(
        "GET",
        "/api/public/v2/observations?traceId=" + trace_id + "&limit=1&fields=core",
    )
    if existing.get("data"):
        raise ValueError("This report/run trace already exists; choose a new run name")


def effective_prompt_records(native, row, metadata):
    """Retain captured managed/bundled identities without inventing managed version numbers."""
    captured = []
    for request in metadata.get("effectiveModelRequests", []):
        if isinstance(request, dict) and isinstance(request.get("prompts"), list):
            captured.extend(request["prompts"])
    if not captured:
        nested = metadata.get("nativeResult")
        candidates = [native.get("prompts"), row.get("promptFragments")]
        if isinstance(nested, dict):
            candidates.append(nested.get("prompts"))
        captured = next((value for value in candidates if isinstance(value, list) and value), [])
    unique = {}
    for record in captured:
        if not isinstance(record, dict) or not isinstance(record.get("name"), str):
            raise ValueError("Captured prompt identities must be named records")
        unique[digest(record)] = record
    return list(unique.values())


def calibrated_audio_evidence(output):
    """Require positive heard content plus a matching, genuinely rejected negation control.

    Artifact bytes are separately verified by prepare_media before upload. This
    derives metadata only; it never supplies a model verdict or changes output.
    """
    if not isinstance(output, dict):
        return None
    review = output.get("perceptualReview")
    if (
        not isinstance(review, dict)
        or review.get("status") != "pass"
        or review.get("calibrationStatus") != "required_negative_controls_rejected"
    ):
        return None
    required = {
        "intelligible",
        "noInterferingArtifacts",
        "nonemptyIndependentTranscript",
        "meaningPreserved",
        "requiredContentComplete",
        "noUnsupportedOrUnsafeContent",
        "evidenceQuotesVerified",
    }
    checks = review.get("referenceChecks", {})
    if (
        not isinstance(checks, dict)
        or not all(checks.get(key) is True for key in required)
        or not review.get("observation", {}).get("transcript")
    ):
        return None

    def audio_artifacts(value):
        if isinstance(value, dict):
            if (
                value.get("mediaType") == "audio/wav"
                and value.get("path")
                and value.get("sha256")
            ):
                yield value["sha256"]
            for child in value.values():
                yield from audio_artifacts(child)
        elif isinstance(value, list):
            for child in value:
                yield from audio_artifacts(child)

    def reviewed_audio(value):
        return {row.get("stage") for row in value.get("providerReceipts", [])} >= {
            "blind_audio_observation",
            "reference_comparison",
        }

    if review.get("artifactSha256") not in set(
        audio_artifacts(output)
    ) or not reviewed_audio(review):
        return None
    for control in review.get("negativeControlResults", []):
        result = control.get("result", {})
        artifact = control.get("artifact", {})
        control_checks = result.get("referenceChecks", {})
        if (
            control.get("kind") == "audio"
            and control.get("negativeKind") == "altered_negation"
            and result.get("status") == "fail"
            and result.get("judgment", {}).get("verdict") == "fail"
            and result.get("artifactSha256") == artifact.get("sha256")
            and artifact.get("mediaType") == "audio/wav"
            and artifact.get("sha256") != review.get("artifactSha256")
            and reviewed_audio(result)
            and result.get("observation", {}).get("transcript")
            and any(
                control_checks.get(key) is False
                for key in (
                    "meaningPreserved",
                    "requiredContentComplete",
                    "noUnsupportedOrUnsafeContent",
                )
            )
            and all(
                result.get(key) == review.get(key)
                for key in ("model", "audioModel", "promptSha256", "referenceSha256")
            )
        ):
            return {
                "positiveAudioSha256": review["artifactSha256"],
                "rejectedNegationAudioSha256": artifact["sha256"],
                "model": review.get("model"),
                "audioModel": review.get("audioModel"),
                "promptSha256": review.get("promptSha256"),
                "referenceSha256": review.get("referenceSha256"),
            }
    return None


def normalize_report(report, manifest):
    lookup = {}
    for feature in validate_manifest(manifest):
        identity = feature.get("featureId") or feature.get("id")
        for item in feature["items"]:
            lookup[item["id"]] = (identity, feature, item)
    raw_rows = report.get("results", report.get("reports", []))
    if not isinstance(raw_rows, list) or not raw_rows:
        raise ValueError("An actual execution report is required")
    rows, seen = [], set()
    for row in raw_rows:
        native = row.get("result", row)
        metadata = (
            {**report.get("model", {}), **row.get("metadata", {})}
            if isinstance(report.get("model", {}), dict)
            else row.get("metadata", {})
        )
        case_id = (
            row.get("caseId")
            or metadata.get("caseId")
            or native.get("case_id")
            or row.get("id")
        )
        if case_id not in lookup or case_id in seen:
            raise ValueError("Unknown or duplicate captured case identity")
        seen.add(case_id)
        feature_id, feature, item = lookup[case_id]
        status = row.get("executionStatus") or native.get("status")
        if status not in (
            "generated",
            "response_generated",
            "needs_review",
            "passed",
            "failed",
            "not_run",
        ):
            raise ValueError(
                "Prepared tasks and reference candidates are not application results"
            )
        actual = row.get("actualOutput", native.get("output"))
        if (
            status in ("generated", "response_generated", "needs_review", "passed")
            and actual is None
        ):
            raise ValueError("Successful execution needs actual output evidence")
        actual_input = row.get("input")
        expected = item["expectedOutput"]
        if "expectedOutput" in row and digest(row["expectedOutput"]) != digest(
            expected
        ):
            raise ValueError(
                "Captured expected output differs from the versioned oracle"
            )
        checks = (
            row.get("checks")
            or native.get("checks")
            or row.get("deterministic", {}).get("checks", {})
        )
        if not isinstance(checks, dict) or any(
            not isinstance(value, bool) for value in checks.values()
        ):
            raise ValueError("Deterministic checks must be boolean assertions")
        raw_status = status
        if status != "not_run" and any(value is False for value in checks.values()):
            status = "failed"
        metadata = {
            **metadata,
            "reportedExecutionStatus": raw_status,
            "inputProvenance": (
                metadata.get("inputProvenance", "runner_supplied")
                if actual_input is not None
                else "missing"
            ),
            "featureId": feature_id,
            "caseId": case_id,
            "scope": metadata.get(
                "scope", feature.get("executionLevel", feature.get("coverageScope"))
            ),
            "executionStatus": status,
            "capturedInputSha256": digest(actual_input),
            "publishedItemInputSha256": digest(item["input"]),
            "inputMatchesPublishedItem": actual_input is not None
            and digest(actual_input) == digest(item["input"]),
            "deterministicChecks": checks,
            "providerResponses": row.get("providerResponses", []),
            "effectivePromptRecords": effective_prompt_records(native, row, metadata),
            "runtimeContextAudit": row.get("contextAudit"),
            "priorAttemptFailures": report.get("priorFailures", []),
            "captureImportOnly": True,
            # Capture actual evidence before upload_media replaces artifact objects
            # with Langfuse markers. Never trust an incoming purported projection.
            "judgeCompatibleOutput": project_voice_output(actual, metadata.get("savedExecutionImport", {})),
            "judgeCompatibleOutputProvenance": {
                "source": "actual_output_before_media_marker_replacement",
                "routineVoiceFramesMayBeSummarized": isinstance(actual, dict) and isinstance(actual.get("nativeSocketEvents"), list),
                "sha256": digest(actual),
                "perceptualAcceptance": "Only independently captured actual-media review and controls establish audible quality; this projection does not listen to audio.",
            },
            "evidenceLayerSemantics": {
                "recordingSpan": "Imports a previously executed capture; creating this span does not execute an application or model.",
                "needs_review": "Native execution/hard checks finished; semantic quality awaits its separate evaluator.",
                "nativeOutputStatus": "Native execution or deterministic-check status, not the separate semantic score.",
                "unobservedProviderInternals": "The CLI did not instrument the application's outgoing provider call; inspect supplied native HTTP/Socket captures and state readbacks independently.",
            },
            "spanLatencyIsIngestionNotOriginalExecution": True,
        }
        native_metadata = metadata.get("nativeResult")
        calibration = calibrated_audio_evidence(actual)
        if (
            isinstance(native_metadata, dict)
            and native_metadata.get("acceptance") == "response_only_uncalibrated"
            and calibration
        ):
            metadata["nativeResult"] = {
                **copy.deepcopy(native_metadata),
                "acceptance": "independent_actual_audio_review_with_rejected_negative_control",
            }
            metadata["compatibilityCorrection"] = {
                "field": "nativeResult.acceptance",
                "originalValue": native_metadata["acceptance"],
                "originalNativeMetadataSha256": digest(native_metadata),
                "sourceReportSha256": metadata.get("savedExecutionImport", {}).get(
                    "sourceReportSha256"
                ),
                "reason": "Historical generic label predates the attached actual-audio positive review and matching rejected negation control.",
                "derivedEvidence": calibration,
                "actualOutputChanged": False,
            }
        metadata["judgeCompatibleMetadata"] = project_judge_metadata(metadata)
        rows.append(
            {
                "caseId": case_id,
                "featureId": feature_id,
                "datasetName": feature["datasetName"],
                "input": actual_input,
                "output": actual,
                "expectedOutput": expected,
                "metadata": metadata,
                "status": status,
            }
        )
    return rows


def record_report(client, setup, manifest, report, run_name, media_roots=None):
    """Ingest real captured responses; the caller explicitly authorizes exporter traffic."""
    rows = normalize_report(report, manifest)
    prepared_media = prepare_media(rows, media_roots)

    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
    from opentelemetry.sdk.trace.id_generator import IdGenerator

    client.verify_project()
    if setup["project"]["id"] != client.expected_id:
        raise ValueError("Setup and credential project do not match")
    report_hash = digest(report)

    class StableItemIds(IdGenerator):
        item = ""

        def generate_trace_id(self):
            return int(
                digest([client.expected_id, run_name, report_hash, self.item])[:32], 16
            )

        def generate_span_id(self):
            return int(
                digest([client.expected_id, run_name, report_hash, self.item, "root"])[
                    :16
                ],
                16,
            )

    ids = StableItemIds()

    class VerifiedExporter(SpanExporter):
        def __init__(self):
            self.delegate = OTLPSpanExporter(
                endpoint=client.origin + "/api/public/otel/v1/traces",
                headers=otlp_headers(client),
                timeout=60,
            )
            self.results = []

        def export(self, spans):
            result = self.delegate.export(spans)
            self.results.append(result)
            return result

        def shutdown(self):
            self.delegate.shutdown()

    exporter = VerifiedExporter()
    provider = TracerProvider(id_generator=ids)
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("mentingo.explicit-regression-capture", "1")
    receipts = []
    try:
        for row_index, row in enumerate(rows):
            dataset = next(
                (
                    value
                    for value in setup["datasets"]
                    if value["name"] == row["datasetName"]
                ),
                None,
            )
            if dataset is None:
                raise ValueError("Feature dataset has not been provisioned")
            stable_item = item_identity(
                setup.get("profile", manifest.get("project")),
                row["featureId"],
                row["caseId"],
            )
            # Item lookup guards against silently linking a captured response to a different fixture.
            published = client.request(
                "GET", "/api/public/dataset-items/" + urllib_quote(stable_item)
            )
            if published.get("datasetId") != dataset["id"]:
                raise ValueError("Published item and dataset identity mismatch")
            experiment_id = uuid.uuid5(
                uuid.NAMESPACE_URL,
                client.expected_id
                + ":"
                + run_name
                + ":"
                + dataset["id"]
                + ":"
                + report_hash,
            ).hex
            ids.item = stable_item
            assert_new_trace(client, format(ids.generate_trace_id(), "032x"))
            media_receipts = upload_media(
                client,
                rows,
                prepared_media,
                row_index,
                format(ids.generate_trace_id(), "032x"),
                format(ids.generate_span_id(), "016x"),
            )
            attributes = {
                "langfuse.environment": "regression-experiment",
                "langfuse.trace.name": "regression/" + row["featureId"],
                "langfuse.observation.type": "span",
                "langfuse.observation.input": json.dumps(
                    row["input"], ensure_ascii=False
                ),
                "langfuse.observation.output": json.dumps(
                    row["output"], ensure_ascii=False
                ),
                "langfuse.experiment.id": experiment_id,
                "langfuse.experiment.name": run_name + "/" + row["featureId"],
                "langfuse.experiment.dataset.id": dataset["id"],
                "langfuse.experiment.description": "Explicit captured-response baseline; actual model execution preceded ingestion. Controlled synthetic fixtures; no customer mutations.",
                "langfuse.experiment.metadata.report_sha256": report_hash,
                "langfuse.experiment.metadata.trigger": "explicit_manual",
                "langfuse.experiment.item.id": stable_item,
                "langfuse.experiment.item.expected_output": json.dumps(
                    row["expectedOutput"], ensure_ascii=False
                ),
            }
            for key, value in row["metadata"].items():
                attributes["langfuse.observation.metadata." + key] = json.dumps(
                    value, ensure_ascii=False
                )
                attributes["langfuse.experiment.item.metadata." + key] = json.dumps(
                    value, ensure_ascii=False
                )
            with tracer.start_as_current_span(
                "regression/" + row["featureId"], attributes=attributes
            ) as span:
                trace_id = format(span.get_span_context().trace_id, "032x")
                observation_id = format(span.get_span_context().span_id, "016x")
                span.set_attribute(
                    "langfuse.experiment.item.root_observation_id", observation_id
                )
                if row["status"] in ("failed", "not_run"):
                    span.set_attribute("langfuse.observation.level", "ERROR")
            receipts.append(
                {
                    "caseId": row["caseId"],
                    "featureId": row["featureId"],
                    "datasetId": dataset["id"],
                    "experimentId": experiment_id,
                    "traceId": trace_id,
                    "observationId": observation_id,
                    "status": row["status"],
                    **({"media": media_receipts} if media_receipts else {}),
                    "traceUrl": client.origin
                    + "/project/"
                    + client.expected_id
                    + "/traces/"
                    + trace_id,
                }
            )
        if not provider.force_flush(timeout_millis=30000):
            raise RuntimeError("Experiment trace flush did not complete")
        if len(exporter.results) != len(rows) or any(
            result != SpanExportResult.SUCCESS for result in exporter.results
        ):
            raise RuntimeError("Langfuse did not acknowledge every experiment span")
    finally:
        provider.shutdown()
    return {
        "schemaVersion": 1,
        "project": setup["project"],
        "runName": run_name,
        "reportSha256": report_hash,
        "rows": receipts,
        "scope": "captured_response_baseline_not_live_delivery_or_full_workflow",
    }


def urllib_quote(value):
    from urllib.parse import quote

    return quote(value, safe="")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--setup", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--run-name", required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--media-root",
        action="append",
        type=Path,
        default=[],
        help="Explicitly allow verified output media in this directory; repeatable",
    )
    args = parser.parse_args()
    setup, manifest, report = [
        json.loads(path.read_text())
        for path in (args.setup, args.manifest, args.report)
    ]
    if args.apply:
        client = ProjectClient(
            os.environ["LANGFUSE_BASE_URL"],
            os.environ["LANGFUSE_PUBLIC_KEY"],
            os.environ["LANGFUSE_SECRET_KEY"],
            setup["project"]["id"],
        )
        result = record_report(
            client, setup, manifest, report, args.run_name, args.media_root
        )
    else:
        rows = normalize_report(report, manifest)
        media = prepare_media(rows, args.media_root)
        result = {
            "mode": "dry_run",
            **({"validatedMediaCount": len(media)} if args.media_root else {}),
            "rows": rows,
            "noRemoteRequests": True,
        }
    args.receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    args.receipt.chmod(0o600)
    print(
        json.dumps(
            {
                "mode": "recorded" if args.apply else "dry_run",
                "receipt": str(args.receipt),
            }
        )
    )


if __name__ == "__main__":
    main()
