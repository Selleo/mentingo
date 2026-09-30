#!/usr/bin/env python3
"""release-film: a narrated demo film of a release (in the project's language: English or Polish), filmed from the
project's own end-to-end tests.

    film.py run --repo Owner/name --tag v1.2.0 [--base v1.1.0]     everything below, in order, with no agent (CI):
                                                                   exits 1 when it makes no film
    film.py doctor [--repo Owner/name]   what this machine lacks for a film and how to install it (start checks first)
    film.py voice-setup [--narrator F]   VoxCPM2 as this machine's narrator (an NVIDIA GPU; else edge-tts speaks)
    film.py voice-check [--language en]  one sentence spoken by the narrator a run would use here (edge-tts in CI)
    film.py start   … checkout, pull requests and the test environment (in parallel)
    film.py capture --run R      the film set for the scenes: the test environment kept up for their tries
    film.py write   --run R      the pull requests no scene shows, grouped with a reason
    film.py adopt   --run R      check story.json written by the agent (when no model key is set)
    film.py finish  --run R      adopt, the automatic review, the labels, make, page and stop in one command
    film.py labels  --run R      the film's bottom-bar labels (what is happening) from the reviewed narration
    film.py learn   --run R      fold the run into the project's knowledge (finish starts it in the background)
    film.py note    --run R --gap ID --text T   a scene writer's lesson, kept once the scene passed
    film.py film-queue --run R   the camera's operator for the scene tries (`try` starts it in the background)
    film.py make    --run R      narration, montage and the rendered film
    film.py recut   --run R --out DIR   the film made again into DIR from the run's takes and voice (the run untouched)
    film.py metrics --run R      what the film and the run measure (captions, proofs, frozen pictures, scenes, cost)
    film.py page    --run R      the preview page, served on 127.0.0.1 (in CI only written: public/)
    film.py stop    --run R      stop what this run started (scene choice, workers, services)
    film.py report  --run R      stage times and the film summary

Every command prints one JSON object. Runs live in .local/release-film/runs/<owner>__<name>/<tag>/<run>/.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import contextlib
import json
import os
import re
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time

sys.dont_write_bytecode = True
import core  # noqa: E402
import cut  # noqa: E402
import doctor  # noqa: E402
import editor  # noqa: E402
import gaps  # noqa: E402
import harness  # noqa: E402
import knowledge  # noqa: E402
import language  # noqa: E402
import llm  # noqa: E402
import metrics  # noqa: E402
import page  # noqa: E402
import review  # noqa: E402
import sources  # noqa: E402


def out(value):
    print(json.dumps(value, ensure_ascii=False, indent=1))


def repo_dir(slug, given=None):
    """A local clone with tags: this repository when it is the release's one, else a cached partial clone."""
    if given:
        return Path(given).resolve()
    remote = core.sh(['git', '-C', str(core.REPO), 'remote', 'get-url', 'origin'], check=False).stdout.strip().lower()
    if remote.removesuffix('.git').endswith(slug.lower()):
        return core.REPO
    target = core.HOME / 'repos' / core.project_key(slug)
    if not target.exists():
        core.sh(['git', 'clone', '--filter=blob:none', '--no-checkout', f'https://github.com/{slug}.git', str(target)], timeout=1800)
    core.sh(['git', '-C', str(target), 'fetch', '-q', '--tags', '--force', 'origin'], timeout=900)
    return target


def base_tag(slug, repo, tag):
    """The previous published release whose tag is an ancestor of ``tag``; else the previous tag."""
    listed = core.sh(['gh', 'release', 'list', '-R', slug, '--limit', '200', '--json', 'tagName,publishedAt,isDraft,isPrerelease'],
                     check=False).stdout
    releases = sorted((r for r in json.loads(listed or '[]') if not r['isDraft'] and not r['isPrerelease'] and r['tagName'] != tag),
                      key=lambda r: r['publishedAt'], reverse=True)
    for release in releases:
        if core.sh(['git', '-C', str(repo), 'merge-base', '--is-ancestor', release['tagName'], tag], check=False).returncode == 0:
            return release['tagName']
    return core.sh(['git', '-C', str(repo), 'describe', '--tags', '--abbrev=0', f'{tag}^']).stdout.strip()


def meta(run):
    """The run's facts, with the project add-on read again (edits between steps count without a new env step)."""
    info = core.load(Path(run) / 'meta.json')
    if (Path(run) / 'checkout').exists():
        info['addon'] = core.addon(info['repo'], Path(run) / 'checkout')
    return info


def recipe_of(info):
    return (info['addon'].get('harness') or {})


