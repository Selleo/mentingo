"""Recording captures must never turn prepared fixtures into generated outputs."""

import unittest

from record import assert_new_trace, normalize_report, otlp_headers
from test_manage import manifest


class RecordTests(unittest.TestCase):
    def test_actual_bundled_prompt_identity_survives_nested_native_capture(self):
        identity = {"name": "writer", "version": None, "origin": "bundled_source", "templateSha256": "a" * 64}
        row = {"caseId": "source-grounding", "status": "needs_review", "output": "Actual",
               "metadata": {"nativeResult": {"prompts": [identity]}}}
        result = normalize_report({"results": [row]}, manifest())[0]
        self.assertEqual(result["metadata"]["effectivePromptRecords"], [identity])
        self.assertIsNone(result["metadata"]["effectivePromptRecords"][0]["version"])

    def test_actual_request_prompt_records_take_precedence_and_deduplicate(self):
        identity = {"name": "actual", "version": 3}
        row = {"caseId": "source-grounding", "status": "needs_review", "output": "Actual",
               "promptFragments": [{"name": "declared-only", "version": 1}],
               "metadata": {"effectiveModelRequests": [{"prompts": [identity]}, {"prompts": [identity]}]}}
        result = normalize_report({"results": [row]}, manifest())[0]
        self.assertEqual(result["metadata"]["effectivePromptRecords"], [identity])

    def test_existing_trace_is_not_exported_again(self):
        class Client:
            def request(self, method, path):
                self.last = (method, path)
                return {"data": [{"id": "already-recorded"}]}

        client = Client()
        with self.assertRaisesRegex(ValueError, "already exists"):
            assert_new_trace(client, "abc")
        self.assertEqual(client.last[0], "GET")

    def test_export_selects_v4_so_experiments_are_synthesized(self):
        client = type("Client", (), {"authorization": "Basic synthetic"})()
        self.assertEqual(
            otlp_headers(client),
            {"Authorization": "Basic synthetic", "x-langfuse-ingestion-version": "4"},
        )

    def test_actual_output_is_retained_without_copying_the_reference(self):
        report = {
            "results": [
                {
                    "caseId": "source-grounding",
                    "status": "needs_review",
                    "output": "Reception is on floor two.",
                    "checks": {"grounded": False},
                }
            ]
        }
        rows = normalize_report(report, manifest())
        self.assertEqual(rows[0]["output"], "Reception is on floor two.")
        self.assertEqual(rows[0]["expectedOutput"], {"requiredFacts": ["floor one"]})
        self.assertEqual(
            rows[0]["metadata"]["deterministicChecks"], {"grounded": False}
        )

    def test_prepared_or_reference_data_cannot_be_recorded_as_an_actual_run(self):
        with self.assertRaisesRegex(ValueError, "Prepared"):
            normalize_report(
                {
                    "results": [
                        {
                            "caseId": "source-grounding",
                            "status": "prepared",
                            "output": "reference",
                        }
                    ]
                },
                manifest(),
            )

    def test_a_success_without_actual_output_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "actual output"):
            normalize_report(
                {
                    "results": [
                        {"caseId": "source-grounding", "status": "response_generated"}
                    ]
                },
                manifest(),
            )

    def test_unexecuted_case_remains_not_run_even_with_legacy_absence_checks(self):
        row = normalize_report(
            {
                "results": [
                    {
                        "caseId": "source-grounding",
                        "status": "not_run",
                        "checks": {"generatedResponse": False},
                    }
                ]
            },
            manifest(),
        )[0]
        self.assertEqual(row["status"], "not_run")
        self.assertEqual(row["metadata"]["reportedExecutionStatus"], "not_run")
        self.assertIsNone(row["output"])

    def test_failed_attempts_remain_failed_in_the_capture(self):
        row = normalize_report(
            {"results": [{"caseId": "source-grounding", "status": "failed"}]},
            manifest(),
        )[0]
        self.assertEqual(row["status"], "failed")
        self.assertIsNone(row["output"])

    def test_missing_input_is_unknown_not_copied_from_the_published_fixture(self):
        row = normalize_report(
            {
                "results": [
                    {
                        "caseId": "source-grounding",
                        "status": "response_generated",
                        "output": "Actual synthetic response",
                    }
                ]
            },
            manifest(),
        )[0]
        self.assertIsNone(row["input"])
        self.assertEqual(row["metadata"]["inputProvenance"], "missing")
        self.assertFalse(row["metadata"]["inputMatchesPublishedItem"])

    def test_report_cannot_replace_the_versioned_expected_output(self):
        with self.assertRaisesRegex(ValueError, "oracle"):
            normalize_report(
                {
                    "results": [
                        {
                            "caseId": "source-grounding",
                            "status": "response_generated",
                            "output": "Actual synthetic response",
                            "expectedOutput": {"requiredFacts": ["changed gold"]},
                        }
                    ]
                },
                manifest(),
            )

    def test_false_deterministic_check_overrides_a_reported_pass(self):
        row = normalize_report(
            {
                "results": [
                    {
                        "caseId": "source-grounding",
                        "status": "passed",
                        "output": "The writer claimed success.",
                        "checks": {"nativePersistence": False, "responded": True},
                    }
                ]
            },
            manifest(),
        )[0]
        self.assertEqual(row["status"], "failed")
        self.assertEqual(row["metadata"]["reportedExecutionStatus"], "passed")
        self.assertFalse(row["metadata"]["deterministicChecks"]["nativePersistence"])
        self.assertEqual(row["output"], "The writer claimed success.")

    def test_nonboolean_checks_are_rejected_instead_of_coerced_to_truth(self):
        for value in ("false", 0, None):
            with self.subTest(value=value), self.assertRaisesRegex(
                ValueError, "boolean"
            ):
                normalize_report(
                    {
                        "results": [
                            {
                                "caseId": "source-grounding",
                                "status": "passed",
                                "output": "Actual synthetic response",
                                "checks": {"nativePersistence": value},
                            }
                        ]
                    },
                    manifest(),
                )

    def test_changed_inputs_are_explicitly_marked_instead_of_rewritten(self):
        row = normalize_report(
            {
                "results": [
                    {
                        "caseId": "source-grounding",
                        "status": "response_generated",
                        "input": {"message": "Different scenario"},
                        "output": "Actual result",
                    }
                ]
            },
            manifest(),
        )[0]
        self.assertEqual(row["input"], {"message": "Different scenario"})
        self.assertFalse(row["metadata"]["inputMatchesPublishedItem"])

    def test_unknown_and_duplicate_cases_fail_before_remote_recording(self):
        item = {
            "caseId": "source-grounding",
            "status": "generated",
            "actualOutput": "Observed output",
        }
        with self.assertRaisesRegex(ValueError, "Unknown or duplicate"):
            normalize_report({"results": [item, item]}, manifest())
        with self.assertRaisesRegex(ValueError, "Unknown or duplicate"):
            normalize_report({"results": [{**item, "caseId": "other"}]}, manifest())


