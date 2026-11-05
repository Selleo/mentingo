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
import render_demo


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
        values = [{'start': .3, 'end': 2.8, 'box': [600,350,200,60], 'zoom': True}]
        focus.validate(values, [1600,900], 3.2)
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)/'focus.mp4'
            inputs = ['-f','lavfi','-i','color=c=0x202020:s=1600x900:r=30:d=3.2,drawbox=x=600:y=350:w=200:h=60:color=white:t=fill']
            rings, layer = focus.overlays(inputs, values, Path(temporary), render_demo.png)
            graph = '[0:v]null[c2];' + rings + f';[{layer}]' + focus.filters(values).rstrip(',') + '[out]'
            subprocess.run([ffmpeg,'-v','error','-filter_complex_threads','1',*inputs,'-filter_complex',graph,'-map','[out]','-t','3.2','-c:v','libx264','-threads','2',str(target)],
                check=True,capture_output=True)
            def pixel(at,x,y):
                raw=subprocess.check_output([ffmpeg,'-v','error','-ss',str(at),'-i',str(target),
                    '-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'])
                index=(y*1600+x)*3
                return tuple(raw[index:index+3])
            self.assertLess(max(pixel(0,850,450)),80)
            self.assertGreater(min(pixel(1.4,850,450)),180)
            self.assertLess(max(pixel(3,850,450)),80)
            outline=pixel(1.4,646,450)
            self.assertGreater(outline[2],150)
            self.assertLess(outline[0],130)

    def test_camera_keeps_context_inside_frame_and_does_not_upscale_excessively(self):
        for box in ([600,350,200,60], [180,100,50,30], [1320,730,100,60]):
            zoom, left, top = focus.camera(box, (1600,900))
            self.assertLessEqual(zoom, 1.45)
            self.assertLessEqual(left, 0)
            self.assertLessEqual(top, 0)
            self.assertGreaterEqual(left + 1600 * zoom, 1600)
            self.assertGreaterEqual(top + 900 * zoom, 900)
            x,y,w,h = box
            self.assertGreaterEqual(x * zoom + left, 0)
            self.assertLessEqual((x+w) * zoom + left, 1600)
            self.assertGreaterEqual(y * zoom + top, 0)
            self.assertLessEqual((y+h) * zoom + top, 900)

    def test_round_ring_has_clear_interior_and_corners_and_mentingo_blue_edge(self):
        (w,h), rows = focus.ring(200,60)
        self.assertEqual(rows[h//2][(w//2)*4+3], 0, 'never obscure the actual control')
        self.assertEqual(rows[0][3], 0)
        self.assertGreater(rows[h//2][8*4+3], 200)
        self.assertEqual(list(rows[h//2][8*4:8*4+3]), [71,150,253])

    def test_short_actions_only_ring_and_do_not_pulse_camera(self):
        film={'footage':2,'actions':[{'step':0,'t_pre':.4,'t':.7}]}
        capture={'steps':[{'step':0,'look':True,'box':[600,350,200,60]}]}
        values=focus.from_film(film,capture)
        self.assertFalse(values[0]['zoom'])
        self.assertEqual(focus.filters(values), '')


    def test_full_footage_graph_renders_two_rings_and_scaled_camera(self):
        ffmpeg = core.tool('ffmpeg', home=False)
        if not ffmpeg:
            self.skipTest('FFmpeg unavailable')
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            source = work / 'take.mp4'
            subprocess.run([ffmpeg, '-v', 'error', '-f', 'lavfi', '-i',
                            'testsrc2=s=800x450:r=30:d=4', '-c:v', 'libx264', '-threads', '2', str(source)],
                           check=True, capture_output=True)
            values = [{'start': .1, 'end': 2.5, 'box': [300,175,100,30], 'zoom': True},
                      {'start': 2.6, 'end': 3.7, 'box': [740,175,50,30], 'zoom': False}]
            segment = {'source': source, 'scale': .5, 'frame': [800,450], 'pieces': [[0,4,0]],
                       'pointer': {'start':[700,380], 'moves':[], 'clicks':[]},
                       'footage_duration':4, 'crop':[0,0,800,450], 'focus':values}
            inputs, graph = render_demo.footage_visual(segment, 0, 4, render_demo.pointer_images(work,.5), work=work)
            out = work / 'result.mp4'
            subprocess.run([ffmpeg, '-v', 'error', '-filter_complex_threads', '1', *map(str,inputs),
                            '-filter_complex', graph, '-map','[v0]', '-t','4', '-c:v','libx264',
                            '-threads','2',str(out)], check=True, capture_output=True)
            raw = subprocess.check_output([ffmpeg, '-v','error','-ss','3.1','-i',str(out),
                                           '-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'])
            self.assertEqual(len(raw), 1920 * 1080 * 3)


    def test_legacy_short_zoom_plan_renders_as_a_ring_without_rejecting_saved_work(self):
        values=[{'start':.2,'end':1.8,'box':[600,350,200,60],'zoom':True}]
        self.assertEqual(focus.validate(values,[1600,900],2),values)
        self.assertEqual(focus.filters(values),'')
