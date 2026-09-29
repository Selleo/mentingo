"""Review sheets: the picture as each sentence starts, with the sentence under it."""
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

import core  # noqa: E402
import language  # noqa: E402
import review  # noqa: E402

FFMPEG = os.environ.get('DEMO_FFMPEG') or core.tool('ffmpeg', home=False)


class Sheets(unittest.TestCase):
    def test_one_sheet_per_chapter_with_the_loaded_page_after_a_navigation(self):
        with tempfile.TemporaryDirectory() as folder:
            run, capture = Path(folder) / 'run', Path(folder) / 'capture'
            (capture / 'stills').mkdir(parents=True)
            for name, color in (('a0000.jpg', 'white'), ('a0001.jpg', 'blue'), ('end-p0.jpg', 'green')):
                subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c={color}:s=320x180', '-frames:v', '1',
                                str(capture / 'stills' / name)], check=True)
            (capture / 'actions.json').write_text(json.dumps([
                {'id': 0, 'kind': 'goto', 'still': 'stills/a0000.jpg'}, {'id': 1, 'kind': 'click', 'still': 'stills/a0001.jpg'}]))
            (capture / 'page-log.json').write_text(json.dumps({'pages': [{'still': 'stills/end-p0.jpg'}]}))
            self.assertEqual(review.stills(capture)[0].name, 'a0001.jpg')  # the page after the goto, not the blank one
            story = {'keys': {'F1': str(capture)}, 'chapters': [{'film': 'F1', 'title': 'Notatki', 'sentences': [
                {'text': 'Otwieramy notatki.', 'action': 0}, {'text': 'Zapisujemy zmianę.', 'action': 1},
                {'text': 'Ten sam ekran.', 'action': None}]}]}
            sheets = review.sheets(run, story)
            self.assertEqual(len(sheets), 1)
            self.assertTrue(Path(sheets[0]).is_file())


