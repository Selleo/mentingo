"""Coordinator regression tests use temporary fixtures and controlled transports only."""

from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import quote

import experiment
from manage import OWNER, digest
from record import item_identity


class ExperimentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(
            prefix="langfuse-coordinator-test-"
        )
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repo = self.root / "repo"
        self.item = {
            "id": "synthetic-case-a",
            "input": {"task": {"kind": "prompt"}, "message": "Where is reception?"},
            "expectedOutput": {"requiredFacts": ["Reception is on floor one."]},
            "metadata": {"synthetic": True},
        }
        self.feature = {
            "featureId": "synthetic-teacher",
            "datasetName": "core/synthetic-teacher/v1",
            "items": [self.item],
        }
        self.manifest = {"project": "mentingo", "features": [self.feature]}
        project_id, manifest_path, setup_path, _ = experiment.PROJECTS["mentingo"]
        self.setup = {
            "project": {"id": project_id, "name": "mentingo"},
            "datasets": [
                {
                    "id": "synthetic-dataset",
                    "name": self.feature["datasetName"],
                    "featureId": self.feature["featureId"],
                    "manifestSha256": digest(self.feature),
                }
            ],
        }
        self._json(self.repo / manifest_path, self.manifest)
        self._json(self.repo / setup_path, self.setup)
        self.config_path = self.root / "experiment.json"
        self._json(
            self.config_path,
            {
                "project": "mentingo",
                "repo": str(self.repo),
                "python": sys.executable,
                "features": [self.feature["featureId"]],
                "runName": "synthetic-regression",
                "outputDir": "runs",
                "allowBundledPrompts": True,
                "timeoutSeconds": 3,
                "model": {
                    "model": "synthetic-model",
                    "apiKeyEnv": "SYNTHETIC_MODEL_KEY",
                },
            },
        )
        self.env = {
            "LANGFUSE_BASE_URL": "https://langfuse.invalid",
            "LANGFUSE_PUBLIC_KEY": "synthetic-public",
            "LANGFUSE_SECRET_KEY": "synthetic-secret",
            "SYNTHETIC_MODEL_KEY": "synthetic-model-key",
            "PATH": os.environ.get("PATH", ""),
        }

    @staticmethod
    def _json(path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value))

    def _resolved(self):
        return experiment.load_config(self.config_path)

    def _published(self, item=None):
        item = item or self.item
        return {
            "datasetId": "synthetic-dataset",
            "status": "ACTIVE",
            "input": copy.deepcopy(item["input"]),
            "expectedOutput": copy.deepcopy(item["expectedOutput"]),
            "metadata": {
                "owner": OWNER,
                "featureId": self.feature["featureId"],
                "caseId": item["id"],
            },
        }

    def test_check_validates_local_dependencies_without_network_runner_or_recording(
        self,
    ):
        with (
            patch.dict(os.environ, self.env, clear=True),
            patch(
                "experiment.subprocess.run",
                return_value=subprocess.CompletedProcess([], 0),
            ) as process,
            patch("experiment.shutil.which", return_value="/synthetic/pnpm"),
            patch("experiment.ProjectClient") as client,
            patch("experiment.published_preflight") as remote_preflight,
            patch("experiment.run_native") as native,
            patch("urllib.request.urlopen") as network,
        ):
            result = experiment.execute(self.config_path, check=True)
        self.assertEqual(result["mode"], "checked_local_only")
        self.assertTrue(result["noRemoteRequests"])
        self.assertEqual(result["cases"], [self.item["id"]])
        client.assert_not_called()
        remote_preflight.assert_not_called()
        native.assert_not_called()
        network.assert_not_called()
        # The only child is a local dependency-import probe, never a model/app CLI.
        self.assertEqual(process.call_count, 1)
        argv = process.call_args.args[0]
        self.assertEqual(argv[0], os.path.abspath(sys.executable))
        self.assertEqual(argv[1], "-c")
        self.assertIn("opentelemetry", argv[2])
        self.assertNotIn("--apply", argv)
        self.assertEqual(process.call_args.kwargs["env"]["OTEL_SDK_DISABLED"], "true")
        self.assertFalse((self.root / "runs").exists())

    def test_published_owner_or_oracle_drift_aborts_before_any_native_case(self):
        for drift in ("owner", "oracle"):
            with self.subTest(drift=drift):
                published = self._published()
                if drift == "owner":
                    published["metadata"]["owner"] = "unrelated-owner"
                else:
                    published["expectedOutput"] = {"requiredFacts": ["Changed oracle"]}
                client = Mock()
                client.request.return_value = published
                with (
                    patch.dict(os.environ, self.env, clear=True),
                    patch("experiment.local_preflight"),
                    patch("experiment.ProjectClient", return_value=client),
                    patch("experiment.run_native") as native,
                    patch("urllib.request.urlopen") as network,
                ):
                    with self.assertRaisesRegex(ValueError, "Published"):
                        experiment.execute(self.config_path)
                native.assert_not_called()
                network.assert_not_called()
                client.verify_project.assert_called_once()
                self.assertTrue(
                    all(call.args[0] == "GET" for call in client.request.call_args_list)
                )

    def test_every_selected_item_is_preflighted_before_first_paid_case(self):
        second = copy.deepcopy(self.item)
        second["id"] = "synthetic-case-b"
        self.feature["items"].append(second)
        project = experiment.PROJECTS["mentingo"]
        self.setup["datasets"][0]["manifestSha256"] = digest(self.feature)
        self._json(self.repo / project[1], self.manifest)
        self._json(self.repo / project[2], self.setup)
        published_a = self._published()
        published_b = self._published(second)
        published_b["input"] = {"message": "An unrelated case"}
        client = Mock()
        client.request.side_effect = [published_a, published_b]
        with (
            patch.dict(os.environ, self.env, clear=True),
            patch("experiment.local_preflight"),
            patch("experiment.ProjectClient", return_value=client),
            patch("experiment.run_native") as native,
        ):
            with self.assertRaisesRegex(ValueError, "Published"):
                experiment.execute(self.config_path)
        self.assertEqual(client.request.call_count, 2)
        native.assert_not_called()
        self.assertFalse((self.root / "runs").exists())

    def test_setup_feature_hash_drift_is_rejected_before_item_reads(self):
        config, manifest, setup, selected = self._resolved()
        setup["datasets"][0]["manifestSha256"] = "stale-feature"
        client = Mock()
        with self.assertRaisesRegex(ValueError, "Local setup"):
            experiment.published_preflight(client, config, manifest, setup, selected)
        client.request.assert_not_called()

    def test_config_keeps_the_selected_virtualenv_interpreter_symlink(self):
        alias = self.root / "synthetic-venv" / "bin" / "python"
        alias.parent.mkdir(parents=True)
        alias.symlink_to(sys.executable)
        config = json.loads(self.config_path.read_text())
        config["python"] = str(alias)
        self._json(self.config_path, config)
        loaded, _, _, _ = self._resolved()
        self.assertEqual(loaded["python"], str(alias.absolute()))
        self.assertNotEqual(loaded["python"], str(alias.resolve()))

    def test_native_tracing_stays_disabled_but_explicit_exporter_is_enabled(self):
        client = Mock()
        client.request.return_value = self._published()
        observed_native_env = []
        observed_export_env = []

        def native(config, feature, item, directory, env):
            observed_native_env.append(dict(env))
            return {
                "caseId": item["id"],
                "featureId": feature["featureId"],
                "status": "needs_review",
                "input": item["input"],
                "expectedOutput": item["expectedOutput"],
                "output": "Synthetic response",
                "checks": {},
            }

        def export(argv, **kwargs):
            self.assertIn("--apply", argv)
            self.assertTrue(any(str(arg).endswith("record.py") for arg in argv))
            observed_export_env.append(dict(kwargs["env"]))
            self._json(Path(argv[argv.index("--receipt") + 1]), {"rows": []})
            return subprocess.CompletedProcess(argv, 0)

        with (
            patch.dict(os.environ, self.env, clear=True),
            patch("experiment.local_preflight"),
            patch("experiment.ProjectClient", return_value=client),
            patch("experiment.run_native", side_effect=native),
            patch("experiment.subprocess.run", side_effect=export) as exported,
            patch("experiment.verify_recording", return_value=[]),
            patch("builtins.print"),
        ):
            result = experiment.execute(self.config_path)
        self.assertEqual(result["mode"], "executed_and_recorded")
        self.assertEqual(len(observed_native_env), 1)
        self.assertEqual(observed_native_env[0]["OTEL_SDK_DISABLED"], "true")
        self.assertEqual(observed_native_env[0]["LANGFUSE_TRACING_ENABLED"], "false")
        self.assertEqual(len(observed_export_env), 1)
        self.assertEqual(observed_export_env[0]["OTEL_SDK_DISABLED"], "false")
        exported.assert_called_once()

    def test_matching_preflight_uses_the_same_published_item_identity_as_recorder(self):
        config, manifest, setup, selected = self._resolved()
        client = Mock()
        client.request.return_value = self._published()
        experiment.published_preflight(client, config, manifest, setup, selected)
        identity = item_identity("mentingo", self.feature["featureId"], self.item["id"])
        client.request.assert_called_once_with(
            "GET", "/api/public/dataset-items/" + quote(identity, safe="")
        )

    def _native_process(
        self,
        returned_status="needs_review",
        exit_code=2,
        bad_oracle=False,
        timeout=False,
    ):
        native_calls = []

        def process(argv, **kwargs):
            if argv[:3] == ["git", "rev-parse", "HEAD"]:
                return subprocess.CompletedProcess(argv, 0, stdout="a" * 40 + "\n")
            if argv[:3] == ["git", "status", "--porcelain"]:
                return subprocess.CompletedProcess(argv, 0, stdout="")
            native_calls.append((argv, kwargs))
            if timeout:
                raise subprocess.TimeoutExpired(
                    argv, kwargs["timeout"], stderr=b"private-provider-error"
                )
            report = Path(argv[argv.index("--out") + 1])
            self._json(
                report,
                {
                    "results": [
                        {
                            "caseId": self.item["id"],
                            "featureId": self.feature["featureId"],
                            "status": returned_status,
                            "input": copy.deepcopy(self.item["input"]),
                            "expectedOutput": (
                                {"requiredFacts": ["Changed oracle"]}
                                if bad_oracle
                                else copy.deepcopy(self.item["expectedOutput"])
                            ),
                            "output": "Actual synthetic native output",
                            "checks": {"responded": True},
                            "metadata": {
                                "inputProvenance": "declared_published_fixture"
                            },
                        }
                    ]
                },
            )
            return subprocess.CompletedProcess(
                argv, exit_code, stderr=b"private-stderr-not-for-report"
            )

        return process, native_calls

    def test_native_exit_two_retains_actual_output_and_pending_review(self):
        config, _, _, _ = self._resolved()
        directory = self.root / "native-run"
        directory.mkdir()
        process, native_calls = self._native_process()
        with patch("experiment.subprocess.run", side_effect=process):
            row = experiment.run_native(
                config, self.feature, self.item, directory, self.env
            )
        self.assertEqual(row["status"], "needs_review")
        self.assertEqual(row["output"], "Actual synthetic native output")
        self.assertEqual(row["input"], self.item["input"])
        self.assertEqual(row["expectedOutput"], self.item["expectedOutput"])
        self.assertEqual(row["metadata"]["runnerExitCode"], 2)
        self.assertEqual(row["metadata"]["repositoryCommit"], "a" * 40)
        self.assertEqual(len(native_calls), 1)
        self.assertEqual(native_calls[0][1]["cwd"], config["cwd"])
        self.assertNotIn("private-stderr", json.dumps(row))

    def test_timeout_becomes_failed_evidence_without_an_automatic_retry(self):
        config, _, _, _ = self._resolved()
        directory = self.root / "timed-out-run"
        directory.mkdir()
        process, native_calls = self._native_process(timeout=True)
        with patch("experiment.subprocess.run", side_effect=process):
            row = experiment.run_native(
                config, self.feature, self.item, directory, self.env
            )
        self.assertEqual(row["status"], "failed")
        self.assertIsNone(row["output"])
        self.assertEqual(row["expectedOutput"], self.item["expectedOutput"])
        self.assertEqual(row["metadata"]["runnerFailure"], "TimeoutExpired")
        self.assertEqual(row["metadata"]["runnerExitCode"], 1)
        self.assertEqual(len(native_calls), 1)
        self.assertNotIn("private-provider-error", json.dumps(row))

    def test_native_report_with_rewritten_oracle_is_rejected_and_retained_as_failure(
        self,
    ):
        config, _, _, _ = self._resolved()
        directory = self.root / "wrong-oracle-run"
        directory.mkdir()
        process, native_calls = self._native_process(bad_oracle=True)
        with patch("experiment.subprocess.run", side_effect=process):
            row = experiment.run_native(
                config, self.feature, self.item, directory, self.env
            )
        self.assertEqual(row["status"], "failed")
        self.assertEqual(row["expectedOutput"], self.item["expectedOutput"])
        self.assertIsNone(row["output"])
        self.assertEqual(row["metadata"]["runnerFailure"], "ValueError")
        self.assertEqual(len(native_calls), 1)

    def test_missing_experiment_or_observation_cannot_become_verified_from_scores(self):
        receipt = {
            "rows": [
                {
                    "caseId": "synthetic-case-a",
                    "experimentId": "experiment-1",
                    "traceId": "trace-1",
                    "observationId": "observation-1",
                    "traceUrl": "https://langfuse.invalid/trace-1",
                    "featureId": "synthetic-teacher",
                    "status": "needs_review",
                }
            ]
        }
        for missing in ("experiment", "observation"):
            with self.subTest(missing=missing):

                def request(method, path):
                    self.assertEqual(method, "GET")
                    if "/experiments?" in path:
                        return {
                            "data": (
                                []
                                if missing == "experiment"
                                else [{"id": "experiment-1"}]
                            )
                        }
                    if "/observations?" in path:
                        return {
                            "data": (
                                []
                                if missing == "observation"
                                else [{"id": "observation-1"}]
                            )
                        }
                    return {
                        "data": [
                            {
                                "name": "regression/mentingo/experiment-synthetic-teacher/v1",
                                "value": "pass",
                            }
                        ]
                    }

                client = Mock()
                client.request.side_effect = request
                with patch("experiment.time.sleep") as sleep:
                    rows = experiment.verify_recording(
                        client,
                        receipt,
                        "2026-11-06T00:00:00Z",
                        attempts=2,
                        profile="mentingo",
                    )
                self.assertFalse(rows[0]["verified"])
                self.assertEqual(rows[0]["judgeStatus"], "pass")
                sleep.assert_called_once_with(2)

    def test_exact_experiment_and_observation_ids_are_required_for_verification(self):
        receipt = {
            "rows": [
                {
                    "caseId": "synthetic-case-a",
                    "experimentId": "experiment-1",
                    "traceId": "trace-1",
                    "observationId": "observation-1",
                    "traceUrl": "https://langfuse.invalid/trace-1",
                    "featureId": "synthetic-teacher",
                    "status": "failed",
                }
            ]
        }
        client = Mock()
        client.request.side_effect = [
            {"data": [{"id": "experiment-1"}]},
            {"data": [{"id": "a-different-observation"}]},
            {"data": []},
        ]
        rows = experiment.verify_recording(
            client, receipt, "2026-11-06T00:00:00Z", attempts=1
        )
        self.assertFalse(rows[0]["verified"])
        self.assertEqual(rows[0]["executionStatus"], "failed")

    def test_evidence_score_or_another_features_judge_does_not_count_as_quality_acceptance(
        self,
    ):
        receipt = {
            "rows": [
                {
                    "caseId": self.item["id"],
                    "featureId": self.feature["featureId"],
                    "experimentId": "experiment-1",
                    "traceId": "trace-1",
                    "observationId": "observation-1",
                    "traceUrl": "https://langfuse.invalid/trace-1",
                    "status": "needs_review",
                }
            ]
        }
        client = Mock()
        client.request.side_effect = [
            {"data": [{"id": "experiment-1"}]},
            {"data": [{"id": "observation-1"}]},
            {
                "data": [
                    {"name": "regression/mentingo/output-evidence/v1", "value": 1},
                    {
                        "name": "regression/mentingo/experiment-another-feature/v1",
                        "value": "pass",
                    },
                ]
            },
        ]
        rows = experiment.verify_recording(
            client, receipt, "2026-11-06T00:00:00Z", attempts=1, profile="mentingo"
        )
        self.assertTrue(rows[0]["verified"])
        self.assertEqual(rows[0]["judgeStatus"], "pending_or_not_configured")
        self.assertEqual(len(rows[0]["scores"]), 2)


if __name__ == "__main__":
    unittest.main()
