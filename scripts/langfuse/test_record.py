"""Recording captures must never turn prepared fixtures into generated outputs."""

import unittest

from record import assert_new_trace, normalize_report, otlp_headers
from test_manage import manifest


class RecordTests(unittest.TestCase):
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

    def test_failed_attempts_remain_failed_in_the_capture(self):
        row = normalize_report(
            {"results": [{"caseId": "source-grounding", "status": "failed"}]},
            manifest(),
        )[0]
        self.assertEqual(row["status"], "failed")
        self.assertIsNone(row["output"])

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
