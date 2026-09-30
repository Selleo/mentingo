"""The scenes chosen in the background: `gaps` and `write` wait for the choice, and the choice always ends its wait."""
import json
import os
from pathlib import Path
import sys
import tempfile
import subprocess
import threading
import time
import types
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import film  # noqa: E402


class Choice(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.run = Path(self.folder.name)
        (self.run / 'sources.json').write_text(json.dumps({'prs': []}))
        (self.run / 'picked.json').write_text(json.dumps({'e2e/a.spec.ts': [1]}))
        self.args = types.SimpleNamespace(run=str(self.run))
        for name, value in (('meta', lambda run: {'addon': {}}), ('recipe_of', lambda info: {'config': 'x'})):
            patcher = mock.patch.object(film, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = mock.patch.object(film.harness, 'test_roots', lambda checkout, recipe: ['e2e'])
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_the_choice_writes_the_plan_and_ends_the_wait(self):
        (self.run / 'gaps.pending').touch()
        scene = {'id': 'pr1', 'prs': [1], 'title': 't', 'proofs': ['Saved'], 'base': 'e2e/a.spec.ts', 'show': 's'}
        with mock.patch.object(film.gaps, 'choose', lambda *a, **k: [scene]):
            film.choose_scenes(self.args)
        self.assertFalse((self.run / 'gaps.pending').exists())
        self.assertEqual(film.gaps.parse((self.run / 'gaps.txt').read_text()), [scene])
        film.wait_for_scenes(self.run, limit=5)  # returns at once: nothing pending

    def test_without_a_model_every_change_is_open_to_a_scene(self):
        # the capture films no test of the project's own: a change whose own spec was picked still needs its scene
        with mock.patch.object(film.gaps, 'choose', lambda *a, **k: None), \
                mock.patch.object(film.gaps, 'candidates', return_value=[]) as ranked:
            film.choose_scenes(self.args)
        self.assertEqual(ranked.call_args.kwargs['picked'], [])

    def test_more_render_jobs_than_the_render_takes_are_refused_before_anything_runs(self):
        self.assertEqual(film.jobs('8'), 8)
        for value in ('0', '9', '12'):
            with self.assertRaises(film.argparse.ArgumentTypeError):
                film.jobs(value)

    def test_a_failed_choice_still_ends_the_wait(self):
        (self.run / 'gaps.pending').touch()
        with mock.patch.object(film.gaps, 'choose', mock.Mock(side_effect=RuntimeError('boom'))):
            with self.assertRaises(RuntimeError):
                film.choose_scenes(self.args)
        self.assertFalse((self.run / 'gaps.pending').exists())

    def test_a_plan_written_first_is_kept(self):  # one command without an agent writes an empty plan at once
        (self.run / 'gaps.txt').write_text('')
        scene = {'id': 'pr1', 'prs': [1], 'title': 't', 'proofs': [], 'base': 'e2e/a.spec.ts', 'show': 's'}
        with mock.patch.object(film.gaps, 'choose', lambda *a, **k: [scene]):
            film.choose_scenes(self.args)
        self.assertEqual((self.run / 'gaps.txt').read_text(), '')

    def test_local_scene_limit_bounds_model_selection_and_fallback(self):
        with mock.patch.object(film, 'recipe_of', return_value={'config': 'x', 'scene_limit': 8}), \
                mock.patch.object(film.harness, 'serial', return_value=True), \
                mock.patch.object(film.gaps, 'choose', return_value=None) as choose, \
                mock.patch.object(film.gaps, 'candidates', return_value=[]) as fallback:
            film.choose_scenes(self.args)
        self.assertEqual(choose.call_args.kwargs['limit'], 8)
        self.assertEqual(fallback.call_args.kwargs['limit'], 8)

    def test_invalid_scene_limit_fails_before_model_and_releases_pending_wait(self):
        for limit in [True, 0, -1, 11, 8.0, '8']:
            with self.subTest(limit=limit):
                (self.run / 'gaps.pending').touch()
                with mock.patch.object(film, 'recipe_of', return_value={'config': 'x', 'scene_limit': limit}), \
                        mock.patch.object(film.harness, 'serial', return_value=True), \
                        mock.patch.object(film.gaps, 'choose') as choose:
                    with self.assertRaisesRegex(ValueError, 'integer from 1 to 10'):
                        film.choose_scenes(self.args)
                choose.assert_not_called()
                self.assertFalse((self.run / 'gaps.pending').exists())


class Capture(unittest.TestCase):
    def test_the_set_comes_up_for_the_scenes_and_no_test_is_filmed(self):  # the scenes are the film
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            args = types.SimpleNamespace(run=str(run))
            with mock.patch.object(film, 'meta', lambda run: {'addon': {}, 'repo': 'o/r'}), \
                    mock.patch.object(film, 'recipe_of', lambda info: {'config': 'x'}), \
                    mock.patch.object(film.harness, 'test_env', lambda run, recipe: {}), \
                    mock.patch.object(film.harness, 'serial', lambda run, recipe: True), \
                    mock.patch.object(film.harness, 'keep_set') as kept, mock.patch.object(film.harness, 'capture') as filmed:
                result = film.capture(args)
            self.assertEqual(result['films'], 0)
            kept.assert_called_once()  # the set is up for the scenes' tries
            filmed.assert_not_called()
            self.assertTrue(json.loads((run / 'camera.json').read_text())['serial'])
            self.assertEqual(film.films_of(run), [])  # nothing filmed yet: no index


class Labels(unittest.TestCase):
    def test_the_labels_go_into_the_story(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'story.json').write_text(json.dumps({'chapters': [{'title': 'T', 'sentences': [{'text': 'A.'}, {'text': 'B.'}]}],
                                                        'keys': {}}))
            (run / 'sources.json').write_text(json.dumps({'repo': 'o/r', 'tag': 'v2', 'prs': []}))

            def label(story, keys, sources, provider=None):
                story['chapters'][0]['sentences'][0]['label'] = 'Nowy raport'
                return [{'usd_list': 0.01}]
            with mock.patch.object(film.editor, 'write_labels', side_effect=label):
                result = film.labels(types.SimpleNamespace(run=str(run)))
            self.assertEqual(result, {'labels': 1, 'usage': [{'usd_list': 0.01}]})
            with mock.patch.object(film.editor, 'write_labels', return_value=[None]):  # its call timed out
                self.assertEqual(film.labels(types.SimpleNamespace(run=str(run)))['missing'], [1])
            self.assertEqual(json.loads((run / 'story.json').read_text())['chapters'][0]['sentences'][0]['label'], 'Nowy raport')


class Finish(unittest.TestCase):
    """After the narration one command makes the film; the review needs no agent and never leaves a broken story."""

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.run = Path(self.folder.name)
        self.args = types.SimpleNamespace(run=str(self.run), jobs=2)

    def test_finish_stops_at_problems_the_story_has(self):
        with mock.patch.object(film, 'adopt', return_value={'ok': False, 'problems': ['chapter 2: 1 sentences (2–10)']}), \
                mock.patch.object(film, 'make', side_effect=AssertionError('no film from a broken story')):
            result = film.finish(self.args)
        self.assertFalse(result['ok'])
        self.assertIn('film.py finish', result['next'])

    def test_a_chapter_the_review_rejects_but_cannot_drop_fails_the_review(self):
        (self.run / 'story.txt').write_text('# chapter F1 | 1 | Notatki | proof: "Saved"\n0 | Otwieramy notatki.\n')
        (self.run / 'story.json').write_text(json.dumps({'chapters': [
            {'film': 'F1', 'title': 'Notatki', 'prs': [1], 'source': {'file': 'story.txt', 'chapter': 0},
             'sentences': [{'text': 'Otwieramy notatki.', 'action': 0}]}]}))
        rejected = {'chapter': 1, 'drop': 'the pictures show an empty list, not the notes'}
        with mock.patch.object(film.review, 'sheets', return_value=['chapter-1.jpg']), \
                mock.patch.object(film.review, 'check_claims', side_effect=lambda run, sheets, story: [rejected] if sheets else []), \
                mock.patch.object(film.review, 'waits', return_value=[]), \
                mock.patch.object(film, 'meta', return_value={'addon': {}}), \
                mock.patch.object(film, 'adopt', return_value={'ok': True, 'problems': []}):
            result = film.review_sheets(self.args)  # a film of one scene: its only chapter cannot leave
        self.assertIs(result['ok'], False)
        self.assertEqual(result['rejected'], [{'chapter': 1, 'title': 'Notatki', 'why': rejected['drop']}])
        self.assertIn('film.py finish', result['next'])

    def test_finish_stops_when_the_review_fails(self):
        stopped = []
        failed = {'ok': False, 'rejected': [{'chapter': 1, 'title': 'Notatki', 'why': 'empty'}], 'next': 'fix it'}
        with mock.patch.object(film, 'adopt', return_value={'ok': True, 'scenes': []}), \
                mock.patch.object(film, 'review_sheets', return_value=failed), \
                mock.patch.object(film, 'make', side_effect=AssertionError('no film after a failed review')), \
                mock.patch.object(film, 'stop', side_effect=lambda a: stopped.append(a.keep_checkout)):
            result = film.finish(self.args)
        self.assertIs(result['ok'], False)
        self.assertEqual(result['rejected'][0]['title'], 'Notatki')
        self.assertEqual(stopped, [True])  # the services stop, the checkout stays to fix the scene

    def test_a_failed_review_exits_non_zero(self):
        for result, code in (({'ok': False, 'rejected': [], 'next': 'fix it'}, 1), ({'sheets': [], 'next': 'make'}, None)):
            with self.subTest(code=code), mock.patch.object(film, 'review_sheets', return_value=result), \
                    mock.patch.object(sys, 'argv', ['film.py', 'review', '--run', str(self.run)]), \
                    mock.patch.object(film, 'out'):
                if code is None:
                    film.main()  # a passed review carries no ok and ends as before
                else:
                    with self.assertRaises(SystemExit) as stopped:
                        film.main()
                    self.assertEqual(stopped.exception.code, code)

    def test_rewrites_that_break_the_story_are_taken_back(self):
        original = '# chapter F1 | 1 | Notatki | proof: "Saved"\n0 | Otwieramy notatki.\n2 | Zapisujemy.\n'
        (self.run / 'story.txt').write_text(original)
        (self.run / 'story.json').write_text(json.dumps({'chapters': [
            {'film': 'F1', 'title': 'Notatki', 'prs': [1], 'source': {'file': 'story.txt', 'chapter': 0},
             'sentences': [{'text': 'Otwieramy notatki.', 'action': 0}, {'text': 'Zapisujemy.', 'action': 2}]}]}))
        claim = {'sentence': '1.2', 'problem': 'x', 'fix': 'Nowe zdanie.'}
        adopted = iter([{'ok': False, 'problems': ['too few words']}, {'ok': True, 'problems': []}])
        with mock.patch.object(film.review, 'sheets', return_value=['chapter-1.jpg']), \
                mock.patch.object(film.review, 'check_claims', return_value=[claim]), \
                mock.patch.object(film.review, 'waits', return_value=[]), \
                mock.patch.object(film, 'meta', return_value={'addon': {}}), \
                mock.patch.object(film, 'adopt', side_effect=lambda args, **_: next(adopted)):
            result = film.review_sheets(self.args)
        self.assertEqual((self.run / 'story.txt').read_text(), original)
        self.assertEqual(result['applied'], 0)
        self.assertIn('note', result)


class StartFails(unittest.TestCase):
    def test_a_failed_start_stops_the_services_it_started(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder) / 'run'
            args = types.SimpleNamespace(repo='Acme/shop', repo_dir=None, base='v1', tag='v2', run_id=None)
            stopped = []
            with mock.patch.object(film.doctor, 'check', return_value={'ok': True}), \
                    mock.patch.object(film, 'repo_dir', return_value=Path(folder)), \
                    mock.patch.object(film.core, 'run_dir', return_value=run), \
                    mock.patch.object(film.harness, 'checkout', return_value=Path(folder)), \
                    mock.patch.object(film.core, 'addon', return_value={}), \
                    mock.patch.object(film, 'recipe_of', return_value={'config': 'playwright.config.ts'}), \
                    mock.patch.object(film.sources, 'collect', side_effect=UnicodeDecodeError('utf-8', b'\x93', 0, 1, 'bad')), \
                    mock.patch.object(film.harness, 'setup', return_value=None), \
                    mock.patch.object(film.harness, 'stop_services', side_effect=lambda r: stopped.append('services')), \
                    mock.patch.object(film.harness, 'stop_stacks', side_effect=lambda r: stopped.append('stacks')):
                with self.assertRaises(UnicodeDecodeError):
                    film.start(args)
            self.assertEqual(stopped, ['services', 'stacks'])

    def test_a_machine_without_its_tools_makes_no_run_and_says_what_to_install(self):
        lacking = {'ok': False, 'missing': [{'name': 'ffmpeg', 'why': 'the film is encoded with FFmpeg'}],
                   'install': ['brew install ffmpeg-full'], 'manual': []}
        args = types.SimpleNamespace(repo='Acme/shop', repo_dir=None, base='v1', tag='v2', run_id=None)
        with mock.patch.object(film.doctor, 'check', return_value=lacking), \
                mock.patch.object(film, 'repo_dir') as repo_dir, mock.patch.object(film.core, 'run_dir') as run_dir:
            result = film.start(args)
        repo_dir.assert_not_called()
        run_dir.assert_not_called()
        self.assertEqual((result['ok'], result['environment'], result['install']),
                         (False, 'missing tools', ['brew install ffmpeg-full']))

    def test_output_that_is_not_utf8_does_not_stop_a_command(self):
        done = film.core.sh(['printf', '\\223quoted\\224'])
        self.assertIn('quoted', done.stdout)


class GaveUp(unittest.TestCase):
    def test_a_take_its_writer_gave_up_on_is_not_narrated_by_the_stand_in(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            for gap_id in ('pr1', 'pr2', 'pr3', 'pr4', 'pr5'):
                (run / 'gaps' / gap_id).mkdir(parents=True)
                (run / 'gaps' / gap_id / 'worker.json').write_text('{}')
                (run / 'gaps' / gap_id / 'result.json').write_text(json.dumps({'ok': True, 'key': 'F1'}))
            scenes = [{'id': 'pr1', 'prs': [1], 'title': 'AI', 'result': {'ok': True, 'key': 'F1'}, 'story': None},
                      {'id': 'pr2', 'prs': [2], 'title': 'Wideo', 'result': {'ok': True, 'key': 'F2'}, 'story': None},
                      {'id': 'pr3', 'prs': [3], 'title': 'Empty widgets', 'result': {'ok': True, 'key': 'F3'},
                       'story': 'Narration written before the worker rejected the empty take.'},
                      {'id': 'pr4', 'prs': [4], 'title': 'Ocena', 'result': {'ok': True, 'key': 'F4'},
                       'story': 'Narration of the take that passed before the time ran out.'},
                      {'id': 'pr5', 'prs': [5], 'title': 'Widżet', 'result': {'ok': True, 'key': 'F5'}, 'story': None}]
            said = {'pr1': 'failed: the test stack has no AI provider, every capability shows "Disabled"',
                    'pr2': 'no answer (stopped at the time limit?)',
                    'pr3': 'failed: the take passed, but its empty widgets violate the visual requirements',
                    'pr4': 'failed: time is up', 'pr5': 'failed: time is up'}  # polishing a passed take at the limit
            narrated, merged = [], {}
            with mock.patch.object(film.gaps, 'wait_for_workers', return_value=said), \
                    mock.patch.object(film, 'scene_plan', return_value=scenes), mock.patch.object(film, 'films_of', return_value=[]), \
                    mock.patch.object(film, 'meta', return_value={'addon': {}}), mock.patch.object(film.core, 'load', return_value={}), \
                    mock.patch.object(film, 'stale', return_value=False), \
                    mock.patch.object(film.editor, 'narrate_scene', side_effect=lambda run, data, films, scene, addon: narrated.append(scene['id']) or ''), \
                    mock.patch.object(film.editor, 'adopt', side_effect=lambda run, data, films, scenes, reviewed=None: merged.update({s['id']: s['result']['ok'] for s in scenes}) or []):
                film.adopt(types.SimpleNamespace(run=str(run)), early=False)
            self.assertEqual(narrated, ['pr2', 'pr5'])  # stopped at its limit with its take: narrated by the stand-in
            # rejected takes stay out, even if narrated; a take that passed before the time ran out stays in
            self.assertEqual(merged, {'pr1': False, 'pr2': True, 'pr3': False, 'pr4': True, 'pr5': True})
            self.assertFalse(film.core.gave_up(film.core.TIME_UP))
            self.assertTrue(film.core.gave_up('failed: no AI provider'))


class Watching(unittest.TestCase):
    def test_a_watched_command_is_looked_at_while_it_runs(self):
        with tempfile.TemporaryDirectory() as folder:
            marks = []
            done = film.core.sh_watching(['sh', '-c', f'touch {folder}/one; sleep 1.5; touch {folder}/two; sleep 1.5'],
                                         lambda: marks.append(sorted(p.name for p in Path(folder).iterdir() if p.suffix != '.log')),
                                         log=Path(folder) / 'run.log', every=0.5)
            self.assertEqual(done.returncode, 0)
            self.assertIn(['one'], marks)  # seen before the command ended
            self.assertEqual(marks[-1], ['one', 'two'])


class Costs(unittest.TestCase):
    def test_the_report_adds_up_the_model_calls_and_the_scene_workers(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'usage.jsonl').write_text('\n'.join(json.dumps(line) for line in [
                {'step': 'plan', 'usd_list': 0.8}, {'step': 'chapter', 'usd_list': 0.25}, {'step': 'chapter', 'usd_list': 0.25},
                {'step': 'review', 'usd_list': None}]) + '\n')
            (run / 'gaps' / 'pr1').mkdir(parents=True)
            (run / 'gaps' / 'pr1' / 'worker.log').write_text('starting\n' + json.dumps(
                [{'type': 'system'}, {'type': 'result', 'total_cost_usd': 1.5}]) + '\n')
            (run / 'gaps' / 'pr2').mkdir()
            (run / 'gaps' / 'pr2' / 'worker.log').write_text('killed at the deadline\n')
            cost = film.costs(run)
            self.assertEqual(cost['usd_known'], 2.8)
            self.assertEqual((cost['usd'], cost['usd_scenes'], cost['usd_calls']), (None, None, None))
            self.assertEqual((cost['calls_unpriced'], cost['scenes_uncounted']), (1, 1))
            self.assertEqual(list(cost['by_step']), ['plan', 'chapter', 'review'])

    def test_a_worker_stopped_before_its_answer_is_priced_from_its_tokens(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            message = lambda n, out: {'type': 'assistant', 'message': {'id': f'm{n}', 'usage': {'input_tokens': 1000, 'output_tokens': out}}}
            stamped = lambda events: ''.join(f'{1790000000 + i:.1f} {json.dumps(e)}\n' for i, e in enumerate(events))
            (run / 'gaps' / 'pr1').mkdir(parents=True)  # answered: 2 messages, 1000 + 5 × 1800 = 10000 units for $1
            (run / 'gaps' / 'pr1' / 'worker.log').write_text(stamped([
                {'type': 'system'}, message(1, 1000), message(1, 1000), message(2, 800),
                {'type': 'result', 'total_cost_usd': 1.0, 'result': 'ok F1'}]).replace('"input_tokens": 1000, "output_tokens": 800', '"input_tokens": 0, "output_tokens": 800'))
            (run / 'gaps' / 'pr2').mkdir()  # stopped: 1000 + 5 × 1800 = 10000 units, priced as the other paid
            (run / 'gaps' / 'pr2' / 'worker.log').write_text(stamped([{'type': 'system'}, message(1, 1800)]))
            cost = film.costs(run)
            self.assertEqual((cost['usd_scenes'], cost['scenes_estimated'], cost['scenes_uncounted']), (2.0, 1, 0))
            self.assertEqual(film.core.worker_result(run / 'gaps' / 'pr1' / 'worker.log')['result'], 'ok F1')
            self.assertEqual(film.core.worker_result(run / 'gaps' / 'pr2' / 'worker.log'), {})
            events = film.core.worker_events(run / 'gaps' / 'pr2' / 'worker.log')
            self.assertEqual([t for t, _ in events], [1790000000.0, 1790000001.0])



class StandIns(unittest.TestCase):
    def test_a_stopped_workers_filmed_scene_is_narrated_and_checked_at_once(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'sources.json').write_text(json.dumps({'prs': []}))
            (run / 'gaps.txt').write_text('# gap | pr1 | 1 | Limit | proof: "12h" | base: e2e/a.spec.ts | show: s\n')
            (run / 'gaps' / 'pr1').mkdir(parents=True)
            (run / 'gaps' / 'pr1' / 'worker.json').write_text('{}')
            (run / 'gaps' / 'pr1' / 'result.json').write_text(json.dumps({'ok': True, 'key': 'F9', 'since': 1.0}))
            checked, narrated = [], []

            def wait(run_folder, on_done=None, on_stopped=None):
                on_stopped('pr1')  # killed at its limit, filmed but not narrated
                return {'pr1': 'no answer (stopped at the time limit?)'}

            def narrate(run_folder, data, films, scene, addon=None):
                narrated.append(scene['id'])
                return '# chapter F9 | 1 | Limit\n0 | Limit działa.\n'
            with mock.patch.object(film, 'meta', lambda r: {'addon': {}}), \
                    mock.patch.object(film.gaps, 'wait_for_workers', wait), \
                    mock.patch.object(film.editor, 'narrate_scene', narrate), \
                    mock.patch.object(film.editor, 'adopt', lambda *a, **k: []), \
                    mock.patch.object(film.review, 'early_check', lambda run_folder, gap, keys: checked.append(gap)), \
                    mock.patch.object(film.llm, 'capabilities', lambda provider=None: {'review': True, 'workers': True}), \
                    mock.patch.object(film.core, 'mark', lambda *a, **k: None):
                result = film.adopt(types.SimpleNamespace(run=str(run)))
            film.EARLY.clear()
            self.assertTrue(result['ok'])
            self.assertEqual(narrated, ['pr1'])  # once: at the kill, not again after the wait
            self.assertTrue((run / 'gaps' / 'pr1' / 'story.standin').exists())
            self.assertEqual(checked, ['pr1'])

    def test_a_narration_older_than_its_take_is_stale(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'story.txt').write_text('# chapter F9 | 1 | Limit\n')
            written = (Path(folder) / 'story.txt').stat().st_mtime
            self.assertTrue(film.stale({'folder': folder, 'result': {'ok': True, 'since': written + 5}}))
            self.assertFalse(film.stale({'folder': folder, 'result': {'ok': True, 'since': written - 5}}))
            self.assertFalse(film.stale({'folder': folder, 'result': {'ok': True}}))  # a take from before `since` was kept


class LateStandIns(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.run = run = Path(self.folder.name)
        (run / 'sources.json').write_text(json.dumps({'prs': []}))
        (run / 'gaps.txt').write_text('# gap | pr1 | 1 | Limit | proof: "12h" | base: e2e/a.spec.ts | show: s\n')
        (run / 'gaps' / 'pr1').mkdir(parents=True)
        (run / 'gaps' / 'pr1' / 'worker.json').write_text('{}')
        (run / 'gaps' / 'pr1' / 'result.json').write_text(json.dumps({'ok': True, 'key': 'F9', 'since': 1.0}))

    def test_a_stand_in_late_for_adopt_never_changes_the_narration_adopt_wrote(self):
        release, calls = threading.Event(), []

        def wait(run_folder, on_done=None, on_stopped=None):
            on_stopped('pr1')  # killed at its limit, filmed but not narrated
            return {'pr1': 'no answer (stopped at the time limit?)'}

        def narrate(run_folder, data, films, scene, addon=None):
            calls.append(scene['id'])
            if len(calls) == 1:  # the stand-in: its answer comes after adopt stopped waiting for it
                release.wait(10)
                return '# chapter F9 | 1 | Late\n0 | Za późno.\n'
            return '# chapter F9 | 1 | Adopt\n0 | Na czas.\n'
        with mock.patch.object(film, 'meta', lambda r: {'addon': {}}), \
                mock.patch.object(film.gaps, 'wait_for_workers', wait), \
                mock.patch.object(film.editor, 'narrate_scene', narrate), \
                mock.patch.object(film.editor, 'RESERVE_TIMEOUT', -119.7), \
                mock.patch.object(film.editor, 'adopt', lambda *a, **k: []), \
                mock.patch.object(film.llm, 'capabilities', lambda provider=None: {'review': False, 'workers': True}), \
                mock.patch.object(film.core, 'mark', lambda *a, **k: None):
            self.assertTrue(film.adopt(types.SimpleNamespace(run=str(self.run)))['ok'])
            release.set()
            time.sleep(0.5)  # the stand-in ends now
        self.assertEqual(calls, ['pr1', 'pr1'])
        self.assertEqual((self.run / 'gaps' / 'pr1' / 'story.txt').read_text(), '# chapter F9 | 1 | Adopt\n0 | Na czas.\n')

    def test_the_reviews_adopt_narrates_no_scene_and_keeps_the_chapters_it_checked(self):
        adopted = {}
        with mock.patch.object(film, 'meta', lambda r: {'addon': {}}), \
                mock.patch.object(film.gaps, 'wait_for_workers', lambda run, on_done=None, on_stopped=None: {}), \
                mock.patch.object(film.editor, 'narrate_scene') as narrate, \
                mock.patch.object(film.editor, 'adopt', lambda *a, **k: adopted.update(k) or []), \
                mock.patch.object(film.core, 'mark', lambda *a, **k: None):
            film.adopt(types.SimpleNamespace(run=str(self.run)), early=False, reviewed={('gaps/pr2/story.txt', 0, None)})
        narrate.assert_not_called()  # a narration written now would go unchecked
        self.assertEqual(adopted['reviewed'], {('gaps/pr2/story.txt', 0, None)})
        self.assertFalse((self.run / 'gaps' / 'pr1' / 'story.txt').exists())


class Failures(unittest.TestCase):
    def test_stop_ends_a_scene_choice_still_running_and_nothing_else(self):
        with tempfile.TemporaryDirectory() as folder:
            real = subprocess.Popen
            with mock.patch.object(film.subprocess, 'Popen', lambda *a, **k: real(['sleep', '60'], start_new_session=True)):
                film.background(folder, 'choose', 'choose.log')  # a choice still waiting for its model's answer
            choice = json.loads((Path(folder) / 'choose.json').read_text())
            self.assertTrue(film.core.still_running(choice))
            self.assertTrue(film.stop_choice(folder))
            os.waitpid(choice['pid'], 0)
            self.assertFalse(film.core.still_running(choice))
            self.assertFalse(film.stop_choice(folder))  # ended: nothing to stop, and never a process with its pid now
        self.assertFalse(film.stop_choice('/nowhere'))

    def test_cleanup_attempts_each_owned_resource_after_one_stop_fails(self):
        args = types.SimpleNamespace(run='/nowhere', keep_checkout=True)
        with mock.patch.object(film.gaps, 'stop_workers', side_effect=RuntimeError('worker cleanup failed')) as workers, \
                mock.patch.object(film.harness, 'stop_keeper') as keeper, \
                mock.patch.object(film.harness, 'stop_services') as services, \
                mock.patch.object(film.harness, 'stop_stacks') as stacks:
            with self.assertRaisesRegex(RuntimeError, 'worker cleanup failed'):
                film.stop(args)
        for action in (workers, keeper, services, stacks):
            action.assert_called_once_with('/nowhere')

    def test_a_failing_finish_stops_the_services_and_keeps_the_checkout(self):
        args = types.SimpleNamespace(run='/nowhere')
        stopped = []
        adopted = {'ok': True, 'scenes': []}
        with mock.patch.object(film, 'adopt', lambda a: adopted), \
                mock.patch.object(film, 'review_sheets', mock.Mock(side_effect=RuntimeError('render broke'))), \
                mock.patch.object(film, 'stop', lambda a: stopped.append(a.keep_checkout)), \
                mock.patch('sys.stderr'):
            with self.assertRaisesRegex(RuntimeError, 'render broke'):
                film.finish(args)
        self.assertEqual(stopped, [True])
        self.assertFalse(args.keep_checkout)

    def test_a_story_to_fix_stops_services_and_preserves_checkout(self):
        args = types.SimpleNamespace(run='/nowhere')
        kept = []
        with mock.patch.object(film, 'adopt', lambda a: {'ok': False, 'problems': ['x']}), \
                mock.patch.object(film, 'stop', side_effect=lambda a: kept.append(a.keep_checkout)):
            self.assertFalse(film.finish(args)['ok'])
        self.assertEqual(kept, [True])
        self.assertFalse(args.keep_checkout)

    def test_an_interrupt_stops_services_and_restores_checkout_preference(self):
        args = types.SimpleNamespace(run='/nowhere', keep_checkout=False)
        kept = []
        with mock.patch.object(film, 'adopt', side_effect=KeyboardInterrupt), \
                mock.patch.object(film, 'stop', side_effect=lambda a: kept.append(a.keep_checkout)), \
                mock.patch('sys.stderr'):
            with self.assertRaises(KeyboardInterrupt):
                film.finish(args)
        self.assertEqual(kept, [True])
        self.assertFalse(args.keep_checkout)

    def test_cleanup_error_preserves_original_error_and_checkout_preference(self):
        args = types.SimpleNamespace(run='/nowhere', keep_checkout=False)
        with mock.patch.object(film, 'adopt', side_effect=RuntimeError('original failure')), \
                mock.patch.object(film, 'stop', side_effect=RuntimeError('cleanup failure')), mock.patch('sys.stderr'):
            with self.assertRaisesRegex(RuntimeError, 'original failure'):
                film.finish(args)
        self.assertFalse(args.keep_checkout)

    def test_a_recut_goes_elsewhere_than_the_run(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder) / 'run'
            run.mkdir()
            (run / 'story.json').write_text(json.dumps({'chapters': []}))
            (run / 'sources.json').write_text(json.dumps({'prs': []}))
            with mock.patch.object(film, 'meta', lambda r: {'addon': {}}), \
                    mock.patch.object(film.cut, 'make', mock.Mock(return_value={'seconds': 1})) as make:
                with self.assertRaises(SystemExit):
                    film.recut(types.SimpleNamespace(run=str(run), out=str(run), jobs=2))
                film.recut(types.SimpleNamespace(run=str(run), out=str(Path(folder) / 'again'), jobs=2))
            self.assertEqual(make.call_args.kwargs['out'], (Path(folder) / 'again').resolve())


class Page(unittest.TestCase):
    def test_in_ci_the_page_is_written_and_no_server_outlives_the_job(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'public').mkdir()
            args = types.SimpleNamespace(run=str(run))
            with mock.patch.object(film.page, 'build', return_value=run / 'public'), \
                    mock.patch.object(film.page, 'serve', return_value='http://127.0.0.1:1/') as serve:
                with mock.patch.dict(os.environ, {'RELEASE_FILM_CI': '1'}):
                    self.assertEqual(film.preview(args)['url'], None)
                serve.assert_not_called()
                with mock.patch.dict(os.environ, {'RELEASE_FILM_CI': '0'}):
                    self.assertEqual(film.preview(args)['url'], 'http://127.0.0.1:1/')  # locally served as before


class AutomatedRun(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.run = Path(folder.name)
        self.args = types.SimpleNamespace(run=str(self.run), provider=None, learn='off')
        (self.run / 'film').mkdir()
        (self.run / 'film' / 'demo.mp4').write_bytes(b'fixture')
        self.scenes = {'ok': True, 'scenes': [{'id': 'pr1'}], 'workers': True}
        self.finished = {'ok': True, 'scenes': [{'id': 'pr1', 'filmed': True, 'narrated': True}]}
        self.patched = {}
        for name, result in [('start', {'run': str(self.run), 'environment': 'ready'}),
                             ('gap_scenes', self.scenes), ('capture', {}), ('write', {}),
                             ('finish', self.finished), ('stop', {})]:
            patch = mock.patch.object(film, name, return_value=result)
            self.patched[name] = patch.start()
            self.addCleanup(patch.stop)
        patch = mock.patch.object(film.llm, 'capabilities', return_value={'text': True, 'workers': True, 'review': True})
        self.capabilities = patch.start()
        self.addCleanup(patch.stop)
        patch = mock.patch.object(film.llm, 'signed_in', return_value=True)
        self.signed_in = patch.start()
        self.addCleanup(patch.stop)

    def test_complete_reviewed_film_succeeds(self):
        self.assertTrue(film.run_all(self.args)['ok'])
        self.patched['finish'].assert_called_once()

    def test_missing_capability_is_rejected_before_starting_services(self):
        for missing in ('workers', 'review', 'text'):
            with self.subTest(missing=missing):
                self.capabilities.return_value = {name: name != missing for name in ('workers', 'review', 'text')}
                self.assertFalse(film.run_all(self.args)['ok'])
        self.patched['start'].assert_not_called()

    def test_a_cli_without_credentials_is_rejected_before_starting_services(self):
        self.signed_in.return_value = False
        with mock.patch.object(film.llm, 'choose', return_value='cli'):
            result = film.run_all(self.args)
        self.assertFalse(result['ok'])
        self.assertIn('claude auth status', result['error'])
        self.patched['start'].assert_not_called()

    def test_invalid_or_empty_scene_plan_stops_before_capture(self):
        for scenes in ({'ok': False, 'problems': ['invalid']}, {'ok': True, 'scenes': [], 'workers': True},
                       {'ok': True, 'scenes': [{'id': 'pr1'}], 'workers': False}):
            with self.subTest(scenes=scenes):
                self.patched['gap_scenes'].return_value = scenes
                self.assertFalse(film.run_all(self.args)['ok'])
        self.assertEqual(self.patched['stop'].call_count, 3)
        self.patched['capture'].assert_not_called()

    def test_existing_video_never_hides_incomplete_finish(self):
        for finished in ({'ok': False}, dict(self.finished, degraded={'review': 'unavailable'}),
                         {'ok': True, 'scenes': []}, {'ok': True, 'scenes': [{'filmed': True, 'narrated': False}]}):
            with self.subTest(finished=finished):
                self.patched['finish'].return_value = finished
                self.assertFalse(film.run_all(self.args)['ok'])
        self.assertEqual(self.patched['stop'].call_count, 4)

    def test_missing_video_is_a_failure(self):
        (self.run / 'film' / 'demo.mp4').unlink()
        self.assertFalse(film.run_all(self.args)['ok'])
        self.patched['stop'].assert_called_once()

    def test_cli_returns_nonzero_without_required_models(self):
        result = subprocess.run([sys.executable, '-B', str(Path(film.__file__)), 'run', '--repo', 'example/app', '--tag', 'v1'],
                                env=dict(os.environ, RELEASE_FILM_LLM='agent'), text=True, capture_output=True, timeout=15)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(json.loads(result.stdout)['ok'])


if __name__ == '__main__':
    unittest.main()
