"""Ensure whole-page rendering preserves edge-attached drawers and footer controls."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import core
import montage
import render_demo


class ViewportEdges(unittest.TestCase):
    def test_default_crop_keeps_the_entire_page_at_recording_scales(self):
        for scale in (0.5, 1, 1.5, 2):
            with self.subTest(scale=scale):
                self.assertEqual(montage.scale_crop(None, scale), [0, 0, int(1600 * scale), int(900 * scale)])
        self.assertEqual(montage.scale_crop([10, 20, 100, 200], 1.5), [16, 30, 150, 300])

    def test_rendered_footage_keeps_all_four_edges(self):
        ffmpeg = core.tool('ffmpeg', home=False)
        if not ffmpeg:
            self.skipTest('FFmpeg unavailable')
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'drawer.mp4'
            # Mark the strips the old crop discarded: right red, bottom green, left blue, top white.
            image = ('color=0x101010:s=1600x900:r=30:d=0.3,'
                     'drawbox=x=1592:y=0:w=8:h=900:color=red:t=fill,'
                     'drawbox=x=0:y=890:w=1600:h=10:color=lime:t=fill,'
                     'drawbox=x=0:y=0:w=8:h=900:color=blue:t=fill,'
                     'drawbox=x=0:y=0:w=1600:h=4:color=white:t=fill')
            subprocess.run([ffmpeg, '-v', 'error', '-f', 'lavfi', '-i', image, '-c:v', 'libx264',
                            '-threads', '1', str(source)], check=True, capture_output=True)
            segment = {'source': source, 'scale': 1, 'crop': montage.scale_crop(None, 1),
                       'pieces': [[0, 0.3, 0]], 'footage_duration': 0.3,
                       'pointer': {'start': [800, 450], 'moves': [], 'clicks': []}}
            inputs, graph = render_demo.footage_visual(segment, 0, 0.2, render_demo.pointer_images(root, 1))
            result = root / 'rendered.mp4'
            subprocess.run([ffmpeg, '-v', 'error', '-filter_complex_threads', '1', *map(str, inputs),
                            '-filter_complex', graph, '-map', '[v0]', '-an', '-t', '0.2',
                            '-c:v', 'libx264', '-threads', '1', str(result)], check=True, capture_output=True)
            pixels = subprocess.check_output([ffmpeg, '-v', 'error', '-i', str(result), '-frames:v', '1',
                                               '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
            def pixel(x, y):
                at = (y * 1920 + x) * 3
                return tuple(pixels[at:at + 3])
            red, green, blue, white = pixel(1739, 100), pixel(1000, 907), pixel(180, 100), pixel(1000, 31)
            self.assertGreater(red[0], 180, red)
            self.assertLess(max(red[1:]), 70, red)
            self.assertGreater(green[1], 180, green)
            self.assertLess(max(green[0], green[2]), 70, green)
            self.assertGreater(blue[2], 180, blue)
            self.assertLess(max(blue[:2]), 70, blue)
            self.assertGreater(min(white), 180, white)
