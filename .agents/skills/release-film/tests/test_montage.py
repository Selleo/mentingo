"""Film timing of event-driven captures (pure functions)."""
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import language  # noqa: E402
import montage  # noqa: E402
import render_demo  # noqa: E402

FPS = montage.FPS


def words_at(*sentences):
    """Word timings: each sentence ``(start, text)``, words 0.3 s apart."""
    words = []
    for start, text in sentences:
        for i, word in enumerate(text.split()):
            words.append((round(start + 0.3 * i, 3), round(start + 0.3 * i + 0.25, 3), word))
    return words


def capture(steps, active=(), blank=(), end=None, changes=()):
    """A capture with a clean clock (frame k shows capture time k/30)."""
    last = end if end is not None else max(s['b'] for s in steps) + 0.5
    return {'scale': 1, 'start': 0.0, 'end': last, 'steps': steps, 'active': list(active), 'blank': list(blank),
            'changes': list(changes), 'timeline': [(round(k / FPS, 4), round(k / FPS, 3)) for k in range(int(last * FPS) + 1)]}


def shown_at(film, t):
    """The capture time on screen at film time ``t`` (a piece's last frame holds until the next piece starts)."""
    a, b, f = max((p for p in film['pieces'] if p[2] <= t), key=lambda p: p[2])
    return a + (t - f) if t < f + (b - a) else b - 1 / FPS


def step(index, w, a, b, point=None, acting=True, click=True, **extra):
    return dict({'step': index, 'w': w, 'm': w + 0.01 if point else a, 'a': a, 'b': b, 'point': point, 'acting': acting,
                 'click': click and point is not None, 'pre': {'url': 'u'}, 'post': {'url': 'u'}}, **extra)


class Narration(unittest.TestCase):
    def test_a_question_inside_a_quote_does_not_end_the_sentence(self):
        words = [(0.0, 0.3, 'Okno'), (0.3, 0.6, '„Leave'), (0.6, 0.9, 'editor?”'), (0.9, 1.2, 'pyta,'), (1.2, 1.5, 'np.'),
                 (1.5, 1.8, 'teraz.'), (2.0, 2.3, 'Zapisujemy.')]
        self.assertEqual(montage.sentence_starts(words), [0.0, 2.0])
        self.assertEqual(len(montage.sentence_starts(montage.estimated_words('Okno „Leave editor?” pyta, np. teraz. Dalej.'))), 2)

    def test_words_sentences_and_estimates(self):
        srt = '1\n00:00:00,100 --> 00:00:00,500\nOto\n\n2\n00:00:00,500 --> 00:00:01,000\nzmiany.\n\n' \
              '3\n00:00:01,200 --> 00:00:01,600\nKoniec.\n'
        words = montage.words_from_srt(srt)
        self.assertEqual(words[1], (0.5, 1.0, 'zmiany.'))
        self.assertEqual(montage.sentence_starts(words), [0.1, 1.2])
        estimate = montage.estimated_words('Krótkie zdanie. Drugie, znacznie dłuższe zdanie z nazwami.')
        starts = montage.sentence_starts(estimate)
        self.assertEqual(starts[0], 0.0)
        letters = len('Krótkiezdanie')
        self.assertAlmostEqual(starts[1], montage.SPEECH_LETTER * letters + montage.SPEECH_SENTENCE, places=2)
        self.assertEqual(len(estimate), 8)

    def test_the_sentences_the_voice_read_place_every_start(self):  # "np. Excel" used to start a sentence
        said = ('Eksport obejmuje np. Excel i PDF.', 'Klikamy „Pobierz”', 'Plik ma ok. 5 stron.', 'iPhone też go otworzy.')
        words = words_at(*[(0.1 + 3.0 * i, text) for i, text in enumerate(said)])
        self.assertEqual(montage.sentence_starts(words, said), [0.1, 3.1, 6.1, 9.1])
        self.assertEqual(montage.sentence_ends(words, said)[:2], [1.85, 3.65])
        # a dash the voice says no word for goes with the word before it ("raport. –" does not look like an end)
        dashed = ('Zapisujemy raport.', '– Gotowe – mówi system.')
        voiced = [(0.1, 0.35, 'Zapisujemy'), (0.4, 0.65, 'raport. –'), (3.1, 3.35, 'Gotowe –'), (3.4, 3.65, 'mówi'),
                  (3.7, 3.95, 'system.')]
        self.assertEqual(montage.sentence_starts(voiced, dashed), [0.1, 3.1])
        self.assertEqual(len(montage.sentence_starts(montage.estimated_words(' '.join(dashed)), dashed)), 2)
        # without them, or for words that are not theirs, the punctuation decides, knowing the abbreviations
        self.assertEqual(montage.sentence_starts(words, ('Inne zdanie.',)), montage.sentence_starts(words))
        english = words_at((0.1, 'Exports cover e.g. Excel and PDF files.'), (3.0, 'Save it.'))
        self.assertEqual(montage.sentence_starts(english), [0.1, 3.0])
        self.assertEqual(len(montage.sentence_starts(montage.estimated_words(f'{said[0]} {said[2]}'))), 2)

    def test_silences_shift_the_words_after_them(self):
        words = words_at((0.1, 'Pierwsze zdanie.'), (2.0, 'Drugie zdanie.'))
        shifted = montage.words_from_srt(montage.shifted_srt(words, [(2.0, 1.5)]))
        self.assertEqual(shifted[1][:2], words[1][:2])  # before the silence: unchanged
        self.assertEqual(shifted[2][0], 3.5)  # the second sentence waits 1.5 s
        self.assertEqual([w[2] for w in shifted], [w[2] for w in words])


