"""Faithful judge views of captured voice evidence; original roots remain unmodified."""

import copy

from manage import digest


def project_voice_output(actual, provenance):
    """Summarize only routine per-frame input acknowledgments, retaining every critical event.

    Unknown fields, failed sequence assertions, errors and unfamiliar events are
    retained verbatim. Frame summaries expose ordered sequences and every measured
    gap/duplicate; the complete original log remains bound by SHA and source path.
    """
    output = copy.deepcopy(actual)
    if not isinstance(actual, dict) or not isinstance(
        actual.get("nativeSocketEvents"), list
    ):
        return output
    events = actual["nativeSocketEvents"]
    retained, groups = [], {}
    for index, event in enumerate(events):
        payload = event.get("payload") if isinstance(event, dict) else None
        meta = payload.get("meta") if isinstance(payload, dict) else None
        routine = (
            isinstance(event, dict)
            and set(event) <= {"event", "receivedAtMonotonic", "payload"}
            and event.get("event") == "audio:chunked"
            and isinstance(payload, dict)
            and set(payload)
            <= {
                "type",
                "sessionId",
                "meta",
                "sessionRunId",
                "duplicate",
                "lastAcceptedAudioSeq",
                "nextAudioSeq",
            }
            and payload.get("type") == "audio.chunk"
            and payload.get("duplicate") is False
            and isinstance(meta, dict)
            and set(meta) <= {"seq", "sr", "samples", "tsMs"}
            and all(
                type(meta.get(key)) is int for key in ("seq", "sr", "samples", "tsMs")
            )
            and payload.get("lastAcceptedAudioSeq") == meta["seq"]
            and payload.get("nextAudioSeq") == meta["seq"] + 1
        )
        if not routine:
            retained.append(copy.deepcopy(event))
            continue
        key = (payload.get("sessionId"), payload.get("sessionRunId"), meta["sr"])
        group = groups.setdefault(
            key,
            {
                "sessionId": key[0],
                "sessionRunId": key[1],
                "sampleRate": key[2],
                "originalEventIndices": [],
                "orderedSequences": [],
                "sampleCounts": [],
                "firstReceivedAtMonotonic": event.get("receivedAtMonotonic"),
                "lastReceivedAtMonotonic": event.get("receivedAtMonotonic"),
                "firstTimestampMs": meta["tsMs"],
                "lastTimestampMs": meta["tsMs"],
                "sequenceAnomalies": [],
            },
        )
        sequences = group["orderedSequences"]
        if sequences and meta["seq"] != sequences[-1] + 1:
            group["sequenceAnomalies"].append(
                {
                    "originalEventIndex": index,
                    "previousSequence": sequences[-1],
                    "sequence": meta["seq"],
                    "expectedNext": sequences[-1] + 1,
                }
            )
        group["originalEventIndices"].append(index)
        sequences.append(meta["seq"])
        group["sampleCounts"].append(meta["samples"])
        group["lastReceivedAtMonotonic"] = event.get("receivedAtMonotonic")
        group["lastTimestampMs"] = meta["tsMs"]
    for group in groups.values():
        group["count"] = len(group["orderedSequences"])
        group["sequenceBounds"] = [
            min(group["orderedSequences"]),
            max(group["orderedSequences"]),
        ]
        group["totalSamples"] = sum(group["sampleCounts"])
    output["nativeSocketEvents"] = retained
    output["nativeFrameReceiptProjection"] = {
        "kind": "derived_routine_input_frame_receipt_summary_not_raw_log",
        "originalLogSha256": digest(events),
        "originalEventCount": len(events),
        "retainedCriticalOrUnknownEventCount": len(retained),
        "summarizedRoutineFrameCount": sum(group["count"] for group in groups.values()),
        "fullSourceReportPath": provenance.get("sourceReportPath"),
        "fullSourceReportSha256": provenance.get("sourceReportSha256"),
        "fullLogLocation": "original captured output.nativeSocketEvents",
        "groups": list(groups.values()),
    }
    return output


def project_judge_metadata(metadata):
    """Keep checks/identities/provenance while removing duplicate output views, never root metadata."""
    projected = copy.deepcopy(metadata)
    for field in ("judgeCompatibleOutput", "judgeCompatibleMetadata"):
        projected.pop(field, None)
    native = projected.get("nativeResult")
    if isinstance(native, dict) and "output" in native:
        original = native.pop("output")
        native["outputProjectionAudit"] = {
            "originalOutputSha256": digest(original),
            "location": "Root output and judgeCompatibleOutput; duplicate omitted from this metadata view only.",
        }
    projected["metadataProjectionProvenance"] = (
        "Derived judge context: root metadata remains intact; only duplicate actual output views omitted."
    )
    return projected
