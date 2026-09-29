"""The editor: spec picking, the answer formats and the story checks."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import editor  # noqa: E402
import language  # noqa: E402
import sources  # noqa: E402


def pr(number, title, files, body=''):
    return {'number': number, 'title': title, 'labels': [], 'body': body, 'url': f'https://github.com/o/r/pull/{number}',
            'files': files, 'touched': sources.touched(files)}


class Picking(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        (root / 'e2e/specs').mkdir(parents=True)
        (root / 'e2e/page-objects').mkdir(parents=True)
        (root / 'e2e/specs/allocation.spec.ts').write_text('test("adds an allocation", async () => {})')
        (root / 'e2e/specs/leave.spec.ts').write_text('import { LeaveRequestModal } from "../page-objects/LeaveRequestModal";')
        (root / 'e2e/specs/login.smoke.spec.ts').write_text('test("logs in", async () => {})')
        self.root = root
        self.sources = {'prs': [
            pr(1, 'feat: allocation percentages', ['frontend/src/Allocation.tsx', 'e2e/specs/allocation.spec.ts']),
            pr(2, 'feat: holiday picker', ['frontend/src/components/AddLeaveRequestModal.tsx']),
            pr(3, 'chore: bump deps', ['package-lock.json']),
            pr(4, 'feat: faster login', ['frontend/src/Login.tsx', 'e2e/specs/login.smoke.spec.ts'])]}

    def tearDown(self):
        self.temp.cleanup()

    def test_changed_specs_first_then_specs_that_drive_the_changed_screens(self):
        specs, reasons = editor.pick_specs(self.sources, 'e2e', {}, checkout=self.root)
        self.assertEqual(specs, ['e2e/specs/allocation.spec.ts', 'e2e/specs/leave.spec.ts'])
        self.assertEqual(reasons['e2e/specs/leave.spec.ts'], [2])  # LeaveRequestModal drives the changed modal
        self.assertNotIn('e2e/specs/login.smoke.spec.ts', specs)  # smoke checks are avoided by default

    def test_technical_changes_rank_below_features(self):
        self.assertGreater(editor.score(self.sources['prs'][0]), editor.score(self.sources['prs'][2]))
        self.assertLessEqual(editor.score(self.sources['prs'][2]), 0)


class Answers(unittest.TestCase):
    def test_the_line_format(self):
        story = editor.parse('''Here you go:
# chapter F2 | 12, 13 | Alokacje: procent czasu | proof: "Idle income protection"; „Idle · 75% income”
0 | W tym wydaniu widać alokacje.
- | Ten sam ekran.
3. Otwieramy okno.
# not shown | 14,15 | Zmiany techniczne.''')
        chapter = story['chapters'][0]
        self.assertEqual((chapter['film'], chapter['prs'], chapter['title']), ('F2', [12, 13], 'Alokacje: procent czasu'))
        self.assertEqual(chapter['proofs'], ['Idle income protection', 'Idle · 75% income'])
        self.assertEqual([s['action'] for s in chapter['sentences']], [0, None, 3])
        self.assertEqual(story['not_shown'], [{'prs': [14, 15], 'reason': 'Zmiany techniczne.'}])

    def test_json_answers_and_unclosed_json(self):
        answer = {'chapters': [{'film': 'F1', 'prs': [1], 'title': 'T', 'sentences': [{'text': 'A.', 'action': 0}]}]}
        self.assertEqual(editor.parse('```json\n' + json.dumps(answer) + '\n```'), answer)
        self.assertEqual(editor.parse(json.dumps(answer)[:-2]), answer)  # the model stopped before the last brackets


class Lines(unittest.TestCase):
    def test_film_lines_read_as_a_viewer_names_things(self):
        page = None
        line, page = editor.tidy_line("3 fill getByTestId('lesson-title-input') = \"Kotlin Basics\" [text \"Title\"] | on screen: "
                                      "dialog \"New lesson\" @ /admin/courses/c81f27cc-b7ee-46ae-a151-7282cb4fca9a", page)
        self.assertEqual(line, '3 fill "Title" = "Kotlin Basics" | on screen: dialog "New lesson" @ /admin/courses/…')
        line, page = editor.tidy_line("4 click locator('main').getByRole('button', { name: 'Save' }).first() "
                                      "@ /admin/courses/c81f27cc-b7ee-46ae-a151-7282cb4fca9a", page)
        self.assertEqual(line, '4 click button "Save"')  # the same page is not repeated
        line, _ = editor.tidy_line("5 look be visible: getByText('you cannot add more than 12h a day') | on screen: toasts "
                                   "\"import-1790424805876 failed\" @ /schedule/import", page)
        self.assertEqual(line, '5 look be visible: "you cannot add more than 12h a day" | on screen: toasts '
                               '"import-… failed" @ /schedule/import')


class Checks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        folder = Path(self.temp.name) / 'film'
        folder.mkdir()
        (folder / 'capture.json').write_text(json.dumps({'steps': [{'step': i} for i in range(6)], 'actions_text': [
            f"{i} click getByRole('button', {{ name: 'Save {i}' }}) @ /notes" for i in range(6)]}))
        self.keys = {'F1': str(folder)}
        self.sources = {'prs': [pr(n, f'feat: {n}', [f'frontend/{n}.tsx']) for n in range(1, 5)]}

    def tearDown(self):
        self.temp.cleanup()

    def story(self, actions, title='Alokacje', chapters=4, words=25):
        text = ' '.join(['słowo'] * words) + '.'
        return {'chapters': [{'film': 'F1', 'prs': [index + 1], 'title': title, 'proofs': ['save 4'],
                              'sentences': [{'text': text, 'action': a} for a in actions]} for index in range(chapters)]}

    def test_a_good_story_passes(self):
        self.assertEqual(editor.check(self.story([0, 2, 4, None]), self.keys, self.sources, {}), [])

    def test_a_chapter_proves_its_change_on_screen(self):
        story = self.story([0, 2, 4, None])
        story['chapters'][0]['proofs'] = ['Delete all']
        self.assertIn("proof 'Delete all' is not in film F1", ' '.join(editor.check(story, self.keys, self.sources, {})))
        story = self.story([0, 1, 2, None])
        self.assertIn('pin a sentence to action 4 or later', ' '.join(editor.check(story, self.keys, self.sources, {})))
        story['chapters'][0]['proofs'] = []
        self.assertIn('give 1–3 proof texts', ' '.join(editor.check(story, self.keys, self.sources, {})))

    def test_a_pull_request_belongs_to_one_chapter(self):
        story = self.story([0, 2, 4, None])
        story['chapters'][0]['prs'] = [1, 2]
        self.assertIn('#2 is named in chapters [1, 2]', ' '.join(editor.check(story, self.keys, self.sources, {})))

    def test_other_scripts_than_polish_are_sent_back(self):
        story = self.story([0, 2, 4, None])
        story['not_shown'] = [{'prs': [1], 'reason': 'Drobne улучшения.'}]
        self.assertIn('Polish only', ' '.join(editor.check(story, self.keys, self.sources, {})))

    def test_a_film_holds_at_most_its_words_and_chapters(self):
        self.assertIn('at most 570 words', ' '.join(editor.check(self.story([0, 2, 4, None], words=40), self.keys, self.sources, {})))
        self.assertIn('make at most 10', ' '.join(editor.check(self.story([0, 2, 4, None], chapters=11, words=3), self.keys,
                                                               self.sources, {})))
        self.assertEqual(editor.check({'chapters': []}, self.keys, self.sources, {}), ['no chapters: no scene was filmed and narrated'])

    def test_a_last_sentence_before_the_proof_is_pinned_to_it(self):
        story = self.story([0, 1, 2, None])  # the proof 'save 4' shows at action 4
        self.assertEqual(editor.repin(story, self.keys), [1, 2, 3, 4])
        self.assertEqual([s['action'] for s in story['chapters'][0]['sentences']], [0, 1, 4, None])
        self.assertEqual(editor.check(story, self.keys, self.sources, {}), [])
        self.assertEqual(editor.repin(story, self.keys), [])  # nothing left to move

    def test_only_the_films_first_sentence_opens_with_w_tym_wydaniu(self):
        story = self.story([0, 2, 4, None])
        story['chapters'][0]['sentences'][0]['text'] = 'W tym wydaniu pokazujemy nowości.'
        story['chapters'][1]['sentences'][0]['text'] = 'W tym wydaniu tryb wsparcia pozwala wybrać administratora.'
        self.assertEqual(editor.reopen(story), ['2.1'])
        self.assertEqual(story['chapters'][1]['sentences'][0]['text'], 'Teraz tryb wsparcia pozwala wybrać administratora.')
        self.assertEqual(story['chapters'][0]['sentences'][0]['text'], 'W tym wydaniu pokazujemy nowości.')

    def test_not_shown_keeps_only_this_release_and_unshown_pull_requests(self):
        story = dict(self.story([0, 2, 4], chapters=1), not_shown=[{'prs': [1, 2, 99], 'reason': 'Technika.'},
                                                                   {'prs': [99], 'reason': 'Spoza wydania.'}])
        self.assertEqual(editor.tidy(story, {1, 2, 3})['not_shown'], [{'prs': [2], 'reason': 'Technika.'}])

    def test_surplus_sentences_without_an_action_are_dropped(self):
        story = editor.tidy(self.story([0, None, 1, None, None, 2, None], chapters=1))
        self.assertEqual([s['action'] for s in story['chapters'][0]['sentences']], [0, None, 1, None, 2])
        self.assertEqual(len(story['dropped']), 2)

    def test_problems_name_what_to_fix(self):
        problems = editor.check(self.story([0, 4, 2, 9, None, None, None], 'x' * 90), self.keys, self.sources, {})
        text = ' '.join(problems)
        self.assertIn('85 characters', text)
        self.assertIn('action 9', text)
        self.assertIn('comes before', text)
        self.assertIn('without an action', text)
        self.assertIn('unknown film', ' '.join(editor.check({'chapters': [{'film': 'F9', 'sentences': []}]}, self.keys,
                                                             self.sources, {})))


class NewTexts(unittest.TestCase):
    def test_a_film_names_the_new_ui_texts_it_shows(self):
        sources = {'prs': [{'number': 2945, 'ui': ['Idle income protection', 'Go to profile', 'Set']},
                           {'number': 2926, 'ui': ['Edit']}]}
        lines = ['3 click getByRole(\'button\', { name: \'Go to profile\' }) | on screen: dialog "Idle income protection"',
                 '4 click getByRole(\'button\', { name: \'Edit\' }) @ /x']
        self.assertEqual(editor.new_texts(sources, lines), '#2945 "Idle income protection", "Go to profile"')  # no bare words



class LeftOut(unittest.TestCase):
    def test_a_film_its_scenes_carry_only_groups_what_it_leaves_out(self):
        with tempfile.TemporaryDirectory() as folder:
            sources = {'repo': 'Acme/shop', 'tag': 'v2', 'base': 'v1',
                       'prs': [pr(1, 'feat: a', ['frontend/a.tsx']), pr(2, 'feat: b', ['frontend/b.tsx']),
                               pr(3, 'fix: c', ['frontend/c.tsx']), pr(4, 'chore: bump deps', ['package-lock.json']),
                               pr(5, 'feat: e', ['frontend/e.tsx'])]}
            claimed = {1: 'Scena A', 2: 'Scena B'}
            with mock.patch.object(editor, 'ask', return_value=('# not shown | 3 | Drobna poprawka wyglądu.\n', {})) as asked:
                result = editor.write(folder, sources, 'cli', claimed=claimed)
            self.assertEqual(asked.call_count, 1)  # one quick call, no plan and no chapter
            self.assertEqual(asked.call_args[0][2], editor.RESERVE_EFFORT)
            self.assertEqual(result['not_shown'], 3)
            story = json.loads((Path(folder) / 'story.json').read_text())
            reasons = {n: line['reason'] for line in story['not_shown'] for n in line['prs']}
            self.assertEqual(reasons, {3: 'Drobna poprawka wyglądu.', 4: language.TEXTS['pl']['technical'], 5: language.TEXTS['pl']['rest']})
            self.assertIn('# not shown | 3 |', (Path(folder) / 'story.txt').read_text())


class Labels(unittest.TestCase):
    def test_a_sentence_opening_on_a_label_starts_on_what_follows(self):
        story = {'chapters': [{'sentences': [{'text': 'Nowość: w trybie wsparcia wcielamy się w każdego.'},
                                             {'text': 'Nowość – to zostaje, bo zdanie ma treść dalej.'}]},
                              {'sentences': [{'text': 'Nowości tego wydania.'}, {'text': 'Nowość:'}]}]}
        self.assertEqual(editor.unlabel(story), ['1.1', '1.2'])
        self.assertEqual([s['text'] for s in story['chapters'][0]['sentences']],
                         ['W trybie wsparcia wcielamy się w każdego.', 'To zostaje, bo zdanie ma treść dalej.'])
        self.assertEqual([s['text'] for s in story['chapters'][1]['sentences']], ['Nowości tego wydania.', 'Nowość:'])


class StepLabels(unittest.TestCase):
    """The film's bottom bar: a caption per sentence saying what happens, which a viewer without sound understands."""

    def story(self):
        return {'chapters': [
            {'film': 'F1', 'title': 'Alokacje: procent czasu i zakres dat w jednym oknie edycji', 'sentences': [
                {'text': 'W tym wydaniu pokazujemy nowości.', 'action': None},
                {'text': 'Otwieramy okno alokacji.', 'action': 0}, {'text': 'Zapisujemy.', 'action': 1}]},
            {'film': 'F1', 'title': 'Raport', 'sentences': [{'text': 'Raport ma nową kolumnę.', 'action': 0}]}]}

    def test_each_sentence_gets_its_label_or_keeps_the_one_before(self):
        story = self.story()
        answer = ('1.1 | Nowości wydania\n1.2 | Otwieramy okno alokacji\n1.3 | -\n'
                  '2.1 | „Raport godzin pracy całego zespołu ma teraz nową kolumnę z sumą nadgodzin każdej osoby w danym '
                  'miesiącu i w całym roku”\n')
        with mock.patch.object(editor, 'ask', return_value=(answer, {'usd_list': 0.01})) as asked:
            usage = editor.write_labels(story, {}, {'repo': 'Acme/shop', 'tag': 'v2'}, 'cli')
        self.assertEqual(asked.call_count, 2)  # one quick call per chapter, all at once: each answers its own lines
        self.assertEqual({call[0][2] for call in asked.call_args_list}, {editor.RESERVE_EFFORT})
        prompts = sorted(call[0][0] for call in asked.call_args_list)
        self.assertIn('1.2 | Otwieramy okno alokacji.', prompts[0])
        self.assertNotIn('2.1 |', prompts[0])
        self.assertIn('2.1 | Raport ma nową kolumnę.', prompts[1])
        labels = [[s.get('label') for s in c['sentences']] for c in story['chapters']]
        self.assertEqual(labels[0], ['Nowości wydania', 'Otwieramy okno alokacji', None])
        self.assertEqual(labels[1], ['Raport godzin pracy całego zespołu ma teraz nową kolumnę z sumą nadgodzin każdej '
                                     'osoby w danym miesiącu i w'])  # two lines at most: cut at a word, no outer quotes
        self.assertIn('watches without sound', asked.call_args[0][0])
        self.assertEqual(usage, [{'usd_list': 0.01}, {'usd_list': 0.01}])

    def test_a_chapter_without_an_answer_shows_its_title_and_the_others_their_captions(self):
        story = self.story()

        def ask(prompt, *rest, **kwargs):  # the second chapter's call timed out
            if 'Chapter 2:' in prompt:
                raise editor.Unanswered('timed out')
            return '1.1 | Nowości wydania\n1.2 | Otwieramy okno alokacji\n1.3 | Zapisujemy zmiany\n', {'usd_list': 0.01}
        with mock.patch.object(editor, 'ask', side_effect=ask):
            usage = editor.write_labels(story, {}, {'repo': 'Acme/shop', 'tag': 'v2'})
        self.assertEqual([[s.get('label') for s in c['sentences']] for c in story['chapters']],
                         [['Nowości wydania', 'Otwieramy okno alokacji', 'Zapisujemy zmiany'], ['Raport']])
        self.assertEqual(usage, [{'usd_list': 0.01}, None])

    def test_captions_marked_up_or_numbered_by_the_sentence_alone_are_read_and_an_answer_without_any_is_missing(self):
        story = self.story()

        def ask(prompt, *rest, **kwargs):
            if 'Chapter 2:' in prompt:  # an answer that names no sentence: no caption, so the chapter is missing
                return 'Raport: nowa kolumna.', {'usd_list': 0.01}
            return '**1.1** | Nowości wydania\n- 2 | Otwieramy okno alokacji\n3 | Zapisujemy zmiany\n', {'usd_list': 0.01}
        with mock.patch.object(editor, 'ask', side_effect=ask):
            usage = editor.write_labels(story, {}, {'repo': 'Acme/shop', 'tag': 'v2'})
        self.assertEqual([[s.get('label') for s in c['sentences']] for c in story['chapters']],
                         [['Nowości wydania', 'Otwieramy okno alokacji', 'Zapisujemy zmiany'], ['Raport']])
        self.assertEqual(usage, [{'usd_list': 0.01}, None])  # film.labels lists chapter 2 as missing
        # the one chapter asked about, numbered otherwise by the answer, keeps its captions
        self.assertEqual(editor.caption_lines('1.1 | A\n1.2 | B\n', 4), {1: 'A', 2: 'B'})
        self.assertEqual(editor.caption_lines('1.1 | A\n2.1 | B\n', 2), {1: 'B'})

    def test_without_a_model_each_chapter_shows_its_title(self):
        story = self.story()
        with mock.patch.object(editor, 'ask', side_effect=editor.Unanswered('no model')):
            editor.write_labels(story, {}, {'repo': 'Acme/shop', 'tag': 'v2'})
        self.assertEqual([[s.get('label') for s in c['sentences']] for c in story['chapters']],
                         [['Alokacje: procent czasu i zakres dat w jednym oknie edycji', None, None], ['Raport']])
        self.assertEqual(editor.short_label('Zgoda: „Acceptance required”.'), 'Zgoda: „Acceptance required”')
        self.assertEqual(editor.short_label('Status „Waiting for the finance department approval”', 32),
                         'Status „Waiting for the finance”')  # a quote the cut leaves open is closed
        self.assertEqual(editor.short_label('Idle cutoff on”: tylko Anna Kowalczyk'),
                         '„Idle cutoff on”: tylko Anna Kowalczyk')  # and one the model never opened is opened
        with mock.patch.object(editor, 'ask') as asked:  # a story without sentences asks nothing
            self.assertEqual(editor.write_labels({'chapters': []}, {}, {}), [])
        asked.assert_not_called()


