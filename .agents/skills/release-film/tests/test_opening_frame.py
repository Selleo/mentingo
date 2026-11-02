"""Decode the opening screen without requiring drawtext or any paid provider."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import core
import cut
import render_demo


class OpeningFrame(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.ffmpeg = core.tool('ffmpeg', home=False)
        if not self.ffmpeg:
            self.skipTest('FFmpeg unavailable')
        self.run_media('-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=2',
                       '-c:v', 'libx264', '-threads', '1', self.root / 'capture.mp4')
        self.run_media('-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', self.root / 'voice.wav')
        chapter = {'title': 'Create a course', 'prs': ['https://github.com/example/project/pull/1'],
                   'audio': 'voice.wav', 'captions': [{'start': 2, 'end': 3, 'text': 'Create a course'}],
                   'clips': [{'footage': {'source': 'capture.mp4', 'duration': 2, 'scale': 0.2,
                             'pieces': [[0.7, 1.7, 0]], 'camera': [{'crop': [0, 0, 320, 180]}],
                             'pointer': {'start': [0, 0], 'moves': [], 'clicks': []}}}]}
        path = self.root / 'plan.json'
        path.write_text(json.dumps({'font': cut.font_path(), 'chapters': [chapter, copy.deepcopy(chapter)]}))
        self.plan = render_demo.load_plan(path, enforce_duration=False)

    def run_media(self, *args):
        subprocess.run([self.ffmpeg, '-v', 'error', '-y', *map(str, args)], check=True, capture_output=True)

    def frame(self, video, at, view='scale=160:90'):
        return subprocess.check_output([self.ffmpeg, '-v', 'error', '-ss', str(at), '-i', str(video),
                                        '-frames:v', '1', '-vf', view, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])

    def test_only_the_opening_card_uses_the_first_kept_screen_without_shifting_audio(self):
        opening, footage, second_card, _ = self.plan['segments']
        self.assertEqual(opening['opening']['at'], 0.7)
        self.assertEqual(opening['source'], footage['source'])
        self.assertNotIn('opening', second_card)
        self.assertEqual([segment['start'] for segment in self.plan['segments']], [0, 2, 4, 6])
        self.assertEqual([chapter['audio_offset'] for chapter in self.plan['chapters']], [2, 2])

    def test_first_decoded_frame_contains_the_screen_and_holds_it_through_the_opening(self):
        inputs, visual = render_demo.opening_visual(self.plan['segments'][0], 0, 2)
        target = self.root / 'opening.mp4'
        self.run_media(*inputs, '-filter_complex', visual, '-map', '[v0]', '-an', '-t', '2',
                       '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', target)
        first = self.frame(target, 0, 'crop=1564:880:178:30,scale=160:90')
        last = self.frame(target, 1.8, 'crop=1564:880:178:30,scale=160:90')
        source = self.frame(self.root / 'capture.mp4', 0.7)
        self.assertGreater(len(set(first)), 150)  # actual detailed screen, not a flat brand color
        self.assertLess(sum(abs(a - b) for a, b in zip(first, source)) / len(first), 12)
        self.assertLess(sum(abs(a - b) for a, b in zip(first, last)) / len(first), 2)

    def test_opening_title_is_visible_immediately_and_has_no_fade_to_blue(self):
        title = self.root / 'title.txt'
        with mock.patch.object(render_demo, 'step_filter', return_value='null') as label:
            _, visual = render_demo.card_visual(self.plan['segments'][0], 0, 2, title)
        self.assertEqual(label.call_args.args[2], -1)
        self.assertNotIn('fade=', visual)
        self.assertIn('tpad=stop_mode=clone', visual)