if __name__ == "__main__":
    unittest.main()


class JudgeCompatibleOutputTests(unittest.TestCase):
    def test_projection_is_actual_evidence_and_overwrites_untrusted_metadata(self):
        output = {
            "transcript": "Do not proceed.",
            "perceptualReview": {"status": "fail"},
            "playbackArtifact": {
                "path": "/private/actual.wav",
                "sha256": "a" * 64,
                "byteSize": 44,
                "mediaType": "audio/wav",
            },
        }
        row = {
            "caseId": "source-grounding",
            "status": "needs_review",
            "output": output,
            "metadata": {
                "judgeCompatibleOutput": "fake pass",
                "judgeCompatibleOutputProvenance": "fake",
            },
        }
        normalized = normalize_report({"results": [row]}, manifest())[0]
        metadata = normalized["metadata"]
        self.assertEqual(metadata["judgeCompatibleOutput"], output)
        self.assertNotEqual(
            metadata["judgeCompatibleOutput"], normalized["expectedOutput"]
        )
        self.assertEqual(
            metadata["judgeCompatibleOutputProvenance"]["source"],
            "actual_output_before_media_marker_replacement",
        )
        normalized["output"]["playbackArtifact"] = "@@@langfuseMedia:actual-upload@@@"
        self.assertEqual(
            metadata["judgeCompatibleOutput"]["playbackArtifact"]["mediaType"],
            "audio/wav",
        )
        self.assertEqual(
            metadata["judgeCompatibleOutput"]["perceptualReview"]["status"], "fail"
        )


