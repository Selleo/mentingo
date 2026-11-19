"""Trust boundaries and event policy for automatic PR video recording."""

import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[4]


class Workflow(unittest.TestCase):
    def setUp(self):
        self.workflow = yaml.safe_load(
            (ROOT / ".github/workflows/pr-flow-video.yml").read_text()
        )

    def test_readiness_dispatch_is_metadata_only_and_forks_are_excluded(self):
        events = self.workflow.get("on", self.workflow.get(True))
        self.assertEqual(
            events["pull_request"]["types"], ["opened", "ready_for_review"]
        )
        self.assertIn("workflow_dispatch", events)
        self.assertNotIn("pull_request_target", events)
        self.assertNotIn("synchronize", events["pull_request"]["types"])
        dispatch = self.workflow["jobs"]["dispatch"]
        self.assertEqual(dispatch["if"], "github.event_name == 'pull_request'")
        self.assertEqual(
            dispatch["permissions"], {"actions": "write", "pull-requests": "read"}
        )
        self.assertFalse(
            any("checkout" in step.get("uses", "") for step in dispatch["steps"])
        )
        self.assertNotIn("secrets.", str(dispatch))
        command = dispatch["steps"][0]["run"]
        self.assertIn(".draft == false", command)
        self.assertIn(".head.repo.full_name == env.REPOSITORY", command)
        self.assertIn(".head.sha == env.HEAD_SHA", command)
        self.assertIn("/collaborators/$login/permission", command)
        self.assertIn("admin|maintain|write)", command)
        self.assertLess(command.index("eligible="), command.index("gh workflow run"))
        self.assertIn("gh workflow run release-film.yml", command)
        self.assertIn('-f "expected_head=$HEAD_SHA"', command)
        self.assertIn('-f "requested_by=$REQUESTED_BY"', command)
        self.assertIn("-f publish=false", command)
        self.assertNotIn("gh workflow run pr-flow-video.yml", command)

    def test_recorder_runs_trusted_control_code_and_has_no_write_token(self):
        job = self.workflow["jobs"]["film"]
        self.assertIn("github.event_name == 'workflow_dispatch'", job["if"])
        self.assertNotIn("write", str(job["permissions"]))
        checkout = next(
            step for step in job["steps"] if "checkout" in step.get("uses", "")
        )
        self.assertEqual(checkout["with"]["ref"], "${{ github.sha }}")
        self.assertIs(checkout["with"]["persist-credentials"], False)
        installer = next(
            step for step in job["steps"] if "recorder tools" in step.get("name", "")
        )
        self.assertIn("steps.plan.outputs.record == 'true'", installer["if"])
        artifact = next(
            step
            for step in job["steps"]
            if step.get("name") == "Preserve only the verified PR video bundle"
        )
        self.assertEqual(artifact["with"]["path"].count("\n"), 2)
        self.assertNotIn("checkout", artifact["with"]["path"])
        self.assertNotIn("pr-input.json", artifact["with"]["path"])

    def test_failed_recordings_preserve_only_the_redacted_report(self):
        steps = self.workflow["jobs"]["film"]["steps"]
        report = next(
            step
            for step in steps
            if step.get("name") == "Preserve the redacted recording report"
        )
        self.assertIn("always()", report["if"])
        self.assertEqual(
            report["with"]["path"],
            "${{ runner.temp }}/pr-video/pr-video-recording-report.json",
        )
        self.assertNotIn("checkout", report["with"]["path"])
        self.assertNotIn("worker.log", report["with"]["path"])
        self.assertNotIn("keeper.env", report["with"]["path"])

    def test_only_separate_publisher_can_modify_the_pr(self):
        job = self.workflow["jobs"]["attach"]
        self.assertEqual(job["needs"], "film")
        self.assertEqual(job["permissions"]["pull-requests"], "write")
        self.assertEqual(job["environment"], "release-film")
        self.assertNotIn("PR_VIDEO_UPLOAD_TOKEN", str(self.workflow["jobs"]["film"]))
        self.assertEqual(
            [step["env"]["PR_VIDEO_UPLOAD_TOKEN"] for step in job["steps"]
             if "PR_VIDEO_UPLOAD_TOKEN" in step.get("env", {})],
            ["${{ secrets.PR_VIDEO_UPLOAD_TOKEN }}"],
        )
        self.assertNotIn("env", job)
        self.assertNotIn("CLAUDE_CODE", str(job))
        self.assertNotIn("ELEVENLABS", str(job))
        self.assertIn("needs.film.outputs.record == 'true'", job["if"])
        self.assertFalse(self.workflow["concurrency"]["cancel-in-progress"])

    def test_registered_release_entry_point_reuses_the_same_pr_pipeline(self):
        release = yaml.safe_load(
            (ROOT / ".github/workflows/release-film.yml").read_text()
        )
        events = release.get("on", release.get(True))
        self.assertEqual(
            events["workflow_dispatch"]["inputs"]["pr_number"]["default"], 0
        )
        caller = release["jobs"]["pr_video"]
        self.assertEqual(caller["uses"], "./.github/workflows/pr-flow-video.yml")
        self.assertIn("inputs.pr_number > 0", caller["if"])
        self.assertNotIn("runs-on", caller)
        self.assertIn("refs/heads/staging", self.workflow["jobs"]["film"]["if"])
        self.assertIn("refs/heads/main", self.workflow["jobs"]["film"]["if"])
        self.assertEqual(
            caller["with"],
            {
                "pr_number": "${{ format('{0}', inputs.pr_number) }}",
                "branch_test": "${{ inputs.pr_video_branch_test == true }}",
            },
        )
        expected_secrets = {
            "CLAUDE_CODE_OAUTH_TOKEN": "${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
            "ELEVENLABS_API_KEY": "${{ secrets.ELEVENLABS_API_KEY }}",
        }
        self.assertEqual(caller["secrets"], expected_secrets)
        self.assertEqual(
            events["workflow_dispatch"]["inputs"]["pr_video_branch_test"]["default"],
            False,
        )
        for field in ("expected_head", "requested_by"):
            self.assertEqual(
                events["workflow_dispatch"]["inputs"][field]["type"], "string"
            )
        self.assertIn("!inputs.pr_number", release["jobs"]["film"]["if"])
        self.assertIn("!inputs.pr_number", release["jobs"]["publish"]["if"])
        called_events = self.workflow.get("on", self.workflow.get(True))
        self.assertEqual(
            called_events["workflow_call"]["inputs"]["pr_number"]["type"], "string"
        )
        declared_secrets = called_events["workflow_call"]["secrets"]
        self.assertEqual(set(declared_secrets), set(expected_secrets) | {"PR_VIDEO_UPLOAD_TOKEN"})
        self.assertTrue(all(declared_secrets[name]["required"] for name in expected_secrets))
        self.assertFalse(declared_secrets["PR_VIDEO_UPLOAD_TOKEN"]["required"])
        self.assertIs(
            called_events["workflow_call"]["inputs"]["branch_test"]["default"], False
        )
        self.assertIn("inputs.branch_test == true", self.workflow["jobs"]["film"]["if"])
        self.assertEqual(self.workflow["jobs"]["film"]["environment"], "release-film")
        self.assertIn("!inputs.pr_video_branch_test", release["jobs"]["film"]["if"])
        self.assertIn("!inputs.pr_video_branch_test", release["jobs"]["publish"]["if"])

    def test_missing_credentials_fail_before_any_model_or_voice_call(self):
        import os
        import subprocess
        import sys

        steps = self.workflow["jobs"]["film"]["steps"]
        guard = next(
            step
            for step in steps
            if step.get("name") == "Validate the existing recording credentials"
        )
        script = guard["run"].split("<<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
        self.assertIn("steps.inspect.outputs.eligible == 'true'", guard["if"])
        self.assertLess(
            steps.index(guard),
            next(index for index, step in enumerate(steps) if step.get("id") == "plan"),
        )
        environment = dict(
            os.environ,
            CLAUDE_CODE_OAUTH_TOKEN="test-claude",
            ELEVENLABS_API_KEY="test-eleven",
        )
        for missing in ("CLAUDE_CODE_OAUTH_TOKEN", "ELEVENLABS_API_KEY"):
            with self.subTest(missing=missing):
                result = subprocess.run(
                    [sys.executable, "-c", script],
                    env=dict(environment, **{missing: ""}),
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(missing, result.stderr)
                self.assertNotIn("test-claude", result.stderr)
                self.assertNotIn("test-eleven", result.stderr)
        result = subprocess.run(
            [sys.executable, "-c", script],
            env=environment,
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(
            result.stdout.strip(), "Both existing recording credentials are configured."
        )
