"""Scenes for changes no test shows: the plan line, the proofs a viewer can read, merging a filmed scene, the cameras
and the scenes' time limits."""
import fcntl
import importlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import core  # noqa: E402
import editor  # noqa: E402
import gaps  # noqa: E402
import language  # noqa: E402
import sources  # noqa: E402


def pr(number, title, files, ui=()):
    return {'number': number, 'title': title, 'labels': [], 'body': '', 'files': files, 'touched': sources.touched(files),
            'ui': list(ui)}


class Plan(unittest.TestCase):
    def test_a_gap_line_round_trips(self):
        gap = {'id': 'pr12', 'prs': [12], 'title': 'feat: picker', 'proofs': ['Flex Friday days'],
               'base': 'e2e/specs/booking.spec.ts', 'show': 'the new picker'}
        self.assertEqual(gaps.parse(gaps.render([gap])), [gap])

    def test_proofs_are_texts_a_viewer_reads(self):
        self.assertEqual(gaps.proofs(['… info', 'profile-skeleton', 'NPS Score', 'Marketing consent', 'Industry']),
                         ['NPS Score', 'Marketing consent'])
        self.assertEqual(gaps.proofs(['clientY -', 'offsetX', 'Video progress']), ['Video progress'])  # code, not a label
        # an error message makes a scene provoke the error; code shows nothing
        self.assertEqual(gaps.proofs(['Error resetting certificates', 'Failed to delete category', '| globalThis.KeyboardEvent',
                                      'loading...', 'total - 1', 'The thread must be active.', 'Certificate validity']),
                         ['Certificate validity'])
        self.assertEqual(gaps.proofs(['canvas]:!w-full"', 'void document', '`preview`',
                                      'Course preview', 'Fullscreen reader']), ['Course preview', 'Fullscreen reader'])

    def test_workflow_evidence_keeps_titles_and_marks_interception_without_running_tests(self):
        own, related, omitted = 'e2e/certificate.spec.ts', 'e2e/course.spec.ts', 'e2e/other.spec.ts'
        texts = {
            own: 'test("Create certificate", async () => {});\ntest.skip("Download PDF", async () => {});\n'
                 'test.only(`Renew certificate`, async () => {});\ntest("Fourth title", async () => {});',
            related: 'test("Complete course", async () => page.route("**/video-provider", handler));',
            omitted: 'test("Unrelated workflow", async () => {});',
        }
        with mock.patch.object(editor, 'related', return_value=[own, related, omitted]):
            evidence = gaps.workflow_evidence(pr(1, 'Certificates', [own]), texts)
        self.assertEqual(evidence.count(own), 1)
        for title in ['Create certificate', 'Download PDF', 'Renew certificate', 'Complete course']:
            self.assertIn(title, evidence)
        self.assertNotIn('Fourth title', evidence)
        self.assertNotIn(omitted, evidence)
        self.assertIn('[route interception: verify the target]', evidence)
        self.assertNotIn('mocked application API', evidence)

    def test_workflow_evidence_discloses_when_no_related_test_exists(self):
        with mock.patch.object(editor, 'related', return_value=[]):
            self.assertEqual(gaps.workflow_evidence(pr(1, 'Certificates', ['e2e/missing.spec.ts']), {}),
                             ' | no related test workflow found')

    def test_the_choice_reads_the_release_notes(self):
        prs = [{'number': 1, 'title': 'feat: live trainings', 'body': '', 'ui': [], 'labels': [],
                'touched': {'specs': ['e2e/a.spec.ts'], 'frontend': ['src/x.tsx'], 'texts': []}}]
        seen = {}

        def complete(prompt, system, provider=None, effort=None):
            seen['prompt'] = prompt
            return '', {}
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'e2e').mkdir()
            (Path(folder) / 'e2e' / 'a.spec.ts').write_text('test("a", async () => {});')
            release = {'name': 'v2 - Live Training', 'body': 'Highlights: Live Trainings in the calendar.'}
            with mock.patch.object(gaps.llm, 'complete', complete), mock.patch.object(gaps.knowledge, 'earlier', return_value=[]):
                gaps.choose({'repo': 'Acme/shop', 'tag': 'v2', 'prs': prs, 'release': release}, Path(folder), ['e2e'], {}, [])
        self.assertIn('Highlights: Live Trainings in the calendar.', seen['prompt'])
        self.assertIn('"v2 - Live Training"', seen['prompt'])
        self.assertIn('existing test workflows: e2e/a.spec.ts: a', seen['prompt'])
        self.assertNotIn('cannot show', seen['prompt'])
        with tempfile.TemporaryDirectory() as folder:  # what the test stack cannot show, learned or given
            (Path(folder) / 'e2e').mkdir()
            (Path(folder) / 'e2e' / 'a.spec.ts').write_text('test("a", async () => {});')
            with mock.patch.object(gaps.llm, 'complete', complete), mock.patch.object(gaps.knowledge, 'earlier', return_value=[]), \
                    mock.patch.object(gaps.knowledge, 'limits', return_value=['the stack has no AI provider']):
                gaps.choose({'repo': 'Acme/shop', 'tag': 'v2', 'prs': prs}, Path(folder), ['e2e'],
                            {'harness': {'unavailable': ['video transcoding']},
                             'unavailable': ['payments (no Stripe keys)', 'video transcoding']}, [])
        self.assertIn('cannot show these (never pick a change that needs one):\n- video transcoding\n- payments (no Stripe keys)\n'
                      '- the stack has no AI provider', seen['prompt'])
        self.assertEqual(seen['prompt'].count('- video transcoding'), 1)

    def test_features_without_a_test_are_suggested_first(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'e2e/specs').mkdir(parents=True)
            (root / 'e2e/specs/booking.spec.ts').write_text('import { BookingModal } from "../po/BookingModal";')
            data = {'prs': [pr(1, 'fix: booking modal spacing', ['frontend/src/BookingModal.tsx'], ['A b', 'C d']),
                            pr(2, 'feat: booking modal picker', ['frontend/src/BookingModal.tsx'], ['Pick days']),
                            pr(3, 'feat: tested thing', ['frontend/src/BookingModal.tsx', 'e2e/specs/booking.spec.ts'])]}
            picked = gaps.candidates(data, root, ['e2e/specs'], {})
            # a feature first, a related fix in the same scene (one base spec); one with its own test never
            self.assertEqual([(g['id'], g['prs']) for g in picked], [('pr2', [2, 1])])
            self.assertEqual(picked[0]['base'], 'e2e/specs/booking.spec.ts')
            self.assertIn('#2: feat: booking modal picker; #1: fix: booking modal spacing', picked[0]['show'])
            # when the capture does not film that test, its pull request gets a scene too (its own test is the base)
            self.assertEqual(gaps.candidates(data, root, ['e2e/specs'], {}, picked=[])[0]['prs'], [2, 3])  # two a scene