class Claims(unittest.TestCase):
    def setUp(self):  # the CLI's answers are mocked: whether `claude` is installed on this machine must not matter
        patcher = mock.patch('llm.choose', return_value='cli')
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_a_failed_or_empty_review_is_not_a_clean_verdict(self):
        for answer in ('', 'I could not inspect the images', 'not logged in'):
            with self.subTest(answer=answer), mock.patch('llm.cli', return_value=(answer, {})):
                with self.assertRaises(review.ReviewUnavailable):
                    review.check_chapter({'title': 'A'}, 1, '/tmp/chapter-1.jpg')
        with mock.patch('llm.cli', side_effect=RuntimeError('not logged in')):
            with self.assertRaisesRegex(review.ReviewUnavailable, 'not logged in'):
                review.check_chapter({'title': 'A'}, 1, '/tmp/chapter-1.jpg')
        with mock.patch('llm.cli', return_value=('ok', {})):
            self.assertEqual(review.check_chapter({'title': 'A'}, 1, '/tmp/chapter-1.jpg'), [])

    def test_a_clean_verdict_may_be_marked_up_but_one_naming_a_sentence_is_no_verdict(self):
        for answer in ('OK.', '**ok**', '`ok`', 'Okay!', 'OK, every sentence matches its pictures.'):
            with self.subTest(answer=answer), mock.patch('llm.cli', return_value=(answer, {})):
                self.assertEqual(review.check_chapter({'title': 'A'}, 1, '/tmp/chapter-1.jpg'), [])
        for answer in ('OK except 1.3: the toast is gone', 'ok, but drop it'):
            with self.subTest(answer=answer), mock.patch('llm.cli', return_value=(answer, {})):
                with self.assertRaises(review.ReviewUnavailable):
                    review.check_chapter({'title': 'A'}, 1, '/tmp/chapter-1.jpg')

    def test_a_sentence_given_by_its_number_alone_is_of_the_chapter_checked(self):  # "5 |" for 2.5
        answer = ('5 | the PDF\'s contents are not shown | Pobieramy protokół jako PDF.\n'
                  '**2.3** | cut | an empty list\n- 4: | a cloud | Zapisujemy.\n')
        with mock.patch('llm.cli', return_value=(answer, {})):
            found = review.check_chapter({'title': 'A'}, 2, '/tmp/chapter-2.jpg')
        self.assertEqual([f['sentence'] for f in found], ['2.5', '2.3', '2.4'])
        self.assertEqual(found[0]['fix'], 'Pobieramy protokół jako PDF.')
        self.assertTrue(found[1]['cut'])
        with mock.patch('llm.cli', return_value=('The pictures are too small to judge.', {})):
            with self.assertRaisesRegex(review.ReviewUnavailable, 'too small to judge'):  # what it said, for the log
                review.check_chapter({'title': 'A'}, 2, '/tmp/chapter-2.jpg')

    def test_a_check_out_of_time_on_the_tiles_is_asked_once_more_on_the_sheet(self):
        with tempfile.TemporaryDirectory() as folder:
            sheet = Path(folder) / 'chapter-1.jpg'
            (Path(folder) / 'c1').mkdir()
            for name in ('01.jpg', '02.jpg'):
                (Path(folder) / 'c1' / name).write_bytes(b'')
            calls = []

            def cli(prompt, system, effort, read=(), timeout=None):
                calls.append((prompt, timeout))
                if len(calls) == 1:
                    raise RuntimeError(f'claude -p gave no answer within {timeout} s')
                return 'ok', {}
            with mock.patch('llm.cli', cli):
                self.assertEqual(review.check_chapter({'title': 'A'}, 1, str(sheet)), [])
            self.assertEqual([t for _, t in calls], [review.CHECK_TIMEOUT, review.SHEET_TIMEOUT])
            self.assertIn('01.jpg', calls[0][0])
            self.assertIn(str(sheet), calls[1][0])
            self.assertNotIn('01.jpg', calls[1][0])  # the one sheet, not the tiles again
            calls.clear()
            with mock.patch('llm.cli', side_effect=RuntimeError('not logged in')) as refused:
                with self.assertRaisesRegex(review.ReviewUnavailable, 'not logged in'):
                    review.check_chapter({'title': 'A'}, 1, str(sheet))
            self.assertEqual(refused.call_count, 1)  # only a timeout falls back to the sheet

    def test_a_long_chapter_is_checked_in_two_parts_at_once(self):
        with tempfile.TemporaryDirectory() as folder:
            sheet = Path(folder) / 'chapter-2.jpg'
            (Path(folder) / 'c2').mkdir()
            for n in range(1, 8):
                (Path(folder) / 'c2' / f'{n:02d}.jpg').write_bytes(b'')
            chapter = {'title': 'A', 'sentences': [{'text': f'Zdanie {n}.'} for n in range(1, 8)]}
            prompts = []

            def cli(prompt, system, effort, read=(), timeout=None):
                prompts.append(prompt)
                if '07.jpg' in prompt:  # the second part: sentences 2.4–2.7
                    return '2.4 | a later claim | Zdanie cztery.\n2.6 | no list | Zdanie sześć.', {}
                return '2.2 | a claim | Zdanie dwa.\n2.4 | a claim | Zdanie 4.', {}
            with mock.patch('llm.cli', cli):
                found = review.check_chapter(chapter, 2, str(sheet))
            self.assertEqual(len(prompts), 2)
            first, second = sorted(prompts, key=lambda p: '07.jpg' in p)
            self.assertIn('04.jpg', first)
            self.assertNotIn('05.jpg', first)
            self.assertIn('04.jpg', second)  # the shared sentence
            self.assertNotIn('03.jpg', second)
            self.assertIn('sentences 2.4–2.7', second)
            self.assertIn('skip that check here', second)
            self.assertNotIn('skip that check here', first)
            self.assertEqual([(f['sentence'], f['fix']) for f in found],
                             [('2.2', 'Zdanie dwa.'), ('2.4', 'Zdanie 4.'), ('2.6', 'Zdanie sześć.')])
            with mock.patch('llm.cli', return_value=('drop | nothing of it shows', {})):
                self.assertEqual(review.check_chapter(chapter, 2, str(sheet)), [{'chapter': 2, 'drop': 'nothing of it shows'}])

            def one_drop(prompt, system, effort, read=(), timeout=None):
                return ('drop | not in these pictures', {}) if '07.jpg' in prompt else ('ok', {})
            with mock.patch('llm.cli', one_drop):
                self.assertEqual(review.check_chapter(chapter, 2, str(sheet)), [])  # half a chapter is no drop

    def test_failed_review_propagates_from_parallel_checks(self):
        with mock.patch('llm.cli', side_effect=RuntimeError('limit reached')):
            with self.assertRaises(review.ReviewUnavailable):
                review.check_claims('/tmp', ['/tmp/chapter-1.jpg'], {'chapters': [{'title': 'A'}]}, provider='cli')

    def test_old_cached_empty_verdict_is_rechecked(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            chapter = {'film': 'F1', 'source': {'file': 'gaps/pr1/story.txt'}, 'sentences': [{'text': 'A', 'action': 1}]}
            saved = {'key': review.chapter_key(chapter), 'found': []}
            core.save(run / 'early' / 'pr1.json', saved)
            self.assertEqual(review.early_findings(run, {'chapters': [chapter]}), {})
            core.save(run / 'early' / 'pr1.json', dict(saved, checked=True))
            self.assertEqual(review.early_findings(run, {'chapters': [chapter]}), {1: []})

    def test_rewrites_go_back_to_the_file_each_chapter_came_from(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'gaps' / 'pr7').mkdir(parents=True)
            (run / 'story.txt').write_text('# chapter F1 | 1 | Notatki | proof: "Saved"\n0 | Otwieramy notatki.\n'
                                           '2 | Zapis trafia do chmury.\n# not shown | 3 | Zmiany techniczne.\n')
            (run / 'gaps' / 'pr7' / 'story.txt').write_text('# chapter F9 | 7 | Limit | proof: "12h"\n1 | Import odrzucony.\n')
            story = {'chapters': [
                {'film': 'F1', 'source': {'file': 'story.txt', 'chapter': 0}, 'sentences': [{}, {}]},
                {'film': 'F9', 'source': {'file': 'gaps/pr7/story.txt', 'chapter': 0}, 'sentences': [{}]}]}
            claims = [{'sentence': '1.2', 'problem': 'no cloud', 'fix': 'Widać komunikat „Saved”.'},
                      {'sentence': '2.1', 'problem': 'no rejection', 'fix': 'Wpis zostaje w polu importu.'},
                      {'sentence': '9.9', 'problem': 'no such sentence', 'fix': 'x'}]
            self.assertEqual(len(review.apply_claims(run, story, claims)), 2)
            main = (run / 'story.txt').read_text()
            self.assertIn('2 | Widać komunikat „Saved”.', main)
            self.assertIn('0 | Otwieramy notatki.', main)
            self.assertIn('# not shown | 3 | Zmiany techniczne.', main)
            self.assertIn('1 | Wpis zostaje w polu importu.', (run / 'gaps' / 'pr7' / 'story.txt').read_text())

    def test_saved_review_expires_when_the_take_or_review_rules_change(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            capture = run / 'capture'
            core.save(capture / 'capture.json', {'end': 12})
            chapter = {'film': 'F1', 'source': {'file': 'gaps/pr1/story.txt'},
                       'sentences': [{'text': 'Zapisujemy zmianę.', 'action': 1}]}
            story = {'keys': {'F1': str(capture)}, 'chapters': [chapter]}
            core.save(run / 'early/pr1.json', {'checked': True, 'found': [],
                                              'key': review.chapter_key(chapter, capture)})
            self.assertEqual(review.early_findings(run, story), {1: []})
            with mock.patch.object(review, 'CHECK', review.CHECK + '\nNew review rule.'):
                self.assertEqual(review.early_findings(run, story), {})
            core.save(capture / 'capture.json', {'end': 20})
            self.assertEqual(review.early_findings(run, story), {})

    def test_saved_review_expires_when_its_framing_implementation_changes(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            scripts = run / 'scripts'
            scripts.mkdir()
            for name in ('review.py', 'cut.py', 'montage.py'):
                (scripts / name).write_text('# original implementation\n')
            chapter = {'film': 'F1', 'source': {'file': 'gaps/pr1/story.txt'},
                       'sentences': [{'text': 'Widać wynik.', 'action': 1}]}
            story = {'chapters': [chapter]}
            with mock.patch.object(review, '__file__', str(scripts / 'review.py')):
                for name in ('review.py', 'cut.py', 'montage.py'):
                    with self.subTest(source=name):
                        core.save(run / 'early/pr1.json', {'checked': True, 'found': [],
                                                        'key': review.chapter_key(chapter)})
                        self.assertEqual(review.early_findings(run, story), {1: []})
                        (scripts / name).write_text('# updated implementation\n')
                        self.assertEqual(review.early_findings(run, story), {})

    def test_a_sentence_over_an_empty_screen_is_cut_while_three_pinned_ones_stay(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'story.txt').write_text('# chapter F1 | 1 | Notatki | proof: "Saved"\n0 | Pierwsze.\n1 | Drugie.\n'
                                           '2 | Trzecie.\n3 | Czwarte nad pustą listą.\n'
                                           '# chapter F2 | 2 | Raport | proof: "PDF"\n0 | Jeden.\n1 | Dwa.\n2 | Trzy.\n')
            story = {'chapters': [{'film': 'F1', 'source': {'file': 'story.txt', 'chapter': 0}, 'sentences': [{}] * 4},
                                  {'film': 'F2', 'source': {'file': 'story.txt', 'chapter': 1}, 'sentences': [{}] * 3}]}
            claims = [{'sentence': '1.4', 'problem': 'said over an empty screen: no notes', 'cut': True},
                      {'sentence': '1.1', 'problem': 'said over an empty screen', 'cut': True},  # names the change
                      {'sentence': '2.3', 'problem': 'said over an empty screen', 'cut': True}]  # three would not stay
            applied = review.apply_claims(run, story, claims)
            self.assertEqual([c['sentence'] for c in applied], ['1.4'])
            text = (run / 'story.txt').read_text()
            self.assertNotIn('Czwarte', text)
            self.assertIn('2 | Trzy.', text)
            self.assertEqual(applied[0]['before'], 'Czwarte nad pustą listą.')

    def test_empty_opening_setup_can_leave_three_sentences_showing_the_change(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'story.txt').write_text(
                '# chapter F1 | 1 | Osoby projektu | proof: "Anna"\n'
                '7 | Otwieramy pustą listę.\n8 | Nie ma jeszcze dodatkowych osób.\n'
                '16 | Do projektu dodajemy teraz dodatkowe osoby.\n'
                '23 | Anna i Jan są na liście.\n32 | Po powrocie obie osoby pozostają przypisane.\n')
            story = {'chapters': [{'film': 'F1', 'source': {'file': 'story.txt', 'chapter': 0},
                                   'sentences': [{'added': True}] + [{}] * 5}]}
            claims = [{'sentence': f'1.{n}', 'problem': 'only empty setup', 'cut': True} for n in (1, 2, 3)]
            applied = review.apply_claims(run, story, claims)
            self.assertEqual({c['sentence'] for c in applied}, {'1.2', '1.3'})  # introduction stays
            text = (run / 'story.txt').read_text()
            self.assertNotIn('pustą listę', text)
            self.assertNotIn('Nie ma jeszcze', text)
            self.assertIn('16 | Do projektu dodajemy teraz dodatkowe osoby.', text)
            self.assertIn('32 | Po powrocie obie osoby pozostają przypisane.', text)

    def test_the_check_rewrites_sentences_and_drops_a_chapter_that_shows_nothing(self):
        with tempfile.TemporaryDirectory() as folder:
            review_dir = Path(folder)
            sheets = []
            for number in (1, 2):
                (review_dir / f'c{number}').mkdir()
                (review_dir / f'c{number}' / '01.jpg').write_bytes(b'')
                sheets.append(str(review_dir / f'chapter-{number}.jpg'))
            story = {'chapters': [{'title': 'Notatki', 'proofs': ['Saved']}, {'title': 'Raport', 'proofs': ['PDF']}]}
            answers = {'1': '1.1 | a cloud | Widać komunikat „Saved”.\n1.2 | cut | an empty list\n',
                       '2': 'drop | the page is still loading\n'}
            prompts = []

            def cli(prompt, system, effort, read=(), timeout=None):
                prompts.append(prompt)
                return answers[prompt.split('chapter ', 1)[1].split(' ', 1)[0]], {}
            with mock.patch('llm.cli', cli):
                found = review.check_claims(folder, sheets, story, provider='cli')
            self.assertIn({'sentence': '1.1', 'problem': 'a cloud', 'fix': 'Widać komunikat „Saved”.'}, found)
            self.assertIn({'sentence': '1.2', 'problem': 'said over an empty screen: an empty list', 'cut': True}, found)
            self.assertIn({'chapter': 2, 'drop': 'the page is still loading'}, found)
            self.assertTrue(any('The texts on screen that prove it: "PDF"' in p for p in prompts))

    def test_drops_spare_the_opening_and_the_closing_and_keep_three_chapters(self):
        with tempfile.TemporaryDirectory() as folder:
            chapters = [{'title': f'R{i}', 'prs': [i], 'source': {'file': 'story.txt', 'chapter': i - 1}} for i in range(1, 7)]
            found = [{'chapter': n, 'drop': 'blank'} for n in (1, 2, 3, 4, 6)]
            drops = review.record_drops(folder, {'chapters': chapters}, found)
            self.assertEqual([d['title'] for d in drops], ['R2', 'R3'])  # never the first or last; at most two
            self.assertEqual(json.loads((Path(folder) / 'drops.json').read_text())[0]['chapter'], 1)
        with tempfile.TemporaryDirectory() as folder:
            four = review.record_drops(folder, {'chapters': chapters[:4]}, found)
            self.assertEqual([d['title'] for d in four], ['R2'])  # three chapters stay

    def test_a_later_review_keeps_the_chapters_an_earlier_one_dropped(self):
        # finish run again after a failed make: its review must not bring back what the first review dropped
        with tempfile.TemporaryDirectory() as folder:
            chapters = [{'title': f'R{i}', 'prs': [i], 'source': {'file': f'gaps/pr{i}/story.txt', 'chapter': 0}}
                        for i in range(1, 7)]
            first = review.record_drops(folder, {'chapters': chapters}, [{'chapter': 3, 'drop': 'blank'}])
            self.assertEqual([d['title'] for d in first], ['R3'])
            remaining = [c for c in chapters if c['title'] != 'R3']
            again = review.record_drops(folder, {'chapters': remaining}, [{'chapter': 2, 'drop': 'blank'},
                                                                          {'chapter': 4, 'drop': 'blank'}])
            self.assertEqual([d['title'] for d in again], ['R2'])  # two in all, the earlier one counted
            kept = json.loads((Path(folder) / 'drops.json').read_text())
            self.assertEqual([d['title'] for d in kept], ['R3', 'R2'])
            self.assertEqual(review.record_drops(folder, {'chapters': remaining}, []), [])
            self.assertEqual(len(json.loads((Path(folder) / 'drops.json').read_text())), 2)  # a clean review keeps them



class Relevance(unittest.TestCase):
    def test_the_check_names_the_change_and_turns_label_lists_into_polish(self):
        # the judges' first complaint: chapters that read labels aloud and never say what changed
        self.assertIn('the change is not named', review.CHECK)
        self.assertIn('a list of labels', review.CHECK)
        self.assertIn("The chapter's change itself", review.CHECK)


class AddedLines(unittest.TestCase):
    def test_a_rewrite_finds_its_sentence_past_the_opening_line_adopt_added(self):
        import editor
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'gaps' / 'pr1').mkdir(parents=True)
            (run / 'gaps' / 'pr1' / 'story.txt').write_text('# chapter F1 | 1 | Scena | proof: "x"\n0 | Pierwsze zdanie.\n2 | Drugie zdanie.\n')
            story = {'chapters': [{'source': {'file': 'gaps/pr1/story.txt', 'chapter': 0}, 'sentences': [
                {'text': language.TEXTS['pl']['intro'].format(name='Shop'), 'action': None, 'added': True},
                {'text': 'Pierwsze zdanie.', 'action': 0}, {'text': 'Drugie zdanie.', 'action': 2}]}]}
            applied = review.apply_claims(run, story, [{'sentence': '1.2', 'problem': 'p', 'fix': 'Poprawione zdanie.'},
                                                       {'sentence': '1.1', 'problem': 'p', 'fix': 'Nie ruszaj.'}])
            self.assertEqual(len(applied), 1)
            self.assertIn('0 | Poprawione zdanie.', (run / 'gaps' / 'pr1' / 'story.txt').read_text())
            self.assertIn('2 | Drugie zdanie.', (run / 'gaps' / 'pr1' / 'story.txt').read_text())

    def test_a_rewrite_finds_its_sentence_past_the_lines_tidy_left_out(self):
        import editor
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'gaps' / 'pr1').mkdir(parents=True)
            scene = run / 'gaps' / 'pr1' / 'story.txt'
            scene.write_text('# chapter F1 | 1 | Scena | proof: "x"\n0 | A.\n- | B.\n2 | C.\n- | D.\n6 | E.\n')
            chapter = editor.parse(scene.read_text())['chapters'][0]
            chapter['source'] = {'file': 'gaps/pr1/story.txt', 'chapter': 0}
            chapter['sentences'].insert(0, {'text': 'W tym wydaniu…', 'action': None, 'added': True})
            story = editor.tidy({'chapters': [chapter]})  # the opening line makes D the third line without an action
            self.assertEqual([s['text'] for s in story['chapters'][0]['sentences']], ['W tym wydaniu…', 'A.', 'B.', 'C.', 'E.'])
            applied = review.apply_claims(run, story, [{'sentence': '1.5', 'problem': 'p', 'fix': 'E poprawione.'}])
            self.assertEqual(len(applied), 1)
            self.assertEqual(scene.read_text().splitlines()[1:], ['0 | A.', '- | B.', '2 | C.', '- | D.', '6 | E poprawione.'])

if __name__ == '__main__':
    unittest.main()