def start(args):
    ready = doctor.check(args.repo)  # before anything is made: a missing tool would fail it minutes later
    if not ready['ok']:
        return dict(ready, environment='missing tools')
    repo = repo_dir(args.repo, args.repo_dir)
    base = args.base or base_tag(args.repo, repo, args.tag)
    run = core.run_dir(args.repo, args.tag, args.run_id)
    run.mkdir(parents=True, exist_ok=True)
    os.environ['RELEASE_FILM_RUN'] = str(run)  # the model calls log their cost there (llm.log)
    core.mark(run, 'total', 'start', f'{args.repo} {args.tag}')
    core.mark(run, 'start', 'start')
    checkout = harness.checkout(repo, args.tag, run)
    addon = core.addon(args.repo, checkout)
    info = {'repo': args.repo, 'tag': args.tag, 'base': base, 'repo_dir': str(repo), 'run': str(run), 'addon': addon}
    core.save(run / 'meta.json', info)
    recipe = recipe_of(info)

    def collect():
        core.mark(run, 'sources', 'start')
        data = sources.collect(args.repo, repo, base, args.tag)
        data['language'] = language.choose(addon, data)  # the film is told in it (language.py)
        core.save(run / 'sources.json', data)
        core.mark(run, 'sources', 'end')
        return data

    with ThreadPoolExecutor(max_workers=2) as pool:
        got = pool.submit(collect)
        env = pool.submit(harness.setup, run, recipe) if recipe.get('config') else None
        try:
            data = got.result()
            if recipe.get('config'):  # the scenes are chosen at once, while the environment is still being set up
                choose_in_background(run, data, checkout, recipe, addon)
            if env:
                env.result()
        except BaseException:  # the services the setup started beside the failed step would keep running
            if env:
                try:
                    env.result()
                except BaseException:  # noqa: BLE001 the setup's own failure: the first error is the one reported
                    pass
            harness.stop_services(run)
            harness.stop_stacks(run)
            raise
    core.mark(run, 'start', 'end')
    if recipe.get('config') and harness.one_off(checkout / recipe['config']):
        background(run, 'keep', 'keeper-start.log')  # the film set's servers come up while the scenes are written
    result = {'run': str(run), 'base': base, 'prs': len(data['prs']), 'language': data['language'],
              'environment': 'ready' if recipe.get('config') else 'no recipe'}
    if not recipe.get('config'):
        result['next'] = ('write the project recipe (the add-on "harness" key, see SKILL.md) from these facts, '
                          f'then: film.py env --run {run}')
        result['facts'] = harness.discover(checkout)
    return result


def background(run, command, log_name):
    """film.py <command> --run <run> in the background, detached (it outlives this command): its process in
    <run>/<command>.json (pid and start), so `stop` can end the scene choice of a run cut short."""
    with open(Path(run) / log_name, 'a') as log:
        process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), command, '--run', str(run)], stdout=log,
                                   stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True,
                                   cwd=os.getcwd())
    core.save(Path(run) / f'{command}.json', {'pid': process.pid, 'since': core.started_at(process.pid)})


def stop_choice(run):
    """Ends the scene choice `start` runs in the background (`choose`, with its model call) and all it started, when
    it still runs: a run cut short left it going (never another process that got its pid). Whether it was running."""
    choice = core.load(Path(run) / 'choose.json')
    if not core.still_running(choice):
        return False
    try:
        os.killpg(choice['pid'], signal.SIGKILL)
    except OSError:
        return False
    return True


def choose_in_background(run, data, checkout, recipe, addon):
    """The scene choice (a model call of a minute or two) started at once: picked.json, gaps.pending, `choose`."""
    roots = harness.test_roots(checkout, recipe)
    _, reasons = editor.pick_specs(data, roots, addon, editor.MAX_SPECS, checkout)
    core.save(Path(run) / 'picked.json', reasons)
    (Path(run) / 'gaps.pending').touch()
    background(run, 'choose', 'choose.log')


def keep(args):
    """The film set kept up for the run (harness.keep_set), started by `start` in the background."""
    info = meta(args.run)
    recipe = recipe_of(info)
    state = harness.keep_set(args.run, recipe, harness.test_env(args.run, recipe))
    return {'keeper': bool(state)}


def env(args):
    info = meta(args.run)
    info['addon'] = core.addon(info['repo'], Path(args.run) / 'checkout')
    core.save(Path(args.run) / 'meta.json', info)
    harness.setup(args.run, recipe_of(info))
    return {'environment': 'ready'}


def capture(args):
    """The film set for the scenes: the project's test environment, its servers and setup kept up for the scenes'
    tries (the scenes are the film: no test of the project's own is filmed)."""
    info = meta(args.run)
    recipe = recipe_of(info)
    env = harness.test_env(args.run, recipe)
    harness.keep_set(args.run, recipe, env)  # servers, globalSetup and setup projects: once for the whole run
    core.save(Path(args.run) / 'camera.json', {'free': time.time(), 'ready': time.time(),
                                               'serial': harness.serial(args.run, recipe)})
    return {'films': 0, 'note': 'the set is up for the scenes; the scenes are the film'}


def films_of(run):
    """The run's filmed tests and scenes (captures.json; none yet when no test was filmed)."""
    return (core.load(Path(run) / 'captures.json') or {}).get('films') or []


def scene_plan(run):
    """The run's scenes for changes no test shows (gaps.txt), with their try result and narration when written."""
    run = Path(run)
    plan = run / 'gaps.txt'
    found = []
    for gap in gaps.parse(plan.read_text()) if plan.exists() else []:
        folder = run / 'gaps' / gap['id']
        story = folder / 'story.txt'
        found.append(dict(gap, result=core.load(folder / 'result.json'), story=story.read_text() if story.exists() else None,
                          folder=str(folder)))
    return found


