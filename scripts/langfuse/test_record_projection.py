"""Offline lossless-critical-evidence and measured-frame projection controls."""

import copy
import unittest

from manage import digest
from record_projection import project_judge_metadata, project_voice_output


class ProjectionTests(unittest.TestCase):
    def frame(self, seq):
        return {
            "event": "audio:chunked",
            "receivedAtMonotonic": seq / 10,
            "payload": {
                "type": "audio.chunk",
                "sessionId": "actual-session",
                "sessionRunId": "actual-run",
                "duplicate": False,
                "lastAcceptedAudioSeq": seq,
                "nextAudioSeq": seq + 1,
                "meta": {"seq": seq, "sr": 16000, "samples": 320, "tsMs": seq * 20},
            },
        }

    def test_preserves_verbatim_speech_negation_errors_and_all_critical_events(self):
        critical = [
            {
                "event": event,
                "payload": {
                    "text": "Do not isolate.",
                    "unexpectedError": "actual error",
                },
            }
            for event in [
                "learner:transcription",
                "audio:output:interrupted",
                "audio:output:complete",
                "unknown:control",
                "server:error",
            ]
        ]
        actual = {
            "nativeSocketEvents": [self.frame(1), *critical, self.frame(2)],
            "transcript": "Do not isolate.",
            "perceptualReview": {
                "status": "fail",
                "negativeControlResults": [{"status": "pass"}],
            },
        }
        before = copy.deepcopy(actual)
        projected = project_voice_output(
            actual,
            {
                "sourceReportPath": "/private/actual.json",
                "sourceReportSha256": "source",
            },
        )
        self.assertEqual(actual, before)
        self.assertEqual(projected["nativeSocketEvents"], critical)
        self.assertEqual(projected["transcript"], actual["transcript"])
        self.assertEqual(projected["perceptualReview"], actual["perceptualReview"])
        summary = projected["nativeFrameReceiptProjection"]
        self.assertEqual(
            summary["originalLogSha256"], digest(actual["nativeSocketEvents"])
        )
        self.assertEqual(summary["summarizedRoutineFrameCount"], 2)
        self.assertEqual(summary["groups"][0]["orderedSequences"], [1, 2])
        self.assertEqual(
            projected,
            project_voice_output(
                actual,
                {
                    "sourceReportPath": "/private/actual.json",
                    "sourceReportSha256": "source",
                },
            ),
        )

    def test_gaps_duplicates_and_unknown_frame_fields_remain_observable(self):
        anomaly = self.frame(9)
        anomaly["payload"]["unexpectedError"] = "do not hide me"
        events = [self.frame(1), self.frame(3), self.frame(3), anomaly]
        result = project_voice_output({"nativeSocketEvents": events}, {})
        self.assertEqual(result["nativeSocketEvents"], [anomaly])
        group = result["nativeFrameReceiptProjection"]["groups"][0]
        self.assertEqual(group["orderedSequences"], [1, 3, 3])
        self.assertEqual(len(group["sequenceAnomalies"]), 2)
        self.assertEqual(group["sequenceAnomalies"][0]["expectedNext"], 2)

    def test_metadata_keeps_checks_actors_prompts_and_original_hash_without_duplicate_output(
        self,
    ):
        original = {
            "nativeResult": {
                "output": {"actual": "Do not proceed."},
                "acceptance": "failed",
                "sessionId": "actual",
            },
            "deterministicChecks": {"safe": False},
            "actor": "original-user",
            "effectivePromptRecords": [{"name": "original", "version": 3}],
            "judgeCompatibleOutput": {"actual": "Do not proceed."},
        }
        before = copy.deepcopy(original)
        result = project_judge_metadata(original)
        self.assertEqual(original, before)
        self.assertNotIn("judgeCompatibleOutput", result)
        self.assertNotIn("output", result["nativeResult"])
        for field in ("deterministicChecks", "actor", "effectivePromptRecords"):
            self.assertEqual(result[field], original[field])
        self.assertEqual(
            result["nativeResult"]["outputProjectionAudit"]["originalOutputSha256"],
            digest(original["nativeResult"]["output"]),
        )


class RawVoiceEventAccountingTests(unittest.TestCase):
    def test_interruption_count_is_never_collapsed_with_frame_acknowledgments(self):
        interruptions = [{"event": "audio:output:interrupted", "payload": {"jobId": str(index), "reason": "USER_SPEECH"}} for index in range(480)]
        frame = ProjectionTests().frame(1)
        result = project_voice_output({"nativeSocketEvents": [*interruptions, frame]}, {})
        self.assertEqual(result["nativeSocketEvents"], interruptions)
        self.assertEqual(result["nativeFrameReceiptProjection"]["retainedCriticalOrUnknownEventCount"], 480)
        self.assertEqual(result["nativeFrameReceiptProjection"]["summarizedRoutineFrameCount"], 1)
