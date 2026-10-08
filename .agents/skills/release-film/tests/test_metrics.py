"""What a film and its run measure: captions over the next picture, proofs, frozen pictures, scenes and their cost."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import metrics  # noqa: E402


def film(**extra):
    """A 20 s chapter: sentence 1 pinned to a click at 2 s, sentence 2 to a click at 12 s, a step no sentence names
    at 8 s between them; the pointer glides before each click."""
    base = {'duration': 20.0, 'sentences': [0.0, 10.0], 'silences': [],
            'anchors': [{'step': 0, 'beat': 1, 'action': 2.0, 'late': 0.0},
                        {'step': 2, 'beat': 2, 'action': 12.0, 'late': 0.8}],
            'actions': [{'step': 0, 't': 2.0, 't_pre': 2.0}, {'step': 1, 't': 8.0, 't_pre': 8.0},
                        {'step': 2, 't': 12.0, 't_pre': 12.0}, {'step': 3, 't': 15.0, 'look': True}],
            'pointer': {'moves': [[1.5, 2.0, 0, 0, 1, 1], [7.5, 8.0, 1, 1, 2, 2], [11.5, 12.0, 2, 2, 3, 3]]},
            'pieces': [(0.0, 20.0, 0.0)]}
    base.update(extra)
    return base


class Chapter(unittest.TestCase):
    def test_a_caption_held_past_the_next_change_is_counted_by_what_the_picture_moved_to(self):
        captions = [{'start': 0.2, 'end': 9.0, 'text': 'one'},  # sentence 1, over the unnamed step at 8 s by 1 s
                    {'start': 10.0, 'end': 19.0, 'text': 'two'}]  # sentence 2: nothing changes after its click
        found = metrics.chapter(film(), [{'start': 0.0, 'end': None, 'crop': None}], captions, {'active': []})
        # over the unnamed step only: informative (the sentence usually says it), not a caption behind its picture
        self.assertEqual((found['caption_over_chain_s'], found['caption_over_next_s'], found['captions_over']), (1.0, 0.0, 0))
        next_only = film(actions=[a for a in film()['actions'] if a['step'] != 1])
        captions[0]['end'] = 12.5  # held over the next sentence's own click
        found = metrics.chapter(next_only, [{'start': 0.0, 'end': None, 'crop': None}], captions, {'active': []})
        self.assertEqual((found['caption_over_next_s'], found['caption_over_chain_s'], found['captions_over']), (0.5, 0.0, 1))

    def test_proof_frozen_pictures_wide_shots_and_waits(self):
        spans = [{'start': 0.0, 'end': 5.0, 'crop': None}, {'start': 5.0, 'end': 6.0, 'from': None, 'to': [0, 0, 800, 450]},
                 {'start': 6.0, 'end': None, 'crop': [0, 0, 800, 450]}]
        found = metrics.chapter(film(silences=[(9.0, 1.5)]), spans, [], {'active': [(3.0, 4.0)]})
        self.assertEqual(found['proof_hold_s'], 8.0)  # the last pinned click at 12 s, the chapter ends at 20 s
        self.assertEqual(found['wide_share'], 0.25)
        self.assertEqual(found['narration_waits_s'], 1.5)
        self.assertEqual(found['late_beats'], 1)
        # moving: page 3–4, glides 1.5–2, 7.5–8, 11.5–12, the camera 5–6; still at the end from 12 s to 20 s
        self.assertEqual(found['frozen_max_s'], 8.0)
        self.assertEqual(found['frozen_s'], 8.0)

    def test_empty_states_count_from_the_action_that_left_them(self):
        capture = {'active': [], 'steps': [{'step': 0, 'empty': [], 'shows_empty': []},
                                           {'step': 1, 'shows_empty': ['No notes yet']}, {'step': 2, 'shows_empty': []},
                                           {'step': 3, 'shows_empty': ['3 values read 0']}]}
        found = metrics.chapter(film(), [{'start': 0.0, 'end': None, 'crop': None}], [], capture)
        self.assertEqual(found['empty_state_s'], (12.0 - 8.0) + (20.0 - 15.0))  # step 1 at 8 s, step 3 (a look) at 15 s
        self.assertTrue(found['ends_empty'])
        total = metrics.summary([found])
        self.assertEqual((total['ends_empty'], total['empty_share']), (1, 0.45))

    def test_missing_probe_is_unknown_and_an_explicit_clean_probe_is_zero(self):
        spans = [{'start': 0.0, 'end': None, 'crop': None}]
        old = metrics.chapter(film(), spans, [], {'steps': [{'step': n} for n in range(4)]})
        self.assertIsNone(old['empty_state_s'])
        self.assertIsNone(old['ends_empty'])
        self.assertEqual(old['empty_probe_coverage'], 0.0)
        clean = metrics.chapter(film(), spans, [], {'steps': [
            {'step': n, 'empty': [], 'shows_empty': []} for n in range(4)]})
        self.assertEqual((clean['empty_state_s'], clean['ends_empty'], clean['empty_probe_coverage']), (0.0, False, 1.0))
        # A mixed film must not turn unknown chapters into a passing 0% empty-state result.
        summary = metrics.summary([clean, old])
        self.assertIsNone(summary['empty_share'])
        self.assertIsNone(summary['empty_state_s'])
        self.assertIsNone(summary['ends_empty'])
        self.assertEqual(summary['empty_probe_coverage'], 0.5)

    def test_partial_probe_and_pdf_keep_unknown_seconds_separate(self):
        capture = {'steps': [{'step': 0}, {'step': 1, 'shows_empty': ['No notes yet']},
                             {'step': 2}, {'step': 3, 'shows_empty': []}]}
        partial = metrics.chapter(film(), [], [], capture)
        self.assertEqual((partial['empty_state_observed_s'], partial['empty_probe_s']), (4.0, 9.0))
        self.assertIsNone(partial['empty_state_s'])
        self.assertFalse(partial['ends_empty'])
        inserted = metrics.chapter(film(insert_from=13.0), [], [], capture)
        self.assertEqual(inserted['empty_probe_s'], 4.0)
        self.assertIsNone(inserted['ends_empty'])

    def test_the_film_adds_up_its_chapters(self):
        one = metrics.chapter(film(), [{'start': 0.0, 'end': None, 'crop': None}],
                              [{'start': 0.2, 'end': 9.0, 'text': 'one'}], {'active': []})
        two = dict(one, proof_hold_s=3.0, seconds=10.0, wide_share=0.0)
        total = metrics.summary([one, two])
        self.assertEqual(total['seconds'], 34.0)  # and a 2 s card per chapter
        self.assertEqual((total['caption_over_s'], total['proof_hold_min_s'], total['proof_held_share']), (2.0, 3.0, 0.5))
        self.assertAlmostEqual(total['wide_share'], 20 / 30, places=3)


def stamped(events):
    return ''.join(f'{1790000000 + i:.1f} {json.dumps(e)}\n' for i, e in enumerate(events))


class Scenes(unittest.TestCase):
    def test_scenes_tries_denials_stand_ins_and_the_cost_of_what_the_film_left_out(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            message = lambda n, tokens: {'type': 'assistant', 'message': {
                'id': f'm{n}', 'usage': {'input_tokens': tokens, 'output_tokens': 1},
                'content': [{'type': 'tool_use', 'id': f't{n}', 'name': 'Write',
                             'input': {'file_path': f'{folder}/gaps/pr1/story.txt'}}] if n == 2 else []}}
            denied = {'type': 'user', 'message': {'content': [{'type': 'tool_result', 'tool_use_id': 'x', 'is_error': True,
                                                               'content': 'Permission for this tool use was denied.'}]}}
            for gap, ok in (('pr1', True), ('pr2', False), ('pr3', True)):
                (run / 'gaps' / gap).mkdir(parents=True)
                (run / 'gaps' / gap / 'gap.json').write_text('{}')
                (run / 'gaps' / gap / 'result.json').write_text(json.dumps({'ok': ok}))
            (run / 'gaps' / 'pr1' / 'worker.log').write_text(stamped([
                message(1, 1000), message(2, 1000), {'type': 'result', 'total_cost_usd': 3.0,
                                                     'usage': {'output_tokens': 1000}}]))
            (run / 'gaps' / 'pr2' / 'worker.log').write_text(stamped([message(1, 1000), denied]))  # stopped at its limit
            (run / 'gaps' / 'pr3' / 'worker.log').write_text(stamped([
                message(1, 500), {'type': 'result', 'total_cost_usd': 1.0, 'usage': {'output_tokens': 100}}]))
            (run / 'gaps' / 'pr3' / 'story.txt').write_text('# scene')
            (run / 'gaps' / 'pr3' / 'story.standin').touch()  # narrated by the chapter writer
            (run / 'captures.json').write_text(json.dumps({'batches': {
                'g01': {'results': [{'file': 'e2e/demo--rf-pr1.spec.ts', 'status': 'failed'},
                                    {'file': 'e2e/demo--rf-pr3.spec.ts', 'status': 'passed'}]},
                'g02': {'results': [{'file': 'e2e/demo--rf-pr1.spec.ts', 'status': 'passed'}]}}}))
            story = {'chapters': [{'source': {'file': 'gaps/pr1/story.txt'}}, {'source': {'file': 'story.txt'}}]}
            found = metrics.scenes(run, story)
            rows = {r['id']: r for r in found['scenes']}
            self.assertEqual((found['chosen'], found['passed'], found['in_film'], found['first_try']), (3, 2, 1, 1))
            self.assertEqual((rows['pr1']['tries'], rows['pr1']['first_try'], rows['pr1']['stand_in']), (2, False, False))
            self.assertEqual((rows['pr3']['stand_in'], found['stand_ins'], found['denied']), (True, 1, 1))
            # pr2 stopped: 1000 input + 5 × max(1 streamed, 1100 / 3 per message) units at the $4 / 7000 units paid
            self.assertAlmostEqual(rows['pr2']['usd'], 4.0 / (2000 + 500 + 5 * 1100) * (1000 + 5 * 1100 / 3), places=2)
            self.assertEqual(found['usd_wasted'], round(rows['pr2']['usd'] + 1.0, 2))  # pr2 and pr3: not in the film




class Seat(unittest.TestCase):
    def test_the_subscription_used_by_the_scene_workers_is_read_from_their_limit_reports(self):
        def report(moment, five_hour, week):
            info = {'status': 'allowed', 'unifiedWindows': {'five_hour': {'utilization': five_hour, 'resetsAt': 9000},
                                                            'seven_day': {'utilization': week, 'resetsAt': 90000}}}
            return f"{moment} {json.dumps({'type': 'rate_limit_event', 'rate_limit_info': info})}"
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            self.assertEqual(metrics.seat_usage(run), {})  # no worker reported one
            for gap, lines in (('pr1', [report(100.0, 0.04, 0.23), '101.0 {"type": "assistant"}', report(300.0, 0.06, 0.23)]),
                               ('pr2', [report(150.0, 0.05, 0.23), report(300.0, 0.06, 0.23),  # two workers at one moment
                                        report(420.0, 0.07, 0.24)])):
                (run / 'gaps' / gap).mkdir(parents=True)
                (run / 'gaps' / gap / 'worker.log').write_text('\n'.join(lines) + '\n')
            self.assertEqual(metrics.seat_usage(run), {'five_hour': {'from': 0.04, 'to': 0.07, 'resets_at': 9000},
                                                       'seven_day': {'from': 0.23, 'to': 0.24, 'resets_at': 90000}})


if __name__ == '__main__':
    unittest.main()