def write(args):
    wait_for_scenes(args.run)  # the scenes' pull requests are theirs
    claimed = {n: g['title'] for g in scene_plan(args.run) for n in g['prs']}
    return editor.write(args.run, core.load(Path(args.run) / 'sources.json'), getattr(args, 'provider', None), claimed=claimed)


def labels(args):
    """The film's bottom-bar labels: each reviewed sentence gets a ``label`` in story.json saying what is happening, like
    a presentation's heading (the narration itself is offered as the player's subtitles)."""
    run = Path(args.run)
    story = core.load(run / 'story.json')
    if not story:
        raise SystemExit('no adopted story yet: film.py adopt --run ' + args.run)
    core.mark(run, 'labels', 'start')
    usage = editor.write_labels(story, story.get('keys') or {}, core.load(run / 'sources.json'), getattr(args, 'provider', None))
    core.save(run / 'story.json', story)
    missing = [n for n, (chapter, used) in enumerate(zip(story['chapters'], usage), 1) if chapter.get('sentences') and not used]
    if missing:  # the chapter's title stays under its picture the whole chapter
        print(f'release-film: chapters {missing} got no captions: film.py labels --run {run} writes them again',
              file=sys.stderr, flush=True)
    core.mark(run, 'labels', 'end')
    return {'labels': sum(1 for c in story['chapters'] for s in c.get('sentences') or [] if s.get('label')), 'usage': usage,
            **({'missing': missing} if missing else {})}


def review_sheets(args):
    """The review, in one automatic pass: sheets, the claim check (Opus 5.5 looking at every sentence's pictures) and
    the voice's pauses at once; rewrites and drops go into the story files and are adopted. When they would break the
    story (adopt finds problems), the story stays as it was."""
    run = Path(args.run)
    story = core.load(run / 'story.json')
    if not story:
        raise SystemExit('no adopted story yet: film.py adopt --run ' + args.run)
    core.mark(run, 'review', 'start')
    # the chapters no early check covers are checked at once, beside the early checks still running: only their
    # sheets are made (the takes and pictures of the others were made with their early checks)
    covered = {n for n, gap in review.scene_ids(story).items() if gap in EARLY or (run / 'early' / f'{gap}.json').exists()}
    uncovered = {n for n in range(1, len(story['chapters']) + 1) if n not in covered}
    made = review.sheets(args.run, story, only=uncovered)
    with ThreadPoolExecutor(max_workers=2) as pool:  # the claim check (minutes) while the voice is spoken and cut
        checking = pool.submit(review.check_claims, args.run, made, story)
        pauses = review.waits(args.run, story, meta(args.run)['addon'])
        until = time.time() + EARLY_WAIT
        for gap, job in EARLY.items():  # the scenes checked while others were filmed: reused while their text holds
            try:
                job.result(timeout=max(1, until - time.time()))
            except Exception:  # noqa: BLE001 an early check that failed or is late is simply done again
                if not job.done():
                    print(f'release-film: early check of {gap} still running after the wait: checked again',
                          file=sys.stderr, flush=True)
        early = review.early_findings(run, story)
        changed = {n for n in covered if n not in early}  # changed since its early check
        again = review.sheets(args.run, story, only=changed, fresh=False) if changed else []
        made += again
        found = checking.result() + review.check_claims(args.run, again, story) + [f for n in sorted(early) for f in early[n]]
    claims = [c for c in found if c.get('sentence')]
    before, dropped = review.story_files(run), core.load(run / 'drops.json') or []
    # the chapters this review checked, and no other (a story not adopted from files has no sources to keep them by)
    reviewed = {editor.source_of(c) for c in story['chapters']} if all(c.get('source') for c in story['chapters']) else None
    applied = review.apply_claims(args.run, story, claims)  # the rewrites say only what the pictures show
    drops, rejected = review.record_drops(args.run, story, [c for c in found if c.get('drop')])
    kept = True
    if (applied or drops) and not adopt(args, early=False, reviewed=reviewed)['ok']:
        for path, text in before.items():
            path.write_text(text, encoding='utf-8')
        core.save(run / 'drops.json', dropped)
        adopt(args, early=False, reviewed=reviewed)  # the story as it was before the review
        kept = False
        rejected += [{'title': d['title'], 'why': d['reason']} for d in drops]  # back in the film with the story
    core.mark(run, 'review', 'end', f'{len(applied) if kept else 0} rewrites, {len(drops) if kept else 0} drops, '
                                    f'{len(early)} checked early')
    core.save(run / 'review' / 'claims.json', {'applied': applied if kept else [], 'drops': drops if kept else []})
    result = {'sheets': made, 'claims': claims, 'applied': len(applied) if kept else 0,
              'dropped': [{'title': d['title'], 'prs': d['prs'], 'why': d['reason']} for d in drops] if kept else [],
              'waits': pauses, **({} if kept else {'note': 'the rewrites broke the story: it stays as adopted before'}),
              'next': f'film.py make --run {args.run} (nothing to read or fix: the review is done)'}
    if rejected:  # a chapter that shows nothing of its change and cannot leave the film: no reviewed film with it
        result.update(ok=False, rejected=rejected,
                      next=('the review found chapters that show nothing of their change and cannot leave the film (the '
                            'opening or the closing one, one past the limit of drops, or one of the last three): fix '
                            f'their scene or narration, then film.py finish --run {args.run}'))
    return result