class CalibratedAcceptanceMetadataTests(unittest.TestCase):
    def evidence(self):
        positive = {
            "status": "pass",
            "calibrationStatus": "required_negative_controls_rejected",
            "artifactSha256": "positive",
            "model": "judge",
            "audioModel": "listener",
            "promptSha256": "prompt",
            "referenceSha256": "reference",
            "referenceChecks": {
                key: True
                for key in [
                    "intelligible",
                    "noInterferingArtifacts",
                    "nonemptyIndependentTranscript",
                    "meaningPreserved",
                    "requiredContentComplete",
                    "noUnsupportedOrUnsafeContent",
                    "evidenceQuotesVerified",
                ]
            },
            "observation": {"transcript": "Verify zero energy."},
            "providerReceipts": [
                {"stage": "blind_audio_observation"},
                {"stage": "reference_comparison"},
            ],
        }
        negative = {
            **positive,
            "status": "fail",
            "artifactSha256": "negative",
            "judgment": {"verdict": "fail"},
            "referenceChecks": {"meaningPreserved": False},
            "observation": {"transcript": "Do not verify zero energy."},
        }
        positive["negativeControlResults"] = [
            {
                "kind": "audio",
                "negativeKind": "altered_negation",
                "artifact": {
                    "path": "negative.wav",
                    "sha256": "negative",
                    "mediaType": "audio/wav",
                },
                "result": negative,
            }
        ]
        return {
            "playbackArtifact": {
                "path": "positive.wav",
                "sha256": "positive",
                "mediaType": "audio/wav",
            },
            "perceptualReview": positive,
        }

    def test_stale_label_is_corrected_only_from_actual_review_and_control(self):
        actual = self.evidence()
        report = {
            "results": [
                {
                    "caseId": "source-grounding",
                    "status": "response_generated",
                    "output": actual,
                    "metadata": {
                        "nativeResult": {"acceptance": "response_only_uncalibrated"},
                        "savedExecutionImport": {
                            "sourceReportSha256": "original-source"
                        },
                    },
                }
            ]
        }
        row = normalize_report(report, manifest())[0]
        self.assertEqual(row["output"], actual)
        self.assertEqual(
            row["metadata"]["nativeResult"]["acceptance"],
            "independent_actual_audio_review_with_rejected_negative_control",
        )
        correction = row["metadata"]["compatibilityCorrection"]
        self.assertEqual(correction["originalValue"], "response_only_uncalibrated")
        self.assertEqual(correction["sourceReportSha256"], "original-source")
        self.assertFalse(correction["actualOutputChanged"])
        self.assertEqual(
            report["results"][0]["metadata"]["nativeResult"]["acceptance"],
            "response_only_uncalibrated",
        )

    def test_boolean_pass_or_unrelated_control_cannot_claim_calibration(self):
        from record import calibrated_audio_evidence

        for defect in (
            "missing_control",
            "unrelated_reference",
            "control_incomplete",
            "positive_not_heard",
        ):
            actual = self.evidence()
            review = actual["perceptualReview"]
            if defect == "missing_control":
                review["negativeControlResults"] = []
            elif defect == "unrelated_reference":
                review["negativeControlResults"][0]["result"][
                    "referenceSha256"
                ] = "other"
            elif defect == "control_incomplete":
                review["negativeControlResults"][0]["result"][
                    "status"
                ] = "insufficient_evidence"
            elif defect == "positive_not_heard":
                review["providerReceipts"] = []
            self.assertIsNone(calibrated_audio_evidence(actual), defect)