class Cut(unittest.TestCase):
    def setUp(self):
        self.words = words_at((0.1, 'Otwieramy stronę.'), (4.0, 'Klikamy zapis.'), (8.0, 'Wynik jest widoczny.'))
        self.spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}, {'cmd': ['click', '#save'], 'beat': 2},
                               {'cmd': ['hover', '#result'], 'beat': 3}]}
        # the whole scene runs in under 3 s; only the moments right after the actions change the page
        self.capture = capture([step(0, 0.2, 0.4, 0.9, (100, 100)), step(1, 1.0, 1.2, 1.9, (500, 300)),
                                step(2, 2.0, 2.2, 2.7, (900, 600), click=False)],
                               active=[(0.45, 0.8), (1.25, 1.8), (2.25, 2.6)])

    def test_actions_land_with_their_sentences_and_the_page_holds_between(self):
        film = montage.cut(self.spec, self.capture, self.words, audio_duration=9.8)
        # each action lands as its sentence starts (+ LAND, a little before it); the first after the pointer's first glide
        self.assertEqual([a['action'] for a in film['anchors']][1:], [round(4.0 + montage.LAND, 3), round(8.0 + montage.LAND, 3)])
        self.assertLess(film['anchors'][0]['late'], montage.LATE_TOLERANCE)
        self.assertEqual(film['silences'], [])
        # the narration's end, or the last action's state held PROOF_HOLD, whichever is later
        self.assertEqual(film['duration'], round(max(9.8 + montage.DEFAULT_TAIL, 8.0 + montage.LAND + montage.PROOF_HOLD), 3))
        starts = [f for _, _, f in film['pieces']]
        self.assertEqual(starts, sorted(starts))
        gaps = [b[2] - (a[2] + (a[1] - a[0])) for a, b in zip(film['pieces'], film['pieces'][1:])]
        self.assertGreater(max(gaps), 3.0)  # the page holds while the narration talks
        # the pointer glides into each target and arrives just before its action
        self.assertEqual(len(film['pointer']['moves']), 3)
        for move, anchor in zip(film['pointer']['moves'], film['anchors']):
            self.assertLess(move[1], anchor['action'])
            self.assertLess(anchor['action'] - move[1], 0.4)
        self.assertEqual(len(film['pointer']['clicks']), 2)  # hovers show no click ring

    def test_a_second_visible_proof_after_a_narrated_check_is_not_cut_as_setup(self):
        title = {'x': 700, 'y': 40, 'width': 400, 'height': 60}
        sidebar = {'x': 40, 'y': 160, 'width': 300, 'height': 400}
        spec = {'steps': [{'cmd': ['look', 'article'], 'beat': 1}, {'cmd': ['look', 'sidebar']},
                          {'cmd': ['click', 'next page']}, {'cmd': ['look', 'next title'], 'beat': 2}]}
        take = capture([step(0, 0.1, 0.2, 0.5, acting=False, look=True, box=title),
                        step(1, 0.5, 0.6, 0.9, acting=False, look=True, box=sidebar),
                        step(2, 1, 1.1, 3.5, (200, 200)),
                        step(3, 3.5, 3.6, 4.0, acting=False, look=True, box=title)],
                       active=[(0.1, 4.0)])
        film = montage.cut(spec, take, words_at((0.1, 'Artykuł i menu.'), (6, 'Kolejna strona.')))
        proof = next((a for a in film['actions'] if a['step'] == 1), None)
        self.assertIsNotNone(proof, 'The sidebar is evidence for the first sentence, not setup for the next page')
        self.assertLess(proof['t'], film['sentences'][1])

    def test_the_narration_waits_for_actions_that_do_not_fit_their_sentence(self):
        busy = capture([step(0, 0.2, 0.4, 0.9, (100, 100)), step(1, 1.0, 1.2, 6.9, (500, 300)),
                        step(2, 7.0, 7.2, 7.7, (900, 600), click=False)],
                       active=[(0.45, 0.8), (1.25, 6.8), (7.25, 7.6)])  # a 5.5 s animation after the save
        film = montage.cut(self.spec, busy, self.words, audio_duration=9.8)
        waits = {a['beat']: a['waits'] for a in film['anchors']}
        self.assertEqual(waits[1], 0.0)
        self.assertEqual(waits[2], 0.0)
        self.assertGreater(waits[3], 1.0)
        self.assertEqual(len(film['silences']), 1)
        self.assertEqual(film['silences'][0][0], 8.0)  # silence before the third sentence, in speech time
        self.assertAlmostEqual(film['speech'], 9.8 + film['silences'][0][1], places=2)
        self.assertAlmostEqual(film['sentences'][2], 8.0 + film['silences'][0][1], places=2)

    def test_steps_no_sentence_names_come_right_before_the_next_sentence(self):
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}, {'cmd': ['click', '#save'], 'beat': 2},
                          {'cmd': ['click', '#close']}, {'cmd': ['hover', '#result'], 'beat': 3}]}
        take = capture([step(0, 0.2, 0.4, 0.9, (100, 100)), step(1, 1.0, 1.2, 1.9, (500, 300)),
                        step(2, 2.0, 2.2, 2.9, (700, 400)), step(3, 3.0, 3.2, 3.7, (900, 600), click=False)],
                       active=[(0.45, 0.8), (1.25, 1.8), (2.25, 2.8), (3.25, 3.6)])
        film = montage.cut(spec, take, self.words, audio_duration=9.8)
        close = next(a['t'] for a in film['actions'] if a['step'] == 2)
        # the second sentence (4.0–8.0 s) keeps the page its save led to; the close runs just before the third one
        self.assertGreater(close, 6.0)
        self.assertLess(close, 8.15)
        self.assertEqual(film['anchors'][1]['action'], round(4.0 + montage.LAND, 3))
        # the third sentence's action still lands with it (at most a fraction of a second after the sentence starts,
        # the price of the close running late enough not to show under the sentence before): no silence
        self.assertLess(film['anchors'][2]['late'], 0.6)
        self.assertEqual(film['silences'], [])

    def chained(self, words):
        """A save (sentence 2) then a close no sentence names, before the result (sentence 3); sentence 2 has
        ``words`` words, 0.3 s apart."""
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}, {'cmd': ['click', '#save'], 'beat': 2},
                          {'cmd': ['click', '#close']}, {'cmd': ['hover', '#result'], 'beat': 3}]}
        take = capture([step(0, 0.2, 0.4, 0.9, (100, 100)), step(1, 1.0, 1.2, 1.9, (500, 300)),
                        step(2, 2.0, 2.2, 2.9, (700, 400)), step(3, 3.0, 3.2, 3.7, (900, 600), click=False)],
                       active=[(0.45, 0.8), (1.25, 1.8), (2.25, 2.8), (3.25, 3.6)])
        spoken = words_at((0.1, 'Otwieramy stronę.'), (4.0, ' '.join(['Klikamy'] * (words - 1) + ['zapis.'])),
                          (8.0, 'Wynik jest widoczny.'))
        return montage.cut(spec, take, spoken, audio_duration=10.5), spoken

    def test_the_page_answering_a_sentences_action_plays_under_it_before_any_wait(self):
        film, _ = self.chained(2)
        self.assertGreater(shown_at(film, 4.3), 1.7)  # the save's answer (1.25–1.8 s), not the moment of the click

    def test_short_steps_no_sentence_names_wait_for_the_words_and_end_the_previous_caption(self):
        film, spoken = self.chained(8)
        close = next(a for a in film['actions'] if a['step'] == 2)
        said = montage.sentence_ends(spoken)[1]
        approach = close['t_pre'] - montage.MOVE_SECONDS
        self.assertGreaterEqual(approach, said)
        self.assertGreaterEqual(montage.caption_limits(film)[1][1], said)
        self.assertLessEqual(montage.caption_limits(film)[1][1], approach + 0.001)
        self.assertLess(film['anchors'][-1]['waits'], montage.CHAIN_WAIT)

    def test_a_same_page_chain_is_cut_when_waiting_for_the_words_would_delay_the_next_sentence(self):
        film, spoken = self.chained(12)
        self.assertNotIn(2, [a['step'] for a in film['actions']])
        jump = next(a for a in film['actions'] if a.get('navigate'))
        said = montage.sentence_ends(spoken)[1]
        self.assertGreaterEqual(jump['t'], said)
        self.assertLessEqual(montage.caption_limits(film)[1][1], jump['t'])
        self.assertEqual(film['silences'], [])

    def test_a_step_that_closes_the_dialog_waits_for_the_sentence_before_and_ends_its_captions(self):
        # the sentence about adding a person keeps the dialog; the close belongs to the
        # next sentence ("after the dialog closes, she shows in the widget")
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}, {'cmd': ['click', '#add'], 'beat': 2},
                          {'cmd': ['click', '#close']}, {'cmd': ['hover', '#widget'], 'beat': 3}]}
        dialog = {'x': 500, 'y': 200, 'width': 600, 'height': 400}
        take = capture([step(0, 0.2, 0.4, 0.9, (100, 100)),
                        step(1, 1.0, 1.2, 1.9, (500, 300), pre={'url': 'u', 'overlay': dialog}, post={'url': 'u', 'overlay': dialog}),
                        step(2, 2.0, 2.2, 2.9, (700, 400), pre={'url': 'u', 'overlay': dialog}, post={'url': 'u'}),
                        step(3, 3.0, 3.2, 3.7, (900, 600), click=False)],
                       active=[(0.45, 0.8), (1.25, 1.8), (2.25, 2.8), (3.25, 3.6)])
        spoken = words_at((0.1, 'Otwieramy stronę.'), (4.0, ' '.join(['Dodajemy'] * 7 + ['osobę.'])), (8.0, 'Widżet ją pokazuje.'))
        film = montage.cut(spec, take, spoken, audio_duration=10.5)
        said = montage.sentence_ends(spoken)[1]
        close = next(a['t'] for a in film['actions'] if a['step'] == 2)
        self.assertGreaterEqual(close, said + montage.SAID)
        limit = montage.caption_limits(film)[1][1]
        self.assertLessEqual(limit, close)  # the add's captions are gone before the dialog closes
        self.assertGreaterEqual(limit, said)

    def test_a_later_sentence_waits_for_an_action_over_half_a_second_late(self):
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}, {'cmd': ['click', '#save'], 'beat': 2}]}
        take = capture([step(0, 0.2, 0.4, 3.8, (100, 100)), step(1, 3.85, 4.05, 4.6, (500, 300))],
                       active=[(0.45, 3.75), (4.1, 4.5)])  # a 3.3 s animation after the first click
        film = montage.cut(spec, take, words_at((0.1, 'Otwieramy stronę.'), (4.0, 'Klikamy zapis.')), audio_duration=6)
        first, second = film['anchors']
        self.assertGreater(first['late'], montage.LATE_TOLERANCE_LATER)  # the first action may be that late: no wait
        self.assertEqual(first['waits'], 0.0)
        self.assertTrue(montage.LATE_TOLERANCE_LATER < second['late'] <= montage.LATE_TOLERANCE)
        self.assertEqual(film['silences'], [(4.0, second['late'])])

    def test_a_reload_and_another_window_are_labelled(self):
        spec = {'steps': [{'cmd': ['click', '#play'], 'beat': 1}, {'cmd': ['reload', ''], 'beat': 2},
                          {'cmd': ['click', '#course'], 'beat': 3}]}
        reload = step(1, 1.0, 1.2, 2.4, None, acting=False, navigate=True, url='http://app/lesson/7', cmd=['reload', ''])
        other = step(2, 2.5, 2.7, 3.2, (300, 300), page=1, enter=2.45)
        take = capture([step(0, 0.2, 0.4, 0.9, (100, 100), page=0), dict(reload, page=0), other],
                       active=[(0.45, 0.8), (1.3, 2.3), (2.75, 3.1)])
        film = montage.cut(spec, take, self.words, audio_duration=9.8)
        texts = [text for _, _, text in film['labels']]
        self.assertEqual(texts, [language.TEXTS['pl']['reloaded'], language.TEXTS['pl']['another_window']])
        reloaded = next(a['t'] for a in film['actions'] if a['step'] == 1)
        self.assertEqual(film['labels'][0][:2], [reloaded, round(reloaded + montage.LABEL_SECONDS, 3)])
        named = montage.cut(dict(spec, sections=True), dict(take, steps=[take['steps'][0], take['steps'][1],
                                                                        dict(other, section='Widok kursanta')]),
                            self.words, audio_duration=9.8)
        self.assertEqual([text for _, _, text in named['labels']], [language.TEXTS['pl']['reloaded'], 'Widok kursanta'])
        english = montage.cut(dict(spec, language='en'), take, self.words, audio_duration=9.8)
        self.assertEqual([text for _, _, text in english['labels']], ['After a page reload', 'Another account'])
        self.assertTrue(montage.reloads({'navigate': True, 'cmd': ['goto', '/lesson/7?x=1'], 'url': 'http://app/lesson/7?x=1'}))
        self.assertFalse(montage.reloads({'navigate': True, 'cmd': ['goto', '/courses'], 'url': 'http://app/lesson/7'}))

    def test_beats_land_on_the_sentences_the_voice_read(self):  # an extra sentence start moved every later beat
        said = ['Otwieramy np. Raport roczny.', 'Klikamy „Zapisz”', 'Wynik jest widoczny.']
        words = words_at((0.1, said[0]), (4.0, said[1]), (8.0, said[2]))
        film = montage.cut(dict(self.spec, sentences=said), self.capture, words, audio_duration=9.8)
        self.assertEqual(film['sentences'], [0.1, 4.0, 8.0])
        self.assertEqual([a['action'] for a in film['anchors']][1:], [round(4.0 + montage.LAND, 3), round(8.0 + montage.LAND, 3)])
        self.assertEqual(film['silences'], [])

    def test_a_scenes_window_title_shows_in_one_line(self):  # the label the renderer draws holds one line
        spec = {'steps': [{'cmd': ['click', '#play'], 'beat': 1}, {'cmd': ['click', '#course'], 'beat': 2}],
                'sections': True}
        take = capture([step(0, 0.2, 0.4, 0.9, (100, 100), page=0),
                        step(1, 2.5, 2.7, 3.2, (300, 300), page=1, enter=2.45, section='Widok\n  kursanta ')],
                       active=[(0.45, 0.8), (2.75, 3.1)])
        film = montage.cut(spec, take, self.words, audio_duration=9.8)
        self.assertEqual([text for _, _, text in film['labels']], ['Widok kursanta'])
        blank = dict(take, steps=[take['steps'][0], dict(take['steps'][1], section=' \n ')])
        self.assertEqual([text for _, _, text in montage.cut(spec, blank, self.words, audio_duration=9.8)['labels']],
                         [language.TEXTS['pl']['another_window']])

    def test_labels_and_keys_end_with_the_footage_a_pdf_page_follows(self):  # the renderer refused them: film lost
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}, {'cmd': ['reload', ''], 'beat': 2},
                          {'cmd': ['press', 'field'], 'beat': 3}], 'insert': {'from_beat': 3}}
        take = capture([step(0, 0.2, 0.4, 0.9, (100, 100)),
                        step(1, 1.0, 1.2, 2.0, None, acting=False, navigate=True, url='http://app/x', cmd=['reload', '']),
                        step(2, 2.1, 2.2, 2.6, (300, 300), click=False, cmd=['press', 'field'], value='Enter')],
                       active=[(0.45, 0.8), (1.25, 1.9), (2.25, 2.5)])
        words = words_at((0.1, 'Otwieramy stronę.'), (2.5, 'Odświeżamy.'), (3.2, 'Plik pokazuje raport.'))
        film = montage.cut(spec, take, words, audio_duration=4.7)
        self.assertEqual(film['footage'], film['insert_from'])
        (label_start, label_end, _), = film['labels']
        (key_start, key_end, _), = film['keys']
        self.assertEqual((label_end, key_end), (film['footage'], film['footage']))  # cut short by the page
        self.assertLess(label_start, film['footage'] - 0.5)
        self.assertLess(key_start, film['footage'] - 0.2)
        footage = {'source': 'take.mp4', 'duration': film['footage'], 'pieces': [[0.0, 0.5, 0.0]],
                   'camera': [{'start': 0.0, 'end': None, 'crop': [8, 0, 1584, 890]}], 'pointer': film['pointer'],
                   'labels': film['labels'], 'keys': film['keys']}
        info = {'streams': [{'codec_type': 'video', 'width': 1600, 'height': 900}], 'format': {'duration': '10'}}
        segment = render_demo.footage_segment(footage, 'take.mp4', info)  # the footage clip the renderer draws them on
        self.assertEqual((len(segment['labels']), len(segment['keys'])), (1, 1))
        plain = montage.cut(dict(spec, insert=None), take, words, audio_duration=4.7)  # no page: they last their time
        self.assertEqual(plain['labels'][0][1], round(plain['labels'][0][0] + montage.LABEL_SECONDS, 3))
        self.assertEqual(plain['keys'][0][1], round(plain['keys'][0][0] + montage.KEY_SECONDS, 3))

    def test_the_footage_before_a_pdf_page_is_long_enough_to_render(self):  # 0.3 s of it: the renderer refused the film
        spec = {'steps': [{'cmd': ['look', 'report'], 'beat': 1}], 'insert': {'from_beat': 1}}
        take = capture([step(0, 0.0, 0.01, 0.02, None, acting=False, look=True)], end=0.05)  # a still page, checked
        film = montage.cut(spec, take, words_at((0.1, 'Pobieramy raport.')), audio_duration=1.0)
        self.assertEqual(film['footage'], 0.5)
        self.assertGreaterEqual(film['duration'] - film['insert_from'], 0.5)  # the page's own shortest time
        footage = {'source': 'take.mp4', 'duration': film['footage'], 'pieces': [[0.0, 0.03, 0.0]],
                   'camera': [{'start': 0.0, 'end': None, 'crop': [8, 0, 1584, 890]}], 'pointer': film['pointer']}
        info = {'streams': [{'codec_type': 'video', 'width': 1600, 'height': 900}], 'format': {'duration': '1'}}
        self.assertEqual(render_demo.footage_segment(footage, 'take.mp4', info)['footage_duration'], 0.5)

    def test_every_key_badge_is_one_the_renderer_draws(self):  # over 30 characters, empty or two lines: film lost
        pl, en = language.texts('pl'), language.texts('en')
        self.assertEqual(montage.key_name('Control+Shift+ArrowRight', pl), 'Ctrl+Shift+Strzałka w prawo')
        self.assertEqual(montage.key_name('Control+Alt+Shift+ArrowDown', en), 'Ctrl+Alt+Shift+Down arrow')
        self.assertEqual(montage.key_name('Meta+Alt+Shift+ArrowRight', pl), 'Cmd+Alt+Shift+Strzałka w prawo')
        self.assertEqual(montage.key_name('ControlOrMeta+a', en), 'Ctrl + A')  # a short one keeps its spaces
        # the plus key, alone or after a modifier, as Playwright reads it; Playwright's Enter alias
        self.assertEqual([montage.key_name(key, en) for key in ('+', 'Control++', '\n')], ['+', 'Ctrl + +', 'Enter'])
        self.assertEqual(montage.key_name('Control+Alt+Shift+ArrowRight', pl), '')  # too long even so: no badge
        values = ['Control+Shift+ArrowRight', '+', 'Control++', '\n', 'Control+Alt+Shift+ArrowRight', 'x' * 40]
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}] + [{'cmd': ['press', '']} for _ in values]
                + [{'cmd': ['click', '#save'], 'beat': 2}]}
        take = capture([step(0, 0.2, 0.4, 0.9, (100, 100))]
                       + [step(i, 1.0 * i, 1.0 * i + 0.1, 1.0 * i + 0.6, None, cmd=['press', ''], value=value)
                          for i, value in enumerate(values, 1)]
                       + [step(len(values) + 1, 8.0, 8.2, 8.6, (700, 500))])
        film = montage.cut(spec, take, words_at((0.1, 'Otwieramy stronę.'), (9.0, 'Zapisujemy.')), audio_duration=10.0)
        self.assertEqual([text for _, _, text in film['keys']], ['Ctrl+Shift+Strzałka w prawo', '+', 'Ctrl + +', 'Enter'])
        for start, end, text in film['keys']:
            self.assertTrue(text.strip() and len(text) <= 30 and '\n' not in text and end > start)

    def test_a_pressed_key_gets_a_badge_and_a_field_typed_in_is_clicked(self):  # nothing happens "by itself"
        spec = {'steps': [{'cmd': ['focus', 'combobox'], 'beat': 1}, {'cmd': ['press', 'combobox']},
                          {'cmd': ['fill', 'field'], 'beat': 2}, {'cmd': ['press', '']}, {'cmd': ['click', '#save'], 'beat': 3}],
                'language': 'en'}
        take = capture([step(0, 0.2, 0.4, 0.9, (100, 100), click=False, cmd=['focus', 'combobox']),
                        step(1, 1.0, 1.1, 1.6, (100, 100), click=False, cmd=['press', 'combobox'], value='ArrowDown'),
                        step(2, 4.0, 4.2, 4.6, (400, 300), click=False, cmd=['fill', 'field'], value='Norway'),
                        step(3, 4.8, 4.9, 5.2, None, cmd=['press', ''], value='ControlOrMeta+s'),
                        step(4, 8.0, 8.2, 8.6, (700, 500), cmd=['click', '#save'])])
        film = montage.cut(spec, take, self.words, audio_duration=9.8)
        self.assertEqual([text for _, _, text in film['keys']], ['Down arrow', 'Ctrl + S'])
        self.assertTrue(all(end - start <= montage.KEY_SECONDS + 1e-6 for start, end, _ in film['keys']))
        self.assertEqual(len(film['pointer']['clicks']), 3)  # the focused box, the field typed in, the save button
        polish = montage.cut(dict(spec, language='pl'), take, self.words, audio_duration=9.8)
        self.assertEqual(polish['keys'][0][2], 'Strzałka w dół')

    def test_another_window_opening_on_an_address_never_shows_the_page_it_was_left_on(self):
        # the admin's saved list (sentence 1), then the learner's window: its goto starts on the learner's landing page
        # (an empty course list, 1.1–1.4 s) and the next sentence reads the loaded notifications
        spec = {'steps': [{'cmd': ['click', '#save'], 'beat': 1}, {'cmd': ['goto', '/notifications']},
                          {'cmd': ['look', 'card'], 'beat': 2}]}
        take = capture([step(0, 0.2, 0.4, 1.0, (100, 100), page=0),
                        step(1, 1.0, 1.4, 3.0, None, acting=False, navigate=True, page=1, enter=1.1),
                        step(2, 3.0, 3.1, 3.5, None, acting=False, look=True, page=1)],
                       active=[(0.45, 0.8), (1.1, 1.35), (2.2, 2.9)])
        film = montage.cut(spec, take, self.words, audio_duration=9.8)
        shown = [(a, b) for a, b, _ in film['pieces'] if b > 1.1 + 1e-6 and a < 1.4 - 1e-6]
        self.assertEqual(shown, [])
        self.assertEqual([text for _, _, text in film['labels']], [language.TEXTS['pl']['another_window']])

    def test_long_steps_no_sentence_names_are_cut_instead_of_making_the_narration_wait(self):
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}, {'cmd': ['click', '#save'], 'beat': 2},
                          {'cmd': ['goto', '/course']}, {'cmd': ['click', '#add']}, {'cmd': ['fill', '#title']},
                          {'cmd': ['hover', '#result'], 'beat': 3}]}
        # between the save and the result the test sets up another page: 7 s of motion no sentence talks about
        take = capture([step(0, 0.2, 0.4, 0.9, (100, 100)), step(1, 1.0, 1.2, 1.9, (500, 300)),
                        step(2, 2.0, 2.2, 4.4, None, acting=False, navigate=True), step(3, 4.5, 4.7, 6.4, (300, 300)),
                        step(4, 6.5, 6.7, 8.9, (400, 400)), step(5, 9.0, 9.2, 9.7, (900, 600), click=False)],
                       active=[(0.45, 0.8), (1.25, 1.8), (2.2, 4.3), (4.75, 6.3), (6.75, 8.8), (9.25, 9.6)])
        film = montage.cut(spec, take, self.words, audio_duration=9.8)
        self.assertEqual(film['silences'], [])  # the voice never stops for the set-up
        self.assertLess(film['anchors'][-1]['late'], 0.3)
        self.assertEqual({a['step'] for a in film['actions']} & {2, 3, 4}, set())  # cut out
        jump = next(a for a in film['actions'] if a.get('navigate'))
        self.assertGreater(jump['t'], 6.5)  # the second sentence keeps its page, then the cut to the next one
        self.assertEqual(jump['step'], 5)  # the camera shows the next step's page whole from the cut (a navigation)

    def test_the_page_a_sentences_click_opened_plays_before_the_steps_after_it_are_cut(self):
        spec = {'steps': [{'cmd': ['click', '#customer'], 'beat': 1}, {'cmd': ['look', 'heading']}, {'cmd': ['goBack']},
                          {'cmd': ['hover', '#budget']}, {'cmd': ['look', 'tooltip'], 'beat': 2}]}
        click = step(0, 0.2, 0.4, 3.0, (100, 100), pre={'url': 'http://app/dashboard'}, post={'url': 'http://app/reports'})
        heading = step(1, 1.6, 1.7, 3.0, acting=False, look=True)  # the chart page the click opened, checked
        back = step(2, 3.0, 3.1, 5.0, None, acting=False, navigate=True)
        taken = capture([click, heading, back, step(3, 5.1, 5.3, 5.7, (300, 300), click=False),
                         step(4, 5.7, 5.8, 6.2, acting=False, look=True)],
                        active=[(0.45, 0.6), (1.0, 1.5), (3.2, 4.5), (5.35, 5.6)])
        taken['stills'] = [1.7]
        words = words_at((0.1, 'Klikamy kartę i przechodzimy do wykresu klienta.'), (6.0, 'Wracamy na pulpit.'))
        film = montage.cut(spec, taken, words, audio_duration=8.0)
        on_screen = shown_at(film, film['sentences'][0] + 2.5)
        self.assertGreater(on_screen, 1.4)  # the chart page painted (its last frame of motion), not the dashboard the click left
        self.assertLess(on_screen, 3.0)  # and not the dashboard the test went back to
        self.assertTrue(any(a.get('navigate') and a['step'] == 4 for a in film['actions']))  # the way back is cut

    def test_the_window_a_sentence_talks_about_holds_until_the_next_window_takes_over(self):
        # Marek sends a message in his window, then the test opens the notifications in Anna's window: the sentence about
        # the message must not play over Anna's dashboard (her window's still before the address was opened)
        spec = {'steps': [{'cmd': ['click', '#send'], 'beat': 1}, {'cmd': ['look', 'message']},
                          {'cmd': ['goto', '/notifications'], 'beat': 2}, {'cmd': ['look', 'mention']}]}
        send = step(0, 0.2, 0.4, 2.6, (100, 100), page=3, enter=0.2)
        message = step(1, 0.5, 0.9, 2.6, acting=False, look=True, page=3, enter=0.9)
        notifications = step(2, 2.8, 3.0, 4.5, None, acting=False, navigate=True, page=4, enter=2.6)
        mention = step(3, 3.2, 3.4, 4.5, acting=False, look=True, page=4, enter=3.4)
        taken = capture([send, message, notifications, mention], active=[(0.45, 0.9), (2.6, 2.65), (3.0, 3.6)])
        words = words_at((0.1, 'Wysyłamy pytanie i widzimy je w dyskusji kursu, zaraz pod polem.'),
                         (6.0, 'Anna otwiera powiadomienia.'))
        film = montage.cut(spec, taken, words, audio_duration=8.0)
        for t in (1.5, 3.0, 4.5, 5.5):  # all through the first sentence: Marek's window
            self.assertLess(shown_at(film, t), 2.6)

    def test_a_chapter_opening_on_an_address_opens_on_the_page_it_leads_to(self):
        spec = {'steps': [{'cmd': ['click', '#login'], 'at': -1}, {'cmd': ['goto', '/calendar'], 'beat': 1},
                          {'cmd': ['click', '#event'], 'beat': 2}]}
        taken = capture([step(0, 0.2, 0.4, 1.0, (100, 100)), step(1, 1.0, 1.1, 3.0, None, acting=False, navigate=True),
                         step(2, 3.0, 3.2, 3.8, (500, 300))],
                        active=[(0.45, 0.9), (1.2, 2.0), (3.25, 3.6)], blank=[(1.1, 1.6)])
        film = montage.cut(spec, taken, words_at((0.1, 'Kalendarz pokazuje szkolenia.'), (4.0, 'Otwieramy wydarzenie.')),
                           audio_duration=6.0)
        self.assertGreaterEqual(film['begin'], 1.6 - 1e-3)  # the calendar, loaded, from the first frame
        self.assertGreater(shown_at(film, 0.5), 1.5)  # never the page before the address was opened

    def test_off_film_steps_and_still_stretches_are_not_shown(self):
        spec = {'steps': [{'cmd': ['click', '#menu'], 'at': -5}, {'cmd': ['click', '#open']},
                          {'cmd': ['click', '#save'], 'beat': 1}]}
        taken = capture([step(0, 0.2, 0.4, 0.9, (40, 40)), step(1, 1.0, 1.2, 3.9, (60, 40)),
                         step(2, 4.0, 4.2, 4.7, (500, 300))],
                        active=[(0.45, 0.8), (1.25, 1.6), (4.25, 4.6)], blank=[(1.3, 1.5)])
        film = montage.cut(spec, taken, words_at((0.1, 'Zapisujemy zmiany.')), audio_duration=1.5)
        self.assertEqual(film['begin'], 4.0)  # the film opens as the first shown step starts, after the off-film ones
        self.assertTrue(all(a >= 3.9 for a, _, _ in film['pieces']))
        self.assertTrue(all(not (a < 1.5 and b > 1.3) for a, b, _ in film['pieces']))  # blank frames are cut
        idle = montage.cut(self.spec, self.capture, self.words, audio_duration=9.8)
        played = sum(b - a for a, b, _ in idle['pieces'])
        # only the page's motion and the moments at the pointer (hover, click) play; the still stretches are held
        self.assertAlmostEqual(played, 0.59 + 0.79 + 0.59 + 1 / FPS, delta=0.02)

    def test_loading_indicators_after_an_action_are_left_out(self):
        spec = {'steps': [{'cmd': ['click', '#login'], 'beat': 1}, {'cmd': ['type', '#search', 'abc'], 'beat': 2}]}
        taken = capture([step(0, 0.2, 0.4, 2.9, (100, 100)), step(1, 3.0, 3.6, 4.1, (500, 300))],
                        active=[(0.45, 2.8), (3.0, 4.0)])
        # a spinner after the login click, still turning as the typing starts; an indicator that never goes away
        taken['loading'] = [(0.6, 3.2), (0.0, 30.0)]
        film = montage.cut(spec, taken, words_at((0.1, 'Logujemy się.'), (3.0, 'Szukamy.')), audio_duration=5.0)
        shown = [(a, b) for a, b, _ in film['pieces']]
        self.assertEqual(montage.covered(shown, 0.55, 3.0), 0)  # the film jumps from the click to the loaded page
        self.assertAlmostEqual(montage.covered(shown, 0.25, 0.45), 0.2, delta=0.01)  # the click itself plays
        self.assertAlmostEqual(montage.covered(shown, 3.01, 3.65), 0.64, delta=0.01)  # so does the typing
        taken['loading'] = []
        plain = montage.cut(spec, taken, words_at((0.1, 'Logujemy się.'), (3.0, 'Szukamy.')), audio_duration=5.0)
        self.assertGreater(montage.covered([(a, b) for a, b, _ in plain['pieces']], 0.55, 3.0), 2.0)

    def test_a_navigation_jumps_from_the_action_to_the_page_it_led_to(self):
        spec = {'steps': [{'cmd': ['click', '#login'], 'beat': 1}, {'cmd': ['click', '#tab'], 'beat': 2}]}
        login = step(0, 0.2, 0.4, 3.0, (100, 100), pre={'url': 'http://app/auth/login'}, post={'url': 'http://app/courses'})
        tab = step(1, 3.2, 3.4, 3.9, (500, 300), pre={'url': 'http://app/courses'}, post={'url': 'http://app/courses?tab=2'})
        taken = capture([login, tab], active=[(0.45, 2.9), (3.45, 3.8)])
        taken['routes'] = [(0.0, '/auth/login'), (1.1, '/settings'), (2.2, '/courses'), (3.5, '/courses?tab=2')]
        film = montage.cut(spec, taken, words_at((0.1, 'Logujemy się.'), (3.0, 'Otwieramy zakładkę.')), audio_duration=5.0)
        shown = [(a, b) for a, b, _ in film['pieces']]
        self.assertEqual(montage.covered(shown, 0.5, 2.2), 0)  # the redirect through the settings page never shows
        self.assertAlmostEqual(montage.covered(shown, 2.2, 2.9), 0.7, delta=0.01)  # the page it led to does
        self.assertAlmostEqual(montage.covered(shown, 3.5, 3.8), 0.3, delta=0.01)  # a tab changing the query plays
        taken['routes'] = []  # no address log: nothing is cut
        plain = montage.cut(spec, taken, words_at((0.1, 'Logujemy się.'), (3.0, 'Otwieramy zakładkę.')), audio_duration=5.0)
        self.assertGreater(montage.covered([(a, b) for a, b, _ in plain['pieces']], 0.5, 2.2), 1.6)

    def test_the_picture_holds_on_the_page_an_action_led_to(self):
        spec = {'steps': [{'cmd': ['click', '#catalog'], 'beat': 1}, {'cmd': ['click', '#more'], 'beat': 2}]}
        catalog = step(0, 0.2, 0.4, 1.6, (100, 100), pre={'url': 'http://app/settings'}, post={'url': 'http://app/courses'})
        taken = capture([catalog, step(1, 1.8, 2.0, 2.5, (500, 300))], active=[(0.45, 1.0), (2.05, 2.4)])
        taken['routes'] = [(0.0, '/settings'), (0.5, '/courses')]
        taken['loading'] = [(0.55, 1.0)]  # the catalog paints while it loads, then stays still
        film = montage.cut(spec, taken, words_at((0.1, 'Otwieramy katalog.'), (4.0, 'Wchodzimy w kurs.')), audio_duration=6.0)
        held = max(b for a, b, _ in film['pieces'] if a < 1.8)  # the frame the picture holds before the next action
        self.assertGreaterEqual(held, 1.6)  # the loaded catalog, not the settings page

    def test_a_sentence_on_a_passed_check_holds_the_state_it_proves(self):
        spec = {'steps': [{'cmd': ['click', '#save'], 'beat': 1}, {'cmd': ['look', 'toast'], 'beat': 2},
                          {'cmd': ['click', '#next'], 'beat': 3}]}
        save = step(0, 0.2, 0.4, 0.6, (100, 100))
        toast = step(1, 0.6, 0.7, 2.0, acting=False, look=True, box={'x': 1200, 'y': 40, 'width': 300, 'height': 60})
        taken = capture([save, toast, step(2, 2.0, 2.2, 2.6, (500, 300))], active=[(0.45, 2.1)])  # the toast fades
        words = words_at((0.1, 'Zapisujemy.'), (1.0, 'Komunikat potwierdza zapis w prawym rogu.'), (5.0, 'Dalej.'))
        film = montage.cut(spec, taken, words, audio_duration=6.0)
        holds = [f1 - (f0 + (b0 - a0)) for (a0, b0, f0), (a1, b1, f1) in zip(film['pieces'], film['pieces'][1:])
                 if abs(b0 - 0.7) < 0.05]
        self.assertTrue(holds and max(holds) >= 2.0)  # the picture stays on the toast while its sentence is spoken

    def test_loading_after_a_reload_is_left_out_too(self):
        spec = {'steps': [{'cmd': ['click', '#save'], 'beat': 1}, {'cmd': ['reload'], 'beat': 2}]}
        taken = capture([step(0, 0.2, 0.4, 0.9, (100, 100)), step(1, 1.0, 1.0, 3.5, acting=False, navigate=True)],
                        active=[(0.45, 0.8), (1.1, 3.4)])
        taken['loading'] = [(1.5, 3.0)]
        film = montage.cut(spec, taken, words_at((0.1, 'Zapisujemy.'), (1.5, 'Odświeżamy.')), audio_duration=3.0)
        self.assertEqual(montage.covered([(a, b) for a, b, _ in film['pieces']], 1.45, 3.05), 0)

    def test_the_chapter_opens_on_the_settled_page(self):
        loading = capture([step(0, 1.5, 1.7, 2.2, (100, 100)), step(1, 2.3, 2.5, 3.0, (500, 300))],
                          active=[(0.0, 1.4), (1.75, 2.1)])  # the page still re-rendered for 1.4 s after the capture began
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}, {'cmd': ['click', '#save'], 'beat': 2}]}
        film = montage.cut(spec, loading, self.words, audio_duration=9.8)
        self.assertGreaterEqual(film['begin'], 1.4)  # opens once the page has settled
        self.assertEqual(film['silences'], [])  # the first sentence does not wait for the page to load

    def test_a_check_a_sentence_names_before_the_first_click_stays_on_film(self):
        # the page opens with a dialog the first sentence talks about; it closes by itself before the first click. The
        # navigation runs off film, and its answer lasts until the click (the checks do not end it)
        spec = {'steps': [{'cmd': ['goto', '/practice'], 'at': -1}, {'cmd': ['look', 'dialog'], 'beat': 1},
                          {'cmd': ['look', 'no dialog']}, {'cmd': ['click', '#finish'], 'beat': 2}]}
        taken = capture([step(0, 0.0, 0.5, 4.0, None, acting=False, navigate=True),
                         step(1, 0.5, 1.5, 2.0, acting=False, look=True, m=0.55), step(2, 2.0, 2.4, 3.9, acting=False, look=True),
                         step(3, 4.0, 4.2, 4.7, (500, 300))],
                        active=[(1.2, 1.6), (2.0, 2.3), (3.5, 3.9), (4.25, 4.6)], blank=[(0.0, 1.1)])
        taken['stills'] = [1.55, 2.6]  # the dialog painted; the page after it closed
        film = montage.cut(spec, taken, words_at((0.1, 'Okno opisuje zadanie.'), (4.0, 'Kończymy.')), audio_duration=6.0)
        self.assertAlmostEqual(film['begin'], 1.55)  # opens on the painted dialog, not on the page before the click
        self.assertLess(shown_at(film, film['sentences'][0] + 1.0), 2.0)  # and stays on it while the sentence says it

    def test_a_cut_to_a_still_page_shows_that_page_from_the_cut(self):
        spec = {'steps': [{'cmd': ['click', '#save'], 'beat': 1}, {'cmd': ['click', '#close']},
                          {'cmd': ['look', 'button'], 'beat': 2}]}
        # closing takes 2.3 s of motion; the page it leaves stands still until the check after it
        taken = capture([step(0, 0.2, 0.4, 0.9, (100, 100)), step(1, 1.0, 1.2, 3.6, (700, 400)),
                         step(2, 4.0, 4.01, 4.5, acting=False, look=True)],
                        active=[(0.45, 0.8), (1.25, 3.5)])
        film = montage.cut(spec, taken, words_at((0.1, 'Zapisujemy.'), (5.0, 'Przycisk czeka.')), audio_duration=7.0)
        self.assertGreaterEqual(shown_at(film, film['sentences'][1] + 0.5), 3.5 - 1e-3)  # the page after the close

    def test_a_passed_check_shows_its_painted_state(self):
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 1}, {'cmd': ['look', 'dialog'], 'beat': 2}]}
        # the dialog is in the page (Playwright: visible) at 0.5 s but paints in by 0.9 s, when its still was taken
        taken = capture([step(0, 0.2, 0.4, 0.45, (100, 100)),
                         step(1, 0.45, 0.5, 1.2, acting=False, look=True, box={'x': 500, 'y': 200, 'width': 600, 'height': 400})],
                        active=[(0.42, 0.55)])
        taken['stills'] = [0.3, 0.9]
        film = montage.cut(spec, taken, words_at((0.1, 'Otwieramy okno.'), (2.0, 'Okno pokazuje wynik.')), audio_duration=5.0)
        self.assertGreaterEqual(shown_at(film, film['sentences'][1] + 0.5), 0.9 - 1e-3)

    def test_a_still_image_covers_the_chapter_end(self):
        spec = dict(self.spec, insert={'from_beat': 3})
        film = montage.cut(spec, self.capture, self.words, audio_duration=9.8)
        # from its sentence, and never over the page's last motion
        self.assertEqual(film['insert_from'], round(max(film['sentences'][2], film['last_motion'] + 0.3), 3))
        self.assertEqual(film['footage'], film['insert_from'])
        self.assertLessEqual(film['duration'] - film['insert_from'], montage.MAX_STILL)