def finish(args):
    """Everything after the narration in one command: wait for the scenes and adopt, the automatic review, the film,
    the page, and the run's services stopped. Stops early when adopt finds problems or the review rejects a chapter it
    cannot drop (fix them, finish again).
    A step that fails stops the run's services on its way out (the checkout stays, to look at)."""
    with stopped_on_failure(args) as cleanup:
        adopted = adopt(args)
        if not adopted['ok']:
            cleanup.stop()
            return dict(adopted, next=f'fix these problems in story.txt (or gaps/<id>/story.txt), then film.py finish --run {args.run}')
        reviewed = review_sheets(args)
        if reviewed.get('ok') is False:
            cleanup.stop()
            return reviewed
        labeled = labels(args)
        made = make(args)
        shown = preview(args)
    stopped = stop(args)
    learned = None
    mode = getattr(args, 'learn', None) or 'background'
    if mode == 'sync':  # CI: the job may end right after this command, a background learn with it
        learned = learn(args)
    elif mode == 'background':  # the project's knowledge, in the background (model calls)
        background(args.run, 'learn', 'learn.log')
    story = core.load(Path(args.run) / 'story.json')
    return {'ok': True, 'url': shown['url'], 'film': {k: v for k, v in made.items() if k != 'chapters' and v},
            'chapters': [{'title': c['title'], 'prs': c['prs']} for c in story['chapters']],
            'not_shown': story.get('not_shown') or [], 'scenes': adopted['scenes'],
            'review': {k: reviewed[k] for k in ('applied', 'dropped', 'waits', 'note') if k in reviewed},
            'labels': labeled['labels'], **({'labels_missing': labeled['missing']} if labeled.get('missing') else {}),
            **({'degraded': made['degraded']} if made.get('degraded') else {}),
            **({'learned': learned} if learned else {}),
            'stopped': stopped, 'stages': core.timings(args.run)}


EARLY = {}  # {scene id: its chapter's check}, started while the other scenes were filmed (finish: adopt, then review)
EARLY_WAIT = 300  # the review waits this long, in all, for the early checks still running; a later one is checked
# again at once (in one run an early check hung through both its timeouts, 600 s, while the review waited)


class stopped_on_failure:
    """A block after which the run's services are stopped when it fails (keeper, services, stacks; the checkout
    stays), then the failure goes on."""

    def __init__(self, args):
        self.args = args

    def __enter__(self):
        return self

    def __exit__(self, kind, error, trace):
        if kind is not None:
            try:
                self.stop()
                print(f'release-film: {kind.__name__}: the run\'s services were stopped (the checkout stays)', file=sys.stderr)
            except Exception as failed:  # noqa: BLE001 the first failure is the one to report
                print(f'release-film: stopping the services failed too: {failed}', file=sys.stderr)
        return False

    def stop(self):
        keep = getattr(self.args, 'keep_checkout', False)
        try:
            self.args.keep_checkout = True
            return stop(self.args)
        finally:
            self.args.keep_checkout = keep


