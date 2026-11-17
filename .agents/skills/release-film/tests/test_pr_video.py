"""No network or providers: immutable PR inputs and the trusted recorder seam."""

import subprocess
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import core
import film
import gaps
import pr_video

REPO = "Selleo/mentingo"
HEAD = "a" * 40
BASE = "b" * 40


def pull():
    return {
        "number": 10,
        "state": "open",
        "draft": False,
        "title": "Fix visible status",
        "body": "Reviewer context",
        "user": {"login": "writer"},
        "head": {"sha": HEAD, "repo": {"full_name": REPO}},
        "base": {"sha": BASE, "repo": {"full_name": REPO}},
    }


class Inputs(unittest.TestCase):
    def test_only_open_same_repository_writer_pr_and_actor_are_eligible(self):
        pr = pull()
        with patch.object(
            pr_video,
            "api",
            side_effect=[pr, {"permission": "write"}, {"permission": "read"}],
        ):
            self.assertIsNone(pr_video.current(REPO, 10, "reviewer"))
        for change in ("draft", "closed", "fork"):
            other = deepcopy(pr)
            if change == "draft":
                other["draft"] = True
            elif change == "closed":
                other["state"] = "closed"
            else:
                other["head"]["repo"]["full_name"] = "external/fork"
            with patch.object(pr_video, "api", return_value=other) as request:
                self.assertIsNone(pr_video.current(REPO, 10, "writer"))
                self.assertEqual(request.call_count, 1)
        with patch.object(pr_video, "api", side_effect=[pr, {"permission": "write"}]):
            self.assertEqual(pr_video.current(REPO, 10, "writer")["head"]["sha"], HEAD)

    def test_complete_pr_diff_includes_all_commits_not_only_last_one(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp) / "repo"
            repo.mkdir()

            def git(*args):
                return subprocess.check_output(
                    ["git", "-C", str(repo), *args], text=True
                ).strip()

            git("init", "-q")
            git("config", "user.email", "test@example.invalid")
            git("config", "user.name", "Test")
            registry = (
                repo
                / ".agents/skills/release-film/projects/mentingo-self-onboarding.json"
            )
            registry.parent.mkdir(parents=True)
            registry.write_text('{"domains": []}')
            (repo / "screen.tsx").write_text("old status\n")
            git("add", ".")
            git("commit", "-qm", "base")
            base = git("rev-parse", "HEAD")
            (repo / "screen.tsx").write_text("new status\n")
            git("commit", "-qam", "first visible change")
            (repo / "button.tsx").write_text("new button\n")
            git("add", ".")
            git("commit", "-qm", "second visible change")
            head = git("rev-parse", "HEAD")
            pr = pull()
            pr["head"]["sha"] = head
            pr["base"]["sha"] = base
            real_git = pr_video.git
            with (
                patch.object(pr_video, "current", return_value=pr),
                patch.object(
                    pr_video,
                    "git",
                    side_effect=lambda repository, *arguments: (
                        ""
                        if arguments[0] == "fetch"
                        else real_git(repository, *arguments)
                    ),
                ),
            ):
                result = pr_video.inspect(
                    REPO, 10, "writer", repo, Path(temp) / "run", head
                )
            self.assertTrue(result["eligible"])
            inputs = core.load(Path(temp) / "run/pr-input.json")["inputs"]
            self.assertEqual(
                {item["path"] for item in inputs["files"]}, {"screen.tsx", "button.tsx"}
            )
            self.assertTrue(
                any("+new status" in item["diff"] for item in inputs["files"])
            )

    def test_stale_event_stops_before_fetch_or_paid_planning(self):
        with (
            tempfile.TemporaryDirectory() as temp,
            patch.object(pr_video, "current", return_value=pull()),
            patch.object(pr_video, "git") as git,
        ):
            result = pr_video.inspect(REPO, 10, "writer", temp, temp, "c" * 40)
            self.assertFalse(result["eligible"])
            git.assert_not_called()


class Recorder(unittest.TestCase):
    def test_multiple_pr_flows_keep_distinct_scene_ids_and_trusted_recipe(self):
        with tempfile.TemporaryDirectory() as temp:
            run = Path(temp)
            checkout = run / "checkout"
            checkout.mkdir()
            metadata = {
                "repository": REPO,
                "number": 10,
                "headSha": HEAD,
                "baseSha": BASE,
                "actor": "writer",
                "inputs": {
                    "title": "Visible fix",
                    "body": "",
                    "files": [{"path": "screen.tsx", "diff": "+new"}],
                },
            }
            core.save(run / "pr-input.json", metadata)
            core.save(
                run / "pr-video-plan.json",
                {
                    "decision": "record",
                    "flows": [
                        {"id": f"flow-{index}", "title": f"Flow {index}"}
                        for index in (1, 2)
                    ],
                },
            )
            addon = {"language": "en", "harness": {"config": "e2e/config.ts"}}
            with (
                patch.object(pr_video, "current", return_value=pull()),
                patch.object(pr_video.harness, "checkout", return_value=checkout),
                patch.object(pr_video.core, "addon", return_value=addon) as trusted,
                patch("self_onboarding_recording.prepare_demo_checkout"),
                patch.object(pr_video.harness, "test_roots", return_value=["e2e"]),
                patch.object(
                    pr_video.editor,
                    "spec_texts",
                    return_value={"e2e/base.spec.ts": "existing fixture"},
                ),
                patch.object(pr_video.editor, "related", return_value=[]),
            ):
                pr_video.prepare(run, run)
                trusted.assert_called_once_with(REPO)
            selected = gaps.parse((run / "gaps.txt").read_text())
            self.assertEqual(
                [scene["id"] for scene in selected], ["pr-flow-1", "pr-flow-2"]
            )
            self.assertEqual([scene["prs"] for scene in selected], [[10], [10]])
            with patch.object(
                film.core,
                "addon",
                side_effect=AssertionError("must not reload target configuration"),
            ):
                info = film.meta(run)
                self.assertEqual(info["recordingMode"], "pull-request")
                self.assertEqual(
                    info["addon"]["harness"]["env"]["SELF_ONBOARDING_DEMO"], "1"
                )

    def test_recording_cleanup_runs_when_scene_workers_fail(self):
        with (
            tempfile.TemporaryDirectory() as temp,
            patch.object(pr_video, "prepare", return_value={"addon": {"harness": {}}}),
            patch.object(pr_video.harness, "setup"),
            patch.object(pr_video.film, "capture"),
            patch.object(pr_video.film, "gap_scenes", return_value={"ok": False}),
            patch.object(pr_video.film, "stop") as stop,
        ):
            with self.assertRaisesRegex(RuntimeError, "did not start"):
                pr_video.record(temp, temp, Path(temp) / "bundle")
            stop.assert_called_once()
