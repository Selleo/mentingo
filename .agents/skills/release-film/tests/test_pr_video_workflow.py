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
            step for step in job["steps"] if "upload-artifact" in step.get("uses", "")
        )
        self.assertEqual(artifact["with"]["path"].count("\n"), 2)
        self.assertNotIn("checkout", artifact["with"]["path"])
        self.assertNotIn("pr-input.json", artifact["with"]["path"])

    def test_only_separate_publisher_can_modify_the_pr(self):
        job = self.workflow["jobs"]["attach"]
        self.assertEqual(job["needs"], "film")
        self.assertEqual(job["permissions"]["pull-requests"], "write")
        self.assertNotIn("secrets.", str(job))
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
            caller["with"], {"pr_number": "${{ format('{0}', inputs.pr_number) }}"}
        )
        self.assertNotIn("secrets", caller)
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