def adopt(args, early=True, reviewed=None):
    """``early``: check each narrated scene's chapter as soon as its worker ends (finish's first adopt; the review's own
    adopts, after its rewrites, check nothing more). ``reviewed``: the review's adopt, which keeps only the chapters
    it checked (editor.source_of) and narrates no scene now (a narration written now would go unchecked)."""
    said = {}
    data = core.load(Path(args.run) / 'sources.json')
    if list((Path(args.run) / 'gaps').glob('*/worker.json')):  # the scene workers first
        checks = core.ci_profile()['checks']
        pool, checked, standing = ThreadPoolExecutor(max_workers=checks), set(), {}
        # the stand-ins have their own threads (never queued behind the early checks), and once adopt stops waiting
        # for them, one still running writes nothing: its scene is narrated below, and nothing changes it after that
        stand_ins, gate = ThreadPoolExecutor(max_workers=checks), StandInGate()

        def check_early(gap_id):  # a filmed, narrated scene is checked at once: the review then reuses its findings
            keys = {f['key']: f['capture'] for f in films_of(args.run) if f.get('key') and f.get('status') == 'passed'}
            checked.add(gap_id)
            EARLY[gap_id] = pool.submit(review.early_check, args.run, gap_id, keys)
            EARLY[gap_id].add_done_callback(lambda job, gap=gap_id: job.exception() and print(
                f'release-film: early check of {gap} failed: {str(job.exception())[:300]}', file=sys.stderr, flush=True))
        early = early and llm.capabilities()['review']

        def stand_in(gap_id):  # a filmed scene whose worker was stopped before narrating it: narrated (and checked) now
            scene = next((s for s in scene_plan(args.run) if s['id'] == gap_id), None)
            if scene and (scene.get('result') or {}).get('ok') and not scene.get('story') and gap_id not in standing:
                standing[gap_id] = stand_ins.submit(narrate_stand_in, args, data, scene, check_early if early else None,
                                                    gate)
        said = gaps.wait_for_workers(args.run, on_done=check_early if early else None,
                                     on_stopped=stand_in if reviewed is None else None)
        for job in standing.values():
            try:
                job.result(timeout=editor.RESERVE_TIMEOUT + 120)
            except Exception:  # noqa: BLE001 a stand-in that failed or is late is written again below
                pass
        gate.close()
        for job in standing.values():
            job.cancel()  # one not started yet never starts
        for gap in scene_plan(args.run) if early else []:  # the last ones (stopped at the limit with their narration)
            if gap['id'] not in checked and (gap.get('result') or {}).get('ok') and gap.get('story') and not stale(gap):
                check_early(gap['id'])
        pool.shutdown(wait=False)
        stand_ins.shutdown(wait=False)
        core.mark(args.run, 'scenes', 'end', f'{len(said)} workers')
    films = films_of(args.run)
    scenes = scene_plan(args.run)
    # filmed, but its worker ran out of time before the narration (or narrated a take a later try replaced): the chapter
    # writer narrates it (all at once); never a take its own writer gave up on (a scene that ran but shows nothing, such
    # as an AI panel of "Disabled")
    gave_up = {i for i, words in said.items() if core.gave_up(words)}
    for scene in scenes:
        if scene.get('story') and (scene.get('result') or {}).get('ok') and stale(scene):
            scene['story'] = None
    silent = [s for s in scenes if (s.get('result') or {}).get('ok') and not s.get('story') and s['id'] not in gave_up
              and reviewed is None]
    for scene in scenes:
        if scene['id'] in gave_up:
            scene['result'] = dict(scene.get('result') or {}, ok=False)  # its pull requests go to "not shown"
    with ThreadPoolExecutor(max_workers=min(core.ci_profile()['checks'], max(1, len(silent)))) as pool:
        texts = list(pool.map(lambda s: editor.narrate_scene(args.run, data, films, s, meta(args.run)['addon']), silent))
    for scene, text in zip(silent, texts):
        if text:
            (Path(args.run) / 'gaps' / scene['id'] / 'story.txt').write_text(text, encoding='utf-8')
            (Path(args.run) / 'gaps' / scene['id'] / 'story.standin').touch()  # narrated by the chapter writer
            scene['story'] = text
    problems = editor.adopt(args.run, data, films, scenes, reviewed=reviewed)
    return {'ok': not problems, 'problems': problems,
            'scenes': [dict({'id': g['id'], 'filmed': bool((g.get('result') or {}).get('ok')), 'narrated': bool(g.get('story'))},
                            **({'worker': said[g['id']]} if g['id'] in said else {})) for g in scenes]}


def stale(scene):
    """Whether a scene's narration was written before its take (a later try replaced the take it narrates)."""
    folder = Path(scene['folder']) if scene.get('folder') else None
    since = (scene.get('result') or {}).get('since')
    if not since or folder is None or not (folder / 'story.txt').is_file():
        return False
    return (folder / 'story.txt').stat().st_mtime < since - 1


class StandInGate:
    """What lets a stand-in narration write its scene's story.txt: adopt's wait for it (``close`` ends that wait; a
    stand-in done later writes nothing)."""

    def __init__(self):
        self.lock, self.closed = threading.Lock(), False

    def close(self):
        with self.lock:
            self.closed = True


def narrate_stand_in(args, data, scene, check=None, gate=None):
    """A stopped worker's filmed scene narrated by the chapter writer (story.txt, marked story.standin), then checked
    with ``check(scene id)``; returns its text ('' when no model answered, or when ``gate`` closed meanwhile)."""
    text = editor.narrate_scene(args.run, data, films_of(args.run), scene, meta(args.run)['addon'])
    folder = Path(args.run) / 'gaps' / scene['id']
    if not text:
        return text
    with gate.lock if gate else contextlib.nullcontext():
        if gate and gate.closed:
            return ''
        (folder / 'story.txt').write_text(text, encoding='utf-8')
        (folder / 'story.standin').touch()
        if check:
            check(scene['id'])
    return text


def choose_scenes(args):
    """gaps.txt: the scenes Opus 5.5 picks (the ranking when no model can be called). Started by `start` in the
    background; `gaps` and `write` wait for it (gaps.pending)."""
    run = Path(args.run)
    try:
        info = meta(run)
        recipe = recipe_of(info)
        data, checkout = core.load(run / 'sources.json'), run / 'checkout'
        roots = harness.test_roots(checkout, recipe)
        picked = core.load(run / 'picked.json')
        core.mark(run, 'gaps', 'start')
        limit = gaps.MAX_GAPS_SERIAL if harness.serial(run, recipe) else gaps.MAX_GAPS
        requested = recipe.get('scene_limit', limit)
        if type(requested) is not int or not 1 <= requested <= limit:
            raise ValueError(f'harness.scene_limit must be an integer from 1 to {limit}')
        limit = requested
        chosen = gaps.choose(data, checkout, roots, info['addon'], list(picked or []), limit=limit)
        if chosen is None:  # no model to ask: the ranking chooses, every change open to a scene (the capture films no
            # test of the project's own: the scenes are the film)
            chosen = gaps.candidates(data, checkout, roots, info['addon'], limit=limit, picked=[])
        if not (run / 'gaps.txt').exists():
            (run / 'gaps.txt').write_text(gaps.render(chosen) + '\n', encoding='utf-8')
        core.mark(run, 'gaps', 'end', f'{len(chosen)} scenes')
        return {'scenes': len(chosen), 'file': str(run / 'gaps.txt')}
    finally:
        (run / 'gaps.pending').unlink(missing_ok=True)


