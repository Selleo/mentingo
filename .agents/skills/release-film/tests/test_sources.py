"""What a release's pull requests changed: texts a user reads, from the added lines of their diffs."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import json
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import sources  # noqa: E402


class UiTexts(unittest.TestCase):
    def test_texts_from_markup_toasts_and_translations(self):
        added = {
            'frontend/src/Settings.tsx': ['      <Toggle aria-label="Idle income protection" />', '        Preserve full income',
                                          '  const total = items.reduce((a, b) => a + b, 0);', '  toast.error("Could not update")'],
            'frontend/src/Settings.test.tsx': ['  expect(screen.getByText("Test only")).toBeVisible();'],
            'web/src/locales/pl.json': ['  "idle": "Ochrona dochodu",'],
            'app/services/export.rb': ['  "Payroll::ExportStatementToDocx",']}
        texts = sources.ui_strings(added)
        self.assertIn('Idle income protection', texts)
        self.assertIn('Preserve full income', texts)
        self.assertIn('Could not update', texts)
        self.assertIn('Ochrona dochodu', texts)
        self.assertFalse([t for t in texts if 'Test only' in t or 'Payroll' in t or 'reduce' in t])

    def test_english_translations_win(self):
        added = {'app/locales/cs/translation.json': ['  "a": "Přizpůsobit dashboard",'],
                 'app/locales/en/translation.json': ['  "a": "Customize dashboard",'],
                 'app/locales/pl/translation.json': ['  "a": "Dostosuj pulpit",']}
        self.assertEqual(sources.ui_strings(added), ['Customize dashboard'])
        self.assertEqual([sources.locale(p) for p in added], ['cs', 'en', 'pl'])

    def test_code_is_not_text(self):
        for line in ('type DatePickerProps', 'addDays', 'initialData?.dates ?? []', 'return null;'):
            self.assertFalse(sources.looks_like_text(line), line)
        for line in ('Stats', 'Preserve full income while this person is idle.'):
            self.assertTrue(sources.looks_like_text(line), line)



class ReleaseNotes(unittest.TestCase):
    def test_the_release_title_and_notes_without_links_and_markup(self):
        body = '## Highlights\n\n* **Live Trainings** - calendar <table><tr><td>https://x.io/a.mp4</td></tr></table>\n\n![shot](i.png)'
        answer = mock.Mock(stdout=json.dumps({'name': 'v2 - Live Training', 'body': body}))
        with mock.patch.object(sources.core, 'sh', return_value=answer):
            notes = sources.release_notes('o/r', 'v2')
        self.assertEqual(notes['name'], 'v2 - Live Training')
        self.assertIn('Highlights', notes['body'])
        self.assertIn('Live Trainings - calendar', notes['body'])
        self.assertNotIn('http', notes['body'])
        self.assertNotIn('<', notes['body'])
        with mock.patch.object(sources.core, 'sh', return_value=mock.Mock(stdout='')):
            self.assertIsNone(sources.release_notes('o/r', 'v2'))  # no published release


class PullRequests(unittest.TestCase):
    def test_a_subjects_issue_number_is_no_pull_request_and_a_passing_failure_is_tried_again(self):
        facts = json.dumps({'number': 7, 'title': 'feat: x', 'body': '', 'labels': [], 'url': 'u', 'files': [],
                            'author': {'login': 'a'}, 'mergedAt': None})
        issue = subprocess.CompletedProcess([], 1, '', 'GraphQL: Could not resolve to a PullRequest with the number of 5.')
        with mock.patch.object(sources.core, 'sh', return_value=issue), mock.patch.object(sources.time, 'sleep') as slept:
            self.assertIsNone(sources.pull('o/r', 5))
        slept.assert_not_called()
        flaky = [subprocess.CompletedProcess([], 1, '', 'HTTP 502: Bad Gateway'), subprocess.CompletedProcess([], 0, facts, '')]
        with mock.patch.object(sources.core, 'sh', side_effect=flaky), mock.patch.object(sources.time, 'sleep'):
            self.assertEqual(sources.pull('o/r', 7)['number'], 7)
        down = subprocess.CompletedProcess([], 1, '', 'error connecting to api.github.com')
        with mock.patch.object(sources.core, 'sh', return_value=down), mock.patch.object(sources.time, 'sleep'), \
                self.assertRaisesRegex(RuntimeError, 'error connecting'):
            sources.pull('o/r', 7)

    def test_a_commit_naming_an_issue_is_a_direct_commit(self):
        rows = [{'sha': 'a' * 40, 'subject': 'feat: x (#7)', 'pr': 7}, {'sha': 'b' * 40, 'subject': 'fix typo (#5)', 'pr': 5}]
        facts = {'number': 7, 'title': 'feat: x', 'url': 'u', 'body': '', 'labels': [], 'author': 'a', 'merged_at': None,
                 'issues': [], 'files': []}
        with mock.patch.object(sources, 'commits', return_value=rows), \
                mock.patch.object(sources, 'pull', side_effect=lambda slug, n: dict(facts) if n == 7 else None), \
                mock.patch.object(sources, 'added_lines', return_value={}), \
                mock.patch.object(sources, 'release_notes', return_value=None):
            data = sources.collect('o/r', '/repo', 'v1', 'v2')
        self.assertEqual([pr['number'] for pr in data['prs']], [7])
        self.assertEqual([c['subject'] for c in data['direct_commits']], ['fix typo (#5)'])


class AddedLines(unittest.TestCase):
    def test_a_users_diff_prefix_settings_do_not_hide_the_added_lines(self):
        if not shutil.which('git'):
            self.skipTest('git makes the repository')
        with tempfile.TemporaryDirectory() as folder:
            git = lambda *args: subprocess.run(['git', '-C', folder, *args], check=True, capture_output=True)
            git('init', '-q')
            git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'first')
            (Path(folder) / 'page.tsx').write_text('<button aria-label="Save draft" />\n')
            git('add', 'page.tsx')
            git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'second')
            settings = {'GIT_CONFIG_COUNT': '2', 'GIT_CONFIG_KEY_0': 'diff.noprefix', 'GIT_CONFIG_VALUE_0': 'true',
                        'GIT_CONFIG_KEY_1': 'diff.dstPrefix', 'GIT_CONFIG_VALUE_1': 'new/'}
            with mock.patch.dict(os.environ, settings):
                added = sources.added_lines(folder, 'HEAD', ['page.tsx'])
        self.assertEqual(added, {'page.tsx': ['<button aria-label="Save draft" />']})


if __name__ == '__main__':
    unittest.main()
