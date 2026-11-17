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
            events["pull_request_target"]["types"], ["opened", "ready_for_review"]
        )
        self.assertIn("workflow_dispatch", events)
        self.assertNotIn("synchronize", events["pull_request_target"]["types"])
        dispatch = self.workflow["jobs"]["dispatch"]
        self.assertIn("!github.event.pull_request.draft", dispatch["if"])
        self.assertIn("head.repo.full_name == github.repository", dispatch["if"])
        self.assertEqual(dispatch["permissions"], {"actions": "write"})
        self.assertFalse(
            any("checkout" in step.get("uses", "") for step in dispatch["steps"])
        )
        self.assertNotIn("secrets.", str(dispatch))

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