def wait_for_scenes(run, limit=480):
    """Wait while the background choice of scenes runs (gaps.pending), at most ``limit`` seconds."""
    run = Path(run)
    until = time.time() + limit
    while (run / 'gaps.pending').exists() and not (run / 'gaps.txt').exists() and time.time() < until:
        time.sleep(2)


def gap_scenes(args):
    """The scenes for changes no test shows: the suggestion in gaps.txt (edit it to change the choice, an empty file
    for none), checked, with one brief per scene for a sub-agent."""
    info = meta(args.run)
    recipe = recipe_of(info)
    run, data = Path(args.run), core.load(Path(args.run) / 'sources.json')
    checkout = run / 'checkout'
    roots = harness.test_roots(checkout, recipe)
    plan = run / 'gaps.txt'
    wait_for_scenes(run)
    if not plan.exists():
        choose_scenes(args)
    chosen = gaps.parse(plan.read_text())
    problems = gaps.check(chosen, data, checkout)
    if problems:
        return {'ok': False, 'problems': problems, 'file': str(plan)}
    made = gaps.briefs(run, chosen, data, recipe, roots)
    scenes = [{'id': g['id'], 'prs': g['prs'], 'title': g['title'], 'brief': made[g['id']]} for g in chosen]
    workers = gaps.launch_workers(run, made) if chosen else None
    if workers is not None:
        core.mark(run, 'scenes', 'start', f'{len(workers)} workers')
        return {'ok': True, 'file': str(plan), 'scenes': scenes, 'workers': True, 'provider': llm.choose(),
                'next': ('Scene workers write, film and narrate the scenes in the background: '
                         f'launch nothing; film.py adopt --run {run} waits for them')}
    return {'ok': True, 'file': str(plan), 'scenes': scenes,
            'next': 'one sub-agent per scene, all in one message: "Read <brief> and do what it says."'}


def try_scene(args):
    info = meta(args.run)
    recipe = recipe_of(info)
    return gaps.try_scene(args.run, recipe, harness.test_env(args.run, recipe), args.gap)


def film_queue(args):
    info = meta(args.run)
    recipe = recipe_of(info)
    return gaps.film_queue(args.run, recipe, harness.test_env(args.run, recipe))


def make(args):
    info = meta(args.run)
    story = core.load(Path(args.run) / 'story.json')
    return cut.make(args.run, story, core.load(Path(args.run) / 'sources.json'), info['addon'], args.jobs)


def recut(args):
    """The film made again into --out from the run's takes and voice, the run untouched: montage and caption changes
    compared on the same takes, at no model cost."""
    info = meta(args.run)
    story = core.load(Path(args.run) / 'story.json')
    if not story:
        raise SystemExit('no adopted story in the run')
    out = Path(args.out).resolve()
    if out == Path(args.run).resolve():
        raise SystemExit('--out must be another folder than the run')
    return cut.make(args.run, story, core.load(Path(args.run) / 'sources.json'), info['addon'], args.jobs, out=out)


def measure(args):
    """What the film and the run measure: per chapter and in all (metrics.chapter, metrics.summary), the scenes and
    their workers' cost, the model calls' cost and the stages."""
    run = Path(args.run)
    story = core.load(run / 'story.json')
    if not story:
        raise SystemExit('no adopted story in the run')
    code = language.texts(core.load(run / 'sources.json') or {})['code']
    chapters = [dict(cut.chapter_metrics(c, story['keys'][c['film']], run / 'voice' / f'c{n}', n == len(story['chapters']), code),
                     title=c['title']) for n, c in enumerate(story['chapters'], 1)]
    return {'film': metrics.summary(chapters), 'chapters': chapters, 'scenes': metrics.scenes(run, story),
            'cost': costs(run), 'seat': metrics.seat_usage(run), 'stages': core.timings(run)}


def preview(args):
    story = core.load(Path(args.run) / 'story.json')
    brand = ((meta(args.run) or {}).get('addon') or {}).get('brand')  # the page in the project's fonts and accent
    public = page.build(args.run, core.load(Path(args.run) / 'sources.json'), story, core.load(Path(args.run) / 'film.json'),
                        brand)
    if os.environ.get('RELEASE_FILM_CI') == '1':  # the job keeps public/ as an artifact: no server outlives it
        core.mark(args.run, 'total', 'end')
        return {'url': None, 'access': 'no server in CI: public/ is the page', 'public': str(public)}
    url = page.serve(args.run, public)
    core.mark(args.run, 'total', 'end')
    return {'url': url, 'access': 'this machine only, no password', 'public': str(public)}