class Proofs(unittest.TestCase):
    def test_a_proof_the_film_lines_lack_word_for_word_never_stops_the_chapter(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'capture.json').write_text(json.dumps({'steps': [{'step': i} for i in range(4)], 'actions_text': [
                '0 goto /plans @ /plans', '1 click "Hot Desk" @ /plans',
                '2 look to have text: toast expects "The Hot Desk plan has been set as the next plan." @ /plans',
                '3 look be visible: getByText(/selected plan/) expects "/Your selected plan .*/" @ /plans']}))
            chapter = {'film': 'F8', 'title': 'Plany', 'proofs': ['Your selected plan for next month is Hot Desk'],
                       'sentences': [{'action': 1, 'text': 'a'}, {'action': 3, 'text': 'b'}]}
            story = {'chapters': [chapter]}
            self.assertEqual(editor.mend_proofs(story, {'F8': folder}), ['Plany'])
            # the words the pattern starts with, which the page showed, or the toast the next check expects
            self.assertIn(chapter['proofs'], (['Your selected plan'], ['The Hot Desk plan has been set as the next plan.']))
            self.assertEqual(editor.mend_proofs(story, {'F8': folder}), [])  # a proof the lines hold stays
            (Path(folder) / 'capture.json').write_text(json.dumps({'steps': [{'step': i} for i in range(3)], 'actions_text': [
                '0 hover budget @ /d', '1 look be visible: getByText(/^Budget amount: 96/) | on screen: headings "Budget amount: 96 000 zł / Predicted cost" @ /d',
                '2 look have count: rows expects "12" @ /d']}))
            chapter.update(proofs=['Budget amount: 96 000 zł'], sentences=[{'action': 0, 'text': 'a'}, {'action': 2, 'text': 'b'}])
            editor.mend_proofs(story, {'F8': folder})  # the lines hold "Budget amount: 96 000 zł / …" in other words
            self.assertIn(chapter['proofs'], (['Budget amount: 96 000 zł'], ['Budget amount: 96 000'], ['Budget amount']))
            chapter.update(proofs=['Kwota budżetu widoczna na kafelku'])  # nothing of it: a text on screen instead
            editor.mend_proofs(story, {'F8': folder})
            self.assertEqual(chapter['proofs'], ['Budget amount: 96 000 zł / Predicted cost'])


class Ending(unittest.TestCase):
    def test_an_empty_last_screen_is_known_from_the_page(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'capture.json').write_text(json.dumps({'steps': [
                {'step': 0}, {'step': 1}, {'step': 2, 'shows_empty': ['No courses yet']}]}))
            keys = {'F1': folder}
            chapter = {'film': 'F1', 'sentences': [{'action': 0}, {'action': 2}, {'action': None}]}
            self.assertTrue(editor.ends_empty(chapter, keys))
            self.assertFalse(editor.ends_empty(dict(chapter, sentences=[{'action': 1}]), keys))
            self.assertFalse(editor.ends_empty(dict(chapter, film='F9'), keys))


if __name__ == '__main__':
    unittest.main()
