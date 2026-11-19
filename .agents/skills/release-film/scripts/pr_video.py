"""Immutable, same-repository PR inputs and recording through the existing film pipeline."""

import argparse
import fnmatch
import hashlib
import json
import os
import re
import shutil
from pathlib import Path
from types import SimpleNamespace

import core
import editor
import film
import gaps
import harness
import pr_video_plan
import pr_video_report
import sources

SHA = re.compile(r"[a-f0-9]{40}")
REPOSITORY = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")
TRUSTED = {"admin", "maintain", "write"}


def api(path):
    return json.loads(core.sh(["gh", "api", path], timeout=60).stdout)


def eligible(pr, repository):
    return (
        pr.get("state") == "open"
        and not pr.get("draft")
        and pr.get("head", {}).get("repo", {}).get("full_name") == repository
        and pr.get("base", {}).get("repo", {}).get("full_name") == repository
    )


def current(repository, number, actor):
    if not REPOSITORY.fullmatch(repository) or type(number) is not int or number < 1:
        raise ValueError("Invalid repository or PR number")
    pr = api(f"repos/{repository}/pulls/{number}")
    if not eligible(pr, repository):
        return None
    # Readiness is a paid trigger only for repository writers, not external contributions.
    for login in {actor, pr["user"]["login"]}:
        if not re.fullmatch(r"[A-Za-z0-9-]+(?:\[bot\])?", login or ""):
            raise ValueError("Invalid GitHub identity")
        access = api(f"repos/{repository}/collaborators/{login}/permission")
        if access.get("permission") not in TRUSTED:
            return None
    if not all(SHA.fullmatch(pr[reference]["sha"]) for reference in ("head", "base")):
        raise ValueError("Invalid immutable PR references")
    return pr


def git(repo, *args):
    return core.sh(["git", "-C", str(repo), *args], timeout=120).stdout


def inspect(repository, number, actor, repo, run, expected_head=None):
    run, repo = Path(run), Path(repo)
    run.mkdir(parents=True, exist_ok=True)
    pr = current(repository, number, actor)
    if not pr or expected_head and pr["head"]["sha"] != expected_head:
        return {
            "eligible": False,
            "reason": "PR is draft, closed, external, stale or not authored/triggered by a repository writer.",
        }
    head, base = pr["head"]["sha"], pr["base"]["sha"]
    git(repo, "fetch", "--no-tags", "origin", head, base)
    merge_base = git(repo, "merge-base", base, head).strip()
    names = git(repo, "diff", "--name-only", "-z", merge_base, head).split("\0")
    names = [name for name in names if name]
    for name in names:
        if Path(name).is_absolute() or ".." in Path(name).parts:
            raise ValueError("Unsafe changed path")
    # Names route specs and existing browser fixtures; implementation code never
    # enters the planner. Read specs as inert text from the immutable PR head.
    inventory = {
        path
        for path in git(
            repo, "ls-tree", "-r", "--name-only", "-z", head, "--", "docs/specs/"
        ).split("\0")
        if path.startswith("docs/specs/") and path.endswith("-business-spec.md")
    }
    registry = core.load(
        repo / ".agents/skills/release-film/projects/mentingo-self-onboarding.json"
    )
    specs = set()
    for domain in registry["domains"]:
        if any(
            fnmatch.fnmatchcase(name, pattern)
            for name in names
            for pattern in domain["watchPaths"]
        ):
            specs.update(domain["specPaths"])
    specs.update(name for name in names if name in inventory)
    specs.intersection_update(inventory)
    if not specs:
        specs = inventory  # New/unregistered areas can still route by overview.
    inputs = {
        "title": pr["title"],
        "body": pr.get("body") or "",
        "files": [{"path": name} for name in names],
        "business_specs": [
            {"path": path, "content": git(repo, "show", f"{head}:{path}")}
            for path in sorted(specs)
        ],
    }
    metadata = {
        "repository": repository,
        "number": number,
        "headSha": head,
        "baseSha": merge_base,
        "actor": actor,
        "workflowRunId": os.environ.get("GITHUB_RUN_ID", ""),
        "inputs": inputs,
    }
    core.save(run / "pr-input.json", metadata)
    return {"eligible": True, "number": number, "head": head, "base": merge_base}


def classify(run):
    run = Path(run)
    data = core.load(run / "pr-input.json")
    return pr_video_plan.plan(data["inputs"], run)


