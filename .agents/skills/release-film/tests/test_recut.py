"""Recuts use immutable source assets and never manufacture a new voice or take."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import cut  # noqa: E402
import render_demo  # noqa: E402


class Recut(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()  # macOS: /var is /private/var, and the code resolves paths
        self.run, self.out = self.root / 'run', self.root / 'again'
        self.voice = self.run / 'voice' / 'c1'
        self.take = self.run / 'takes' / 'one'
        self.voice.mkdir(parents=True)
        self.take.mkdir(parents=True)
        self.story = {'chapters': [{'title': 'Saved result', 'film': 'one', 'prs': [],
                                    'sentences': [{'text': 'Saved.', 'action': 0}]}], 'keys': {'one': str(self.take)}}
        (self.run / 'voice' / 'done.json').write_text(json.dumps({'jobs': [{'text': 'Saved.'}]}))
        (self.voice / 'audio.mp3').write_bytes(b'cached narration')
        (self.voice / 'subtitles.srt').write_text('1\n00:00:00,100 --> 00:00:00,500\nSaved.\n')
        (self.take / 'take.mp4').write_bytes(b'cached take')
        self.capture = {'take': str(self.take / 'take.mp4'), 'documents': []}
        self.save_capture()

    def save_capture(self):
        (self.take / 'capture.json').write_text(json.dumps(self.capture))

    def snapshot(self):
        return {str(p.relative_to(self.run)): p.read_bytes() for p in self.run.rglob('*') if p.is_file()}

    def rejected(self, pattern):
        before = self.snapshot()
        with mock.patch.object(cut, 'narrate') as voice, mock.patch.object(cut.takes, 'convert') as convert:
            with self.assertRaisesRegex(SystemExit, pattern):
                cut.make(self.run, self.story, {'prs': []}, {}, out=self.out)
            voice.assert_not_called()
            convert.assert_not_called()
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(self.out.exists())

    def test_missing_and_changed_narration_are_rejected_before_any_write(self):
        (self.voice / 'audio.mp3').unlink()
        self.rejected('cached narration matching')
        (self.voice / 'audio.mp3').write_bytes(b'cached narration')
        self.story['chapters'][0]['sentences'][0]['text'] = 'Changed.'
        self.rejected('cached narration matching')

    def test_missing_and_stale_takes_are_rejected_without_conversion(self):
        (self.take / 'take.mp4').unlink()
        self.rejected('already converted take')
        (self.take / 'take.mp4').write_bytes(b'cached take')
        after = (self.take / 'capture.json').stat().st_mtime + 10
        os.utime(self.take / 'take.mp4', (after, after))
        self.rejected('already converted take')

    def test_uncached_pdf_is_rejected_without_rendering_into_its_source(self):
        pdf = self.take / 'statement.pdf'
        pdf.write_bytes(b'original PDF')
        self.capture['documents'] = [{'file': str(pdf), 'step': 0}]
        self.save_capture()
        self.rejected('cached document image missing')

    def test_output_cannot_overlap_sources_or_reuse_existing_content(self):
        alias = self.root / 'alias'
        alias.symlink_to(self.run, target_is_directory=True)
        for destination in (self.run, self.run / 'recut', self.root, alias / 'recut', self.take):
            with self.subTest(destination=destination), self.assertRaisesRegex(SystemExit, 'overlaps'):
                cut.recut_inputs(self.run, self.story, destination)
        self.out.mkdir()
        (self.out / 'voice').symlink_to(self.run / 'voice', target_is_directory=True)
        with self.assertRaisesRegex(SystemExit, 'not empty'):
            cut.recut_inputs(self.run, self.story, self.out)

    def test_complete_cache_is_reused_and_only_output_receives_files(self):
        before = self.snapshot()
        stats = {'metrics': {}}
        with mock.patch.object(cut, 'narrate') as voice, mock.patch.object(cut.takes, 'convert') as convert, \
                mock.patch.object(cut, 'film_font', return_value=('/font.ttf', 'test font', None)), \
                mock.patch.object(cut, 'chapter_cut', return_value=({'title': 'Saved result'}, stats)) as chapter, \
                mock.patch.object(render_demo, 'prepare'), mock.patch.object(render_demo, 'load_plan', return_value={}), \
                mock.patch.object(render_demo, 'render'), mock.patch.object(cut, 'audio_seconds', return_value=200), \
                mock.patch.object(cut.metrics, 'summary', return_value={}):
            result = cut.make(self.run, self.story, {'prs': []}, {}, out=self.out)
        voice.assert_not_called()
        convert.assert_not_called()
        self.assertEqual(chapter.call_args.args[3], self.voice)
        self.assertEqual(chapter.call_args.args[5], self.out / 'voice' / 'c1')
        self.assertTrue(chapter.call_args.kwargs['cached_only'])
        self.assertEqual(self.snapshot(), before)
        self.assertTrue((self.out / 'film.json').is_file())
        self.assertEqual(result['seconds'], 200)



class Steps(unittest.TestCase):
    def test_a_label_shows_from_its_sentence_until_the_next_one(self):
        chapter = {'title': 'Raport godzin', 'sentences': [{'text': 'A.', 'label': 'Nowy raport'}, {'text': 'B.'},
                                                           {'text': 'C.', 'label': 'Eksport do PDF'},
                                                           {'text': 'D.', 'label': 'Eksport do PDF'}]}
        film = {'sentences': [0.3, 4.1, 7.25, 9.0]}
        self.assertEqual(cut.steps_of(chapter, film, 2), [[2, 'Nowy raport'], [9.25, 'Eksport do PDF']])
        chapter['sentences'][0].pop('label')  # an unlabelled first sentence shows the chapter's title
        self.assertEqual(cut.steps_of(chapter, film, 2)[0], [2, 'Raport godzin'])
        self.assertEqual(cut.steps_of(chapter, {'sentences': [0.3]}, 2), [[2, 'Raport godzin']])  # voice and story differ

    def test_an_abbreviation_before_a_capital_keeps_every_label(self):  # "np. Excel" left only the chapter's title
        steps = [{'step': n, 'cmd': ['click', f'#b{n}'], 'acting': True, 'w': n + 0.1, 'm': n + 0.15, 'a': n + 0.2,
                  'b': n + 0.9} for n in range(3)]
        chapter = {'title': 'Eksport', 'sentences': [
            {'text': 'Eksport obejmuje np. Excel i PDF.', 'action': 0, 'label': 'Formaty eksportu'},
            {'text': 'Klikamy „Pobierz”', 'action': 1, 'label': 'Pobranie pliku'},
            {'text': 'Plik ma ok. 5 stron.', 'action': 2, 'label': 'Pięć stron raportu'}]}
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'capture.json').write_text(json.dumps({'steps': steps, 'end': 4.0, 'active': [], 'stills': []}))
            spec, capture = cut.chapter_setup(chapter, folder)
        self.assertEqual(spec['sentences'], [s['text'] for s in chapter['sentences']])
        # the voice's words (one per written word) and the review's estimate alike
        voiced = [(round(0.1 + 0.3 * i, 3), round(0.35 + 0.3 * i, 3), word)
                  for i, word in enumerate(spec['narration'].split())]
        for words in (voiced, cut.montage.estimated_words(spec['narration'])):
            film = cut.montage.cut(spec, capture, words)
            self.assertEqual(len(film['sentences']), 3)
            self.assertEqual([text for _, text in cut.steps_of(chapter, film, 2)],
                             ['Formaty eksportu', 'Pobranie pliku', 'Pięć stron raportu'])


if __name__ == '__main__':
    unittest.main()