def stop(args):
    """Stops the run's services and removes its checkout (the film, captures and page stay)."""
    result, errors = {}, []
    for name, action in (('stopped_choice', stop_choice), ('stopped_workers', gaps.stop_workers),
                         ('stopped_keeper', harness.stop_keeper),
                         ('stopped_services', harness.stop_services), ('stopped_stacks', harness.stop_stacks)):
        try:
            result[name] = action(args.run)
        except Exception as error:
            errors.append(f'{name}: {error}')
    if errors:
        raise RuntimeError('failed to stop parts of the run: ' + '; '.join(errors))
    checkout = Path(args.run) / 'checkout'
    if checkout.exists() and not getattr(args, 'keep_checkout', False):
        repo = meta(args.run)['repo_dir']
        core.sh(['git', '-C', repo, 'worktree', 'remove', '--force', str(checkout)], check=False)
        if checkout.exists():  # files the project's containers wrote as root (a mail catcher's database, say)
            core.sh(['docker', 'run', '--rm', '-v', f'{Path(args.run).resolve()}:/run-folder', 'busybox', 'rm', '-rf',
                     '/run-folder/checkout'], env=harness.docker_env(args.run), check=False)
        core.sh(['git', '-C', repo, 'worktree', 'prune'], check=False)
        result['checkout_removed'] = not checkout.exists()
    return result


def note(args):
    """One line a scene's writer learned about the project's tests (``--kind recipe``: how it made an entity with
    full data through the project's helpers): kept for the project's knowledge once the scene passed its try (a lesson
    from a scene that never passed may be wrong)."""
    folder = Path(args.run) / 'gaps' / args.gap
    if not (core.load(folder / 'result.json') or {}).get('ok'):
        return {'ok': False, 'error': 'a note is kept only after the scene passed its try'}
    text = ' '.join(args.text.split())[:300]
    with (folder / ('recipes.txt' if getattr(args, 'kind', 'lesson') == 'recipe' else 'notes.txt')).open('a', encoding='utf-8') as notes:
        notes.write(text + '\n')
    return {'ok': True, 'kept': text}


def learn(args):
    """Fold the finished run into the project's knowledge (scenes that passed, broken tests, lessons for scene writers)."""
    return knowledge.learn(args.run)


def report(args):
    return {'stages': core.timings(args.run), 'film': core.load(Path(args.run) / 'film.json'),
            'server': core.load(Path(args.run) / 'server.json'), 'cost': costs(args.run),
            'seat': metrics.seat_usage(args.run)}


STEP_NAMES = [('You plan the extra scenes', 'choose'), ('You are the editor', 'write'), ('You check a demo film', 'review'),
              ('You keep the notes', 'learn'), ('You respell English names', 'voice')]  # usage.jsonl names a call by its system prompt


def costs(run):
    """List-price USD of the run's model calls: the plan, chapters, review and knowledge calls (usage.jsonl) and the
    scene workers (their `claude -p` results). The coding agent running the skill is not in it."""
    run = Path(run)
    lines = (run / 'usage.jsonl').read_text(encoding='utf-8').splitlines() if (run / 'usage.jsonl').is_file() else []
    steps, calls_unpriced, unpriced_steps = {}, 0, set()
    for call in (json.loads(line) for line in lines if line.strip()):
        step = next((name for start, name in STEP_NAMES if (call.get('step') or '').startswith(start)), call.get('step') or '?')
        steps[step] = steps.get(step, 0.0) + (call.get('usd_list') or 0.0)
        calls_unpriced += call.get('usd_list') is None
        if call.get('usd_list') is None:
            unpriced_steps.add(step)
    workers = metrics.worker_costs(run)  # the stopped ones estimated at the price the others paid per token
    usd = sum(c for c, _ in workers.values() if c is not None)
    calls = sum(steps.values())
    unpriced = sum(1 for c, _ in workers.values() if c is None)
    return {'usd': None if calls_unpriced or unpriced else round(calls + usd, 2),
            'usd_known': round(calls + usd, 2),
            'usd_scenes': None if unpriced else round(usd, 2),
            'usd_calls': None if calls_unpriced else round(calls, 2), 'calls_unpriced': calls_unpriced,
            'scenes_estimated': sum(1 for c, e in workers.values() if e and c is not None),
            'scenes_uncounted': unpriced,
            'by_step': {step: None if step in unpriced_steps else round(usd, 3)
                        for step, usd in sorted(steps.items(), key=lambda item: -item[1])}}


def run_all(args):
    """Every step with no agent, as a CI job runs it: start, the scenes (Claude Code CLI workers), the film set
    (capture), the pull requests no scene shows (write) and finish. ``ok`` only with a film: a run that cannot make
    one (no recipe, no model, no scene filmed) ends with ``ok: false`` and exit code 1."""
    capabilities = llm.capabilities(getattr(args, 'provider', None))
    missing = [name for name in ('text', 'workers', 'review') if not capabilities.get(name)]
    if missing:
        return {'ok': False, 'error': 'run requires model capabilities: ' + ', '.join(missing),
                'capabilities': capabilities}
    if llm.choose() == 'cli' and not llm.signed_in():  # before minutes of environment setup, not at the first call
        return {'ok': False, 'error': 'the Claude Code CLI is not signed in with a Claude subscription (claude auth '
                                      'status): run /login, or in CI set CLAUDE_CODE_OAUTH_TOKEN from claude setup-token'}
    started = start(args)
    if started['environment'] != 'ready':
        return dict(started, ok=False)
    args.run = started['run']
    steps = {'start': started}
    with stopped_on_failure(args) as cleanup:
        scenes = gap_scenes(args)
        steps['gaps'] = {k: v for k, v in scenes.items() if k != 'next'}
        if not scenes.get('ok') or not scenes.get('scenes') or not scenes.get('workers'):
            cleanup.stop()
            return dict(steps, ok=False, error='run requires a valid scene plan and available scene workers')
        steps['capture'] = capture(args)
        steps['write'] = write(args)
        args.learn = getattr(args, 'learn', None) or 'sync'
        finished = finish(args)
        steps['finish'] = finished
        has_scene = any(s.get('filmed') and s.get('narrated') for s in finished.get('scenes') or [])
        steps['ok'] = bool(finished.get('ok')) and has_scene and not finished.get('degraded') \
            and (Path(args.run) / 'film' / 'demo.mp4').is_file()
        if not steps['ok']:
            cleanup.stop()
            steps['error'] = 'run did not produce a complete, reviewed film with narrated scenes'
    return steps


