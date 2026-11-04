"""Recorded targets, bounded zooms and decoded subpixel interpolation without paid providers."""
import copy
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import core
import tutorial_focus as focus


class TutorialFocus(unittest.TestCase):
    def test_targets_follow_recorded_geometry_and_edge_controls_never_zoom(self):
        film = {'footage': 8, 'actions': [
            {'step': 0, 't': .6, 't_pre': .3},
            {'step': 1, 't': 3.1, 't_pre': 3},
            {'step': 2, 't': 5.5, 't_pre': 5.3},
        ]}
        capture = {'scale': .5, 'steps': [
            {'step': 0, 'look': True, 'box': {'x': 600, 'y': 350, 'width': 200, 'height': 60}},
            {'step': 1, 'look': True, 'box': {'x': 1480, 'y': 350, 'width': 100, 'height': 60}},
            {'step': 2, 'box': {'x': -100, 'y': 350, 'width': 200, 'height': 60}},
        ]}
        values = focus.from_film(film, capture)
        self.assertEqual(len(values), 2)
        self.assertEqual(values[0]['box'], [300, 175, 100, 30])
        self.assertTrue(values[0]['zoom'])
        self.assertFalse(values[1]['zoom'])
        self.assertEqual(focus.validate(values, [800,450], 8), values)
        capture['steps'][0]['pre'] = {'overlay': {'x': 500, 'y': 0, 'width': 1100, 'height': 900}}
        self.assertFalse(focus.from_film(film, capture)[0]['zoom'], 'a drawer must remain fully visible')
        invalid = copy.deepcopy(values)
        invalid[1]['zoom'] = True
        with self.assertRaisesRegex(ValueError, 'interior target'):
            focus.validate(invalid, [800,450], 8)

    def test_rendered_zoom_returns_to_full_view_and_outline_tracks_the_control(self):
        ffmpeg = core.tool('ffmpeg', home=False)
        if not ffmpeg:
            self.skipTest('FFmpeg unavailable')
        values = [{'start': .3, 'end': 1.9, 'box': [600,350,200,60], 'zoom': True}]
        focus.validate(values, [1600,900], 2.5)
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)/'focus.mp4'
            subprocess.run([ffmpeg,'-v','error','-f','lavfi','-i',
                'color=c=0x202020:s=1600x900:r=30:d=2.5,drawbox=x=600:y=350:w=200:h=60:color=white:t=fill',
                '-vf',focus.filters(values).rstrip(','),'-c:v','libx264','-threads','2',str(target)],
                check=True,capture_output=True)
            def pixel(at,x,y):
                raw=subprocess.check_output([ffmpeg,'-v','error','-ss',str(at),'-i',str(target),
                    '-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'])
                index=(y*1600+x)*3
                return tuple(raw[index:index+3])
            self.assertLess(max(pixel(0,596,380)),80)
            self.assertGreater(min(pixel(.9,596,380)),180)
            self.assertLess(max(pixel(2.2,596,380)),80)
            outline=pixel(.9,589,380)
            self.assertGreater(outline[2],150)
            self.assertLess(outline[0],130)
