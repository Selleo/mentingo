"""The film's language: English or Polish, from the project's add-on or the release's own texts, and the prompts and
lines of a film told in it."""
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import editor  # noqa: E402
import language  # noqa: E402
import review  # noqa: E402

# what only a Polish prompt says: its examples and rules
POLISH_ONLY = ('„', 'widać', 'W tym wydaniu', 'Polish', 'Widok kursanta', 'Po odświeżeniu')


def release(texts, notes=''):
    return {'repo': 'Acme/shop', 'tag': 'v2', 'release': {'name': 'v2', 'body': notes},
            'prs': [{'number': n, 'title': t, 'body': b, 'labels': [],
                     'touched': {'specs': [], 'frontend': [], 'texts': []}} for n, (t, b) in enumerate(texts, 1)]}


class Choose(unittest.TestCase):
    def test_the_releases_own_texts_decide_and_the_add_on_overrides(self):
        english = release([('feat: require project status on budget comments', 'This closes #3062. Require a '
                            'delivery-health assessment on every new project budget comment.')])
        polish = release([('feat: dodaj status projektu', 'Teraz każdy komentarz do budżetu wymaga oceny, która '
                           'pokazuje się na liście.')])
        self.assertEqual((language.detect(english), language.detect(polish)), ('en', 'pl'))
        self.assertEqual(language.detect(release([])), None)
        self.assertEqual(language.choose({}, english), 'en')
        self.assertEqual(language.choose({'language': 'pl'}, english), 'pl')
        self.assertEqual(language.choose({}, release([])), 'pl')  # nothing to tell by: the skill's first language
        with self.assertRaises(SystemExit):
            language.choose({'language': 'de'}, english)

    def test_a_run_from_before_languages_is_polish(self):
        self.assertEqual(language.texts({'repo': 'Acme/shop'})['code'], 'pl')
        self.assertEqual(language.texts({'language': 'en'})['edge_voice'], 'en-US-GuyNeural')


class Prompts(unittest.TestCase):
    def test_an_english_film_is_asked_for_in_english_only(self):
        sources = dict(release([('feat: notes', 'Adds notes.')]), language='en')
        chapter = {'title': 'Notes', 'prs': [1], 'proofs': ['Notes'], 'film': 'F1'}
        prompts = [editor.chapter_prompt(sources, chapter, 'lines', ['Notes', 'Other'], 1, 2, {}),
                   editor.LEFT_OUT.format(repo='a', tag='b', brief='', scenes='', prs='', language='English',
                                          reason_examples=language.TEXTS['en']['reason_examples'])]
        said = language.TEXTS['en']
        prompts.append(review.CHECK.format(number=1, title='t', images='', proofs='', part='', language=said['name'],
                                           result_examples=said['result_examples'], change_example=said['change_example'],
                                           reloaded='"After a page reload"', no_fillers=said['no_fillers'],
                                           review_language=said['review_language']))
        for prompt in prompts:
            self.assertIn('English', prompt)
            self.assertFalse([word for word in POLISH_ONLY if word in prompt], prompt[:300])
        self.assertIn('Do not start with "In this release"', editor.chapter_prompt(
            sources, chapter, 'lines', ['A', 'Notes', 'C'], 2, 3, {}))


class Lessons(unittest.TestCase):
    def test_narration_lessons_are_kept_per_language(self):  # a Polish lesson ("say it in plain Polish") misleads English
        import tempfile
        from unittest import mock
        import knowledge
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(knowledge.core, 'HOME', Path(folder)):
            home = knowledge.folder('Acme/shop')
            home.mkdir(parents=True)
            (home / 'narration.md').write_text('- Mów prostą polszczyzną.\n')
            self.assertEqual(knowledge.narration('Acme/shop'), '- Mów prostą polszczyzną.')
            self.assertEqual(knowledge.narration('Acme/shop', 'en'), '')
            (home / 'narration-en.md').write_text('- Say what the picture shows.\n')
            sources = dict(release([('feat: notes', 'Adds notes.')]), language='en')
            prompt = editor.chapter_prompt(sources, {'title': 'Notes', 'prs': [1], 'proofs': ['Notes'], 'film': 'F1'},
                                           'lines', ['Notes'], 1, 1, {})
            self.assertIn('Say what the picture shows.', prompt)
            self.assertNotIn('polszczyzną', prompt)


class Lines(unittest.TestCase):
    def test_an_english_story_opens_closes_and_tidies_in_english(self):
        said = language.TEXTS['en']
        story = {'chapters': [{'sentences': [{'text': 'In this release, the calendar picks days.'},
                                             {'text': 'New: a "Weekend" note.'}]},
                              {'sentences': [{'text': 'In this release we also save notes.'}]}]}
        editor.tidy(story, quotes=said['quotes'])
        self.assertEqual(story['chapters'][0]['sentences'][1]['text'], 'New: a “Weekend” note.')
        self.assertEqual(editor.reopen(story, said), ['2.1'])
        self.assertEqual(story['chapters'][1]['sentences'][0]['text'], 'Now we also save notes.')
        self.assertEqual(editor.unlabel(story, said), ['1.2'])
        self.assertEqual(story['chapters'][0]['sentences'][1]['text'], 'A “Weekend” note.')
        self.assertEqual(editor.short_label('Idle cutoff on”: only Anna', opening='“'), '“Idle cutoff on”: only Anna')


if __name__ == '__main__':
    unittest.main()
