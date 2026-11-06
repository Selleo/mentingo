"""Older release tags get only reviewed demo fixtures; application behavior stays on the tag."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import core
import harness
import self_onboarding_recording as recording


class DemoScaffold(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.run = Path(self.temp.name)
        self.checkout = self.run/'checkout'
        self.seed_hashes = {}
        for name in recording.LEGACY_DEMO_SEEDS:
            path = self.checkout/name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('legacy seed\n')
            self.seed_hashes[name] = (recording.digest(path), recording.digest(core.REPO/name))
        index = self.checkout/'packages/shared/src/index.ts'
        index.parent.mkdir(parents=True, exist_ok=True)
        index.write_text('export const existing = true;\n')

    def test_reviewed_legacy_seed_has_localized_fixtures_and_cover_before_setup(self):
        with patch.object(recording, 'LEGACY_DEMO_SEEDS', self.seed_hashes):
            recording.prepare_demo_checkout(self.checkout, core.REPO)
            recording.prepare_demo_checkout(self.checkout, core.REPO)
        for name in [*recording.DEMO_SCAFFOLD, *recording.LEGACY_DEMO_SEEDS]:
            self.assertEqual((self.checkout/name).read_bytes(), (core.REPO/name).read_bytes())
        index = (self.checkout/'packages/shared/src/index.ts').read_text()
        self.assertIn('existing = true', index)
        self.assertEqual(index.count('constants/self-onboarding-demo'), 1)

    def test_unknown_legacy_seed_fails_before_writing_scaffolding(self):
        first = next(iter(self.seed_hashes))
        (self.checkout/first).write_text('unreviewed seed version')
        with patch.object(recording, 'LEGACY_DEMO_SEEDS', self.seed_hashes):
            with self.assertRaisesRegex(ValueError, 'reviewed demo-seed'):
                recording.prepare_demo_checkout(self.checkout, core.REPO)
        self.assertFalse((self.checkout/'apps/web/e2e/data/self-onboarding/cover.svg').exists())

    def test_native_seed_is_not_replaced_and_tutorial_auth_uses_named_people(self):
        for name in recording.LEGACY_DEMO_SEEDS:
            (self.checkout/name).write_text('native SELF_ONBOARDING_DEMO seed')
        recording.prepare_demo_checkout(self.checkout, core.REPO)
        for name in recording.LEGACY_DEMO_SEEDS:
            self.assertEqual((self.checkout/name).read_text(), 'native SELF_ONBOARDING_DEMO seed')
        harness.recording_files(self.run, {'env': {'SELF_ONBOARDING_DEMO': '1'}})
        accounts = self.checkout/'apps/web/e2e/fixtures/release-film.accounts.ts'
        self.assertIn('getSelfOnboardingDemoEmail', accounts.read_text())
        accounts.unlink()
        harness.recording_files(self.run, {'env': {}})
        self.assertFalse(accounts.exists())

    def test_source_checkout_cannot_be_modified(self):
        with self.assertRaisesRegex(ValueError, 'isolated'):
            recording.prepare_demo_checkout(core.REPO, core.REPO)


if __name__ == '__main__':
    unittest.main()
