"""Short decoded-artifact tests; synthetic colors are fixtures, never demo evidence."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import os
import subprocess
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import core
import cut
import render_demo
from render_demo import load_plan, probe, render, run
render_demo.FFMPEG = os.environ.get("DEMO_FFMPEG") or core.tool('ffmpeg', home=False)  # a build with drawtext (captions)
render_demo.FFPROBE = core.tool('ffprobe', home=False) or 'ffprobe'

# A 640x360 take stands for a 1600x900 page captured at scale 0.4.
FOOTAGE = {'source': 'capture.mp4', 'scale': 0.4, 'duration': 2.0,
           'pieces': [[0, 0.5, 0.0], [1.0, 1.5, 1.0]],
           'camera': [{'start': 0, 'end': None, 'crop': [0, 0, 640, 360]}],
           'pointer': {'start': [800, 450], 'moves': [[0.1, 0.4, 800, 450, 400, 200]], 'clicks': [0.8]}}


class RenderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        font = cut.font_path()
        run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=3', '-c:v', 'libx264',
             '-g', '15', '-threads', '2', cls.root/'capture.mp4'])
        run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', cls.root/'voice.wav'])
        cls.data = {'font': font, 'chapters': [{'title': 'Wynik działania', 'prs': ['https://github.com/example/project/pull/1'],
                                                'audio': 'voice.wav', 'clips': [{'footage': copy.deepcopy(FOOTAGE)}],
                                                'captions': [{'start': 2, 'end': 2.8, 'text': 'Pierwszy napis'},
                                                             {'start': 2.9, 'end': 3.9, 'text': 'Czytelny wynik\nDruga linia'}],
                                                'steps': [[2, 'Pierwszy krok'], [2.9, 'Czytelny wynik']]}]}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def plan(self, data=None, name='input.json'):
        path = self.root/name
        path.write_text(json.dumps(data or self.data))
        return path

    def frame(self, video, at, vf='scale=192:108', fmt='gray'):
        return subprocess.check_output([render_demo.FFMPEG, '-v', 'error', '-ss', str(at), '-i', str(video), '-frames:v', '1',
                                        '-vf', vf, '-pix_fmt', fmt, '-f', 'rawvideo', '-'])

    @staticmethod
    def difference(a, b):
        return sum(abs(x - y) for x, y in zip(a, b)) / len(a)

    def test_decoded_artifacts_step_labels_and_timing(self):
        plan = load_plan(self.plan(), enforce_duration=False)
        out = self.root/'render'
        result = render(plan, out)
        info = probe(out/'demo.mp4')
        video = next(s for s in info['streams'] if s['codec_type'] == 'video')
        audio = next(s for s in info['streams'] if s['codec_type'] == 'audio')
        self.assertEqual((video['codec_name'], video['width'], video['height'], video['r_frame_rate']), ('h264', 1920, 1080, '30/1'))
        self.assertEqual(audio['codec_name'], 'aac')
        pcm = subprocess.check_output([render_demo.FFMPEG, '-v', 'error', '-ss', '2.2', '-i', str(out/'demo.mp4'), '-t', '0.3', '-map', '0:a', '-f', 's16le', '-'])
        self.assertGreater(len(pcm), 1000)
        self.assertTrue(any(pcm))
        self.assertAlmostEqual(result['duration'], 4, delta=.08)
        self.assertIn('00:00:02,900 --> 00:00:03,900', (out/'captions-pl.srt').read_text())  # the player's subtitles
        self.assertIn('00:00:02.900 --> 00:00:03.900', (out/'captions-pl.vtt').read_text())
        self.assertEqual([(s['start'], s['end'], s['text']) for s in plan['steps']],
                         [(2, 2.9, 'Pierwszy krok'), (2.9, 4, 'Czytelny wynik')])
        def bright_pixels(at):  # white text in the band under the picture
            pixels = self.frame(out/'demo.mp4', at, 'crop=1920:140:0:940', 'rgb24')
            return sum(1 for i in range(0, len(pixels), 3) if min(pixels[i:i+3]) > 180)
        def accent_pixels(at):  # the label's orange accent
            pixels = self.frame(out/'demo.mp4', at, 'crop=12:70:178:942', 'rgb24')
            return sum(1 for i in range(0, len(pixels), 3) if pixels[i] > 200 and pixels[i+2] < 100)
        self.assertLess(bright_pixels(1.0), 20)  # the chapter card: no label
        self.assertEqual(accent_pixels(1.0), 0)
        self.assertGreater(bright_pixels(2.6), 300)  # the first step's label, then the second one's
        self.assertGreater(bright_pixels(3.4), 300)
        self.assertGreater(accent_pixels(3.4), 100)
        poster = probe(out/'poster.jpg')['streams'][0]
        self.assertEqual((poster['width'], poster['height']), (1920, 1080))
        self.assertEqual([s['start'] for s in result['segments']], [0, 2])
        expected_artifacts = {'demo.mp4', 'poster.jpg', 'captions-pl.srt', 'captions-pl.vtt'}
        self.assertEqual(set(result['artifact_sha256']), expected_artifacts)
        for name in expected_artifacts:
            self.assertEqual(result['artifact_sha256'][name], hashlib.sha256((out/name).read_bytes()).hexdigest())

    def test_footage_plays_its_pieces_and_holds_between_them(self):
        plan = load_plan(self.plan(), enforce_duration=False)
        out = self.root/'holds'
        render(plan, out)
        film = out/'demo.mp4'
        view = 'crop=1564:880:178:30,scale=160:90'
        source = lambda at: self.frame(self.root/'capture.mp4', at, 'scale=160:90')
        # a hold shows the piece's last frame until the next piece starts (film 0.5-1.0)
        self.assertLess(self.difference(self.frame(film, 2.6, view), self.frame(film, 2.95, view)), 1.5)
        # footage plays at normal speed: film 1.2 shows the take at 1.2, not at 0.7
        later = self.frame(film, 3.2, view)
        self.assertLess(self.difference(later, source(1.2)), self.difference(later, source(0.7)))
        self.assertGreater(self.difference(self.frame(film, 2.95, view), later), 3)

    def test_pointer_is_drawn_and_a_click_shows_the_ring(self):
        still = copy.deepcopy(self.data)
        still['chapters'][0]['clips'][0]['footage']['pointer'] = {'start': [100, 100], 'moves': [], 'clicks': []}
        with_pointer, without = self.root/'pointer', self.root/'no-pointer'
        render(load_plan(self.plan(), enforce_duration=False), with_pointer)
        render(load_plan(self.plan(still, 'still.json'), enforce_duration=False), without)
        # the tip rests at CSS (400, 200): (160, 80) in the take, (568, 225) on the 1920x1080 film
        tip = 'crop=48:48:566:223'
        # (before the film's last ENDING seconds fade out)
        drawn, plain = self.frame(with_pointer/'demo.mp4', 3.1, tip), self.frame(without/'demo.mp4', 3.1, tip)
        self.assertGreater(sum(abs(a - b) > 60 for a, b in zip(drawn, plain)), 60)  # the arrow's fill and outline
        silent = copy.deepcopy(self.data)
        silent['chapters'][0]['clips'][0]['footage']['pointer']['clicks'] = []
        no_click = self.root/'no-click'
        render(load_plan(self.plan(silent, 'silent.json'), enforce_duration=False), no_click)
        ring = 'crop=90:90:523:180'
        def ring_pixels(at):  # the only difference between the two films is the click ring
            a, b = self.frame(with_pointer/'demo.mp4', at, ring, 'rgb24'), self.frame(no_click/'demo.mp4', at, ring, 'rgb24')
            return sum(1 for i in range(0, len(a), 3) if max(abs(a[i + k] - b[i + k]) for k in range(3)) > 40)
        self.assertGreater(ring_pixels(2.9), 30)  # the click at film 0.8 shows the ring for 0.3 s
        self.assertLess(ring_pixels(3.4), 5)

    def test_a_label_shows_in_the_corner_while_it_lasts(self):
        labelled = copy.deepcopy(self.data)
        labelled['chapters'][0]['clips'][0]['footage']['labels'] = [[0.2, 1.0, 'Po odświeżeniu strony']]
        out, plain = self.root/'label', self.root/'no-label'
        render(load_plan(self.plan(labelled, 'labelled.json'), enforce_duration=False), out)
        render(load_plan(self.plan(), enforce_duration=False), plain)
        corner = 'crop=300:60:200:52'
        changed = lambda at: self.difference(self.frame(out/'demo.mp4', at, corner), self.frame(plain/'demo.mp4', at, corner))
        self.assertGreater(changed(2.6), 10)  # footage time 0.6: the label is on
        self.assertLess(changed(3.1), 3)  # after it (encoder noise only)
        bad = copy.deepcopy(self.data)
        bad['chapters'][0]['clips'][0]['footage']['labels'] = [[0.2, 1.0, 'x' * 41]]
        with self.assertRaises(ValueError):
            load_plan(self.plan(bad, 'bad-label.json'), enforce_duration=False)

    def test_a_pressed_key_shows_on_a_badge_in_the_corner(self):
        keyed = copy.deepcopy(self.data)
        keyed['chapters'][0]['clips'][0]['footage']['keys'] = [[0.2, 1.0, 'Ctrl + S']]
        out, plain = self.root/'key', self.root/'no-key'
        render(load_plan(self.plan(keyed, 'keyed.json'), enforce_duration=False), out)
        render(load_plan(self.plan(), enforce_duration=False), plain)
        def accent(video, at):  # the keycap: the film's orange, which the test picture has little of
            pixels = self.frame(video, at, 'crop=260:90:1600:790', 'rgb24')
            return sum(1 for i in range(0, len(pixels), 3) if pixels[i] > 220 and 80 < pixels[i+1] < 140 and pixels[i+2] < 90)
        self.assertGreater(accent(out/'demo.mp4', 2.6) - accent(plain/'demo.mp4', 2.6), 2000)  # footage 0.6: badge on
        self.assertLess(abs(accent(out/'demo.mp4', 3.1) - accent(plain/'demo.mp4', 3.1)), 50)
        bad = copy.deepcopy(self.data)
        bad['chapters'][0]['clips'][0]['footage']['keys'] = [[0.2, 1.0, 'x' * 31]]
        with self.assertRaises(ValueError):
            load_plan(self.plan(bad, 'bad-key.json'), enforce_duration=False)

    def test_a_long_step_label_takes_two_even_lines(self):  # a viewer without sound reads what happens there
        text = 'We set marketing consent to “Allowed” and the country to Norway in the customer header'
        self.assertEqual(render_demo.step_lines(text), ['We set marketing consent to “Allowed” and',
                                                        'the country to Norway in the customer header'])
        self.assertEqual(render_demo.step_lines('Saved values after reopening'), ['Saved values after reopening'])
        two = copy.deepcopy(self.data)
        two['chapters'][0]['steps'][1][1] = text
        out = self.root/'two-lines'
        render(load_plan(self.plan(two, 'two.json'), enforce_duration=False), out)
        def rows(at, top):  # white text in one line's strip of the band
            pixels = self.frame(out/'demo.mp4', at, f'crop=1400:40:200:{top}', 'rgb24')
            return sum(1 for i in range(0, len(pixels), 3) if min(pixels[i:i+3]) > 180)
        self.assertGreater(rows(3.4, 930), 150)  # the first line, then the second under it
        self.assertGreater(rows(3.4, 990), 150)
        long = copy.deepcopy(self.data)
        long['chapters'][0]['steps'][1][1] = 'x ' * 61
        with self.assertRaises(ValueError):
            load_plan(self.plan(long, 'long.json'), enforce_duration=False)

    def test_the_film_fades_out_at_its_end(self):
        out = self.root/'ending'
        render(load_plan(self.plan(), enforce_duration=False), out)
        grey = lambda at: sum(self.frame(out/'demo.mp4', at)) / (192 * 108)
        self.assertGreater(abs(grey(3.0) - grey(3.97)), 5)  # the colour bars, then nearly the card's ground
        self.assertLess(abs(grey(3.97) - 0x30), 12)

    def test_a_projects_brand_colours_the_cards_band_and_marks(self):
        data = dict(copy.deepcopy(self.data), colors={'frame': '#222949', 'accent': '#3f58b6'})
        plan = load_plan(self.plan(data, 'brand.json'), enforce_duration=False)
        self.assertEqual(plan['colors'], {'frame': '0x222949', 'accent': '0x3f58b6'})
        out = self.root / 'brand-out'
        render(plan, out)
        rgb = lambda at, crop: self.average(out / 'demo.mp4', at, crop)
        ground, bar = rgb(1.0, 'crop=40:40:20:20'), rgb(1.0, 'crop=150:5:110:421')  # the chapter card at 1 s
        self.assertTrue(all(abs(a - b) < 14 for a, b in zip(ground, (0x22, 0x29, 0x49))), ground)
        self.assertTrue(all(abs(a - b) < 20 for a, b in zip(bar, (0x3f, 0x58, 0xb6))), bar)
        default = load_plan(self.plan(), enforce_duration=False)
        self.assertEqual(default['colors'], render_demo.COLORS)  # a plan without colours keeps the skill's own
        footage = next(s for s in plan['segments'] if s['kind'] == 'footage')
        chapter = plan['chapters'][0]
        self.assertNotEqual(render_demo.segment_key(plan, footage, chapter, []),
                            render_demo.segment_key(default, footage, chapter, []))  # a cached segment has its colours
        for bad in ({'frame': 'navy'}, {'accent': '#3f58b6;drawtext'}, {'glow': '#ffffff'}):
            with self.subTest(colors=bad), self.assertRaisesRegex(ValueError, 'colors'):
                load_plan(self.plan(dict(copy.deepcopy(self.data), colors=bad), 'bad-colors.json'), enforce_duration=False)

    def average(self, video, at, crop):
        pixels = self.frame(video, at, crop, 'rgb24')
        return tuple(sum(pixels[i::3]) / (len(pixels) / 3) for i in range(3))

    def test_one_still_framing_is_cropped_exactly_without_zoompan(self):  # zoompan rounds its crop to whole pixels
        data = copy.deepcopy(self.data)
        data['chapters'][0]['clips'][0]['footage']['camera'] = [{'start': 0, 'end': None, 'crop': [12, 0, 616, 346]}]
        plan = load_plan(self.plan(data, 'still.json'), enforce_duration=False)
        footage = next(s for s in plan['segments'] if s['kind'] == 'footage')
        visual = render_demo.footage_visual(footage, 0, 1, ('a.png', 'b.png', (0, 0)))[1]
        self.assertIn('crop=616:346:12:0,scale=1564:880:flags=lanczos,', visual)
        self.assertNotIn('zoompan', visual)

    def test_real_image_after_footage(self):
        run(['ffmpeg', '-v', 'error', '-y', '-i', self.root/'capture.mp4', '-frames:v', '1', '-update', '1', self.root/'result.png'])
        data = copy.deepcopy(self.data)
        data['chapters'][0]['clips'].append({'image': 'result.png', 'duration': .5, 'evidence': 'Synthetic test fixture extracted from capture'})
        plan = load_plan(self.plan(data, 'image.json'), enforce_duration=False)
        result = render(plan, self.root/'image-render')
        self.assertAlmostEqual(result['duration'], 4.5, delta=.08)
        self.assertEqual([s['kind'] for s in result['segments']], ['card', 'footage', 'image'])

    def test_a_step_label_going_on_over_a_pdf_page_does_not_fade_in_again(self):  # it flickered at the page's start
        run(['ffmpeg', '-v', 'error', '-y', '-i', self.root/'capture.mp4', '-frames:v', '1', '-update', '1', self.root/'page.png'])
        data = copy.deepcopy(self.data)
        data['chapters'][0]['clips'].append({'image': 'page.png', 'duration': .5, 'evidence': 'Synthetic test fixture'})
        out = self.root/'carried-step'
        render(load_plan(self.plan(data, 'carried.json'), enforce_duration=False), out)
        def bright_pixels(at):  # the label's white text in the band under the picture (the second step: 2.9 s to the end)
            pixels = self.frame(out/'demo.mp4', at, 'crop=1920:140:0:940', 'rgb24')
            return sum(1 for i in range(0, len(pixels), 3) if min(pixels[i:i+3]) > 180)
        shown = bright_pixels(3.9)  # the footage's last frames
        self.assertGreater(shown, 300)
        for at in (4.02, 4.07, 4.12):  # the page's first frames (from 4.0 s): the same label, as bright
            self.assertGreater(bright_pixels(at), 0.8 * shown)

    def test_segments_are_cached_by_content(self):
        cache = self.root/'shared-cache'
        plan = load_plan(self.plan(), enforce_duration=False)
        first = render(plan, self.root/'cache-1', cache=cache)
        again = render(plan, self.root/'cache-2', cache=cache)
        self.assertEqual(first['cached_segments'], 0)
        self.assertEqual(again['cached_segments'], len(again['segments']))
        self.assertEqual(run(['ffmpeg', '-v', 'error', '-i', self.root/'cache-1'/'demo.mp4', '-map', '0:v', '-f', 'framemd5', '-']),
                         run(['ffmpeg', '-v', 'error', '-i', self.root/'cache-2'/'demo.mp4', '-map', '0:v', '-f', 'framemd5', '-']))
        changed = copy.deepcopy(self.data)
        changed['chapters'][0]['steps'][1][1] = 'Zmieniony opis'
        edited = render(load_plan(self.plan(changed, 'changed.json'), enforce_duration=False), self.root/'cache-3', cache=cache)
        self.assertEqual([t['cached'] for t in edited['segments']], [True, False])  # the card kept, the footage re-rendered
        for jobs in [0, 9, True]:
            with self.assertRaisesRegex(ValueError, 'jobs'):
                render(plan, self.root/'bad-jobs', jobs=jobs)

    def test_input_probe_cache_is_scoped_to_one_load(self):
        path = self.plan()
        with patch.object(render_demo, 'probe', wraps=probe) as measured:
            load_plan(path, enforce_duration=False)
            self.assertEqual(measured.call_count, 2)
            load_plan(path, enforce_duration=False)
            self.assertEqual(measured.call_count, 4)

    def test_prepare_preserves_words_timings_and_rejects_short_story(self):
        authored = copy.deepcopy(self.data)
        chapter = authored['chapters'][0]
        del chapter['captions']
        chapter['srt'] = 'voice.srt'
        chapter['review_points'] = {'action': 2.5, 'result': 3.8}
        text = 'Sprawdzamy zapisany wynik. Drugie zdanie zachowuje kolejność słów oraz interpunkcję.'
        stamp = lambda ms: f'00:00:{ms // 1000:02d},{ms % 1000:03d}'
        (self.root/'voice.srt').write_text('\n'.join(  # one word every 180 ms, each 160 ms long
            f'{i + 1}\n{stamp(100 + 180 * i)} --> {stamp(260 + 180 * i)}\n{w}\n' for i, w in enumerate(text.split())))
        path = self.root/'authored.json'
        path.write_text(json.dumps(authored))
        out = self.root/'prepared'
        result = render_demo.prepare(path, out, enforce_duration=False)
        generated = json.loads((out/'editing-plan.json').read_text())
        cues = generated['chapters'][0]['captions']
        self.assertEqual(' '.join(' '.join(c['text'].split()) for c in cues), text)
        self.assertEqual(cues[0]['start'], 2.1)
        self.assertEqual(cues[-1]['end'], 3.88)
        self.assertEqual(result['duration'], 4)
        self.assertTrue(Path(generated['chapters'][0]['clips'][0]['footage']['source']).is_absolute())
        self.assertEqual(load_plan(out/'editing-plan.json', False)['chapters'][0]['review_points'], chapter['review_points'])
        with self.assertRaisesRegex(ValueError, '180–300'):
            render_demo.prepare(path, self.root/'short-rejected')
        self.assertFalse((self.root/'short-rejected').exists())

    def test_prepare_word_boundaries_preserves_endpoint_timing_and_renderer_schema(self):
        authored = copy.deepcopy(self.data)
        chapter = authored['chapters'][0]
        del chapter['captions']
        chapter.update(srt='words.srt', caption_limits=[[0.1, 0.8]])
        words = [('00:00:00,100', '00:00:00,600', 'Zapisany'),
                 ('00:00:00,900', '00:00:01,900', 'wynik.')]
        (self.root/'words.srt').write_text('\n'.join(
            f'{i}\n{start} --> {end}\n{text}\n'
            for i, (start, end, text) in enumerate(words, 1)))
        path = self.root/'word-authored.json'
        path.write_text(json.dumps(authored))
        out = self.root/'word-prepared'
        report = render_demo.prepare(path, out, enforce_duration=False)
        self.assertEqual(set(report['caption_timing'][0]['cues']), {'word_boundary'})
        cues = json.loads((out/'editing-plan.json').read_text())['chapters'][0]['captions']
        self.assertEqual(' '.join(' '.join(c['text'].split()) for c in cues), 'Zapisany wynik.')
        self.assertEqual((cues[0]['start'], cues[-1]['end']), (2.1, 3.9))
        chapter['srt_boundary'] = 'unknown key'
        path.write_text(json.dumps(authored))
        with self.assertRaises(ValueError):
            render_demo.prepare(path, self.root/'invalid-key', enforce_duration=False)
        self.assertFalse((self.root/'invalid-key').exists())

    def test_reject_bad_plans(self):
        footage = lambda c: c['clips'][0]['footage']
        for label, mutate in [
            ('missing', lambda c: footage(c).update(source='missing.mp4')),
            ('piece outside take', lambda c: footage(c).update(pieces=[[0, 0.5, 0], [9, 9.5, 1]])),
            ('pieces out of order', lambda c: footage(c).update(pieces=[[0, 0.5, 1.0], [1, 1.5, 0.5]])),
            ('empty pieces', lambda c: footage(c).update(pieces=[])),
            ('crop', lambda c: footage(c).update(camera=[{'start': 0, 'end': None, 'crop': [600, 0, 100, 100]}])),
            ('pointer move', lambda c: footage(c)['pointer'].update(moves=[[1, 0.5, 0, 0, 1, 1]])),
            ('overlap', lambda c: c['captions'][1].update(start=2.5)),
            ('long captions', lambda c: c['captions'][0].update(text='one\ntwo\nthree')),
            ('wide caption', lambda c: c['captions'][0].update(text='W'*100)),
            ('audio overrun', lambda c: footage(c).update(duration=1)),
            ('fabricated image', lambda c: c['clips'].append({'image': 'capture.mp4', 'duration': 2, 'evidence': 'x'})),
        ]:
            with self.subTest(label=label):
                data = copy.deepcopy(self.data)
                mutate(data['chapters'][0])
                with self.assertRaises(ValueError):
                    load_plan(self.plan(data, 'bad.json'), enforce_duration=False)
        with self.assertRaisesRegex(ValueError, '180–300'):
            load_plan(self.plan())

    def test_pointer_images_share_the_tip(self):
        folder = self.root/'pointers'
        folder.mkdir()
        normal, pressed, hotspot = render_demo.pointer_images(folder, 1.5)
        for path in (normal, pressed):
            stream = probe(path)['streams'][0]
            self.assertEqual((stream['codec_name'], stream['width'], stream['height']), ('png', 66, 69))
        self.assertEqual(hotspot, (27.0, 27.0))



class FFmpegFeatures(unittest.TestCase):
    def test_an_ffmpeg_without_drawtext_is_told_apart(self):  # Homebrew's plain ffmpeg
        with tempfile.TemporaryDirectory() as folder:
            fake = Path(folder) / 'ffmpeg'
            fake.write_text('#!/bin/sh\nif [ "$2" = -filters ]; then echo " zoompan overlay select pad fade tpad atrim adelay apad"; '
                            'else echo " libx264 aac libmp3lame"; fi\n')
            fake.chmod(0o755)
            self.assertEqual(render_demo.lacks(str(fake)), ['drawtext'])
            self.assertEqual(render_demo.lacks(str(Path(folder) / 'missing')), list(render_demo.FILTERS + render_demo.ENCODERS))
        self.assertEqual(render_demo.lacks(render_demo.FFMPEG), [])


class Lookalikes(unittest.TestCase):
    def test_signs_a_brand_font_lacks_are_written_as_their_ascii_twins(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'caption.txt'
            render_demo.text_filter(path, 'Rozmiary 2×1, 2×2 i 3×2')
            self.assertEqual(path.read_text(), 'Rozmiary 2x1, 2x2 i 3x2')

if __name__ == '__main__':
    unittest.main()