class DataSources(unittest.TestCase):
    def put(self, root, name, text):
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def test_finance_paths_outrank_an_unrelated_base_and_are_limited(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.put(root, 'e2e/kudos.spec.ts', 'page.route("**/kudos", mockResponse)')
            self.put(root, 'spec/factories/finance_entries.rb', 'FactoryBot.define do; factory :entry; end')
            self.put(root, 'e2e/helpers/finance.ts', 'export function createFinanceEntry() {}')
            for n in range(7):
                self.put(root, f'e2e/finance-{n}.spec.ts', 'test("finance", () => {})')
            gap = {'title': 'Show finances', 'prs': [1], 'base': 'e2e/kudos.spec.ts'}
            found = gaps.data_sources(gaps.data_index(root), gap,
                                      {1: pr(1, 'Finance entries', ['frontend/src/FinanceEntries.tsx'])})
            self.assertEqual(len(found), 5)
            self.assertIn('spec/factories/finance_entries.rb', found)
            self.assertIn('e2e/helpers/finance.ts', found)
            self.assertNotIn(gap['base'], found)

    def test_content_match_finds_certificate_setup_and_its_helper(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.put(root, 'apps/web/e2e/specs/learning/quiz-retake.spec.ts',
                     'import { createCourse } from "./learning-test-helpers";\n'
                     'test("completed course certificate", () => waitForCertificate())')
            self.put(root, 'apps/web/e2e/specs/learning/learning-test-helpers.ts',
                     'export const createCourse = () => factories.createCourse()')
            self.put(root, 'e2e/kudos.spec.ts', 'test("kudos", () => {})')
            gap = {'title': 'Certificate validity', 'prs': [2], 'base': 'e2e/kudos.spec.ts'}
            found = gaps.data_sources(gaps.data_index(root), gap,
                                      {2: pr(2, 'Certificate validity', ['app/CertificateSettings.tsx'])})
            self.assertEqual(found, ['apps/web/e2e/specs/learning/quiz-retake.spec.ts',
                                     'apps/web/e2e/specs/learning/learning-test-helpers.ts'])

    def test_dependencies_generated_code_and_symlinks_are_not_read(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for directory in ['node_modules/pkg/test', 'app/node_modules/pkg/test', 'vendor/spec',
                              '.local/test', '.git/test', 'dist/test', 'e2e/__generated__']:
                self.put(root, f'{directory}/finance.spec.ts', 'finance')
            self.put(root, 'e2e/helpers/finance.ts', 'export const finance = true')
            (root / 'e2e/linked.spec.ts').symlink_to(root / 'e2e/helpers/finance.ts')
            (root / 'linked-tests').symlink_to(root / 'e2e', target_is_directory=True)
            self.assertEqual([row[0] for row in gaps.data_index(root)], ['e2e/helpers/finance.ts'])

    def test_irrelevant_code_is_not_padded_into_the_suggestions(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.put(root, 'e2e/kudos.spec.tsx', 'test("kudos", async () => {})')
            gap = {'title': 'Add certificates for courses', 'prs': [1], 'base': 'e2e/other.spec.ts'}
            self.assertEqual(gaps.data_sources(gaps.data_index(root), gap,
                             {1: pr(1, 'Add certificates for courses', ['frontend/src/Certificate.tsx'])}), [])

    def test_briefs_share_the_index_and_disclose_mocked_base_data(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            self.put(run / 'checkout', 'e2e/kudos.spec.ts', 'test("kudos", () => page.route("**/api", mock))')
            self.put(run / 'checkout', 'spec/factories/finance.rb', 'factory :finance_entry')
            scene = {'id': 'pr1', 'title': 'Finance entries', 'prs': [1], 'base': 'e2e/kudos.spec.ts',
                     'proofs': [], 'show': ''}
            change = pr(1, 'Finance entries', ['app/Finance.tsx'])
            change['body'] = '<!-- ' + 'PR template instructions. ' * 45 + ' -->\nShow paid and unpaid invoices.'
            with mock.patch.object(gaps, 'sample_picture', return_value=None), \
                    mock.patch.object(gaps.knowledge, 'recall', return_value=''), \
                    mock.patch.object(gaps.knowledge, 'narration', return_value=''), \
                    mock.patch.object(gaps, 'data_index', wraps=gaps.data_index) as scanned:
                made = gaps.briefs(run, [scene, dict(scene, id='pr2')],
                                  {'repo': 'Example/app', 'prs': [change]},
                                  {'config': 'e2e/playwright.config.ts'}, ['e2e'])
            self.assertEqual(scanned.call_count, 1)
            text = Path(made['pr1']).read_text()
            self.assertIn('`spec/factories/finance.rb`', text)
            self.assertIn('possibly unrelated or using mocked API data', text)
            self.assertIn('before spending a try', text)
            self.assertNotIn('right screen, login, data', text)
            self.assertIn('Show paid and unpaid invoices.', text)
            self.assertNotIn('PR template instructions.', text)

    def test_locator_evidence_keeps_the_component_role_and_accessible_name_together(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            component = 'frontend/Navigation.tsx'
            self.put(root, component, '// unrelated imports\n' * 25 +
                     '<TabsTrigger\n  role="tab"\n  aria-label="Kudos"\n  disabled={loading}\n>\n  Kudos\n</TabsTrigger>')
            change = {'markup': {component: ['  aria-label="Kudos"']}}
            evidence = gaps.markup([1], {1: change}, checkout=root)
            self.assertIn(component, evidence)
            self.assertIn('role="tab"', evidence)
            self.assertIn('aria-label="Kudos"', evidence)
            self.assertIn('disabled={loading}', evidence)
            self.assertLessEqual(len(evidence), 8000)

    def test_locator_evidence_never_follows_a_changed_path_outside_the_checkout(self):
        with tempfile.TemporaryDirectory() as folder:
            outer, root = Path(folder), Path(folder) / 'checkout'
            root.mkdir()
            self.put(outer, 'private.tsx', 'PRIVATE\n<div role="button" />')
            (root / 'linked.tsx').symlink_to(outer / 'private.tsx')
            change = {'markup': {name: ['<div role="button" />'] for name in ['../private.tsx', 'linked.tsx']}}
            self.assertNotIn('PRIVATE', gaps.markup([1], {1: change}, checkout=root))

    def test_context_supplies_used_helper_bodies_and_relevant_factories(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.put(root, 'e2e/lesson.spec.ts', 'import { createLesson } from "./helpers/lesson";\n'
                     'test("watched video", () => createLesson({ completion: "coverage" }))')
            self.put(root, 'e2e/helpers/lesson.ts', '// unrelated setup\n' * 500 +
                     'export async function createLesson(options: { completion: "coverage" }) {\n'
                     '  return factory.create({ kind: "video", ...options });\n}\n')
            self.put(root, 'spec/factories/video.rb', 'factory :video, completion: :coverage')
            gap = {'title': 'Video coverage', 'prs': [1], 'base': 'e2e/lesson.spec.ts'}
            packet = gaps.source_context(root, gap, {1: pr(1, 'Video coverage', ['frontend/Video.tsx'])},
                                         gaps.data_index(root))
            self.assertIn('return factory.create({ kind: "video", ...options });', packet)
            self.assertIn('factory :video, completion: :coverage', packet)
            self.assertIn('Incomplete excerpt', packet)
            self.assertLess(len(packet), 24500)

    def test_context_does_not_follow_external_hidden_dependency_or_symlink_imports(self):
        with tempfile.TemporaryDirectory() as folder:
            outer = Path(folder)
            root = outer / 'checkout'
            self.put(outer, 'external.ts', 'export const secret = "external"')
            self.put(root, '.local/secret.ts', 'export const secret = "hidden"')
            self.put(root, 'node_modules/secret.ts', 'export const secret = "dependency"')
            self.put(root, 'e2e/lesson.spec.ts', '\n'.join(
                f'import {{ secret }} from "{name}";' for name in
                ['../../external', '../.local/secret', '../node_modules/secret', './linked']))
            (root / 'e2e/linked.ts').symlink_to(outer / 'external.ts')
            gap = {'title': 'Lesson', 'prs': [], 'base': 'e2e/lesson.spec.ts'}
            self.assertEqual(gaps.source_context(root, gap, {}, []), '')

    def test_context_has_a_total_budget_even_with_many_large_helpers(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.put(root, 'e2e/lesson.spec.ts', '\n'.join(
                f'import {{ helper{n} }} from "./helper{n}";' for n in range(20)))
            for n in range(20):
                self.put(root, f'e2e/helper{n}.ts', f'export function helper{n}() {{\n' + '  // body\n' * 900 + '}')
            gap = {'title': 'Lesson', 'prs': [], 'base': 'e2e/lesson.spec.ts'}
            packet = gaps.source_context(root, gap, {}, [], budget=3000)
            self.assertLess(len(packet), 3200)
            self.assertNotIn('helper19.ts', packet)


class FixtureInstructions(unittest.TestCase):
    def brief(self, run, recipe, tag=None):
        checkout = run / 'checkout'
        (checkout / 'e2e').mkdir(parents=True, exist_ok=True)
        (checkout / 'e2e/a.spec.ts').write_text('test("a", () => {})')
        scene = {'id': 'pr1', 'title': 'Entries', 'prs': [1], 'base': 'e2e/a.spec.ts', 'proofs': [], 'show': ''}
        with mock.patch.object(gaps, 'sample_picture', return_value=None), \
                mock.patch.object(gaps.knowledge, 'recall', return_value=''), \
                mock.patch.object(gaps.knowledge, 'narration', return_value=''):
            sources = {'repo': 'Example/app', 'prs': [pr(1, 'Entries', ['app/Entries.tsx'])], **({'tag': tag} if tag else {})}
            made = gaps.briefs(run, [scene], sources, dict(config='e2e/playwright.config.ts', **recipe), ['e2e'])
        return Path(made['pr1']).read_text()

    def test_only_nonempty_text_authorizes_the_described_invocation_in_the_test(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            command = 'Call the approved existing project factory runner with runtimeState.stack.'
            text = self.brief(root, {'fixture_instructions': command})
            self.assertIn(command, text)
            self.assertIn('inside the test body after the project runtime fixture', text)
            self.assertIn('Do not run this invocation from your shell', text)
            self.assertIn('no custom SQL', text)
            self.assertIn('Shell permissions are unchanged', text)
            self.assertIn(gaps.harness.container_prefix(root) + '-', text)
            for recipe in [{}, {'fixture_instructions': ''}, {'fixture_instructions': '  '},
                           {'fixture_instructions': ['arbitrary-command']}, {'fixture_instructions': True}]:
                with self.subTest(recipe=recipe):
                    self.assertNotIn('Trusted project factory invocation', self.brief(root, recipe))

    def test_the_invocation_names_the_image_built_for_this_release(self):
        with tempfile.TemporaryDirectory() as folder:
            text = self.brief(Path(folder), {'fixture_instructions': "Run 'app-factories:{tag}' with `${stack.name}`."},
                              tag='v1.2.0')
            self.assertIn("Run 'app-factories:v1.2.0' with `${stack.name}`.", text)

    def test_tag_cannot_grant_the_exception_but_local_recipe_can(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            checkout, home = root / 'checkout', root / 'home'
            checkout.mkdir()
            core.save(checkout / '.release-film.json', {'harness': {'fixture_instructions': 'Run tag command'}})
            with mock.patch.object(core, 'HOME', home), mock.patch.object(core, 'SKILL', root / 'skill'), \
                    mock.patch.dict('os.environ', {'RELEASE_FILM_TRUST_TAG': '0'}):
                addon = core.addon('Example/app', checkout)
                self.assertNotIn('fixture_instructions', addon.get('harness', {}))
                self.assertIn('fixture_instructions', addon['untrusted'])
                self.assertNotIn('fixture_instructions', core.TAG_HARNESS_SAFE)
                core.save(home / 'projects/example__app.json', {'harness': {'fixture_instructions': 'Local factory'}})
                self.assertEqual(core.addon('Example/app', checkout)['harness']['fixture_instructions'], 'Local factory')


class Merge(unittest.TestCase):
    def test_filmed_scenes_become_chapters_and_failed_ones_not_shown(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            films = []
            for key in ('F1', 'F2'):
                capture = run / key
                capture.mkdir()
                (capture / 'capture.json').write_text(json.dumps({'steps': [{'step': i} for i in range(5)], 'actions_text': [
                    f"{i} click getByRole('button', {{ name: '{key} step {i}' }}) @ /x" for i in range(5)]}))
                films.append({'key': key, 'capture': str(capture), 'status': 'passed'})
            words = ' '.join(['słowo'] * 25) + '.'
            chapter = lambda key, n: (f'# chapter {key} | {n} | Rozdział {n} | proof: "{key} step 3"\n'
                                      + '\n'.join(f'{i} | {words}' for i in (0, 1, 3, 4)) + '\n')
            (run / 'story.txt').write_text('# not shown | 3 | Drobna poprawka.\n')  # write: what no scene shows
            data = {'repo': 'Acme/shop', 'prs': [pr(n, f'feat {n}', ['frontend/x.tsx']) for n in range(1, 6)]}
            scenes = [{'id': 'pr1', 'prs': [1], 'result': {'ok': True}, 'story': chapter('F1', 1)},
                      {'id': 'pr2', 'prs': [2, 4], 'result': {'ok': True}, 'story': chapter('F2', 2)},
                      {'id': 'pr5', 'prs': [5], 'result': {'ok': False}, 'story': None}]
            self.assertEqual(editor.adopt(run, data, films, scenes), [])
            story = json.loads((run / 'story.json').read_text())
            self.assertEqual([c['prs'] for c in story['chapters']], [[1], [2]])
            self.assertTrue(story['chapters'][0]['sentences'][0]['text'].startswith('W tym wydaniu'))  # the film's opening
            self.assertEqual(story['chapters'][-1]['sentences'][-1]['text'], language.TEXTS['pl']['closing'])
            self.assertIn({'prs': [3], 'reason': 'Drobna poprawka.'}, story['not_shown'])
            self.assertIn({'prs': [5], 'reason': language.TEXTS['pl']['unfilmed']}, story['not_shown'])
            self.assertIn({'prs': [4], 'reason': language.TEXTS['pl']['unshown_part']}, story['not_shown'])  # its scene could not show it
            # a chapter the review dropped (its pictures never showed the change) stays out, its pull request not shown
            (run / 'drops.json').write_text(json.dumps([{'file': 'gaps/pr2/story.txt', 'chapter': 0, 'prs': [2]}]))
            self.assertEqual(editor.adopt(run, data, films, scenes), [])
            story = json.loads((run / 'story.json').read_text())
            self.assertEqual([c['prs'] for c in story['chapters']], [[1]])
            self.assertIn({'prs': [2], 'reason': language.TEXTS['pl']['unreadable']}, story['not_shown'])


class Reserves(unittest.TestCase):
    def test_a_film_the_scenes_carry_opens_and_closes_with_lines_of_its_own(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            films = []
            for key in ('F1', 'F2', 'F3'):
                capture = run / key
                capture.mkdir()
                (capture / 'capture.json').write_text(json.dumps({'steps': [{'step': i} for i in range(5)], 'actions_text': [
                    f"{i} click getByRole('button', {{ name: '{key} step {i}' }}) @ /x" for i in range(5)]}))
                films.append({'key': key, 'capture': str(capture), 'status': 'passed'})
            (run / 'write-keys.json').write_text(json.dumps({k: str(run / k) for k in ('F1', 'F2', 'F3')}))
            words = ' '.join(['słowo'] * 25) + '.'
            scene = lambda key, n: {'id': f'pr{n}', 'prs': [n], 'result': {'ok': True}, 'story': (
                f'# chapter {key} | {n} | Scena {n} | proof: "{key} step 3"\n' + '\n'.join(f'{i} | {words}' for i in (0, 1, 3, 4)))}
            (run / 'story.txt').write_text('# not shown | 9 | Zmiany techniczne, niewidoczne w interfejsie.\n')  # no test chapter
            data = {'repo': 'Acme/shop', 'prs': [pr(n, f'feat {n}', ['frontend/x.tsx']) for n in (1, 2, 3, 9)]}
            self.assertEqual(editor.adopt(run, data, films, [scene('F1', 1), scene('F2', 2), scene('F3', 3)]), [])
            story = json.loads((run / 'story.json').read_text())
            self.assertEqual([c['prs'] for c in story['chapters']], [[1], [2], [3]])
            self.assertEqual(story['chapters'][0]['sentences'][0]['text'], language.TEXTS['pl']['intro'].format(name='Shop'))
            self.assertEqual(story['chapters'][-1]['sentences'][-1]['text'], language.TEXTS['pl']['closing'])
            self.assertEqual(editor.adopt(run, data, films, [scene('F1', 1), scene('F2', 2), scene('F3', 3)]), [])
            again = json.loads((run / 'story.json').read_text())  # adopted twice: still one opening and one closing line
            self.assertEqual(sum(s['text'] == language.TEXTS['pl']['closing'] for c in again['chapters'] for s in c['sentences']), 1)
            self.assertEqual(sum(s['text'].startswith('W tym wydaniu') for c in again['chapters'] for s in c['sentences']), 1)
            failed = lambda n: {'id': f'pr{n}', 'prs': [n], 'result': {'ok': False}, 'story': None}
            # most scenes failed: the two that passed still make a (short) film instead of stopping it
            self.assertEqual(editor.adopt(run, data, films, [scene('F1', 1), failed(2), scene('F3', 3)]), [])
            self.assertEqual([c['prs'] for c in json.loads((run / 'story.json').read_text())['chapters']], [[1], [3]])


class Candidates(unittest.TestCase):
    def test_product_coverage_and_workflow_changes_survive_technical_title_words(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'e2e').mkdir()
            (root / 'e2e/video.spec.ts').write_text('test("watched video", () => {});')
            prs = [pr(1, 'feat: video completion based on watched frame coverage', ['frontend/Video.tsx']),
                   pr(2, 'feat(docs): documentation browser and coverage enforcement', ['frontend/Docs.tsx']),
                   pr(3, 'feat: workflow editor', ['frontend/Workflow.tsx']),
                   pr(4, 'feat: increase video test coverage', ['e2e/video.spec.ts'])]
            data = {'repo': 'Acme/video', 'tag': 'v2', 'prs': prs}
            answers = '\n'.join(f'# gap | pr{n} | {n} | Feature {n}' for n in range(1, 5))
            with mock.patch.object(editor, 'related', return_value=['e2e/video.spec.ts']), \
                    mock.patch.object(gaps.llm, 'complete', return_value=(answers, {})) as model, \
                    mock.patch.object(gaps.knowledge, 'earlier', return_value=[]), \
                    mock.patch.object(gaps.knowledge, 'limits', return_value=[]):
                chosen = gaps.choose(data, root, ['e2e'], {}, [])
                fallback = gaps.candidates(data, root, ['e2e'], {}, picked=[], per_scene=3)
            self.assertEqual({n for g in chosen for n in g['prs']}, {1, 2, 3})
            self.assertEqual({n for g in fallback for n in g['prs']}, {1, 2, 3})
            self.assertIn('#1 feat: video completion', model.call_args.args[0])
            self.assertNotIn('#4 feat: increase', model.call_args.args[0])

    def test_the_model_picks_the_changes_and_the_script_their_bases(self):
        with tempfile.TemporaryDirectory() as folder:
            checkout = Path(folder)
            (checkout / 'e2e').mkdir()
            (checkout / 'e2e' / 'kudos.spec.ts').write_text('test("kudos", async () => {});')
            (checkout / 'e2e' / 'other.spec.ts').write_text('test("other", async () => {});')
            prs = [{'number': n, 'title': f'feat: change {n}', 'body': '', 'ui': ['Give kudos'] if n == 2 else [], 'labels': [],
                    'touched': {'specs': ['e2e/kudos.spec.ts'] if n == 1 else [], 'frontend': [f'src/x{n}.tsx'], 'texts': []}}
                   for n in (1, 2)]
            answer = '# gap | pr1 | 1, 2 | Kudos page\n# gap | pr9 | 9 | Not in the release\n'
            with mock.patch.object(gaps.llm, 'complete', return_value=(answer, {})), \
                    mock.patch.object(gaps.knowledge, 'earlier', return_value=[]):
                chosen = gaps.choose({'repo': 'Acme/shop', 'tag': 'v2', 'prs': prs}, checkout, ['e2e'], {}, [], limit=8)
            self.assertEqual([(g['id'], g['prs'], g['base'], g['proofs'], g['show']) for g in chosen],
                             [('pr1', [1, 2], 'e2e/kudos.spec.ts', ['Give kudos'], '')])  # its own test is its base; a
            # change's new UI text is a proof to check


class Overflow(unittest.TestCase):
    def test_a_film_with_more_scenes_than_it_holds_is_cut_to_fit(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            capture = run / 'F1'
            capture.mkdir()
            (capture / 'capture.json').write_text(json.dumps({'steps': [{'step': i} for i in range(5)], 'actions_text': [
                f"{i} click getByRole('button', {{ name: 'F1 step {i}' }}) @ /x" for i in range(5)]}))
            films = [{'key': 'F1', 'capture': str(capture), 'status': 'passed'}]
            words = ' '.join(['słowo'] * 12) + '.'
            block = lambda n: (f'# chapter F1 | {n} | Rozdział {n} | proof: "F1 step 3"\n'
                               + '\n'.join(f'{i} | {words}' for i in (0, 1, 3, 4)) + '\n')
            (run / 'story.txt').write_text('')
            data = {'repo': 'Acme/shop', 'prs': [pr(n, f'feat {n}', ['frontend/x.tsx']) for n in range(1, 12)]}
            scenes = [{'id': f'pr{n}', 'prs': [n], 'result': {'ok': True}, 'story': block(n)} for n in range(1, 12)]
            self.assertEqual(editor.adopt(run, data, films, scenes), [])  # 11 chapters: the one chosen last goes
            story = json.loads((run / 'story.json').read_text())
            self.assertEqual([c['prs'][0] for c in story['chapters']], list(range(1, 11)))
            self.assertIn({'prs': [11], 'reason': language.TEXTS['pl']['spare']}, story['not_shown'])


class Adopted(unittest.TestCase):
    """What adopt makes of the scenes: the opening and closing lines counted in the word cap, the review's own adopt,
    proofs mended before the last sentence is pinned, a narration in no format."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.run = Path(self.temp.name)
        capture = self.run / 'F1'
        capture.mkdir()
        (capture / 'capture.json').write_text(json.dumps({'steps': [{'step': i} for i in range(6)], 'actions_text': [
            f"{i} click getByRole('button', {{ name: 'F1 step {i}' }}) @ /x" for i in range(6)]
            + ['(the test ends) | empty on screen: "Nothing here"']}))
        self.films = [{'key': 'F1', 'capture': str(capture), 'status': 'passed'}]
        (self.run / 'story.txt').write_text('')
        self.data = {'repo': 'Acme/shop', 'prs': [pr(n, f'feat {n}', ['frontend/x.tsx']) for n in range(1, 12)]}

    def tearDown(self):
        self.temp.cleanup()

    def scenes(self, count, words=12, proof='F1 step 3', actions=(0, 1, 3, 4)):
        text = ' '.join(['słowo'] * words) + '.'
        block = lambda n: (f'# chapter F1 | {n} | Rozdział {n} | proof: {proof}\n'
                           + '\n'.join(f'{i} | {text}' for i in actions) + '\n')
        return [{'id': f'pr{n}', 'prs': [n], 'result': {'ok': True}, 'story': block(n)} for n in range(1, count + 1)]

    def story(self):
        return json.loads((self.run / 'story.json').read_text())

    def test_the_opening_and_closing_lines_count_in_the_word_cap(self):
        # five chapters of 112 words: 560 fit the cap, the opening and closing lines make 572, and the check refused it
        self.assertEqual(editor.adopt(self.run, self.data, self.films, self.scenes(5, words=28)), [])
        story = self.story()
        self.assertEqual([c['prs'][0] for c in story['chapters']], [1, 2, 3, 4])
        self.assertLessEqual(sum(len(s['text'].split()) for c in story['chapters'] for s in c['sentences']), editor.WORDS[1])
        self.assertIn({'prs': [5], 'reason': language.TEXTS['pl']['spare']}, story['not_shown'])

    def test_the_reviews_adopt_never_brings_in_a_chapter_it_did_not_check(self):
        scenes = self.scenes(11)
        self.assertEqual(editor.adopt(self.run, self.data, self.films, scenes), [])
        reviewed = {editor.source_of(c) for c in self.story()['chapters']}
        self.assertEqual(len(reviewed), 10)  # the eleventh was spare
        (self.run / 'drops.json').write_text(json.dumps([{'file': 'gaps/pr5/story.txt', 'chapter': 0, 'prs': [5]}]))
        self.assertEqual(editor.adopt(self.run, self.data, self.films, scenes, reviewed=reviewed), [])
        story = self.story()
        self.assertEqual([c['prs'][0] for c in story['chapters']], [1, 2, 3, 4, 6, 7, 8, 9, 10])  # not 11: never checked
        self.assertIn({'prs': [11], 'reason': language.TEXTS['pl']['spare']}, story['not_shown'])
        # without ``reviewed`` (the first adopt) the room the drop made takes the next scene, as before
        self.assertEqual(editor.adopt(self.run, self.data, self.films, scenes), [])
        self.assertEqual([c['prs'][0] for c in self.story()['chapters']][-1], 11)

    def test_a_proof_the_film_lacks_is_mended_before_the_last_sentence_is_pinned_where_the_others_show(self):
        scenes = self.scenes(1, proof='"F1 step 5"; "Not on any screen"', actions=(0, 1, 2))
        self.assertEqual(editor.adopt(self.run, self.data, self.films, scenes), [])
        chapter = self.story()['chapters'][0]
        self.assertEqual(chapter['proofs'], ['F1 step 5'])
        self.assertEqual([s['action'] for s in chapter['sentences'] if s['action'] is not None], [0, 1, 5])

    def test_the_line_after_the_tests_end_is_no_action(self):
        capture = json.loads((self.run / 'F1' / 'capture.json').read_text())
        self.assertEqual(editor.proof_actions(capture, ['Nothing here', 'F1 step 2']), {'F1 step 2': 2})
        story = {'chapters': [{'film': 'F1', 'proofs': ['Nothing here'], 'sentences': [{'text': 'a', 'action': 3}]}]}
        editor.mend_proofs(story, {'F1': str(self.run / 'F1')})  # its head is searched, no line is taken for an action
        self.assertEqual(story['chapters'][0]['proofs'], [])

    def test_a_narration_in_no_format_is_a_scene_not_narrated(self):
        scenes = self.scenes(2)
        scenes[1]['story'] = 'Otwieramy raport i zapisujemy zmiany.'  # no chapter line
        self.assertEqual(editor.adopt(self.run, self.data, self.films, scenes), [])
        story = self.story()
        self.assertEqual([c['prs'] for c in story['chapters']], [[1]])
        self.assertIn({'prs': [2], 'reason': language.TEXTS['pl']['unfilmed']}, story['not_shown'])
        self.assertEqual(editor.parse('Tylko zdania.')['chapters'], [])  # it raised a JSON error


class Cameras(unittest.TestCase):
    def camera_file(self, run, recipe, kind):
        with gaps.camera(run, recipe, kind) as handle:
            return Path(handle.name).name

    def test_tries_get_their_own_camera_only_with_the_set_kept_up_and_parallel_tests(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'checkout').mkdir()
            (run / 'checkout' / 'playwright.config.ts').write_text('export default { workers: 4 }')
            recipe = {'config': 'playwright.config.ts'}
            self.assertEqual(self.camera_file(run, recipe, 'try'), 'camera.lock')  # every run sets up shared state
            (run / 'keeper.json').write_text(json.dumps({'pid': 1}))
            self.assertEqual(self.camera_file(run, recipe, 'try'), 'camera-try.lock')
            self.assertEqual(self.camera_file(run, recipe, 'capture'), 'camera-capture.lock')
            self.assertEqual(self.camera_file(run, dict(recipe, workers=1), 'try'), 'camera.lock')  # one test at a time


class TimeLimits(unittest.TestCase):
    def scene(self, run, started):
        folder = run / 'gaps' / 'pr1'
        folder.mkdir(parents=True)
        (folder / 'gap.json').write_text(json.dumps({'id': 'pr1', 'prs': [1], 'base': 'e2e/a.spec.ts'}))
        (folder / 'scene.spec.ts').write_text('test("a", async () => {});')
        (folder / 'worker.json').write_text(json.dumps({'pid': 0, 'started': started}))
        return folder

    def test_a_worker_gets_no_new_try_once_its_time_is_up(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            self.scene(run, time.time() - gaps.SCENE_TRIES - 1)
            with mock.patch.object(gaps.harness, 'list_tests', side_effect=AssertionError('no try')):
                result = gaps.try_scene(run, {'config': 'playwright.config.ts'}, {}, 'pr1')
            self.assertFalse(result['ok'])
            self.assertIn('time for this scene is up', result['error'])

    def test_tries_stay_open_after_a_shared_camera_was_busy_with_the_capture(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            self.assertEqual(gaps.deadlines(run, 1000), (1000 + gaps.SCENE_TRIES, 1000 + gaps.SCENE_LIMIT))
            (run / 'camera.json').write_text(json.dumps({'free': 1300, 'serial': True}))  # the capture ended at +300 s
            tries, kill = gaps.deadlines(run, 1000)
            self.assertEqual(tries, max(1000 + gaps.SCENE_TRIES, 1300 + gaps.TRY_WINDOW))
            self.assertEqual(kill - tries, gaps.SCENE_LIMIT - gaps.SCENE_TRIES)
            (run / 'camera.json').write_text(json.dumps({'free': 1300, 'serial': False}))  # tries ran beside the capture
            self.assertEqual(gaps.deadlines(run, 1000)[0], 1000 + gaps.SCENE_TRIES)
            # servers that built for minutes: the tries count from when the set came up, whatever the camera
            (run / 'camera.json').write_text(json.dumps({'free': 1300, 'ready': 1300, 'serial': False}))
            self.assertEqual(gaps.deadlines(run, 1000)[0], max(1000 + gaps.SCENE_TRIES, 1300 + gaps.TRY_WINDOW))

    def test_runner_wait_preserves_repair_time_without_double_counting_startup_or_overlaps(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            core.save(run / 'camera.json', {'ready': 1300})
            core.save(run / 'gaps/pr1/waits.json', {
                'first': {'queued': 1200, 'finished': 1350},
                'overlap': {'queued': 1340, 'finished': 1360},
                'second': {'queued': 1400, 'finished': 1490}})
            with mock.patch.object(gaps.time, 'time', return_value=1500):
                self.assertEqual(gaps.runner_wait(run, 'pr1', 1000), 150)
                self.assertEqual(gaps.deadlines(run, 1000, 'pr1')[0], 1300 + gaps.TRY_WINDOW + 150)
                self.assertEqual(gaps.deadlines(run, 1000, 'pr2')[0], 1300 + gaps.TRY_WINDOW)

    def test_stuck_runner_wait_cannot_extend_a_worker_indefinitely(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            core.save(run / 'gaps/pr1/waits.json', {'stuck': {'queued': 1050}})
            with mock.patch.object(gaps.time, 'time', return_value=9000):
                self.assertEqual(gaps.runner_wait(run, 'pr1', 1000), gaps.CAMERA_CREDIT)
                self.assertEqual(gaps.deadlines(run, 1000, 'pr1')[1], 1000 + gaps.SCENE_LIMIT + gaps.CAMERA_CREDIT)

    def test_early_take_and_final_report_finish_the_same_wait_only_once(self):
        with tempfile.TemporaryDirectory() as folder:
            scene = Path(folder)
            core.save(scene / 'waits.json', {'pr1-try': {'queued': 100}})
            with mock.patch.object(gaps.time, 'time', return_value=160):
                gaps.settle_take(scene, {'ok': True, 'capture': 'same-take'}, 'pr1-try')
            with mock.patch.object(gaps.time, 'time', return_value=200):
                gaps.settle_take(scene, {'ok': True, 'capture': 'same-take'}, 'pr1-try')
            self.assertEqual(core.load(scene / 'waits.json')['pr1-try']['finished'], 160)

    def test_the_camera_does_not_wait_for_a_worker_that_has_ended(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'gaps.txt').write_text(gaps.render([
                {'id': 'pr1', 'prs': [1], 'title': 'a', 'proofs': [], 'base': 'e2e/a.spec.ts', 'show': 'a'},
                {'id': 'pr2', 'prs': [2], 'title': 'b', 'proofs': [], 'base': 'e2e/a.spec.ts', 'show': 'b'}]))
            self.scene(run, time.time())  # pr1: its worker (pid 0) has ended
            (run / 'queue').mkdir()
            (run / 'queue' / 'pr2.json').write_text(json.dumps({'id': 'pr2', 't': time.time()}))
            began = time.time()
            gaps.gather(run, window=20)
            self.assertLess(time.time() - began, 5)

    def test_a_worker_past_its_limit_is_killed_with_what_it_started(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            # named like a worker from the start (no re-exec: /proc/<pid>/cmdline is empty for a moment during one)
            process = subprocess.Popen(['claude-worker', '60'], executable=shutil.which('sleep'), start_new_session=True)
            try:
                folder = run / 'gaps' / 'pr1'
                folder.mkdir(parents=True)
                (folder / 'worker.json').write_text(json.dumps({'pid': process.pid, 'since': core.started_at(process.pid),
                                                                'started': time.time() - gaps.SCENE_LIMIT - gaps.TRY_GRACE - 60}))
                (run / 'queue').mkdir()
                (run / 'queue' / 'pr1.json').write_text('{}')
                self.assertTrue(gaps.alive(core.load(folder / 'worker.json')))
                stopped = []
                said = gaps.wait_for_workers(run, on_stopped=stopped.append)
                self.assertEqual(stopped, ['pr1'])  # its scene can be narrated at once
                self.assertIsNotNone(process.wait(timeout=5))
                self.assertFalse((run / 'queue' / 'pr1.json').exists())
                self.assertIn('pr1', said)
            finally:
                process.kill()

    def test_a_scene_narrated_again_is_checked_again_when_the_narration_settles(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            process = subprocess.Popen(['claude-worker', '4'], executable=shutil.which('sleep'), start_new_session=True)
            try:
                scene = run / 'gaps' / 'pr1'
                scene.mkdir(parents=True)
                (scene / 'worker.json').write_text(json.dumps({'pid': process.pid, 'since': core.started_at(process.pid),
                                                               'started': time.time()}))
                (scene / 'result.json').write_text(json.dumps({'ok': True, 'key': 'F1', 'since': time.time() - 10}))
                (scene / 'story.txt').write_text('# chapter F1 | 1 | Limit\n0 | Pierwsza wersja.\n')
                told = []

                def on_done(gap):
                    told.append(gap)
                    if len(told) == 1:  # the writer narrates again (a later take, or a rewrite)
                        story = scene / 'story.txt'
                        story.write_text('# chapter F1 | 1 | Limit\n0 | Druga wersja.\n')
                        os.utime(story, (time.time() + 1, time.time() + 1))
                with mock.patch.object(gaps, 'NARRATION_SETTLE', 0):
                    gaps.wait_for_workers(run, on_done=on_done)
                self.assertEqual(told, ['pr1', 'pr1'])  # checked again at once, not after the last scene
            finally:
                process.kill()

    def test_a_worker_whose_last_try_is_on_its_way_gets_its_take(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            process = subprocess.Popen(['claude-worker', '60'], executable=shutil.which('sleep'), start_new_session=True)
            try:
                scene = run / 'gaps' / 'pr1'
                scene.mkdir(parents=True)
                (scene / 'worker.json').write_text(json.dumps({'pid': process.pid, 'since': core.started_at(process.pid),
                                                               'started': time.time() - gaps.SCENE_LIMIT - 31}))
                (run / 'filming.json').write_text(json.dumps({'ids': ['pr1']}))  # its try is being filmed
                began = time.time()
                with open(run / 'operator.lock', 'a') as operator, mock.patch.object(gaps, 'TRY_GRACE', 4), \
                        mock.patch.object(gaps, 'SETTLE', 1):
                    fcntl.flock(operator, fcntl.LOCK_EX)  # by an operator that runs
                    gaps.wait_for_workers(run)
                self.assertGreater(time.time() - began, 2)  # not killed at its limit: the take was on its way
                self.assertIsNotNone(process.wait(timeout=5))  # then stopped once the grace was over
            finally:
                process.kill()

    def test_each_expired_worker_is_stopped_before_the_others_finish(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            processes = [subprocess.Popen(['sleep', '60'], start_new_session=True) for _ in range(2)]
            states = [{'pid': p.pid, 'since': core.started_at(p.pid), 'started': 100 * i}
                      for i, p in enumerate(processes)]
            for i, state in enumerate(states):
                core.save(run / 'gaps' / f'pr{i}' / 'worker.json', state)
            clock, stopped = [100], []

            def advance(_seconds):
                clock[0] += 20

            try:
                with mock.patch.object(gaps.time, 'time', side_effect=lambda: clock[0]), \
                        mock.patch.object(gaps.time, 'sleep', side_effect=advance), \
                        mock.patch.object(gaps, 'deadlines', side_effect=lambda _run, start, _gap=None: (start, start + 10)):
                    gaps.wait_for_workers(run, grace=0,
                                          on_stopped=lambda scene: stopped.append((scene, gaps.alive(states[1]))))
                self.assertEqual([s for s, _ in stopped], ['pr0', 'pr1'])
                self.assertTrue(stopped[0][1])  # fallback for pr0 can start while pr1 is still working
            finally:
                for process in processes:
                    process.kill()
                    process.wait()

    def test_cleanup_stops_owned_groups_and_leaves_unknown_identities(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            processes = [subprocess.Popen(['sleep', '60'], start_new_session=True) for _ in range(3)]
            worker, operator, unknown = processes
            core.save(run / 'gaps' / 'pr1' / 'worker.json', {'pid': worker.pid, 'since': core.started_at(worker.pid)})
            core.save(run / 'operator.json', {'pid': operator.pid, 'since': core.started_at(operator.pid)})
            core.save(run / 'gaps' / 'legacy' / 'worker.json', {'pid': unknown.pid})
            core.save(run / 'gaps' / 'stale' / 'worker.json', {'pid': unknown.pid, 'since': core.started_at(unknown.pid) - 1})
            try:
                self.assertEqual(gaps.stop_workers(run), {'workers': ['pr1'], 'operator': True})
                self.assertIsNotNone(worker.wait(timeout=5))
                self.assertIsNotNone(operator.wait(timeout=5))
                self.assertIsNone(unknown.poll())
            finally:
                for process in processes:
                    process.kill()
                    process.wait()

    def test_a_dead_operators_filming_file_holds_no_worker(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            process = subprocess.Popen(['claude-worker', '60'], executable=shutil.which('sleep'), start_new_session=True)
            try:
                scene = run / 'gaps' / 'pr1'
                scene.mkdir(parents=True)
                (scene / 'worker.json').write_text(json.dumps({'pid': process.pid, 'since': core.started_at(process.pid),
                                                               'started': time.time() - gaps.SCENE_LIMIT - 31}))
                (run / 'filming.json').write_text(json.dumps({'ids': ['pr1']}))  # left by an operator killed mid-batch
                began = time.time()
                with mock.patch.object(gaps, 'TRY_GRACE', 30), mock.patch.object(gaps, 'SETTLE', 1):
                    gaps.wait_for_workers(run)
                self.assertLess(time.time() - began, 10)
                self.assertIsNotNone(process.wait(timeout=5))
            finally:
                process.kill()

    def test_a_pid_given_to_another_process_is_not_the_worker(self):
        process = subprocess.Popen(['claude-worker', '60'], executable=shutil.which('sleep'), start_new_session=True)
        try:
            since = core.started_at(process.pid)
            self.assertTrue(gaps.alive({'pid': process.pid, 'since': since}))
            self.assertFalse(gaps.alive({'pid': process.pid, 'since': since - 1}))  # the pid, a later process
            self.assertFalse(gaps.alive({'pid': process.pid}))  # even a matching command name proves no ownership
            self.assertFalse(gaps.alive({'pid': 0}))
        finally:
            process.kill()
            process.wait()
        self.assertFalse(gaps.alive({'pid': process.pid, 'since': since}))

    def test_once_most_scenes_are_filmed_the_stragglers_stop(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            process = subprocess.Popen(['claude-worker', '60'], executable=shutil.which('sleep'), start_new_session=True)
            try:
                for index in range(5):
                    scene = run / 'gaps' / f'pr{index}'
                    scene.mkdir(parents=True)
                    straggler = index == 4
                    (scene / 'worker.json').write_text(json.dumps({'pid': process.pid if straggler else 0,
                                                                 'since': core.started_at(process.pid), 'started': time.time()}))
                    if not straggler:
                        (scene / 'result.json').write_text(json.dumps({'ok': True}))
                began = time.time()
                with mock.patch.object(gaps, 'QUORUM_WAIT', 0.5), mock.patch.object(gaps, 'QUORUM_MIN', 3):
                    gaps.wait_for_workers(run)
                self.assertLess(time.time() - began, 10)  # not the scene's 8-minute limit
                self.assertIsNotNone(process.wait(timeout=5))
            finally:
                process.kill()

    def test_six_of_eight_scenes_do_not_end_the_remaining_workers_early(self):
        with tempfile.TemporaryDirectory() as folder:
            run, clock = Path(folder), [100.0]
            for index in range(8):
                scene = run / 'gaps' / f'pr{index}'
                core.save(scene / 'worker.json', {'pid': index + 1 if index >= 6 else 0, 'started': 100})
                if index < 6:
                    core.save(scene / 'result.json', {'ok': True})

            def advance(_seconds):
                clock[0] += 1

            with mock.patch.object(gaps.time, 'time', side_effect=lambda: clock[0]), \
                    mock.patch.object(gaps.time, 'sleep', side_effect=advance), \
                    mock.patch.object(gaps, 'alive', side_effect=lambda worker: bool(worker.get('pid')) and clock[0] < 110), \
                    mock.patch.object(gaps, 'QUORUM_WAIT', 2), mock.patch.object(gaps, 'settle'), \
                    mock.patch.object(gaps.os, 'killpg') as kill:
                gaps.wait_for_workers(run, grace=0)
            kill.assert_not_called()
            self.assertEqual(clock[0], 110)  # both workers finished naturally; 75% is below the quality target

    def test_a_new_successful_take_gets_time_to_replace_stale_narration(self):
        with tempfile.TemporaryDirectory() as folder:
            run, clock = Path(folder), [101.0]
            scene = run / 'gaps' / 'pr1'
            core.save(scene / 'worker.json', {'pid': 1, 'started': 0})
            core.save(scene / 'result.json', {'ok': True, 'since': 100})
            (scene / 'story.txt').write_text('narration for the earlier take')
            os.utime(scene / 'story.txt', (50, 50))

            def advance(_seconds):
                clock[0] += 1

            with mock.patch.object(gaps.time, 'time', side_effect=lambda: clock[0]), \
                    mock.patch.object(gaps.time, 'sleep', side_effect=advance), \
                    mock.patch.object(gaps, 'alive', side_effect=lambda _worker: clock[0] < 110), \
                    mock.patch.object(gaps, 'deadlines', return_value=(90, 100)), \
                    mock.patch.object(gaps, 'settle'), mock.patch.object(gaps.os, 'killpg') as kill:
                gaps.wait_for_workers(run, grace=0)
            kill.assert_not_called()
            self.assertEqual(clock[0], 110)

    def test_a_failed_try_again_keeps_the_take_that_passed(self):
        with tempfile.TemporaryDirectory() as folder:
            scene = Path(folder)
            gaps.settle_take(scene, {'ok': True, 'key': 'F6', 'capture': 'g02/a'})
            gaps.settle_take(scene, {'ok': False, 'key': 'F6', 'error': 'timeout'})
            self.assertEqual(json.loads((scene / 'result.json').read_text())['capture'], 'g02/a')
            told = gaps.told(scene)
            self.assertFalse(told['ok'])
            self.assertIn('F6', told['kept'])
            first = json.loads((scene / 'result.json').read_text())['since']
            gaps.settle_take(scene, {'ok': True, 'key': 'F6', 'capture': 'g02/a'})  # the batch's end: the same take
            self.assertEqual(json.loads((scene / 'result.json').read_text())['since'], first)
            time.sleep(0.01)
            gaps.settle_take(scene, {'ok': True, 'key': 'F6', 'capture': 'g04/a'})  # a fixed try that passed replaces it
            self.assertEqual(json.loads((scene / 'result.json').read_text())['capture'], 'g04/a')
            self.assertGreater(json.loads((scene / 'result.json').read_text())['since'], first)  # a new take from now
            self.assertNotIn('kept', gaps.told(scene))
            (scene / 'tries').mkdir()
            (scene / 'tries' / 'pr1-9.spec.ts').write_text('test("as filmed", async () => {});')
            (scene / 'scene.spec.ts').write_text('test("edited after the take", async () => {});')
            gaps.settle_take(scene, {'ok': True, 'key': 'F6', 'capture': 'g05/a'}, 'pr1-9')
            self.assertIn('as filmed', (scene / 'scene.passed.spec.ts').read_text())  # the spec of the take kept

    def ready_scene(self, run):
        scene = self.scene(run, time.time())
        (run / 'checkout' / 'e2e').mkdir(parents=True)
        (run / 'checkout' / 'e2e' / 'a.spec.ts').write_text('')
        (run / 'checkout' / 'playwright.config.ts').write_text('export default { workers: 1 }')
        return scene


    def test_direct_pg_scene_is_rejected_before_playwright_or_queue(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            scene = self.ready_scene(run)
            # r25a pr2796's direct-client/query shape, without connection details.
            (scene / 'scene.spec.ts').write_text(
                'import { Client } from "pg";\nconst db = new Client({});\n'
                'await db.query(`UPDATE work_units SET decisions_legal_notes=$1 WHERE id=$2`, [html, projectId]);')
            with mock.patch.object(gaps.harness, 'list_tests') as listed, mock.patch.object(gaps.harness, 'keep_set') as keep:
                result = gaps.try_scene(run, {'config': 'playwright.config.ts'}, {}, 'pr1')
            self.assertFalse(result['ok'])
            self.assertIn("direct database client import 'pg' at line 1", result['error'])
            self.assertIn('existing test helpers/factories', result['error'])
            listed.assert_not_called()
            keep.assert_not_called()
            self.assertFalse((run / 'queue').exists())
            self.assertFalse((run / 'checkout' / 'e2e' / 'rf-pr1.spec.ts').exists())

    def test_imported_project_helper_scene_reaches_playwright(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            scene = self.ready_scene(run)
            (scene / 'scene.spec.ts').write_text(
                'import { createInvoice } from "../helpers/database";\n'
                'test("invoice", async () => { await createInvoice({amount: 120}); });')
            with mock.patch.object(gaps.harness, 'list_tests', return_value=[]) as listed, \
                    mock.patch.object(gaps.core, 'sh', return_value=subprocess.CompletedProcess([], 0, 'no tests', '')):
                result = gaps.try_scene(run, {'config': 'playwright.config.ts'}, {}, 'pr1')
            listed.assert_called_once()
            self.assertIn('scene does not load', result['error'])

    def test_a_fixed_role_name_gets_an_exact_match_and_the_scene_reaches_the_camera(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            scene = self.ready_scene(run)
            (scene / 'scene.spec.ts').write_text('await page.getByRole("button", {name: "Manage people"}).click();')
            with mock.patch.object(gaps.harness, 'list_tests', return_value=[]) as listed, \
                    mock.patch.object(gaps.core, 'sh', return_value=subprocess.CompletedProcess([], 0, 'no tests', '')):
                result = gaps.try_scene(run, {'config': 'playwright.config.ts'}, {}, 'pr1')
            listed.assert_called_once()
            self.assertEqual((scene / 'scene.spec.ts').read_text(),
                             'await page.getByRole("button", {name: "Manage people", exact: true}).click();')
            self.assertIn('line(s) 1 of scene.spec.ts', result['exact'])
            self.assertFalse((scene / 'preflight.jsonl').exists())

    def test_a_role_name_the_fix_cannot_place_is_reported_before_using_the_camera(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            scene = self.ready_scene(run)
            source = 'await page.getByRole("button", {name: "Manage people"}).click();'
            (scene / 'scene.spec.ts').write_text(source)
            with mock.patch.object(gaps.harness, 'list_tests') as listed, \
                    mock.patch.object(gaps.knowledge, 'exact_role_names', return_value=(source, [1])):
                result = gaps.try_scene(run, {'config': 'playwright.config.ts'}, {}, 'pr1')
            self.assertFalse(result['ok'])
            self.assertTrue(result['preflight'])
            self.assertNotIn('exact', result)
            listed.assert_not_called()
            self.assertFalse((run / 'queue').exists())
            self.assertEqual(json.loads((scene / 'preflight.jsonl').read_text())['kind'], 'locator')

    def test_a_try_goes_on_with_its_own_take_while_the_batch_runs(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            scene = self.ready_scene(run)
            gaps.settle_take(scene, {'ok': False, 'error': 'an earlier try'}, 'pr1-old')  # not this try's answer

            def operator(_run):  # films the queue: this scene's take arrives with its try's token
                request = json.loads((run / 'queue' / 'pr1.json').read_text())
                (run / 'queue' / 'pr1.json').unlink()
                gaps.settle_take(scene, {'ok': True, 'key': 'F1'}, request['token'])
            with mock.patch.object(gaps.harness, 'list_tests', return_value=[{'file': 'e2e/rf-pr1.spec.ts'}]), \
                    mock.patch.object(gaps.harness, 'keep_set'), mock.patch.object(gaps, 'start_operator', side_effect=operator):
                result = gaps.try_scene(run, {'config': 'playwright.config.ts'}, {}, 'pr1')
            self.assertEqual((result['ok'], result['key']), (True, 'F1'))
            self.assertFalse((run / 'checkout' / 'e2e' / 'rf-pr1.spec.ts').exists())  # its copy is gone

    def test_a_dropped_try_ends(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            self.ready_scene(run)
            drop = lambda _run: (run / 'queue' / 'pr1.json').unlink()  # its worker was stopped at its limit
            with mock.patch.object(gaps.harness, 'list_tests', return_value=[{'file': 'e2e/rf-pr1.spec.ts'}]), \
                    mock.patch.object(gaps.harness, 'keep_set'), mock.patch.object(gaps, 'start_operator', side_effect=drop):
                result = gaps.try_scene(run, {'config': 'playwright.config.ts'}, {}, 'pr1')
            self.assertEqual(result, {'ok': False, 'error': 'the try was dropped: try again'})
            waits = core.load(run / 'gaps/pr1/waits.json')
            self.assertTrue(all('finished' in wait for wait in waits.values()))

    def test_the_operator_hands_each_scene_its_take_as_its_test_ends(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'queue').mkdir()
            for gap_id in ('pr1', 'pr2'):
                (run / 'gaps' / gap_id).mkdir(parents=True)
                (run / 'queue' / f'{gap_id}.json').write_text(json.dumps(
                    {'id': gap_id, 'spec': f'e2e/rf-{gap_id}.spec.ts', 'prs': [1], 't': time.time(), 'token': f'{gap_id}-t'}))
            seen = []

            def capture(_run, _recipe, _env, targets, gaps=None, batch=None, on_film=None):
                films = [{'gap': gaps[spec]['id'], 'status': 'passed', 'capture': f'{batch}/{gaps[spec]["id"]}'} for spec, _ in targets]
                on_film(films[0])  # pr1 ends first: its writer hears before pr2's test is over
                seen.append(json.loads((run / 'gaps' / 'pr1' / 'try.json').read_text())['token'])
                seen.append((run / 'gaps' / 'pr2' / 'try.json').exists())
                return [dict(f, key=f'F{i}') for i, f in enumerate(films, 1)]
            outcome = lambda films, proofs=None: {'ok': bool(films), 'capture': films[0]['capture'] if films else None,
                                     'key': films[0].get('key') if films else None}
            with mock.patch.object(gaps.harness, 'keep_set'), mock.patch.object(gaps.harness, 'serial', return_value=False), \
                    mock.patch.object(gaps.harness, 'capture', side_effect=capture), mock.patch.object(gaps, 'outcome', side_effect=outcome), \
                    mock.patch.object(gaps, 'camera', return_value=open(run / 'camera.lock', 'a')), mock.patch.object(gaps, 'gather'):
                done = gaps.film_queue(run, {'config': 'playwright.config.ts'}, {})
            self.assertEqual(done, {'operator': 'done', 'batches': 1})
            self.assertEqual(seen, ['pr1-t', False])
            final = json.loads((run / 'gaps' / 'pr2' / 'try.json').read_text())
            self.assertEqual((final['token'], final['key']), ('pr2-t', 'F2'))
            self.assertFalse(gaps.operating(run))
            self.assertEqual(gaps.queued(run), [])

    def test_a_project_that_runs_one_test_at_a_time_films_each_try_on_its_own(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'queue').mkdir()
            for gap_id, asked in (('pr1', 20.0), ('pr2', 10.0)):  # pr2 asked first
                (run / 'gaps' / gap_id).mkdir(parents=True)
                (run / 'queue' / f'{gap_id}.json').write_text(json.dumps(
                    {'id': gap_id, 'spec': f'e2e/rf-{gap_id}.spec.ts', 'prs': [1], 't': asked, 'token': f'{gap_id}-t'}))
            runs = []

            def capture(_run, _recipe, _env, targets, gaps=None, batch=None, on_film=None):
                runs.append([gaps[spec]['id'] for spec, _ in targets])
                return [{'gap': gaps[spec]['id'], 'status': 'passed', 'capture': batch, 'key': 'F1'} for spec, _ in targets]
            with mock.patch.object(gaps.harness, 'keep_set'), mock.patch.object(gaps.harness, 'serial', return_value=True), \
                    mock.patch.object(gaps.harness, 'capture', side_effect=capture), \
                    mock.patch.object(gaps, 'outcome', side_effect=lambda films, proofs=None: {'ok': bool(films)}), \
                    mock.patch.object(gaps, 'camera', return_value=open(run / 'camera.lock', 'a')), \
                    mock.patch.object(gaps, 'gather', side_effect=AssertionError('nothing to gather')):
                done = gaps.film_queue(run, {'config': 'playwright.config.ts'}, {})
            self.assertEqual(done['batches'], 2)
            self.assertEqual(runs, [['pr2'], ['pr1']])  # one test per run, the first asked first

    def test_the_merge_waits_for_a_batch_still_being_filmed(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            self.assertTrue(gaps.settle(run, limit=1))  # no camera ever used
            lock = run / 'camera.lock'
            lock.write_text('')
            holder = subprocess.Popen([sys.executable, '-c', 'import fcntl, sys, time; h = open(sys.argv[1], "a"); '
                                       'fcntl.flock(h, fcntl.LOCK_EX); print("held", flush=True); time.sleep(float(sys.argv[2]))',
                                       str(lock), '2'], stdout=subprocess.PIPE, text=True)
            try:
                self.assertEqual(holder.stdout.readline().strip(), 'held')
                began = time.time()
                self.assertTrue(gaps.settle(run, limit=10))
                self.assertGreater(time.time() - began, 1)  # waited for the batch
                holder.wait(timeout=5)
            finally:
                holder.kill()
            holder = subprocess.Popen([sys.executable, '-c', 'import fcntl, sys, time; h = open(sys.argv[1], "a"); '
                                       'fcntl.flock(h, fcntl.LOCK_EX); print("held", flush=True); time.sleep(30)', str(lock)],
                                      stdout=subprocess.PIPE, text=True)
            try:
                self.assertEqual(holder.stdout.readline().strip(), 'held')
                self.assertFalse(gaps.settle(run, limit=1))  # at most the limit
            finally:
                holder.kill()


class WorkerEnvironment(unittest.TestCase):
    def test_the_clis_bash_sandbox_is_only_asked_for_on_request(self):
        # the CLI's subprocess scrub requires its Bash sandbox: without socat every worker failed
        with mock.patch.dict(os.environ, {'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB': '1', 'ANTHROPIC_API_KEY': 'x'}, clear=False):
            os.environ.pop('RELEASE_FILM_WORKER_SCRUB', None)
            env = gaps.worker_environ()
            self.assertEqual(env['CLAUDE_CODE_SUBPROCESS_ENV_SCRUB'], '0')  # off even where GitHub Actions turns it on
            self.assertNotIn('ANTHROPIC_API_KEY', env)  # the workers run on the Claude subscription
            self.assertEqual(gaps.scrub_missing(), [])
        with mock.patch.dict(os.environ, {'RELEASE_FILM_WORKER_SCRUB': '1'}), \
                mock.patch.object(gaps, 'SCRUB_TOOLS', ('socat', 'bwrap')):  # Linux's
            self.assertEqual(gaps.worker_environ()['CLAUDE_CODE_SUBPROCESS_ENV_SCRUB'], '1')
            with mock.patch.object(gaps.shutil, 'which', return_value=None):
                self.assertEqual(gaps.scrub_missing(), ['socat', 'bwrap'])
                with tempfile.TemporaryDirectory() as folder, \
                        mock.patch.object(gaps.llm, 'capabilities', return_value={'workers': True}), \
                        mock.patch.object(gaps.subprocess, 'Popen') as popen:
                    with self.assertRaisesRegex(SystemExit, 'socat, bwrap'):
                        gaps.launch_workers(folder, {'pr1': f'{folder}/gaps/pr1/brief.md'}, provider='cli')
                    popen.assert_not_called()  # no worker starts

    def test_a_worker_gets_the_seat_token_and_none_of_the_ci_credentials(self):
        ci = {'CLAUDE_CODE_OAUTH_TOKEN': 'seat', 'GH_TOKEN': 'gh', 'GITHUB_TOKEN': 'gh', 'ACTIONS_RUNTIME_TOKEN': 'rt',
              'ACTIONS_RESULTS_URL': 'https://results', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN': 'id'}
        with mock.patch.dict(os.environ, ci):
            env = gaps.worker_environ()
        self.assertEqual(env['CLAUDE_CODE_OAUTH_TOKEN'], 'seat')  # its CLI signs in with it
        self.assertFalse(set(env) & set(gaps.core.CI_SECRETS))

    def test_a_scrubbed_worker_on_macos_needs_no_linux_sandbox_tools(self):  # its Seatbelt is part of the system
        with mock.patch.object(sys, 'platform', 'darwin'):
            self.assertEqual(importlib.reload(gaps).SCRUB_TOOLS, ('sandbox-exec',))
        importlib.reload(gaps)


class Failures(unittest.TestCase):
    def test_a_failed_try_tells_the_page_it_failed_on(self):
        with tempfile.TemporaryDirectory() as folder:
            capture = Path(folder)
            (capture / 'aria-p1.txt').write_text('- banner:\n  - heading "Finance" [level=1]\n  - list:\n'
                                                 '    - listitem:\n      - text: Total 20 971,50 zł\n'
                                                 '  - heading "Finance" [level=1]\n')
            (capture / 'page-log.json').write_text(json.dumps({'pages': [{'page': 1, 'aria': 'aria-p1.txt'}]}))
            result = gaps.outcome([{'capture': str(capture), 'status': 'failed', 'key': 'F1',
                                    'error': '\x1b[2mexpect(\x1b[22mlocator).toBeVisible() failed'}])
            self.assertFalse(result['ok'])
            self.assertEqual(result['error'], 'expect(locator).toBeVisible() failed')
            self.assertEqual(result['page'].splitlines(), ['  - heading "Finance" [level=1]', '      - text: Total 20 971,50 zł'])

    def test_a_proof_shows_in_what_a_check_expected_or_what_it_received(self):
        self.assertEqual(gaps.expect_text({'expect': {'expected': ['Limit: 12h'], 'received': 'Saved'}}), 'limit: 12h saved')
        self.assertEqual(gaps.expect_text({'expect': {'expected': 'Total 5', 'received': None}}), 'total 5 ')
        self.assertEqual(gaps.expect_text({}), '')
        with tempfile.TemporaryDirectory() as folder:
            capture = Path(folder)
            (capture / 'capture.json').write_text(json.dumps({'steps': [
                {'step': 0, 'look': True, 'expect': {'expected': ['Status'], 'received': 'Approved by Anna'}}],
                'actions_text': []}))
            result = gaps.outcome([{'capture': str(capture), 'status': 'passed', 'key': 'F1'}], proofs=['Approved'])
        self.assertEqual(result['proof_actions'], [0])  # the received text counts although something was expected

    def test_a_try_answer_hints_at_its_error_pins_its_proofs_and_warns_of_empty_screens(self):
        with tempfile.TemporaryDirectory() as folder:
            capture = Path(folder)
            (capture / 'capture.json').write_text(json.dumps({'steps': [
                {'step': 0, 'look': False}, {'step': 1, 'look': True, 'expect': {'expected': ['Limit: 12h']}},
                {'step': 2, 'look': False, 'shows_empty': ['No courses yet']}], 'actions_text': []}))
            failed = gaps.outcome([{'capture': str(capture), 'status': 'failed', 'key': 'F1',
                                    'error': 'Error: strict mode violation: getByRole("button") resolved to 3 elements'}],
                                  proofs=['limit: 12h'])
            self.assertIn('narrow it', failed['hint'])
            self.assertEqual(failed['proof_actions'], [1])
            self.assertIn('ends on an empty state ("No courses yet")', failed['warning'])
            passed = gaps.outcome([{'capture': str(capture), 'status': 'passed', 'key': 'F1'}])
            self.assertNotIn('hint', passed)

    def test_a_screen_the_scene_only_passes_through_is_no_warning(self):
        with tempfile.TemporaryDirectory() as folder:
            capture = Path(folder)
            landing = ['We could not find any courses']
            (capture / 'capture.json').write_text(json.dumps({'steps': [
                {'step': 0, 'acting': True, 'shows_empty': landing},  # the login lands on an empty course list
                {'step': 1, 'look': True, 'shows_empty': landing},
                {'step': 2, 'navigate': True, 'shows_empty': ['No notifications yet']},  # the scene's own page
                {'step': 3, 'acting': True, 'shows_empty': []}], 'actions_text': []}))
            result = gaps.outcome([{'capture': str(capture), 'status': 'passed', 'key': 'F1'}])
            self.assertIn('after action 2 the screen shows an empty state', result['warning'])

    def test_a_worker_may_write_only_in_its_scene_and_run_only_the_camera(self):
        allowed = gaps.scene_allow('/runs/r1/gaps/pr1')
        self.assertIn('Write(//runs/r1/gaps/pr1/**)', allowed)
        self.assertIn('Edit(//runs/r1/gaps/pr1/**)', allowed)
        self.assertTrue(any(a.startswith('Bash(python3 ') and a.endswith('film.py try *)') for a in allowed))
        self.assertFalse(any(a in ('Write', 'Edit', 'Bash(python3 *)') or 'sed' in a or 'find' in a for a in allowed))
        self.assertNotIn('Bash(grep *)', allowed)  # a Bash grep would read what the Read rules keep private
        # nor any command that reads a file: `wc --files0-from=/proc/self/environ` prints the token in its errors
        self.assertEqual([a for a in allowed if a.startswith('Bash(') and 'film.py' not in a], ['Bash(ls *)'])
        self.assertIn('Read(//proc/**)', gaps.llm.PRIVATE)  # the environment, where a CI token lives

    def test_a_video_scene_gets_a_clip_the_test_browser_plays(self):
        if not gaps.core.tool('ffmpeg', home=False):
            self.skipTest('no ffmpeg')
        with tempfile.TemporaryDirectory() as folder:
            clip = gaps.sample_video(Path(folder))
            self.assertEqual(clip.suffix, '.webm')
            self.assertGreater(clip.stat().st_size, 10000)
            self.assertEqual(gaps.sample_video(Path(folder)), clip)  # made once
        self.assertTrue(gaps.VIDEO.search('Video progress bar and resume playback'))
        self.assertFalse(gaps.VIDEO.search('Budget notes with week-over-week change'))


class SceneCopies(unittest.TestCase):
    def test_a_scene_copy_is_named_like_its_base_so_the_projects_test_match_lists_it(self):
        self.assertEqual(gaps.test_suffix('allocation.spec.ts'), '.spec.ts')
        self.assertEqual(gaps.test_suffix('checkout.e2e.ts'), '.e2e.ts')
        self.assertEqual(gaps.test_suffix('checkout.e2e.spec.ts'), '.e2e.spec.ts')
        self.assertEqual(gaps.test_suffix('login.test.tsx'), '.test.ts')  # the scene stays TypeScript
        self.assertEqual(gaps.test_suffix('helpers.ts'), '.spec.ts')
        import knowledge
        tries = knowledge.scene_tries({'batches': {'g01': {'results': [
            {'file': 'e2e/demo--rf-pr12.e2e.ts', 'status': 'passed'}, {'file': 'e2e/demo--rf-pr13.spec.ts', 'status': 'failed'}]}}})
        self.assertEqual(sorted(tries), ['pr12', 'pr13'])


class WorkerLimit(unittest.TestCase):
    def test_the_workers_own_timeout_never_comes_before_its_latest_soft_deadline(self):
        with tempfile.TemporaryDirectory() as folder:
            run, started = Path(folder), 1_000_000.0
            # the film set came up as late as keep_set lets it: two starts of KEEPER_WAIT
            gaps.core.save(run / 'camera.json', {'ready': started + gaps.harness.KEEPER_STARTS * gaps.harness.KEEPER_WAIT})
            with mock.patch.object(gaps, 'runner_wait', return_value=gaps.CAMERA_CREDIT):
                killed = gaps.deadlines(run, started, 'pr1')[1]
        latest = killed + 30 + max(gaps.TRY_GRACE, gaps.NARRATE_GRACE)  # wait_for_workers' grace and a take's
        self.assertGreater(started + gaps.WORKER_LIMIT, latest)


if __name__ == '__main__':
    unittest.main()
