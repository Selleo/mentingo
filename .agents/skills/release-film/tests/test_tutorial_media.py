"""Decode real local media to check continuous speech across visual cuts, without providers or drawtext."""
import array
import math
import json
import os
import shutil
from types import SimpleNamespace
from unittest import mock
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import core
import cut
import montage
import render_demo
import self_onboarding_recording as recording


class TutorialMedia(unittest.TestCase):
    def setUp(self):
        self.ffmpeg = core.tool('ffmpeg', home=False)
        if not self.ffmpeg:
            self.skipTest('ffmpeg')
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.video = self.root / 'silent-visual.mp4'
        self.voice = self.root / 'voice.wav'
        self.command('-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=30:d=1', '-an', '-c:v', 'libx264', self.video)
        self.command('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3',
                     '-c:a', 'pcm_s16le', self.voice)

    def command(self, *args):
        subprocess.run([self.ffmpeg, '-v', 'error', '-y', *map(str, args)], check=True, capture_output=True)

    def samples(self, video):
        out = self.root / 'decoded.wav'
        self.command('-i', video, '-vn', '-ac', 1, '-ar', 48000, '-c:a', 'pcm_s16le', out)
        with wave.open(str(out)) as audio:
            return array.array('h', audio.readframes(audio.getnframes()))

    def rms(self, samples, start, end):
        part = samples[round(start * 48000):round(end * 48000)]
        return math.sqrt(sum(value * value for value in part) / len(part)) / 32768

    def test_visual_segments_are_encoded_without_chopped_speech_tracks(self):
        segment = {'kind': 'card', 'start': 0, 'duration': 1}
        plan = {'chapters': [{'start': 0, 'audio': str(self.voice), 'audio_offset': 0}], 'segments': [segment]}
        output = self.root/'video-only.mp4'
        with mock.patch.object(render_demo, 'card_visual', return_value=(['-i', str(self.video)], '[0:v]setpts=PTS-STARTPTS[v0]')):
            render_demo.encode_segment(plan, segment, self.root, {}, output)
        self.assertTrue(any(stream['codec_type'] == 'video' for stream in render_demo.probe(output)['streams']))
        self.assertFalse(any(stream['codec_type'] == 'audio' for stream in render_demo.probe(output)['streams']))

    def test_speech_cache_survives_visual_changes_but_separates_languages(self):
        source = self.root/'source.mp3'
        self.command('-i', self.voice, '-c:a', 'libmp3lame', source)
        run = self.root/'run'
        core.save(run/'sources.json', {'mode': 'tutorial', 'language': 'en'})
        story = {'chapters': [{'sentences': [{'text': 'First.'}, {'text': 'Second.'}]}]}
        actual_sh = core.sh
        paid_calls = []
        def transport(command, **kwargs):
            if len(command) > 2 and str(command[1]).endswith('/voice.py'):
                jobs = core.load(command[2]); paid_calls.extend(jobs)
                for job in jobs:
                    folder = Path(job['out']); folder.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source, folder/'audio.mp3')
                    (folder/'subtitles.srt').write_text(montage.shifted_srt([(.1,.5,'First.'),(.6,1,'Second.')], []))
                return SimpleNamespace(stdout=json.dumps([{'out': job['out']} for job in jobs]))
            return actual_sh(command, **kwargs)
        with mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'elevenlabs', 'ELEVENLABS_VOICE_ID': 'test-narrator'}), \
                mock.patch.object(core, 'sh', side_effect=transport):
            first = recording.narrate_cached(self.root/'cache', run, story, {'brand': {'colors': {'accent': '#3f58b6'}}})
            second = recording.narrate_cached(self.root/'cache', run, story, {'brand': {'colors': {'accent': '#222949'}}})
            self.assertEqual(first, second)
            self.assertEqual(len(paid_calls), 1)
            core.save(run/'sources.json', {'mode': 'tutorial', 'language': 'pl'})
            third = recording.narrate_cached(self.root/'cache', run, story, {})
        self.assertNotEqual(first, third)
        self.assertEqual([job['language'] for job in paid_calls], ['en', 'pl'])
        self.assertTrue((first/'c1/paced.wav').is_file())

    def test_visual_boundaries_do_not_cut_or_reset_the_continuous_narration(self):
        listing = self.root / 'concat.txt'
        listing.write_text(f"file '{self.video}'\n" * 3)
        output = self.root / 'film.mp4'
        render_demo.mux_narration({'chapters': [{'audio': str(self.voice), 'start': 0, 'audio_offset': 0}]},
                                  listing, output, 3)
        samples = self.samples(output)
        middle = self.rms(samples, 0.4, 0.6)
        for boundary in [1, 2]:
            self.assertGreater(self.rms(samples, boundary - .02, boundary + .02), middle * .85)
        self.assertAlmostEqual(len(samples) / 48000, 3, delta=.04)

    def test_chapter_audio_starts_at_its_own_offset_and_does_not_bleed_into_the_gap(self):
        short = self.root / 'short.wav'
        self.command('-i', self.voice, '-t', 1, short)
        listing = self.root / 'four-visuals.txt'
        listing.write_text(f"file '{self.video}'\n" * 4)
        output = self.root / 'chapters.mp4'
        render_demo.mux_narration({'chapters': [
            {'audio': str(short), 'start': 0, 'audio_offset': .5},
            {'audio': str(short), 'start': 2, 'audio_offset': .5},
        ]}, listing, output, 4)
        samples = self.samples(output)
        for start, end in [(.1, .3), (1.8, 2.2)]:
            self.assertLess(self.rms(samples, start, end), .002)
        for start, end in [(.7, .9), (2.7, 2.9)]:
            self.assertGreater(self.rms(samples, start, end), .04)

    def test_tutorial_pause_insertion_preserves_the_original_mp3_and_uses_pcm_for_rendering(self):
        mp3 = self.root / 'audio.mp3'
        self.command('-i', self.voice, '-c:a', 'libmp3lame', mp3)
        original = mp3.read_bytes()
        words = [(.1, .5, 'First.'), (.6, 1.0, 'Second.')]
        (self.root / 'subtitles.srt').write_text(montage.shifted_srt(words, []))
        cut.paced(self.ffmpeg, self.root, ['First.', 'Second.'], lossless=True)
        self.assertEqual(mp3.read_bytes(), original)
        self.assertEqual(cut.narration_audio(self.root), self.root / 'paced.wav')
        self.assertEqual(render_demo.probe(self.root / 'paced.wav')['streams'][0]['codec_name'], 'pcm_s16le')
        paced = montage.words_from_srt((self.root / 'subtitles.srt').read_text())
        self.assertAlmostEqual(paced[1][0] - paced[0][1], cut.PAUSE, places=2)


if __name__ == '__main__':
    unittest.main()
