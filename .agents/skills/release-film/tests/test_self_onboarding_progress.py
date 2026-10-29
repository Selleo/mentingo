"""Failed batches retain inspectable media without leaking their private execution state."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import self_onboarding_progress as progress


class ProgressTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.run, self.cache, self.out = (self.root/name for name in ('run', 'cache', 'out'))
        self.run.mkdir(); self.cache.mkdir()

    def write(self, root, name, content):
        path = root/name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content.encode() if isinstance(content, str) else content)
        return path

    def collect(self):
        return progress.collect(self.run, self.cache, self.out)

    def test_failed_batch_keeps_completed_clips_raw_progress_and_failure_screens(self):
        self.write(self.cache, 'segments/paths/en/create/abc/demo.mp4', b'finished narrated clip')
        self.write(self.cache, 'captures/paths/create/abc/take.mp4', b'raw screen footage')
        self.write(self.cache, 'bundles/batch/paths/en/timeline.json', '{"durationMs":1000,"chapters":[]}')
        self.write(self.run, 'captures/g01/interrupted/frames/0001.jpg', b'partial capture frame')
        self.write(self.run, 'voice/paths/pl/create/c1/audio.mp3', b'completed Polish narration')
        self.write(self.run, 'checkout/apps/web/test-results/setup-auth/test-failed-1.png', b'login failure screenshot')
        self.write(self.run, 'checkout/apps/web/test-results/setup-auth/error-context.md', '# Page\nUnknown tenant')
        self.write(self.run, 'keeper.log', 'Login setup failed')
        result = self.collect()
        self.assertEqual(result['files'], 7)
        manifest = json.loads((self.out/'progress.json').read_text())
        self.assertFalse(manifest['complete']); self.assertFalse(manifest['publishable'])
        self.assertEqual((self.out/'cache/segments/paths/en/create/abc/demo.mp4').read_bytes(), b'finished narrated clip')
        self.assertEqual((self.out/'run/captures/g01/interrupted/frames/0001.jpg').read_bytes(), b'partial capture frame')
        self.assertIn('Login setup failed', (self.out/'startup-diagnostics.json').read_text())
        self.assertIn('not a publishable guide', (self.out/'README.txt').read_text())

    def test_incomplete_timeline_does_not_discard_an_already_produced_clip(self):
        self.write(self.cache, 'bundles/batch/paths/en/video.mp4', b'completed video before later failure')
        self.write(self.cache, 'bundles/batch/paths/en/timeline.json', '{"chapters":')
        result = self.collect()
        self.assertEqual(result['files'], 1)
        manifest = json.loads((self.out/'progress.json').read_text())
        self.assertEqual(manifest['skipped'][0]['reason'], 'Incomplete timeline JSON')
        self.assertEqual((self.out/'cache/bundles/batch/paths/en/video.mp4').read_bytes(), b'completed video before later failure')

    def test_duplicate_capture_views_share_one_exported_media_file_and_keep_aliases(self):
        self.write(self.cache, 'captures/paths/create/abc/take.mp4', b'same large capture')
        self.write(self.run, 'localized/paths/en/create/abc/take.mp4', b'same large capture')
        self.write(self.run, 'localized/paths/pl/create/abc/take.mp4', b'same large capture')
        with patch.object(Path, 'read_bytes', side_effect=AssertionError('Media must not load into memory')):
            result = self.collect()
        manifest = json.loads((self.out/'progress.json').read_text())
        self.assertEqual(result['files'], 1); self.assertEqual(result['sourceFiles'], 3)
        self.assertEqual(len(manifest['files'][0]['sources']), 3)
        self.assertEqual(len(list(self.out.rglob('*.mp4'))), 1)

    def test_only_review_allowlist_is_exported_and_all_known_secrets_are_scrubbed(self):
        generated = 'generated-fixture-secret'
        provider = 'private-provider-token'
        self.write(self.run, 'secrets.json', json.dumps({'MASTER_KEY': generated}))
        self.write(self.cache, 'segments/create/captions-en.srt', '1\n' + generated + '\n' + provider)
        self.write(self.cache, 'bundles/batch/timeline.json', json.dumps({'title': generated + provider}))
        self.write(self.run, 'keeper.log', generated + provider)
        for root, path in [(self.cache, 'state.json'), (self.cache, 'bundles/batch/manifest.json'),
                           (self.cache, 'captures/create/capture.json'), (self.run, '.env'),
                           (self.run, 'gaps/create/worker.log'), (self.run, 'checkout/source.png'),
                           (self.run, 'captures/create/fixtures/private.png'),
                           (self.run, 'checkout/apps/web/test-results/auth/storage-state.json'),
                           (self.run, 'checkout/apps/web/test-results/auth/trace.zip')]:
            self.write(root, path, 'private execution state')
        with patch.dict(os.environ, {'ELEVENLABS_API_KEY': provider}):
            self.collect()
        for path in self.out.rglob('*'):
            if path.is_file():
                text = path.read_text()
                self.assertNotIn(generated, text); self.assertNotIn(provider, text)
                self.assertNotIn('private execution state', text)
        self.assertEqual((self.cache/'state.json').read_text(), 'private execution state')
        self.assertIn(generated, (self.run/'keeper.log').read_text())

    def test_symlink_files_and_directories_cannot_export_outside_the_run(self):
        outside = self.root/'private'
        self.write(outside, 'private.png', b'outside screenshot')
        (self.run/'captures').mkdir()
        (self.run/'captures/linked.png').symlink_to(outside/'private.png')
        (self.run/'captures/linked-folder').symlink_to(outside, target_is_directory=True)
        results = self.run/'checkout/apps/web/test-results'
        results.parent.mkdir(parents=True)
        results.symlink_to(outside, target_is_directory=True)
        self.assertEqual(self.collect()['files'], 0)
        self.assertFalse(list(self.out.rglob('*.png')))

    def test_output_cannot_overwrite_or_recurse_into_private_inputs(self):
        for output in (self.run, self.run/'progress', self.cache/'progress', self.root):
            with self.subTest(output=output), self.assertRaisesRegex(ValueError, 'separate'):
                progress.collect(self.run, self.cache, output)
        self.out.mkdir(); (self.out/'keep.txt').write_text('Keep this earlier export')
        with self.assertRaisesRegex(ValueError, 'empty'):
            self.collect()
        self.assertEqual((self.out/'keep.txt').read_text(), 'Keep this earlier export')

    def test_startup_failure_still_produces_inspectable_manifest_when_no_video_exists(self):
        self.write(self.run, 'keeper.log', 'The login page never appeared')
        result = self.collect()
        self.assertEqual(result['files'], 0)
        self.assertTrue((self.out/'README.txt').is_file())
        self.assertIn('login page never appeared', (self.out/'startup-diagnostics.json').read_text())


if __name__ == '__main__':
    unittest.main()
