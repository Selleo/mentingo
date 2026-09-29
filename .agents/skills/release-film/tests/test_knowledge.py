"""The project's knowledge: scenes that passed and lessons, folded in after a run and read by the next."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import knowledge  # noqa: E402


class Run(unittest.TestCase):
    """A finished run of Acme/shop with one passed scene (pr7) and a knowledge home of its own."""

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        home = Path(self.folder.name) / 'home'
        patcher = mock.patch.object(knowledge.core, 'HOME', home)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.run = Path(self.folder.name) / 'run'
        (self.run / 'gaps' / 'pr7').mkdir(parents=True)
        (self.run / 'meta.json').write_text(json.dumps({'repo': 'Acme/shop', 'tag': 'v2.0.0'}))
        (self.run / 'gaps' / 'pr7' / 'gap.json').write_text(json.dumps({
            'id': 'pr7', 'prs': [7], 'title': 'feat: booking day picker', 'show': 'pick days in the booking modal',
            'base': 'e2e/specs/booking.spec.ts', 'proofs': ['Selected: 2']}))
        (self.run / 'gaps' / 'pr7' / 'result.json').write_text(json.dumps({'ok': True, 'actions': 12}))
        (self.run / 'gaps' / 'pr7' / 'scene.spec.ts').write_text('import { test } from "../fixtures/test";\ntest("picks", async () => {});\n')
        self.index = {'films': [
            {'spec': 'e2e/specs/ai.spec.ts', 'title': 'chats with the mentor', 'status': 'failed', 'error': 'no AI'},
            {'spec': 'e2e/specs/news.spec.ts', 'title': 'adds news', 'status': 'passed'},
            {'spec': 'e2e/specs/rf-pr7.spec.ts', 'title': 'picks', 'status': 'passed', 'gap': 'pr7'}],
            'batches': {'g01': {'results': [{'file': 'specs/demo--rf-pr7.spec.ts', 'status': 'failed', 'error': 'locator timeout'}]},
                        'g02': {'results': [{'file': 'specs/demo--rf-pr7.spec.ts', 'status': 'passed', 'error': ''}]}}}
        (self.run / 'captures.json').write_text(json.dumps(self.index))


class ScenePolicy(unittest.TestCase):
    def test_literal_role_names_require_an_explicit_matching_choice(self):
        for value in ['"Manage people"', "'Save'", '`Team ${name}`']:
            with self.subTest(value=value):
                source = f'// camera scene\nawait page.getByRole("button", {{name: {value}}}).click();'
                self.assertIn('line 2', knowledge.scene_locator_issue(source))
                self.assertEqual(knowledge.scene_locator_issue(source.replace('name:', 'exact: true, name:')), '')
                self.assertEqual(knowledge.scene_locator_issue(source.replace('name:', 'exact: false, name:')), '')

    def test_fixed_role_names_get_an_exact_match_where_the_options_end(self):
        source = ('await page.getByRole("button", {name: "Save"}).click();\n'
                  "page.getByRole('row', { name: 'Anna Nowak', }).click();\n"
                  'page.getByRole("tab", {\n  name: `Team ${team}`, // the team tab\n}).click();\n'
                  'page.getByRole("link", {name: "Docs", exact: false});\n'
                  'page.getByRole("button", {name: /^Save/});\n')
        fixed, lines = knowledge.exact_role_names(source)
        self.assertEqual(lines, [1, 2, 3])
        self.assertEqual(fixed.splitlines()[:5], [
            'await page.getByRole("button", {name: "Save", exact: true}).click();',
            "page.getByRole('row', { name: 'Anna Nowak', exact: true }).click();",
            'page.getByRole("tab", {', '  name: `Team ${team}`, exact: true // the team tab', '}).click();'])
        self.assertEqual(knowledge.scene_locator_issue(fixed), '')
        self.assertEqual(knowledge.exact_role_names(fixed), (fixed, []))

    def test_locator_preflight_ignores_comments_strings_regexes_and_dynamic_names(self):
        source = '''
// page.getByRole('button', {name: 'Not code'});
/* page.getByRole('button', {name: 'Not code'}); */
const sample = "page.getByRole('button', {name: 'Not code'})";
page.getByRole('button', {name: /^Save/});
page.getByRole('button', {name: actualLabel});
page.getByRole('textbox');
'''
        self.assertEqual(knowledge.scene_locator_issue(source), '')

    def test_direct_clients_and_raw_queries_are_rejected_with_line_numbers(self):
        sources = [
            'import { Client } from "pg";\nconst db = new Client({});\nawait db.query(`UPDATE work_units SET decisions_legal_notes=$1`, [html]);',
            'const pg = require("pg");',
            'const client = await import("pg");',
            'await db.query("SELECT id FROM finance_project_budgets");',
            'await db.execute(`INSERT INTO snapshots (hours) VALUES (27.5)`);',
            'await prisma.$queryRaw`SELECT id FROM users`;',
            'await prisma.$executeRawUnsafe(statement);',
            'await prisma.$queryRaw`${statement}`;',
        ]
        for source in sources:
            with self.subTest(source=source):
                self.assertIn('line 1', knowledge.scene_policy_issue(source))

    def test_project_helpers_ui_text_and_comments_are_allowed(self):
        source = '''
import { test } from '../fixtures/test';
import { createInvoice } from '../helpers/database';
// import { Client } from 'pg';
/* db.query('SELECT id FROM users'); */
await createInvoice({ amount: 120 });
await page.getByText('SELECT id FROM users').click();
await page.getByText('import { Client } from "pg"').click();
'''
        self.assertEqual(knowledge.scene_policy_issue(source), '')


class Learning(Run):
    def test_replacing_an_sql_scene_does_not_rehabilitate_its_old_recipe(self):
        home = knowledge.folder('Acme/shop')
        (home / 'scenes').mkdir(parents=True)
        (home / 'scenes/pr7--v2.0.0.spec.ts').write_text('import { Client } from "pg";')
        recipe = {'text': 'Booking: upsert the snapshot rows.', 'words': ['booking'],
                  'scene': 'pr7', 'tag': 'v2.0.0'}
        knowledge.core.save(home / 'recipes.json', [recipe])
        self.assertEqual(knowledge.recipes_for('Acme/shop', {'title': 'Booking'}), [])
        with mock.patch('llm.complete', return_value=('', {'provider': 'agent'})):
            knowledge.learn(self.run)
        self.assertTrue(knowledge.allowed_scene(home / 'scenes/pr7--v2.0.0.spec.ts'))
        self.assertEqual(knowledge.core.load(home / 'recipes.json'), [])
        self.assertEqual(knowledge.recipes_for('Acme/shop', {'title': 'Booking'}), [])

    def test_sql_scene_never_teaches_scenes_recipes_or_distillation(self):
        scene = self.run / 'gaps' / 'pr7'
        (scene / 'scene.spec.ts').write_text('import { Client } from "pg";\nconst db = new Client({});')
        (scene / 'recipes.txt').write_text('Booking day picker: upsert snapshots with hours 27.5.\n')
        with mock.patch('llm.complete') as complete:
            result = knowledge.learn(self.run)
        self.assertEqual(result['scenes_kept'], [])
        self.assertEqual(json.loads((knowledge.folder('Acme/shop') / 'recipes.json').read_text()), [])
        complete.assert_not_called()

    def test_a_rejected_later_edit_cannot_teach_new_recipes_via_a_passed_result(self):
        scene = self.run / 'gaps' / 'pr7'
        (scene / 'scene.passed.spec.ts').write_text('test("passed through project helpers", async () => {});')
        (scene / 'scene.spec.ts').write_text('import { Client } from "pg";')
        (scene / 'recipes.txt').write_text('Booking day picker: fill the snapshot rows.\n')
        self.assertEqual(knowledge.found_recipes(self.run, []), [])
        with mock.patch('llm.complete') as complete:
            knowledge.learn(self.run)
        complete.assert_not_called()

    def test_recall_excludes_old_sql_scenes_and_their_indirect_recipes(self):
        home = knowledge.folder('Acme/shop')
        (home / 'scenes').mkdir(parents=True)
        gap = json.loads((self.run / 'gaps' / 'pr7' / 'gap.json').read_text())
        old = dict(gap, file='pr7--v1.0.spec.ts', tag='v1.0')
        (home / 'scenes' / old['file']).write_text('import { Client } from "pg";')
        (home / 'scenes.json').write_text(json.dumps([old]))
        recipes = [
            {'text': 'Booking: upsert the snapshot rows.', 'words': ['booking'], 'scene': 'pr7', 'tag': 'v1.0'},
            {'text': 'Booking: UPDATE work_units SET notes=1.', 'words': ['booking'], 'scene': 'pr8', 'tag': 'v0'},
            {'text': 'Booking: SELECT id, title FROM booking.', 'words': ['booking'], 'scene': 'pr8', 'tag': 'v0'},
            {'text': 'Booking: createBooking from fixtures/booking.', 'words': ['booking'], 'scene': 'pr9', 'tag': 'v0'},
        ]
        (home / 'recipes.json').write_text(json.dumps(recipes))
        (home / 'lessons.md').write_text('- Insert with pg Client into work_units.\n- Use the admin fixture.\n')
        recalled = knowledge.recall('Acme/shop', gap)
        self.assertNotIn('upsert', recalled)
        self.assertNotIn('UPDATE', recalled)
        self.assertNotIn('pg', recalled)
        self.assertIn('createBooking', recalled)
        self.assertIn('admin fixture', recalled)
        self.assertEqual(knowledge.found_recipes(self.run, recipes), recipes[-1:])

    def test_distillation_forbids_sql_and_application_api_mocks(self):
        self.assertIn("mocking the application's own API", knowledge.DISTILL)
        self.assertIn('Never teach custom SQL, direct database clients', knowledge.DISTILL)
        with mock.patch('llm.complete', return_value=('- Use pg Client to seed bookings.\n- Use createBooking helper.\n', {})):
            knowledge.learn(self.run)
        self.assertEqual((knowledge.folder('Acme/shop') / 'lessons.md').read_text(), '- Use createBooking helper.\n')

    def test_distillation_reads_the_take_that_passed_after_a_later_edit(self):
        scene = self.run / 'gaps' / 'pr7'
        (scene / 'scene.passed.spec.ts').write_text('test("the filmed version", async () => {});')
        (scene / 'scene.spec.ts').write_text('test("the later failed version", async () => {});')
        with mock.patch('llm.complete', return_value=('', {'provider': 'agent'})) as complete:
            knowledge.learn(self.run)
        prompt = complete.call_args_list[0].args[0]
        self.assertIn('the filmed version', prompt)
        self.assertNotIn('the later failed version', prompt)

    def test_a_run_leaves_its_scenes_and_lessons(self):
        answers = []

        def complete(prompt, system, provider=None, effort=None):
            answers.append(prompt)
            return '- Log in with the admin fixture.\n- Wait for the dialog before filling it.\nnot a bullet\n', {}
        with mock.patch('llm.complete', complete):
            first = knowledge.learn(self.run)
        home = knowledge.folder('Acme/shop')
        self.assertEqual(first['scenes_kept'], ['pr7--v2.0.0.spec.ts'])
        self.assertTrue((home / 'scenes' / 'pr7--v2.0.0.spec.ts').is_file())
        self.assertEqual(json.loads((home / 'scenes.json').read_text())[0]['tries'], 2)
        self.assertIn('try g01: failed: locator timeout', answers[0])  # the lessons come from the tries' errors
        self.assertEqual((home / 'lessons.md').read_text().splitlines(), ['- Log in with the admin fixture.',
                                                                          '- Wait for the dialog before filling it.'])
        with mock.patch('llm.complete', complete):
            knowledge.learn(self.run)
        self.assertIn('- Log in with the admin fixture.', answers[1])  # earlier lessons are merged, not lost
        self.assertEqual(len((home / 'history.jsonl').read_text().splitlines()), 2)

    def test_the_next_brief_gets_the_lessons_and_the_nearest_scene(self):
        with mock.patch('llm.complete', return_value=('- Use the booking page object.\n', {})):
            knowledge.learn(self.run)
        near = {'id': 'pr9', 'title': 'feat: booking limit', 'show': 'a limit in the booking modal',
                'base': 'e2e/specs/booking.spec.ts'}
        text = knowledge.recall('Acme/shop', near)
        self.assertIn('- Use the booking page object.', text)
        self.assertIn('test("picks"', text)  # the earlier scene on the same screen, in full
        far = {'id': 'pr10', 'title': 'feat: invoices export', 'show': 'export invoices', 'base': 'e2e/specs/invoices.spec.ts'}
        self.assertNotIn('test("picks"', knowledge.recall('Acme/shop', far))
        self.assertEqual(knowledge.recall('Other/project', near), '')  # nothing known yet


class Limits(Run):
    def test_a_services_absence_and_a_data_recipe_are_learned_for_the_next_choice_and_brief(self):
        (self.run / 'gaps' / 'pr8').mkdir()
        (self.run / 'gaps' / 'pr8' / 'gap.json').write_text(json.dumps({'id': 'pr8', 'prs': [8], 'title': 'AI mentor'}))
        (self.run / 'gaps' / 'pr8' / 'worker.log').write_text(
            '1790000000.0 ' + json.dumps({'type': 'result', 'result': 'failed: the stack has no AI provider configured'}) + '\n')
        (self.run / 'gaps' / 'pr7' / 'worker.log').write_text(
            '1790000000.0 ' + json.dumps({'type': 'result', 'result': 'failed: my locator never matched'}) + '\n')
        (self.run / 'gaps' / 'pr7' / 'recipes.txt').write_text('A booking of three days: createBooking(api, {days: 3}) '
                                                               'from fixtures/booking.ts\n')
        with mock.patch('llm.complete', return_value=('', {'provider': 'agent'})):
            knowledge.learn(self.run)
        self.assertEqual(knowledge.limits('Acme/shop'), ['the stack has no AI provider configured'])  # not its own mistake
        self.assertEqual(json.loads((knowledge.folder('Acme/shop') / 'scenes.json').read_text()), [])  # pr7 gave up: not kept
        near = {'id': 'pr9', 'title': 'feat: booking limit', 'show': 'a limit in the booking modal', 'base': 'e2e/specs/booking.spec.ts'}
        self.assertIn('createBooking(api, {days: 3})', knowledge.recall('Acme/shop', near))
        far = {'id': 'pr10', 'title': 'feat: invoices export', 'show': 'export invoices', 'base': 'e2e/specs/invoices.spec.ts'}
        self.assertEqual(knowledge.recipes_for('Acme/shop', far), [])


class Narration(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        patcher = mock.patch.object(knowledge.core, 'HOME', Path(self.folder.name) / 'home')
        patcher.start()
        self.addCleanup(patcher.stop)
        self.run = Path(self.folder.name) / 'run'
        (self.run / 'review').mkdir(parents=True)
        (self.run / 'meta.json').write_text(json.dumps({'repo': 'Acme/shop', 'tag': 'v2.0.0'}))

    def test_what_the_review_rewrote_becomes_a_lesson_for_the_next_films(self):
        (self.run / 'review' / 'claims.json').write_text(json.dumps({'applied': [
            {'before': 'Pojawia się komunikat „Saved”.', 'problem': 'no toast in the pictures', 'fix': 'Zapisujemy zmiany.'}],
            'drops': [{'title': 'Wykres', 'reason': 'the chart is still loading'}]}))
        prompts = []

        def complete(prompt, system, provider=None, effort=None):
            prompts.append(prompt)
            return '- Name a toast only when the film lines show it on screen.\n', {}
        with mock.patch('llm.complete', complete):
            self.assertEqual(len(knowledge.distill_narration(self.run, 'Acme/shop', 'v2.0.0')), 1)
        self.assertIn('said: Pojawia się komunikat „Saved”.', prompts[0])
        self.assertIn('dropped chapter "Wykres"', prompts[0])
        self.assertIn('toast', knowledge.narration('Acme/shop'))

    def test_lessons_never_trade_the_chapters_change_for_literal_labels(self):
        # a check that only strips claims makes lessons that forbid naming the change (round 10: "no archived budgets")
        self.assertIn('never tells the writers to leave a chapter\'s change unnamed', knowledge.NARRATION)
        self.assertIn('no values, names or labels quoted from this film', ' '.join(knowledge.NARRATION.split()))
        self.assertIn('never teaches describing an empty screen', ' '.join(knowledge.NARRATION.split()))
        import review
        self.assertIn('The chapter\'s change itself', review.CHECK)
        import editor
        home = knowledge.folder('Acme/shop')
        home.mkdir(parents=True)
        (home / 'narration.md').write_text('- Name only the fields actually typed in.\n')
        prompt = editor.chapter_prompt({'repo': 'Acme/shop', 'tag': 'v2', 'prs': []},
                                       {'title': 'T', 'prs': [], 'proofs': ['x'], 'film': 'F1'}, 'lines', ['T', 'U'], 2, 3, {})
        self.assertIn('the chapter still names its change plainly', prompt)
        self.assertIn('Name only the fields actually typed in.', prompt)

    def test_an_earlier_chapter_hints_the_base_test_for_a_related_change(self):
        home = knowledge.folder('Acme/shop')
        home.mkdir(parents=True)
        (home / 'features.json').write_text(json.dumps([
            {'pr': 7, 'title': 'feat: budget notes on dashboard tiles', 'chapter': 'Notatki na kafelkach budżetu',
             'tag': 'v1.0.0', 'by': 'scene', 'spec': 'e2e/specs/dashboard-widgets.spec.ts'}]))
        hint = knowledge.earlier('Acme/shop', {'title': 'feat: whole hours on dashboard budget tiles'})
        self.assertEqual([f['spec'] for f in hint], ['e2e/specs/dashboard-widgets.spec.ts'])
        self.assertEqual(knowledge.earlier('Acme/shop', {'title': 'feat: invoices export'}), [])


class Notes(unittest.TestCase):
    def test_a_writers_note_is_kept_only_once_the_scene_passed(self):
        import film
        with tempfile.TemporaryDirectory() as folder:
            gap = Path(folder) / 'gaps' / 'pr1'
            gap.mkdir(parents=True)
            args = mock.Mock(run=folder, gap='pr1', text='Log in   with the admin fixture.')
            self.assertFalse(film.note(args)['ok'])
            (gap / 'result.json').write_text(json.dumps({'ok': True}))
            self.assertEqual(film.note(args)['kept'], 'Log in with the admin fixture.')
            self.assertEqual((gap / 'notes.txt').read_text(), 'Log in with the admin fixture.\n')
            recipe = mock.Mock(run=folder, gap='pr1', text='A course with lessons: seedCourse(3)', kind='recipe')
            film.note(recipe)
            self.assertEqual((gap / 'recipes.txt').read_text(), 'A course with lessons: seedCourse(3)\n')


if __name__ == '__main__':
    unittest.main()
