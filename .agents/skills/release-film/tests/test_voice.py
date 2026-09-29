"""The narrator: VoxCPM2 where it is set up (never in CI), edge-tts elsewhere, in the film's language, one text for
both, and only the chapters whose words changed spoken again."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import cut  # noqa: E402
import montage  # noqa: E402
import voice  # noqa: E402

try:  # the VoxCPM2 Python has them; the skill's own tests run without
    import numpy
    import scipy  # noqa: F401
except ImportError:
    numpy = None


class Voice(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        for name, value in (('VOXCPM', root / 'voxcpm'),):
            patcher = mock.patch.object(cut, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = mock.patch.object(cut.core, 'HOME', root / 'home')
        patcher.start()
        self.addCleanup(patcher.stop)
        patcher = mock.patch.dict(os.environ)
        patcher.start()
        self.addCleanup(patcher.stop)
        for name in ('RELEASE_FILM_VOICE', 'RELEASE_FILM_CI'):
            os.environ.pop(name, None)
        self.run = root / 'run'
        self.run.mkdir()
        (self.run / 'meta.json').write_text(json.dumps({'repo': 'Acme/shop'}))
        (self.run / 'sources.json').write_text(json.dumps({'repo': 'Acme/shop', 'prs': [], 'language': 'pl'}))
        self.story = {'chapters': [{'sentences': [{'text': 'Eksport do PDF.'}, {'text': 'Mamy 2 godziny.'}]},
                                   {'sentences': [{'text': 'Zwykłe zdanie.'}]}]}

    def set_up_voxcpm(self, languages=('pl', 'en')):
        (cut.VOXCPM / 'venv' / 'bin').mkdir(parents=True)
        (cut.VOXCPM / 'venv' / 'bin' / 'python').touch()
        (cut.VOXCPM / 'ready.json').write_text('{}')
        for code in languages:
            (cut.VOXCPM / f'narrator-{code}.wav').write_bytes(b'RIFF')

    def narrate(self, story, addon=None):
        """(the Python each voice ran with, its jobs) of one narrate, and its results."""
        spoken = []

        def sh(cmd, timeout=None, **_):
            jobs = json.loads(Path(cmd[2]).read_text(encoding='utf-8'))
            spoken.append((cmd[0], jobs))
            for job in jobs:
                Path(job['out']).mkdir(parents=True, exist_ok=True)
                (Path(job['out']) / 'audio.mp3').write_bytes(b'voice')
                (Path(job['out']) / 'subtitles.srt').write_text('1\n00:00:00,000 --> 00:00:00,500\nx\n')
            return mock.Mock(stdout=json.dumps([{'out': job['out'], 'terms': []} for job in jobs]))
        with mock.patch.object(cut.core, 'sh', sh), mock.patch.object(cut.core, 'mark'), \
                mock.patch.object(cut.core, 'ensure_tts', return_value='edge-python'):
            results = cut.narrate(self.run, story, addon or {})
        return spoken, results

    def test_the_microsoft_voice_speaks_unless_voxcpm_is_asked_for(self):
        self.assertEqual(cut.engine(), 'edge')
        self.set_up_voxcpm()
        self.assertEqual(cut.engine(), 'edge')  # set up is not asked for: its tone changed from chapter to chapter
        with mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'voxcpm'}):
            self.assertEqual(cut.engine(), 'voxcpm')
        with mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'edge'}):
            self.assertEqual(cut.engine(), 'edge')
        with mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'piper'}), self.assertRaises(SystemExit):
            cut.engine()

    def test_only_the_chapters_whose_words_changed_are_spoken_again(self):
        spoken, results = self.narrate(self.story)
        (python, jobs), = spoken
        self.assertEqual(python, 'edge-python')
        self.assertEqual([job['sentences'] for job in jobs], [['Eksport do PDF.', 'Mamy 2 godziny.'], ['Zwykłe zdanie.']])
        self.assertEqual([job['lexicon'] for job in jobs], [{'PDF': 'pe de ef'}, {}])  # the terms each chapter says
        self.assertEqual([(job['engine'], job['voice']) for job in jobs], [('edge', 'pl-PL-MarekNeural')] * 2)
        self.assertEqual(len(results), 2)
        self.assertEqual(self.narrate(self.story, {'pronunciation': {'Faktura': 'faktura'}})[0], [])  # no chapter says it
        self.story['chapters'][1]['sentences'][0]['text'] = 'Inne zdanie.'
        spoken, results = self.narrate(self.story)
        self.assertEqual([job['text'] for _, jobs in spoken for job in jobs], ['Inne zdanie.'])
        self.assertEqual([r['out'] for r in results], [str(self.run / 'voice' / 'c1'), str(self.run / 'voice' / 'c2')])

    def test_a_new_narrator_speaks_every_chapter_again_with_its_own_python(self):
        self.narrate(self.story)
        self.set_up_voxcpm()
        with mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'voxcpm'}):
            spoken, _ = self.narrate(self.story)
        (python, jobs), = spoken
        self.assertEqual(python, str(cut.VOXCPM / 'venv' / 'bin' / 'python'))
        self.assertEqual({(job['engine'], job['voice']) for job in jobs}, {('voxcpm', str(cut.VOXCPM / 'narrator-pl.wav'))})
        self.assertEqual(len(jobs), 2)

    def test_voxcpm_asked_for_but_not_set_up_stops_the_voice(self):
        with mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'voxcpm'}), self.assertRaisesRegex(SystemExit, 'voice-setup'):
            self.narrate(self.story)
        self.set_up_voxcpm(languages=('pl',))  # set up before its narrator had an English line
        (self.run / 'sources.json').write_text(json.dumps({'repo': 'Acme/shop', 'prs': [], 'language': 'en'}))
        with mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'voxcpm'}), \
                self.assertRaisesRegex(SystemExit, 'English narrator'):
            self.narrate(self.story)

    def test_an_english_film_is_spoken_by_an_english_voice_with_its_names_as_written(self):
        (self.run / 'sources.json').write_text(json.dumps({'repo': 'Acme/shop', 'prs': [], 'language': 'en'}))
        story = {'chapters': [{'sentences': [{'text': 'The PDF export shows 187h.'}]}]}
        (_, jobs), = self.narrate(story)[0]
        self.assertEqual((jobs[0]['language'], jobs[0]['voice'], jobs[0]['lexicon']), ('en', 'en-US-GuyNeural', {}))
        self.assertEqual(jobs[0]['pause'], 1.1)  # a little longer than the voice's own pause between sentences
        self.set_up_voxcpm()
        with mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'voxcpm'}):
            (_, jobs), = self.narrate(story)[0]
        self.assertEqual(jobs[0]['voice'], str(cut.VOXCPM / 'narrator-en.wav'))
        self.assertEqual(cut.lexicon({'pronunciation': {'Acme': 'Akme'}}, 'en'), {'Acme': 'Akme'})  # the add-on's only
        self.assertEqual(cut.lexicon({}, 'pl')['PDF'], 'pe de ef')  # a Polish voice spells it


    def test_the_voice_check_speaks_one_sentence_and_reports_a_refusal(self):
        def spoke(cmd, timeout=None, **_):  # edge-tts answered: the sentence became audio
            [job] = json.loads(Path(cmd[2]).read_text(encoding='utf-8'))
            self.assertEqual((job['engine'], job['voice']), ('edge', 'en-US-GuyNeural'))
            Path(job['out']).mkdir(parents=True, exist_ok=True)
            (Path(job['out']) / 'audio.mp3').write_bytes(b'voice')
            (Path(job['out']) / 'subtitles.srt').write_text('1\n00:00:00,000 --> 00:00:00,500\nx\n')
            return mock.Mock(stdout=json.dumps([{'out': job['out'], 'terms': []}]))
        with mock.patch.dict(os.environ, {'RELEASE_FILM_CI': '1'}), mock.patch.object(cut.core, 'mark'), \
                mock.patch.object(cut.core, 'ensure_tts', return_value='edge-python'):
            with mock.patch.object(cut.core, 'sh', spoke):
                found = cut.voice_check('en')
            self.assertEqual((found['ok'], found['engine']), (True, 'edge'))
            refused = RuntimeError('command failed (1): 403 Invalid response status')  # a service refusing this machine
            with mock.patch.object(cut.core, 'sh', side_effect=refused):
                found = cut.voice_check('en')
        self.assertEqual((found['ok'], found['engine']), (False, 'edge'))
        self.assertIn('403', found['error'])


class Timing(unittest.TestCase):
    def test_words_share_their_sentence_by_syllables_and_their_srt_reads_back(self):
        events = voice.timed(['Mamy', 'dwie', 'godziny,', 'a', 'cel.'], 1.0, 4.4)
        self.assertEqual([e['offset'] for e in events], [10_000_000, 20_000_000, 25_000_000, 44_000_000, 49_000_000])
        self.assertEqual(events[2]['duration'], 19_000_000)  # three syllables and the comma's pause
        words = montage.words_from_srt(voice.srt(events))
        self.assertEqual(words[0], (1.0, 2.0, 'Mamy'))
        self.assertEqual(words[-1], (4.9, 5.4, 'cel.'))


class Pace(unittest.TestCase):
    def test_sentences_said_close_together_get_the_pause_between_them(self):
        ffmpeg = cut.core.tool('ffmpeg', home=False)
        if not ffmpeg:
            self.skipTest('ffmpeg')
        sentences = ['One two.', 'Three four.', 'Five.']
        words = [(0.2, 0.6, 'One'), (0.6, 1.0, 'two.'), (1.2, 1.6, 'Three'), (1.6, 2.0, 'four.'), (2.1, 2.9, 'Five.')]
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            subprocess.run([ffmpeg, '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ac', '1',
                            '-c:a', 'libmp3lame', str(folder / 'audio.mp3')], check=True)
            (folder / 'subtitles.srt').write_text(montage.shifted_srt(words, []), encoding='utf-8')
            cut.paced(ffmpeg, folder, sentences)
            paced = montage.words_from_srt((folder / 'subtitles.srt').read_text(encoding='utf-8'))
            # 0.2 s and 0.1 s between the sentences became the pause (1.1 s): 0.9 s and 1.0 s of silence went in
            self.assertEqual(montage.sentence_starts(paced, sentences), [0.2, 2.1, 4.0])
            self.assertEqual(montage.sentence_ends(paced, sentences), [1.0, 2.9, 4.8])
            self.assertAlmostEqual(cut.audio_seconds(folder / 'audio.mp3'), 4.9, delta=0.1)
            before = (folder / 'audio.mp3').read_bytes()
            cut.paced(ffmpeg, folder, sentences)  # paced already: left as it is
            self.assertEqual((folder / 'audio.mp3').read_bytes(), before)
            self.assertEqual(sorted(p.name for p in folder.iterdir()), ['audio.mp3', 'subtitles.srt'])


@unittest.skipUnless(numpy is not None, 'numpy and scipy (the VoxCPM2 Python has them)')
class Loudness(unittest.TestCase):
    def test_every_sentence_is_made_as_loud_and_its_peaks_stay_under_the_ceiling(self):  # chapters had ranged 4 LU
        rate = 48000
        tone = numpy.sin(2 * numpy.pi * 220 * numpy.arange(rate * 2) / rate)
        for wav in (0.02 * tone, 0.3 * tone, numpy.concatenate([0.05 * tone, [0.9, -0.9], 0.05 * tone])):
            out = voice.levelled(wav, rate)
            self.assertAlmostEqual(voice.loudness(out, rate), voice.LOUDNESS, delta=0.6)
            self.assertLessEqual(float(numpy.abs(out).max()), voice.CEILING + 1e-4)
        silence = numpy.zeros(rate)
        self.assertIs(voice.levelled(silence, rate), silence)


if __name__ == '__main__':
    unittest.main()