def jobs(value):
    """--jobs: the film's parallel encodes, 1 to core.JOBS_MOST (found out now, not when the film is rendered)."""
    number = int(value)
    if not 1 <= number <= core.JOBS_MOST:
        raise argparse.ArgumentTypeError(f'{number} is not from 1 to {core.JOBS_MOST}')
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('run', 'start'):
        p = sub.add_parser(name)
        p.add_argument('--repo', required=True, help='Owner/name on GitHub')
        p.add_argument('--tag', required=True)
        p.add_argument('--base', help='previous release tag (default: the previous published release)')
        p.add_argument('--repo-dir', help='an existing local clone')
        p.add_argument('--run-id')
        if name == 'run':
            p.add_argument('--learn', choices=['sync', 'background', 'off'], default='sync',
                           help="fold the run into the project's knowledge: before exiting (default), after, or not")
            p.add_argument('--provider', choices=['cli', 'agent'])
            p.add_argument('--jobs', type=jobs, default=core.ci_profile()['jobs'])
    p = sub.add_parser('doctor')
    p.add_argument('--repo', help="Owner/name: also what its recipe needs (its tests' Node version)")
    p = sub.add_parser('voice-check')
    p.add_argument('--language', choices=language.LANGUAGES, default='en')
    p = sub.add_parser('voice-setup')
    p.add_argument('--narrator', help="a recording of the narrator's voice (its first seconds are cloned); default: "
                                      'the voice cut.NARRATOR describes')
    for name in ('env', 'capture', 'gaps', 'choose', 'try', 'write', 'adopt', 'review', 'labels', 'make', 'page', 'stop',
                 'report', 'finish', 'learn', 'note', 'film-queue', 'recut', 'metrics', 'keep'):
        p = sub.add_parser(name)
        p.add_argument('--run', required=True)
        if name == 'write':
            p.add_argument('--provider', choices=['cli', 'agent'], help='cli (Claude Code) or agent (default: auto)')
        if name in ('try', 'note'):
            p.add_argument('--gap', required=True, help='the scene id from gaps.txt')
        if name == 'note':
            p.add_argument('--text', required=True, help='what the next scene writer should know, in one line')
            p.add_argument('--kind', choices=['lesson', 'recipe'], default='lesson',
                           help='recipe: how the scene made its data (the project\'s helpers or factories and their calls)')
        if name in ('make', 'finish', 'recut'):
            p.add_argument('--jobs', type=jobs, default=core.ci_profile()['jobs'])
        if name == 'recut':
            p.add_argument('--out', required=True, help='the folder for the film made again (not the run)')
        if name in ('stop', 'finish'):
            p.add_argument('--keep-checkout', action='store_true', help='keep the tag checkout to film again')
        if name == 'finish':
            p.add_argument('--learn', choices=['sync', 'background', 'off'], default='background',
                           help="fold the run into the project's knowledge: in the background (default), before exiting, or not")
    args = parser.parse_args()
    if args.command not in ('note', 'report', 'metrics', 'stop'):  # the others can run for minutes, some for the whole run
        core.keep_awake()
    if getattr(args, 'run', None):  # the plan keeps paths from the run folder: they must not depend on the cwd
        args.run = str(Path(args.run).resolve())
        if args.command not in ('recut', 'metrics'):  # those two only read the run
            os.environ['RELEASE_FILM_RUN'] = args.run  # the model calls log their cost there (llm.log)
    handlers = {'run': run_all, 'start': start, 'env': env, 'capture': capture, 'write': write, 'adopt': adopt,
                'review': review_sheets, 'labels': labels, 'gaps': gap_scenes, 'try': try_scene, 'choose': choose_scenes,
                'make': make, 'page': preview, 'stop': stop, 'report': report, 'finish': finish,
                'learn': learn, 'note': note, 'film-queue': film_queue, 'recut': recut, 'metrics': measure, 'keep': keep,
                'doctor': lambda args: doctor.check(args.repo), 'voice-setup': lambda args: cut.voice_setup(args.narrator),
                'voice-check': lambda args: cut.voice_check(args.language)}
    result = handlers[args.command](args)
    out(result)
    if args.command in ('adopt', 'finish', 'run', 'doctor', 'voice-setup', 'voice-check') and not result.get('ok') \
            or args.command in ('start', 'review') and result.get('ok') is False:
        sys.exit(1)


if __name__ == '__main__':
    main()
