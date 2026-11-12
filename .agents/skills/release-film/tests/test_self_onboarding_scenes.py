"""Cached scenes retain real actions while known UI labels follow the locale."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from self_onboarding_scenes import localized_role_labels


class LocalizedRoleLabels(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.checkout = Path(self.temp.name)
        self.translations('en', {'reports': {'saved': {'title': 'Saved configurations'}},
                                 'one': 'Open', 'two': 'Open', 'dynamic': 'Hello {{name}}'})
        self.translations('pl', {'reports': {'saved': {'title': 'Zapisane konfiguracje'}},
                                 'one': 'Otwórz', 'two': 'Otwarte', 'dynamic': 'Witaj {{name}}'})

    def translations(self, code, values):
        file = self.checkout / f'apps/web/app/locales/{code}/translation.json'
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps(values), encoding='utf-8')

    def test_regex_and_string_labels_follow_ui_without_changing_actions(self):
        source = '''await page.getByRole('button', { name: /Saved configurations/i }).click();
await page.getByRole("button", {name: /^Saved configurations$/}).click();
await page.getByRole('button', { name: 'Saved configurations', exact: true }).click();'''
        actual = localized_role_labels(source, self.checkout, 'pl')
        self.assertIn('new RegExp("Zapisane konfiguracje", "i")', actual)
        self.assertIn('new RegExp("^Zapisane konfiguracje$", "")', actual)
        self.assertIn('name: "Zapisane konfiguracje", exact: true', actual)
        self.assertEqual(actual.count('.click()'), 3)
        self.assertEqual(localized_role_labels(actual, self.checkout, 'pl'), actual)
        self.assertEqual(localized_role_labels(source, self.checkout, 'en'), source)

    def test_comments_data_fuzzy_unknown_and_ambiguous_labels_are_untouched(self):
        source = '''// page.getByRole('button', { name: /Saved configurations/ }).click();
/* page.getByRole('button', { name: 'Saved configurations' }); */
const data = "page.getByRole('button', { name: /Saved configurations/ })";
await page.getByRole('button', { name: /Saved.*/ }).click();
await page.getByRole('button', { name: /Saved configurations|Other/ }).click();
await page.getByRole('button', { name: /Open/ }).click();
await page.getByRole('button', { name: 'Unknown', exact: true }).click();
await page.getByRole('button', { name: recordingText('reports.saved.title') }).click();'''
        self.assertEqual(localized_role_labels(source, self.checkout, 'pl'), source)

    def test_regex_metacharacters_in_translated_label_are_escaped(self):
        self.translations('pl', {'reports': {'saved': {'title': 'Zapisane (moje) [1] + ?'}}})
        actual = localized_role_labels("page.getByRole('button', {name: /Saved configurations/})", self.checkout, 'pl')
        pattern = actual.split('new RegExp(', 1)[1].split(', "")', 1)[0]
        self.assertEqual(json.loads(pattern), r'Zapisane \(moje\) \[1\] \+ \?')

    def test_missing_locale_does_not_invent_labels(self):
        source = "page.getByRole('button', {name: /Saved configurations/})"
        self.assertEqual(localized_role_labels(source, self.checkout, 'de'), source)


if __name__ == '__main__':
    unittest.main()