def prepare_pr_helpers(checkout, repo):
    """Copy only the trusted PR setup helper into the isolated app version."""
    checkout, repo = Path(checkout).resolve(), Path(repo).resolve()
    name = "apps/web/e2e/utils/pr-video-data.ts"
    source, target = repo / name, checkout / name
    if (
        checkout == repo
        or not source.is_file()
        or source.is_symlink()
        or not source.resolve().is_relative_to(repo)
        or target.is_symlink()
        or not target.resolve().is_relative_to(checkout)
    ):
        raise ValueError("Invalid trusted PR helper path")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def prepare(run, repo):
    run, repo = Path(run), Path(repo)
    metadata, plan = (
        core.load(run / "pr-input.json"),
        core.load(run / "pr-video-plan.json"),
    )
    if plan["decision"] != "record" or not plan["flows"]:
        raise ValueError("No visible flows selected")
    fresh = current(metadata["repository"], metadata["number"], metadata["actor"])
    if not fresh or fresh["head"]["sha"] != metadata["headSha"]:
        raise ValueError("PR changed after analysis; rerun for the current head")
    checkout = harness.checkout(repo, metadata["headSha"], run)
    addon = core.addon(metadata["repository"])  # never trust PR overrides
    addon["language"] = "en"
    recipe = addon["harness"]
    recipe.setdefault("env", {}).update(
        SELF_ONBOARDING_DEMO="1",
        SELF_ONBOARDING_LANGUAGE="en",
        DEMO_FAILURE_SCREENSHOTS="1",
    )
    import self_onboarding_recording

    self_onboarding_recording.prepare_demo_checkout(checkout, repo)
    prepare_pr_helpers(checkout, repo)
    info = {
        "repo": metadata["repository"],
        "tag": f"pr-{metadata['number']}-{metadata['headSha'][:12]}",
        "base": metadata["baseSha"],
        "repo_dir": str(repo),
        "run": str(run),
        "addon": addon,
        "recordingMode": "pull-request",
    }
    core.save(run / "meta.json", info)
    paths = [item["path"] for item in metadata["inputs"]["files"]]
    pr = {
        "number": metadata["number"],
        "title": metadata["inputs"]["title"],
        "body": metadata["inputs"]["body"],
        "url": f"https://github.com/{metadata['repository']}/pull/{metadata['number']}",
        "labels": [],
        "author": fresh["user"]["login"],
        "merged_at": None,
        "issues": [],
        "files": paths,
        "touched": sources.touched(paths),
        "ui": [],
        "markup": {},
        "spec_added": {},
    }
    data = {
        "repo": info["repo"],
        "base": info["base"],
        "tag": info["tag"],
        "mode": "pull-request",
        "language": "en",
        "prs": [pr],
        "release": "",
        "direct_commits": [],
    }
    core.save(run / "sources.json", data)
    roots = harness.test_roots(checkout, recipe)
    available = {
        path: text
        for root in roots
        for path, text in editor.spec_texts(checkout, root).items()
    }
    bases = editor.related(pr, available) or sorted(available)
    if not bases:
        raise ValueError("No existing Playwright flow fixture for this PR")
    selected = [
        {
            "id": "pr-flow-" + str(index),
            "prs": [pr["number"]],
            "title": re.sub(r"[\r\n|]+", " ", item["title"])[:200],
            "proofs": [],
            "base": bases[0],
            "show": json.dumps(
                dict(
                    item,
                    verification=(
                        "This flow was selected only from the PR overview and cited business specs. "
                        "Inspect only the relevant implementation and existing browser helpers to verify this flow. "
                        "Do not derive additional flows from code or expand into a product tour. "
                        "Start narration with the actual change and end on the visible result. "
                        "Use each sentence's action pin for the control or outcome it describes. "
                        "Leave release introductions and conclusions out of the story. "
                        "For off-camera course setup, use createPrVideoCourse from "
                        "e2e/utils/pr-video-data.ts inside withWorkerPage(USER_ROLE.admin, ...). "
                        "It reuses seeded categories, uploads a tenant-owned cover and registers cleanup "
                        "immediately. Pass apiClient, factories, cleanup, withWorkerPage, categoryTitle "
                        "and title. Never invent an image key or recreate an existing category. "
                        "Prove the described visible outcome on screen; report a scene failure if it is unsupported."
                    ),
                ),
                ensure_ascii=False,
            ).replace("|", "/"),
        }
        for index, item in enumerate(plan["flows"], 1)
    ]
    # One PR may change multiple flows; do not use release-level PR deduplication.
    (run / "gaps.txt").write_text(gaps.render(selected) + "\n")
    return info


