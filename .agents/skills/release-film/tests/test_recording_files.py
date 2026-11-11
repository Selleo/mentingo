"""Recording scaffolding preserves the tag's test fixture and stays inside the owned checkout."""
import json
import shutil
import subprocess
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import core
import harness


class RecordingFiles(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node is required to evaluate the recording config')
    def test_recording_api_reuses_playwright_browser_and_preserves_explicit_overrides(self):
        source = (core.SKILL / 'projects/mentingo-recording/playwright.config.ts').read_text()
        source = source.replace('import { chromium, defineConfig } from "@playwright/test";', '')
        source = source.replace('import base from "./playwright.config";', '')
        source = source.replace('export default defineConfig(', 'globalThis.result = defineConfig(')
        script = '''const vm = require('node:vm');
const source = JSON.parse(process.argv[1]);
const results = [undefined, '/custom/chrome'].map(inherited => {
  const context = {
    base: {webServer: [
      {command: 'pnpm db:seed-e2e && pnpm dev', env: {KEEP: 'yes'}},
      {command: 'pnpm dev', env: {PUPPETEER_EXECUTABLE_PATH: '/server/chrome'}}
    ]},
    process: {env: {PUPPETEER_EXECUTABLE_PATH: inherited}},
    chromium: {executablePath: () => '/playwright/chromium'}, defineConfig: value => value
  };
  vm.runInNewContext(source, context);
  return context.result;
});
console.log(JSON.stringify(results));'''
        result = subprocess.run(['node', '-e', script, json.dumps(source)], check=True, capture_output=True, text=True)
        default, inherited = json.loads(result.stdout)
        self.assertEqual(default['webServer'][0]['env'], {'KEEP': 'yes', 'PUPPETEER_EXECUTABLE_PATH': '/playwright/chromium'})
        self.assertEqual(inherited['webServer'][0]['env']['PUPPETEER_EXECUTABLE_PATH'], '/custom/chrome')
        self.assertEqual(inherited['webServer'][1]['env']['PUPPETEER_EXECUTABLE_PATH'], '/server/chrome')
        self.assertIn('pnpm db:seed &&', default['webServer'][0]['command'])

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.run = Path(self.temp.name)
        self.root = self.run / 'checkout'
        self.root.mkdir()
        self.recipe = json.loads((core.SKILL / 'projects/selleo__mentingo.json').read_text())['harness']
        self.fixture = self.root / 'apps/web/e2e/fixtures/test.fixture.ts'
        self.fixture.parent.mkdir(parents=True)
        self.fixture.write_text('original release fixture')

    def test_only_recording_scaffolding_is_added_and_original_fixture_survives_repeated_setup(self):
        product = self.root / 'apps/web/app.ts'
        product.write_text('release product code')
        harness.recording_files(self.run, self.recipe)
        harness.recording_files(self.run, self.recipe)
        self.assertEqual((self.fixture.parent / 'release-film.base.fixture.ts').read_text(), 'original release fixture')
        self.assertIn('RECORDING_ACCOUNTS', self.fixture.read_text())
        self.assertEqual(product.read_text(), 'release product code')
        self.assertTrue(harness.one_off(self.root / self.recipe['config']))
        self.assertEqual(harness.test_roots(self.root, self.recipe), ['apps/web/e2e/specs'])

    def test_generated_config_does_not_overwrite_or_import_itself(self):
        harness.recording_files(self.run, self.recipe)
        original = self.root / self.recipe['config']
        before = original.read_bytes()
        generated = harness.demo_config(original)
        self.assertNotEqual(original, generated)
        self.assertEqual(original.read_bytes(), before)
        self.assertIn('import base from "./playwright.recording.config";', generated.read_text())
        with self.assertRaisesRegex(ValueError, 'different filename'):
            harness.demo_config(generated)
        self.assertIn('import base from "./playwright.recording.config";', generated.read_text())

    def test_manual_fixture_changes_are_not_silently_overwritten(self):
        harness.recording_files(self.run, self.recipe)
        self.fixture.write_text('user edit')
        with self.assertRaisesRegex(ValueError, 'changed after preparation'):
            harness.recording_files(self.run, self.recipe)
        self.assertEqual(self.fixture.read_text(), 'user edit')

    def test_source_target_and_backup_paths_cannot_escape_their_roots(self):
        entry = self.recipe['recording_files'][-1]
        for changed in [{'source': '../outside'}, {'target': '../outside'}, {'preserve_as': '../outside'}]:
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                harness.recording_files(self.run, {'recording_files': [entry | changed]})

    def test_scaffolding_is_applied_before_installation_and_services(self):
        with mock.patch.object(harness, 'toolchain', side_effect=RuntimeError('stop before installing')):
            with self.assertRaisesRegex(RuntimeError, 'stop before installing'):
                harness.setup(self.run, self.recipe)
        self.assertIn('RECORDING_ACCOUNTS', self.fixture.read_text())


if __name__ == '__main__':
    unittest.main()
