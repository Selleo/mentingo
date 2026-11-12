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
from urllib.parse import parse_qs, quote, urlsplit

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

    def test_other_project_is_rejected_before_reading_files_or_network(self):
        config = json.loads(self.config_path.read_text())
        config["project"] = "unrelated-project"
        self._json(self.config_path, config)
        with patch("experiment.ProjectClient") as client:
            with self.assertRaisesRegex(ValueError, "project must be "):
                self._resolved()
        client.assert_not_called()

    def test_native_command_uses_only_this_repository_runner(self):
        config, _, _, selected = self._resolved()
        feature, item = selected[0]
        command = experiment.native_command(config, feature, item, Path("report.json"), Path("model.json"))
        self.assertIn("test/evaluations/run-feature.ts", command)
        self.assertEqual(command[0], "pnpm")

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

    def test_strict_gate_requires_actual_verified_judge_pass_for_every_case(self):
        good = {
            "verified": True,
            "executionStatus": "needs_review",
            "judgeStatus": "pass",
            "judgeRootVerified": True,
        }
        self.assertEqual(experiment.result_exit_code({"cases": [good]}, True), 0)
        for update in [
            {"verified": False},
            {"executionStatus": "not_run"},
            {"executionStatus": "failed"},
            {"judgeStatus": "fail"},
            {"judgeStatus": "insufficient_evidence"},
            {"judgeStatus": "pending_or_not_configured"},
            {"judgeRootVerified": False},
        ]:
            with self.subTest(update=update):
                self.assertEqual(
                    experiment.result_exit_code({"cases": [good, {**good, **update}]}, True), 1
                )
        with self.assertRaisesRegex(ValueError, "executed case outcomes"):
            experiment.result_exit_code({"cases": []}, True)
        self.assertEqual(
            experiment.result_exit_code({"cases": [{**good, "judgeStatus": "fail"}]}), 0
        )

    def test_media_roots_require_explicit_existing_directories(self):
        config = json.loads(self.config_path.read_text())
        config["mediaRoots"] = "assets"
        self._json(self.config_path, config)
        with self.assertRaisesRegex(ValueError, "explicit list"):
            self._resolved()
        config["mediaRoots"] = ["missing-assets"]
        self._json(self.config_path, config)
        with self.assertRaisesRegex(ValueError, "must exist"):
            self._resolved()
        assets = self.root / "assets"
        assets.mkdir()
        config["mediaRoots"] = ["assets"]
        self._json(self.config_path, config)
        loaded, _, _, _ = self._resolved()
        self.assertEqual(loaded["mediaRoots"], [str(assets.resolve())])

    def test_native_tracing_stays_disabled_but_explicit_exporter_is_enabled(self):
        client = Mock()
        client.request.return_value = self._published()
        observed_native_env = []
        observed_export_env = []
        config = json.loads(self.config_path.read_text())
        assets = self.root / "assets"
        assets.mkdir()
        config["mediaRoots"] = [str(assets)]
        self._json(self.config_path, config)

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
            self.assertEqual(argv[argv.index("--media-root") + 1], str(assets.resolve()))
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
                                else [{"id": "observation-1", "traceId": "trace-1"}]
                            )
                        }
                    return {
                        "data": [
                            {
                                "name": "regression/mentingo/experiment-synthetic-teacher/v1",
                                "value": "pass",
                                "subject": {
                                    "kind": "observation",
                                    "id": "observation-1",
                                    "traceId": "trace-1",
                                },
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

    def test_score_readback_requests_and_preserves_judge_reason_and_target(self):
        receipt = {
            "rows": [
                {
                    "caseId": "synthetic-case-a",
                    "featureId": "synthetic-teacher",
                    "experimentId": "experiment-1",
                    "traceId": "trace-1",
                    "observationId": "observation-1",
                    "traceUrl": "https://langfuse.invalid/trace-1",
                    "status": "needs_review",
                }
            ]
        }
        subject = {"kind": "observation", "id": "observation-1", "traceId": "trace-1"}
        client = Mock()
        client.request.side_effect = [
            {"data": [{"id": "experiment-1"}]},
            {"data": [{"id": "observation-1", "traceId": "trace-1"}]},
            {
                "data": [
                    {
                        "name": "regression/mentingo/experiment-synthetic-teacher/v1",
                        "value": "fail",
                        "comment": "The reply invents a fee absent from the policy.",
                        "subject": subject,
                    }
                ]
            },
        ]
        result = experiment.verify_recording(
            client, receipt, "2026-11-06T00:00:00Z", attempts=1, profile="mentingo"
        )[0]
        self.assertEqual(result["judgeStatus"], "fail")
        self.assertEqual(
            result["scores"][0]["comment"],
            "The reply invents a fee absent from the policy.",
        )
        self.assertEqual(result["scores"][0]["subject"], subject)
        self.assertIn("fields=details%2Csubject", client.request.call_args.args[1])

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
            {"data": [{"id": "a-different-observation", "traceId": "trace-1"}]},
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
            {"data": [{"id": "observation-1", "traceId": "trace-1"}]},
            {
                "data": [
                    {
                        "name": "regression/mentingo/output-evidence/v1",
                        "value": 1,
                        "subject": {
                            "kind": "observation",
                            "id": "observation-1",
                            "traceId": "trace-1",
                        },
                    },
                    {
                        "name": "regression/mentingo/experiment-another-feature/v1",
                        "value": "pass",
                        "subject": {
                            "kind": "observation",
                            "id": "observation-1",
                            "traceId": "trace-1",
                        },
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

    def test_readback_only_bypasses_models_native_dependencies_and_upload(self):
        config = json.loads(self.config_path.read_text())
        config.update(repo="/missing/application", python="/missing/native/python")
        self._json(self.config_path, config)
        receipt_path = self.root / "receipt.json"
        receipt = BatchVerificationTests.receipt(1)
        receipt["project"] = {"id": experiment.PROJECTS["mentingo"][0]}
        receipt["runName"] = "synthetic-20261106T120000Z-recording"
        self._json(receipt_path, receipt)
        env = {
            key: value
            for key, value in self.env.items()
            if key != "SYNTHETIC_MODEL_KEY"
        }
        client = Mock()
        client.verify_project.return_value = receipt["project"]
        with (
            patch.dict(os.environ, env, clear=True),
            patch("experiment.ProjectClient", return_value=client),
            patch("experiment.verify_recording", return_value=[]) as verify,
            patch("experiment.load_config") as load,
            patch("experiment.local_preflight") as preflight,
            patch("experiment.run_native") as native,
            patch("experiment.subprocess.run") as process,
            patch("urllib.request.urlopen") as network,
        ):
            result = experiment.verify_receipt(self.config_path, receipt_path)
        self.assertEqual(result["mode"], "verified_existing_receipt")
        self.assertTrue(result["noModelOrAppRequests"])
        self.assertTrue(result["noRecordingRequests"])
        self.assertEqual(
            Path(result["verificationReport"]).stat().st_mode & 0o777, 0o600
        )
        self.assertEqual(verify.call_args.args[2], "2026-11-06T11:00:00+00:00")
        for untouched in (load, preflight, native, process, network):
            untouched.assert_not_called()
        client.verify_project.assert_called_once()

    def test_readback_rejects_receipt_project_mismatch_before_network(self):
        path = self.root / "receipt.json"
        receipt = BatchVerificationTests.receipt(1)
        receipt["project"] = {"id": "different-project"}
        self._json(path, receipt)
        with patch("experiment.ProjectClient") as client:
            with self.assertRaisesRegex(ValueError, "project do not match"):
                experiment.verify_receipt(self.config_path, path)
        client.assert_not_called()

    def test_readback_rejects_different_credential_project(self):
        path = self.root / "receipt.json"
        receipt = BatchVerificationTests.receipt(1)
        receipt["project"] = {"id": experiment.PROJECTS["mentingo"][0]}
        self._json(path, receipt)
        client = Mock()
        client.verify_project.return_value = {"id": "other-project"}
        with (
            patch.dict(os.environ, self.env, clear=True),
            patch("experiment.ProjectClient", return_value=client),
        ):
            with self.assertRaisesRegex(ValueError, "credential project"):
                experiment.verify_receipt(self.config_path, path)
        client.request.assert_not_called()


class BatchVerificationTests(unittest.TestCase):
    @staticmethod
    def receipt(count):
        return {
            "rows": [
                {
                    "caseId": f"case-{i}",
                    "experimentId": f"experiment-{i % 3}",
                    "traceId": f"trace-{i}",
                    "observationId": f"observation-{i}",
                    "featureId": "teacher",
                    "traceUrl": f"https://langfuse.invalid/trace-{i}",
                    "status": "generated",
                }
                for i in range(count)
            ]
        }

    @staticmethod
    def score(row, name=None):
        return {
            "id": "score-" + row["caseId"] + (name or "quality"),
            "name": name or "regression/mentingo/experiment-teacher/v1",
            "value": "pass",
            "comment": "Exact-root evidence.",
            "subject": {
                "kind": "observation",
                "id": row["observationId"],
                "traceId": row["traceId"],
            },
        }

    def test_67_cases_and_134_scores_need_four_requests_including_pagination(self):
        receipt = self.receipt(67)
        scores = [
            self.score(row, "regression_output_evidence") for row in receipt["rows"]
        ]
        scores += [self.score(row) for row in receipt["rows"]]

        def request(method, url):
            self.assertEqual(method, "GET")
            parsed, query = urlsplit(url), parse_qs(urlsplit(url).query)
            if parsed.path.endswith("/experiments"):
                self.assertEqual(query["limit"], ["100"])
                self.assertIn("fromStartTime", query)
                self.assertIn("toStartTime", query)
                return {"data": [{"id": f"experiment-{i}"} for i in range(3)]}
            if parsed.path.endswith("/observations"):
                self.assertEqual(query["fields"], ["core"])
                filters = json.loads(query["filter"][0])
                self.assertEqual(
                    {item["column"] for item in filters},
                    {"traceId", "environment", "startTime"},
                )
                return {
                    "data": [
                        {"id": r["observationId"], "traceId": r["traceId"]}
                        for r in receipt["rows"]
                    ]
                }
            self.assertEqual(len(query["traceId"][0].split(",")), 67)
            self.assertEqual(query["fields"], ["details,subject"])
            self.assertEqual(query["limit"], ["100"])
            if "cursor" not in query:
                return {"data": scores[:100], "meta": {"cursor": "page-two"}}
            self.assertEqual(query["cursor"], ["page-two"])
            return {"data": scores[100:], "meta": {}}

        client = Mock()
        client.request.side_effect = request
        result = experiment.verify_recording(
            client, receipt, "2026-11-06T00:00:00Z", profile="mentingo"
        )
        self.assertEqual(client.request.call_count, 4)
        self.assertTrue(
            all(row["verified"] and row["judgeRootVerified"] for row in result)
        )
        self.assertTrue(
            all(
                row["judgeStatus"] == "pass" and len(row["scores"]) == 2
                for row in result
            )
        )

    def test_unrelated_observation_trace_or_judge_subject_cannot_pass(self):
        receipt = self.receipt(1)
        root = receipt["rows"][0]
        for defect in (
            "observation-trace",
            "score-trace",
            "score-id",
            "score-kind",
            "score-name",
        ):
            with self.subTest(defect=defect):
                observation = {"id": root["observationId"], "traceId": root["traceId"]}
                score = self.score(root)
                if defect == "observation-trace":
                    observation["traceId"] = "other-trace"
                if defect == "score-trace":
                    score["subject"]["traceId"] = "other-trace"
                if defect == "score-id":
                    score["subject"]["id"] = "other-root"
                if defect == "score-kind":
                    score["subject"]["kind"] = "trace"
                if defect == "score-name":
                    score["name"] = "another-feature"
                client = Mock()
                client.request.side_effect = [
                    {"data": [{"id": root["experimentId"]}]},
                    {"data": [observation]},
                    {"data": [score]},
                ]
                result = experiment.verify_recording(
                    client,
                    receipt,
                    "2026-11-06T00:00:00Z",
                    attempts=1,
                    profile="mentingo",
                )[0]
                if defect == "observation-trace":
                    self.assertFalse(result["verified"])
                else:
                    self.assertEqual(result["judgeStatus"], "pending_or_not_configured")

    def test_pending_poll_does_not_repeat_completed_experiments_roots_or_scores(self):
        receipt = self.receipt(2)
        rounds = {"observations": 0, "scores": 0}

        def request(method, url):
            path, query = urlsplit(url).path, parse_qs(urlsplit(url).query)
            if path.endswith("/experiments"):
                return {"data": [{"id": "experiment-0"}, {"id": "experiment-1"}]}
            key = "observations" if path.endswith("/observations") else "scores"
            rounds[key] += 1
            if rounds[key] == 2:
                if key == "scores":
                    self.assertEqual(query["traceId"], ["trace-1"])
                else:
                    filters = json.loads(query["filter"][0])
                    self.assertEqual(filters[0]["value"], ["trace-1"])
            index = rounds[key] - 1
            row = receipt["rows"][index]
            return {
                "data": (
                    [{"id": row["observationId"], "traceId": row["traceId"]}]
                    if key == "observations"
                    else [self.score(row)]
                )
            }

        client = Mock()
        client.request.side_effect = request
        with patch("experiment.time.sleep") as sleep:
            result = experiment.verify_recording(
                client, receipt, "2026-11-06T00:00:00Z", profile="mentingo"
            )
        self.assertTrue(
            all(row["verified"] and row["judgeRootVerified"] for row in result)
        )
        self.assertEqual(client.request.call_count, 5)
        sleep.assert_called_once_with(2)

    def test_experiment_and_observation_pages_are_followed(self):
        receipt = self.receipt(2)
        client = Mock()

        def request(method, url):
            path, query = urlsplit(url).path, parse_qs(urlsplit(url).query)
            if path.endswith("/scores"):
                return {"data": [self.score(row) for row in receipt["rows"]]}
            index = 1 if "cursor" in query else 0
            row = receipt["rows"][index]
            value = (
                {"id": row["experimentId"]}
                if path.endswith("/experiments")
                else {"id": row["observationId"], "traceId": row["traceId"]}
            )
            return {"data": [value], "meta": {} if index else {"cursor": "next"}}

        client.request.side_effect = request
        result = experiment.verify_recording(
            client, receipt, "2026-11-06T00:00:00Z", profile="mentingo"
        )
        self.assertTrue(all(row["verified"] for row in result))
        self.assertEqual(client.request.call_count, 5)

    def test_repeated_pagination_cursor_is_rejected(self):
        client = Mock()
        client.request.return_value = {"data": [], "meta": {"cursor": "again"}}
        with self.assertRaisesRegex(ValueError, "pagination cursor"):
            experiment.read_pages(client, "/read", {})
        self.assertEqual(client.request.call_count, 2)


if __name__ == "__main__":
    unittest.main()
