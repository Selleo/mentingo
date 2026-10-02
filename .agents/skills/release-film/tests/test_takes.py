"""Takes: a Playwright capture (frames, stills, actions) becomes a wall-clock video and a montage record."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import unittest.mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import core  # noqa: E402
import takes  # noqa: E402

FFMPEG = os.environ.get('DEMO_FFMPEG') or core.tool('ffmpeg', home=False)


def image(path, size, color, box=False):
    draw = ',drawbox=x=100:y=100:w=400:h=200:color=black:t=fill' if box else ''
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c={color}:s={size}:d=1', '-frames:v', '1',
                    '-vf', f'format=yuv420p{draw}', str(path)], check=True)


class Convert(unittest.TestCase):
    def test_a_take_is_as_large_as_its_stills_whatever_the_device_scale(self):
        # RELEASE_FILM_CI_DEVICE_SCALE=1: stills of 1600x900; frames scaled to 2400x1350 cut the concat of the take short
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            (folder / 'frames').mkdir()
            (folder / 'stills').mkdir()
            t0 = 1_790_000_000_000
            image(folder / 'frames/p0-000000.jpg', '1600x900', 'white')
            image(folder / 'frames/p0-000001.jpg', '1600x900', 'white', box=True)
            image(folder / 'stills/a0000.jpg', '1600x900', 'white', box=True)
            (folder / 'frames.json').write_text(json.dumps([{'file': 'frames/p0-000000.jpg', 't': t0, 'page': 0},
                                                           {'file': 'frames/p0-000001.jpg', 't': t0 + 500, 'page': 0}]))
            (folder / 'actions.json').write_text(json.dumps([{
                'id': 0, 'kind': 'click', 'target': "getByRole('button', { name: 'Save' })", 'url': 'http://app/x',
                'page': 0, 'm': t0 + 1500, 'a': t0 + 1550, 'still': 'stills/a0000.jpg', 'still_t': t0 + 1400}]))
            (folder / 'page-log.json').write_text(json.dumps({'start': t0, 'end': t0 + 2000,
                                                             'viewport': {'width': 1600, 'height': 900},
                                                             'status': 'passed', 'title': 't', 'pages': [{'page': 0}]}))
            takes.convert(folder, FFMPEG)
            probe = json.loads(subprocess.run([core.tool('ffprobe', home=False) or 'ffprobe', '-v', 'error', '-count_frames',
                                               '-show_entries', 'stream=width,height,nb_read_frames', '-of', 'json',
                                               str(folder / 'take.mp4')], capture_output=True, text=True, check=True).stdout)
            stream = probe['streams'][0]
            self.assertEqual((stream['width'], stream['height']), (1600, 900))
            self.assertAlmostEqual(int(stream['nb_read_frames']), 60, delta=2)  # the whole 2 s, not cut at the still
            self.assertEqual(json.loads((folder / 'capture.json').read_text())['scale'], 1.0)

    def test_frames_and_stills_become_a_timed_take(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            (folder / 'frames').mkdir()
            (folder / 'stills').mkdir()
            t0 = 1_790_000_000_000
            # the page paints at 0 s and 0.5 s (a box appears), stands still, then the still before the action
            image(folder / 'frames/p0-000000.jpg', '1600x900', 'white')
            image(folder / 'frames/p0-000001.jpg', '1600x900', 'white', box=True)
            image(folder / 'stills/a0000.jpg', '2400x1350', 'white', box=True)
            (folder / 'frames.json').write_text(json.dumps([{'file': 'frames/p0-000000.jpg', 't': t0, 'page': 0},
                                                           {'file': 'frames/p0-000001.jpg', 't': t0 + 500, 'page': 0}]))
            action = {'id': 0, 'kind': 'click', 'target': "getByRole('button', { name: 'Save' })", 'url': 'http://app/x',
                      'page': 0, 'm': t0 + 1500, 'a': t0 + 1550, 'box': {'x': 100, 'y': 100, 'width': 400, 'height': 200},
                      'still': 'stills/a0000.jpg', 'still_t': t0 + 1400,
                      'pre': {'t': t0 + 1450, 'target': {'x': 100, 'y': 100, 'width': 400, 'height': 200}, 'changes': [[t0 + 600, 1, 2, 3, 4]]}}
            (folder / 'actions.json').write_text(json.dumps([action]))
            (folder / 'page-log.json').write_text(json.dumps({'start': t0, 'end': t0 + 2000, 'viewport': {'width': 1600, 'height': 900},
                                                             'status': 'passed', 'title': 'Team › saves', 'pages': [
                {'page': 0, 'loading': [[t0 + 100, t0 + 300]], 'routes': [[t0, '/x']], 'ambient': []}]}))
            summary = takes.convert(folder, FFMPEG)
            self.assertEqual(summary['steps'], 1)
            probe = json.loads(subprocess.run([core.tool('ffprobe', home=False) or 'ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                                               'stream=width,height,nb_read_frames', '-of', 'json', str(folder / 'take.mp4')],
                                              capture_output=True, text=True, check=True).stdout)['streams'][0]
            self.assertEqual((probe['width'], probe['height']), (2400, 1350))
            self.assertAlmostEqual(int(probe['nb_read_frames']), 60, delta=2)  # 2 s on the wall clock at 30 fps
            record = json.loads((folder / 'capture.json').read_text())
            step = record['steps'][0]
            self.assertEqual((step['m'], step['a'], step['point'], step['click']), (1.5, 1.55, [300.0, 200.0], True))
            self.assertEqual(record['loading'], [[0.1, 0.3]])
            self.assertEqual(record['stills'], [1.4])
            self.assertNotIn('changes', step['pre'])  # moved to the record's change list, in capture seconds
            self.assertEqual(record['changes'], [[0.6, 1, 2, 3, 4]])
            self.assertTrue(any(a <= 0.5 <= b for a, b in record['active']))  # the box appearing is page motion
            # two conversions at once (a scene's early check and the review's pauses): the second waits, finds the take
            import threading
            (folder / 'take.mp4').unlink()
            made = []
            real = takes._convert
            with unittest.mock.patch.object(takes, '_convert', side_effect=lambda *a: made.append(1) or real(*a)):
                runs = [threading.Thread(target=takes.convert, args=(folder, FFMPEG)) for _ in range(2)]
                for run in runs:
                    run.start()
                for run in runs:
                    run.join()
            self.assertEqual(made, [1])
            self.assertTrue(takes.converted(folder))
            self.assertIn('0 click', record['actions_text'][0])

    def test_checks_values_and_screen_text_reach_the_writer(self):
        t0 = 1_000_000
        actions = [
            {'id': 0, 'kind': 'fill', 'target': "getByLabel('Note')", 'value': 'Hello', 'url': 'http://app/notes', 'page': 0,
             'm': t0 + 100, 'a': t0 + 200, 'box': {'x': 0, 'y': 0, 'width': 10, 'height': 10}, 'still_t': t0 + 90,
             'text': {'headings': ['Notes']}},
            {'id': 1, 'kind': 'click', 'target': "getByRole('button', { name: 'Save' })", 'url': 'http://app/notes', 'page': 0,
             'm': t0 + 300, 'a': t0 + 400, 'box': {'x': 0, 'y': 0, 'width': 10, 'height': 10}, 'still_t': t0 + 290,
             'text': {'headings': ['Notes']}},
            {'id': 2, 'kind': 'look', 'target': "getByText('Saved')", 'url': 'http://app/notes', 'page': 0,
             'm': t0 + 410, 'a': t0 + 900, 'box': {'x': 0, 'y': 0, 'width': 10, 'height': 10}, 'still_t': t0 + 910,
             'expect': {'expression': 'to.be.visible', 'expected': [], 'not': False}, 'text': {'headings': ['Notes'], 'toasts': ['Saved']}},
            {'id': 3, 'kind': 'click', 'target': "getByRole('link', { name: 'Back' })", 'url': 'http://app/notes', 'page': 0,
             'm': t0 + 1500, 'a': t0 + 1600, 'box': None, 'still_t': t0 + 1490}]
        record = takes.capture_record('/tmp/x', t0, t0 + 2000, actions, [], {})
        look = record['steps'][2]
        self.assertEqual((look['acting'], look['look'], look['click'], look['point']), (False, True, False, None))
        self.assertEqual(record['steps'][1]['b'], 1.49)  # the page's answer to Save lasts until the next action
        text = record['actions_text']
        self.assertIn('0 fill getByLabel(\'Note\') = "Hello"', text[0])
        self.assertIn('on screen: headings "Notes"', text[0])
        self.assertNotIn('on screen', text[1])  # the same headings: said once
        self.assertIn('2 look be visible: getByText(\'Saved\')', text[2])
        self.assertIn('toasts "Saved"', text[2])
        self.assertNotIn('toast', record['steps'][1])  # a message without its place on the page
        actions[2]['text']['toastBox'] = {'x': 1300, 'y': 20, 'width': 280, 'height': 60}
        record = takes.capture_record('/tmp/x', t0, t0 + 2000, actions, [], {})
        self.assertEqual(record['steps'][1]['toast'], {'x': 1300, 'y': 20, 'width': 280, 'height': 60})  # Save brought it up
        self.assertNotIn('toast', record['steps'][0])  # the check after Save reads it, not the fill before
        actions[3].update(target="getByTestId('back-link')", text={'target': 'Back to notes'})
        self.assertIn('[text "Back to notes"]', takes.action_line(actions[3]))
        # a phone-size view ends the film: the frames would change shape
        resized = actions[:2] + [{'id': 2, 'kind': 'setViewportSize', 'target': '{"width":390,"height":844}', 'url': 'http://app/notes',
                                  'page': 0, 'm': t0 + 800, 'a': t0 + 850, 'box': None}] + actions[3:]
        record = takes.capture_record('/tmp/x', t0, t0 + 2000, resized, [], {})
        self.assertEqual((len(record['steps']), record['end'], len(record['actions_text'])), (2, 0.8, 2))


    def test_final_probe_of_a_closed_context_retains_clean_and_empty_readings(self):
        action = {'id': 0, 'kind': 'look', 'target': 'result', 'page': 6, 'm': 1100, 'a': 1200,
                  'text': {'empty': []}}
        for reading in ([], ['No courses yet'], None):
            with self.subTest(reading=reading):
                page = {'page': 6, 'closed': True, 'text': {'empty': reading} if reading is not None else {}}
                record = takes.capture_record('/tmp/x', 1000, 1500, [action], [page], {})
                self.assertEqual(record['steps'][0]['empty'], [])
                self.assertEqual(record['steps'][0]['shows_empty'], reading)

    def test_a_step_leaves_the_state_of_its_own_window(self):
        # the admin's saved list (window 1), then the learner's window opens on its empty landing page: the admin's
        # last check leaves the list, not the learner's landing page
        actions = [{'id': 0, 'kind': 'look', 'target': 'list', 'page': 1, 'm': 1100, 'a': 1200, 'text': {'empty': []}},
                   {'id': 1, 'kind': 'goto', 'target': '/notifications', 'page': 2, 'm': 1300, 'a': 1400,
                    'text': {'empty': ['We could not find any courses']}},
                   {'id': 2, 'kind': 'look', 'target': 'card', 'page': 2, 'm': 1500, 'a': 1600, 'text': {'empty': []}}]
        pages = [{'page': 1, 'text': {'empty': []}}, {'page': 2, 'text': {'empty': []}}]
        record = takes.capture_record('/tmp/x', 1000, 1800, actions, pages, {})
        self.assertEqual([s['shows_empty'] for s in record['steps']], [[], [], []])
        del pages[0]['text']  # a window whose end is unknown: the next action's reading, as before
        record = takes.capture_record('/tmp/x', 1000, 1800, actions, pages, {})
        self.assertEqual(record['steps'][0]['shows_empty'], ['We could not find any courses'])

    def test_records_without_video_for_the_editor(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            (folder / 'frames').mkdir()
            image(folder / 'frames/p0-000000.jpg', '1600x900', 'white')
            (folder / 'frames.json').write_text(json.dumps([{'file': 'frames/p0-000000.jpg', 't': 1000, 'page': 0}]))
            (folder / 'actions.json').write_text(json.dumps([{'id': 0, 'kind': 'goto', 'target': 'http://app/', 'url': '',
                                                             'page': 0, 'm': 1000, 'a': 1200, 'box': None}]))
            (folder / 'page-log.json').write_text(json.dumps({'end': 1500, 'pages': []}))
            self.assertIsNone(takes.convert(folder, FFMPEG, video=False)['take'])
            self.assertFalse((folder / 'take.mp4').exists())
            self.assertTrue(json.loads((folder / 'capture.json').read_text())['steps'][0]['navigate'])


class Windows(unittest.TestCase):
    def test_a_take_shows_the_window_the_test_acts_on(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'frames').mkdir()
            (Path(folder) / 'stills').mkdir()
            frames = []
            for page in (3, 4):
                for k, t in enumerate((0, 3000, 5000, 7000, 9000)):
                    name = f'frames/p{page}-{k:06d}.jpg'
                    (Path(folder) / name).write_bytes(b'')
                    frames.append({'file': name, 't': 1000 + t, 'page': page})
            (Path(folder) / 'stills' / 'a0001.jpg').write_bytes(b'')
            actions = [{'id': 0, 'kind': 'click', 'page': 3, 'm': 1500, 'a': 1600},
                       {'id': 1, 'kind': 'goto', 'page': 4, 'm': 6200, 'a': 6300, 'still': 'stills/a0001.jpg', 'still_t': 5900}]
            items = takes.sources(folder, frames, actions, [])
            shown = [(t, name) for t, name, _ in items]
            self.assertIn((4000, 'frames/p3-000001.jpg'), shown)  # Marek's window while the test acts in it
            self.assertNotIn((4000, 'frames/p4-000001.jpg'), shown)  # not Anna's repainting behind it
            self.assertIn((5900, 'stills/a0001.jpg'), shown)  # Anna's window from her first action on
            self.assertNotIn((8000, 'frames/p3-000003.jpg'), shown)
            record = takes.capture_record(folder, 1000, 10000, actions, [], {})
            self.assertEqual([(s['page'], s['enter']) for s in record['steps']], [(3, 0.5), (4, 4.9)])


if __name__ == '__main__':
    unittest.main()
