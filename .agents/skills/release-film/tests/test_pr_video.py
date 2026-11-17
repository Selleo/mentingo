"""No network or providers: immutable PR inputs and the trusted recorder seam."""

import json
import os
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
import pr_video_report

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

    def test_changed_path_inventory_covers_all_commits_without_loading_code(self):
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
            self.assertTrue(all(set(item) == {"path"} for item in inputs["files"]))
            self.assertNotIn("new status", json.dumps(inputs))
            self.assertNotIn("old status", json.dumps(inputs))

    def test_business_specs_come_from_pinned_head_and_deleted_specs_are_omitted(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            registry = (
                repo
                / ".agents/skills/release-film/projects/mentingo-self-onboarding.json"
            )
            registry.parent.mkdir(parents=True)
            existing = "docs/specs/course-authoring-business-spec.md"
            removed = "docs/specs/removed-business-spec.md"
            core.save(
                registry,
                {
                    "domains": [
                        {
                            "watchPaths": ["apps/web/**"],
                            "specPaths": [existing, removed],
                        }
                    ]
                },
            )

            def git(repository, *arguments):
                if arguments[0] == "fetch":
                    return ""
                if arguments[0] == "merge-base":
                    return BASE
                if arguments[0] == "diff":
                    self.assertIn("--name-only", arguments)
                    return "apps/web/screen.tsx\0"
                if arguments[0] == "ls-tree":
                    self.assertIn(HEAD, arguments)
                    return existing + "\0"
                self.assertEqual(arguments, ("show", HEAD + ":" + existing))
                return "# Updated PR feature\nUse the newly supported screen."

            with (
                patch.object(pr_video, "current", return_value=pull()),
                patch.object(pr_video, "git", side_effect=git),
            ):
                pr_video.inspect(REPO, 10, "writer", repo, repo / "run", HEAD)
            source = core.load(repo / "run/pr-input.json")["inputs"]
            self.assertEqual(
                source["business_specs"],
                [
                    {
                        "path": existing,
                        "content": "# Updated PR feature\nUse the newly supported screen.",
                    }
                ],
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


class DispatchIdentity(unittest.TestCase):
    def test_existing_entry_point_preserves_head_and_original_actor(self):
        self.check_actor("github-actions[bot]", "reviewer")

    def test_manual_actor_cannot_be_replaced_by_dispatch_input(self):
        self.check_actor("maintainer", "maintainer")

    def check_actor(self, actual_actor, expected_actor):
        with tempfile.TemporaryDirectory() as temp:
            event = Path(temp) / "event.json"
            event.write_text(
                json.dumps(
                    {
                        "inputs": {
                            "pr_number": "10",
                            "expected_head": HEAD,
                            "requested_by": "reviewer",
                            "publish": "false",
                        }
                    }
                )
            )
            arguments = [
                "pr_video.py",
                "inspect",
                "--run",
                temp,
                "--repository",
                REPO,
                "--event-file",
                str(event),
                "--actor",
                actual_actor,
            ]
            with (
                patch.object(sys, "argv", arguments),
                patch.object(
                    pr_video,
                    "inspect",
                    return_value={"eligible": True, "head": HEAD, "base": BASE},
                ) as inspect,
                patch.object(pr_video, "outputs"),
                patch("builtins.print"),
            ):
                pr_video.main()
            inspect.assert_called_once_with(REPO, 10, expected_actor, ".", temp, HEAD)


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


class CompleteFilm(unittest.TestCase):
    def record_with_finish(self, finished, chapter_ids):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        run = Path(folder.name)
        core.save(
            run / "pr-video-plan.json",
            {"flows": [{"id": f"flow-{index}"} for index in range(1, 5)]},
        )
        core.save(
            run / "story.json",
            {
                "chapters": [
                    {"source": {"file": f"gaps/pr-flow-{index}/story.txt"}}
                    for index in chapter_ids
                ]
            },
        )
        patches = [
            patch.object(pr_video, "prepare", return_value={"addon": {"harness": {}}}),
            patch.object(pr_video.harness, "setup"),
            patch.object(pr_video.film, "capture"),
            patch.object(
                pr_video.film, "gap_scenes", return_value={"ok": True, "workers": True}
            ),
            patch.object(pr_video.film, "write"),
            patch.object(pr_video.film, "finish", return_value=finished),
            patch.object(pr_video.film, "stop"),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        return run

    def test_four_flow_chapters_produce_one_staged_video(self):
        finished = {
            "ok": True,
            "scenes": [
                {"id": f"pr-flow-{index}", "filmed": True, "narrated": True}
                for index in range(1, 5)
            ],
        }
        run = self.record_with_finish(finished, [1, 2, 3, 4])
        with patch.object(
            pr_video, "stage", return_value={"video": "single.mp4"}
        ) as stage:
            result = pr_video.record(run, run, run / "bundle")
        self.assertEqual(result, {"video": "single.mp4"})
        stage.assert_called_once_with(run, run / "bundle")

    def test_review_cannot_drop_or_duplicate_a_selected_flow(self):
        finished = {
            "ok": True,
            "scenes": [
                {"id": f"pr-flow-{index}", "filmed": True, "narrated": True}
                for index in range(1, 5)
            ],
        }
        for chapter_ids in ([1, 2, 3], [1, 2, 3, 3]):
            with self.subTest(chapters=chapter_ids):
                run = self.record_with_finish(finished, chapter_ids)
                with (
                    patch.object(pr_video, "stage") as stage,
                    self.assertRaisesRegex(
                        RuntimeError, "every selected flow exactly once"
                    ),
                ):
                    pr_video.record(run, run, run / "bundle")
                stage.assert_not_called()

    def test_review_rejection_retains_real_problems_without_secrets(self):
        secret = "test-secret-longer-than-eight"
        finished = {
            "ok": False,
            "problems": ["chapter 2 has no screen proof " + secret],
            "scenes": [],
        }
        run = self.record_with_finish(finished, [])
        logs = run / "gaps/pr-flow-2"
        logs.mkdir(parents=True)
        (logs / "worker.log").write_text("Scene failed with credential " + secret)
        with (
            patch.dict(os.environ, {"CLAUDE_CODE_OAUTH_TOKEN": secret}),
            self.assertRaisesRegex(
                RuntimeError, "chapter 2 has no screen proof"
            ) as error,
        ):
            pr_video.record(run, run, run / "bundle")
        report = (run / pr_video_report.NAME).read_text()
        self.assertNotIn(secret, report)
        self.assertNotIn(secret, str(error.exception))
        self.assertIn("chapter 2 has no screen proof", report)
        self.assertIn("Scene failed with credential ***", report)
        self.assertEqual(json.loads(report)["phase"], "finish")

    def test_report_does_not_read_logs_outside_the_run(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            run = root / "run"
            run.mkdir()
            outside = root / "private.log"
            outside.write_text("private material")
            (run / "keeper.log").symlink_to(outside)
            report = pr_video_report.checkpoint(run, "capture")
            self.assertEqual(report["logs"], {})