def record(run, repo, bundle):
    run, bundle = Path(run), Path(bundle)
    os.environ["RELEASE_FILM_RUN"] = str(run)
    args = SimpleNamespace(run=str(run), jobs=2, learn="off", provider="cli")
    phase, prepared = "prepare", False
    try:
        pr_video_report.checkpoint(run, phase)
        info = prepare(run, repo)
        prepared = True
        phase = "setup"
        pr_video_report.checkpoint(run, phase)
        print("PR video: preparing the demo environment", flush=True)
        harness.setup(run, info["addon"]["harness"])
        phase = "capture"
        pr_video_report.checkpoint(run, phase)
        film.capture(args)
        phase = "scene-workers"
        pr_video_report.checkpoint(run, phase)
        selected = film.gap_scenes(args)
        if not selected.get("ok") or not selected.get("workers"):
            pr_video_report.checkpoint(run, phase, selected)
            raise RuntimeError(
                "PR scene workers did not start: " + pr_video_report.reason(selected)
            )
        phase = "narration"
        pr_video_report.checkpoint(run, phase)
        print("PR video: recording and narrating the selected flows", flush=True)
        film.write(args)
        phase = "finish"
        pr_video_report.checkpoint(run, phase)
        print("PR video: reviewing and assembling one film", flush=True)
        finished = film.finish(args)
        pr_video_report.checkpoint(run, phase, finished)
        if not finished.get("ok") or finished.get("degraded"):
            raise RuntimeError(
                "PR recording review failed: " + pr_video_report.reason(finished)
            )
        count = len(core.load(run / "pr-video-plan.json")["flows"])
        passed = [
            scene
            for scene in finished.get("scenes", [])
            if scene.get("filmed") and scene.get("narrated")
        ]
        if len(passed) != count:
            raise RuntimeError("Not every selected PR flow was recorded and narrated")
        # Four flows must survive review as four chapters of the one final film.
        # Successful worker takes alone do not prove the review kept those chapters.
        chapters = (core.load(run / "story.json") or {}).get("chapters", [])
        actual = [chapter.get("source", {}).get("file") for chapter in chapters]
        expected = [f"gaps/pr-flow-{index}/story.txt" for index in range(1, count + 1)]
        if len(actual) != count or set(actual) != set(expected):
            raise RuntimeError(
                "The reviewed film does not contain every selected flow exactly once"
            )
        phase = "stage"
        pr_video_report.checkpoint(run, phase)
        return stage(run, bundle)
    except BaseException as error:
        pr_video_report.checkpoint(run, phase, error=error)
        raise
    finally:
        if prepared:
            film.stop(args)


def stage(run, bundle):
    import sys

    sys.path.insert(0, str(core.SKILL / "ci"))
    import release_assets

    run, bundle = Path(run), Path(bundle)
    metadata = core.load(run / "pr-input.json")
    # Existing structural checks decode the entire film before it is uploaded.
    info = core.load(run / "meta.json")
    release_assets.stage(run, info["tag"], metadata["headSha"], run / "verified")
    video = run / "public" / "demo.mp4"
    if video.stat().st_size > 100 * 1024 * 1024:
        raise ValueError("PR video exceeds GitHub native media attachment limit")
    bundle.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(video, bundle / "video.mp4")
    manifest = {
        "schemaVersion": 1,
        "repository": metadata["repository"],
        "number": metadata["number"],
        "headSha": metadata["headSha"],
        "baseSha": metadata["baseSha"],
        "workflowRunId": metadata["workflowRunId"],
        "video": {
            "path": "video.mp4",
            "sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
            "sizeBytes": video.stat().st_size,
        },
        "flows": core.load(run / "pr-video-plan.json")["flows"],
    }
    core.save(bundle / "pr-video.json", manifest)
    return manifest


def outputs(**values):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as file:
            for key, value in values.items():
                text = str(value)
                if "\n" in text or "\r" in text:
                    raise ValueError("Invalid workflow output")
                file.write(f"{key}={text}\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("inspect", "plan", "record"))
    parser.add_argument("--run", required=True)
    parser.add_argument("--repo-dir", default=".")
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY"))
    parser.add_argument("--number", type=int)
    parser.add_argument("--event-file", default=os.environ.get("GITHUB_EVENT_PATH"))
    parser.add_argument("--actor", default=os.environ.get("GITHUB_ACTOR"))
    parser.add_argument("--bundle")
    args = parser.parse_args()
    if args.command == "inspect":
        event = core.load(Path(args.event_file))
        number = (
            args.number
            or event.get("number")
            or int(event.get("inputs", {}).get("pr_number", 0))
        )
        expected = (
            event.get("pull_request", {}).get("head", {}).get("sha")
            or event.get("inputs", {}).get("expected_head")
            or None
        )
        if args.actor == "github-actions[bot]":
            args.actor = event.get("inputs", {}).get("requested_by") or args.actor
        result = inspect(
            args.repository, number, args.actor, args.repo_dir, args.run, expected
        )
        outputs(
            eligible=str(result["eligible"]).lower(),
            number=number,
            head=result.get("head", ""),
            base=result.get("base", ""),
        )
    elif args.command == "plan":
        result = classify(args.run)
        outputs(record=str(result["decision"] == "record").lower())
    else:
        result = record(args.run, args.repo_dir, args.bundle)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