class Pieces(unittest.TestCase):
    def test_frames_keep_their_capture_timing_across_dropped_frames(self):
        timeline = [(round(k / FPS, 4), round(k / FPS + (1.0 if k >= 30 else 0), 3)) for k in range(90)]
        pieces = montage.video_pieces([(0.0, 3.0, 0.0)], timeline)  # the recorder lost 1 s after frame 30
        self.assertEqual(len(pieces), 2)
        self.assertEqual(pieces[0][:2], (0.0, 1.0))
        self.assertAlmostEqual(pieces[1][2], 2.0, places=3)  # the frame after the gap shows capture 2.0 at film 2.0
        overlapping = montage.video_pieces([(0.0, 1.0, 0.0), (0.5, 1.5, 3.0)], timeline[:30])
        self.assertEqual(overlapping, [(0.0, 1.0, 0.0)])  # a frame is used once

    def test_a_piece_between_two_frames_shows_the_next_one(self):
        timeline = [(round(k / FPS, 4), round(k / 27, 4)) for k in range(90)]  # the clock runs ahead of the frames
        pieces = montage.video_pieces([(0.0, 0.5, 0.0), (1.223, 1.223 + 1 / FPS, 3.0)], timeline)
        self.assertEqual(pieces[-1], (round(34 / FPS, 4), round(35 / FPS, 4), 3.0))  # frame 34 reads 1.2593

    def test_clock_jitter_keeps_one_piece(self):
        jitter = [0.0, 0.02, -0.015, 0.03, -0.02]  # a loaded browser stamps frames unevenly
        timeline = [(round(k / FPS, 4), round(k / FPS + jitter[k % 5], 3)) for k in range(120)]
        self.assertEqual(len(montage.video_pieces([(0.0, 4.0, 0.0)], timeline)), 1)

    def test_loading_flashes_between_pages_are_left_out(self):
        page, flash, sparse = 0.05, 0.008, 0.009
        details = [page] * 10 + [flash] * 12 + [page] * 10 + [sparse] * 200 + [page] * 5 + [0.0] * 3 + [page]
        flags = montage.empty_frames(details, 0.003)
        self.assertTrue(all(flags[10:22]))  # a 0.4 s spinner page between two pages
        self.assertFalse(any(flags[32:232]))  # 6.7 s of a sparse page is content
        self.assertTrue(all(flags[237:240]))  # a blank page is always left out
        self.assertFalse(any(flags[:10]))

    def test_frame_spans_follow_the_clock(self):
        timeline = [(round(k / FPS, 4), round(k / FPS, 3)) for k in range(90)]
        flags = [30 <= k < 45 for k in range(90)]
        spans = montage.frame_spans(flags, timeline, pad=2)
        self.assertEqual(len(spans), 1)
        self.assertAlmostEqual(spans[0][0], 28 / FPS - 0.5 / FPS, places=2)
        self.assertAlmostEqual(spans[0][1], 47 / FPS + 0.5 / FPS, places=2)



class Camera(unittest.TestCase):
    def test_the_whole_page_stays_in_view(self):  # close-ups and push-ins were removed: zoompan made them shake
        words = words_at((0.1, 'Otwieramy okno.'), (3.0, 'Zapisujemy.'))
        taken = capture([step(0, 0.2, 0.4, 0.9, (1375, 108))], active=[(0.45, 0.8)])
        spec = {'steps': [{'cmd': ['click', '#open'], 'beat': 2}]}
        film = montage.cut(spec, taken, words, audio_duration=4.0)
        self.assertEqual(montage.camera(spec, taken, film, 1.5),
                         ([(0.0, None, 'establish')], [{'start': 0.0, 'end': None, 'crop': None}]))
        self.assertEqual(montage.scale_crop(None, 1.5), [12, 0, 2376, 1336])


if __name__ == '__main__':
    unittest.main()
