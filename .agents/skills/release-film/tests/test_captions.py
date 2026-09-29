"""Caption cues from the voice's word SRT; no media or network required."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_captions import CAPTION_HOLD, CUT_MARGIN, prepare_captions  # noqa: E402


def cue(text='Wynik.', start='00:00:00,000', end='00:00:10,000', index=1):
    return f'{index}\n{start} --> {end}\n{text}\n'


def stamp(seconds):
    ms = int(round(seconds * 1000))
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'


def spoken(text, start=0.1, step=0.5, length=0.4):
    """A word SRT: each word ``length`` long, one every ``step`` seconds."""
    return '\n'.join(cue(word, stamp(start + i * step), stamp(start + i * step + length), i + 1)
                     for i, word in enumerate(text.split()))


class Captions(unittest.TestCase):
    def test_words_are_grouped_into_readable_cues_in_order(self):
        text = ('Użytkownik sprawdza zmieniony projekt oraz aktualny budżet. '
                'Następnie zapisuje poprawki i ogląda wynik działania.')
        captions = prepare_captions(spoken(text, step=1.0), 20)
        self.assertGreater(len(captions), 1)
        self.assertEqual(' '.join(' '.join(c['text'].split()) for c in captions), text)
        for c in captions:
            self.assertEqual(c['timing'], 'word_boundary')
            self.assertLessEqual(len(c['text'].splitlines()), 2)
            self.assertTrue(all(len(line) <= 40 for line in c['text'].splitlines()))
        self.assertEqual(captions[0]['start'], 2.1)

    def test_a_caption_stays_through_a_short_pause_but_not_a_long_silence(self):
        srt = '\n'.join([cue('Pierwsze.', '00:00:00,100', '00:00:02,000'), cue('Drugie.', '00:00:02,500', '00:00:03,000', 2),
                         cue('Trzecie.', '00:00:09,000', '00:00:10,000', 3)])
        captions = prepare_captions(srt, 10, 0)
        self.assertEqual([(c['start'], c['end']) for c in captions], [(0.1, 2.5), (2.5, 3.0 + CAPTION_HOLD), (9.0, 10.0)])

    def test_a_caption_leaves_with_its_picture_but_never_before_its_words(self):
        srt = '\n'.join([cue('Pierwsze.', '00:00:00,100', '00:00:02,000'), cue('Drugie.', '00:00:04,000', '00:00:05,000', 2),
                         cue('Trzecie.', '00:00:08,000', '00:00:09,000', 3)])
        # the picture leaves the first sentence at 2.4 s, the second one at 4.5 s (under its own words)
        captions = prepare_captions(srt, 10, 2, limits=[[0.1, 2.4], [4.0, 4.5], [8.0, None]])
        self.assertEqual([round(c['end'], 3) for c in captions], [2 + 2.4 - CUT_MARGIN, 2 + 5.0, 2 + 9.0])

    def test_a_word_too_long_for_a_line_is_cut_short(self):
        captions = prepare_captions(cue('x' * 41), 10)
        self.assertEqual([c['text'] for c in captions], ['x' * 39 + '…'])

    def test_bom_crlf_and_tiny_overlaps(self):
        srt = '﻿' + '\n'.join([cue('Pierwszy.', end='00:00:01,000'), cue('Drugi.', '00:00:00,950', '00:00:02,000', 2)])
        captions = prepare_captions(srt.replace('\n', '\r\n'), 2, 0)
        self.assertEqual([c['text'] for c in captions], ['Pierwszy.', 'Drugi.'])  # a cue per sentence
        self.assertEqual([(c['start'], c['end']) for c in captions], [(0.0, 1.0), (1.0, 2.0)])

    def test_reject_invalid_inputs(self):
        invalid = ['', 'stray text', cue(' '), cue('Dwa słowa'), cue('…'),
                   cue(start='-00:00:01,000'), cue(start='nan'), cue(end='inf'),
                   cue(end='00:60:00,000'), cue(end='00:00:10.000'),
                   cue(end='00:00:10,002'), cue(end='00:00:00,000'),
                   cue(start='00:00:02,000', end='00:00:01,000'),
                   cue() + '\ntrailing garbage',
                   cue(end='00:00:01,000') + '\n' + cue(start='00:00:00,939', index=2),
                   cue(end='00:00:01,000') + '\n' + cue(start='00:00:00,950', end='00:00:00,999', index=2),
                   cue(start='00:00:01,000', end='00:00:01,020') + '\n' + cue(start='00:00:00,990', index=2)]
        for srt in invalid:
            with self.subTest(srt=srt), self.assertRaises(ValueError):
                prepare_captions(srt, 10)
        for field in ['audio_seconds', 'offset']:
            for value in [float('nan'), float('inf'), -1, True]:
                args = dict(audio_seconds=10, offset=2)
                args[field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    prepare_captions(cue(), **args)

    def test_one_millisecond_overhang_is_clamped(self):
        captions = prepare_captions(cue(end='00:00:10,001'), 10)
        self.assertEqual(captions[-1]['end'], 12)
        with self.assertRaises(ValueError):
            prepare_captions(cue(end='00:00:10,002'), 10)


if __name__ == '__main__':
    unittest.main()
