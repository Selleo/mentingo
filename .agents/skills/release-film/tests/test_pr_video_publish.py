"""Native PR attachment publication uses synthetic bundles and mocked GitHub only."""
import copy
import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True
CI = Path(__file__).resolve().parents[1] / 'ci'
sys.path.insert(0, str(CI))

import pr_video_publish as publisher
import release_assets

REPOSITORY = 'Selleo/mentingo'
NUMBER = 2468
HEAD_SHA = 'a' * 40
BASE_SHA = 'b' * 40
RUN_ID = '123456789'
ATTACHMENT = 'https://github.com/user-attachments/assets/01234567-abcd-4abc-8abc-0123456789ab'
OLD_ATTACHMENT = 'https://github.com/user-attachments/assets/abcdefab-1234-4abc-8abc-0123456789ab'
MP4 = bytes.fromhex('000000186674797069736f6d0000020069736f6d69736f32') + b'\0\0\0\x10mdatfixture!'


def pull(body='Existing description\n'):
    return {'number': NUMBER, 'state': 'open', 'draft': False, 'body': body,
            'head': {'sha': HEAD_SHA, 'repo': {'full_name': REPOSITORY}}}


class Publish(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.folder = Path(temporary.name)
        self.video = self.folder / 'video.mp4'
        self.video.write_bytes(MP4)
        self.manifest_path = self.folder / 'pr-video.json'
        self.manifest = {
            'schemaVersion': 1, 'repository': REPOSITORY, 'number': NUMBER,
            'headSha': HEAD_SHA, 'baseSha': BASE_SHA, 'workflowRunId': RUN_ID,
            'video': {'path': 'video.mp4', 'sha256': hashlib.sha256(MP4).hexdigest(), 'sizeBytes': len(MP4)},
            'flows': [{'id': 'edit-course', 'title': 'Edit a course',
                       'goal': 'Private planning notes never become Markdown',
                       'evidence': [{'path': 'private/path', 'quote': 'private code'}]}],
        }
        self.write_manifest()
        self.current = pull()
        self.reads = 0
        self.uploads = []
        self.patches = []
        self.calls = []
        self.after_upload = None
        self.github = mock.patch.object(release_assets, 'gh', side_effect=self.fake_gh).start()
        self.addCleanup(mock.patch.stopall)

    def write_manifest(self):
        self.manifest_path.write_text(json.dumps(self.manifest), encoding='utf-8')

    def publish(self):
        return publisher.publish(self.folder, REPOSITORY, NUMBER, HEAD_SHA, RUN_ID)

    def fake_gh(self, *arguments, input_text=None):
        self.calls.append(arguments)
        if arguments == ('api', f'repos/{REPOSITORY}/pulls/{NUMBER}'):
            self.reads += 1
            return json.dumps(self.current)
        if arguments == ('api', f'repos/{REPOSITORY}'):
            return json.dumps({'id': 42})
        if len(arguments) > 1 and arguments[1].startswith('https://uploads.github.com/user-attachments/assets?'):
            self.assertIn('--method', arguments)
            self.assertIn('repository_id=42', arguments[1])
            path = Path(arguments[arguments.index('--input') + 1])
            self.assertNotEqual(path, self.video)
            self.assertEqual(path.name, 'video.mp4')
            self.assertEqual(path.read_bytes(), MP4)
            self.uploads.append(path)
            if self.after_upload:
                self.after_upload()
            return json.dumps({'url': ATTACHMENT})
        if arguments == ('api', '--method', 'PATCH', f'repos/{REPOSITORY}/pulls/{NUMBER}', '--input', '-'):
            payload = json.loads(input_text)
            self.assertEqual(set(payload), {'body'})
            self.patches.append(payload['body'])
            self.current['body'] = payload['body']
            return json.dumps(self.current)
        raise AssertionError(f'Unexpected mocked GitHub call: {arguments}')

    def old_section(self):
        bundle = publisher.Bundle(self.video, 'c' * 64, (publisher.Flow('previous', 'Earlier flow'),))
        return publisher.video_section('d' * 40, bundle, OLD_ATTACHMENT)

    def test_native_upload_is_appended_after_all_original_user_text(self):
        original = '  # Human description\n\n- untouched checklist\n\n'
        self.current['body'] = original
        self.assertEqual(self.publish()['status'], 'published')
        body = self.current['body']
        self.assertTrue(body.startswith(original))
        self.assertTrue(body.endswith(publisher.MARK_END))
        self.assertIn(f'Recorded at `{HEAD_SHA[:12]}`.', body)
        self.assertIn(f'\n\n{ATTACHMENT}\n', body)
        self.assertIn(f'<!-- release-film-video sha256={self.manifest["video"]["sha256"]} url={ATTACHMENT} -->', body)
        self.assertNotIn('Private planning', body)
        self.assertNotIn('private code', body)
        self.assertEqual((self.reads, len(self.uploads), len(self.patches)), (2, 1, 1))
        self.assertFalse(self.uploads[0].exists(), 'private snapshot is cleaned up')
        self.assertFalse(any('/releases' in ' '.join(call) or '/pages' in ' '.join(call) for call in self.calls))

    def test_rerun_reuses_the_managed_checksum_attachment_and_does_not_patch_again(self):
        self.publish()
        first_body = self.current['body']
        self.assertEqual(self.publish()['status'], 'unchanged')
        self.assertEqual(self.current['body'], first_body)
        self.assertEqual((self.reads, len(self.uploads), len(self.patches)), (4, 1, 1))

    def test_existing_section_moves_to_end_without_stripping_outside_characters(self):
        before, after = ' \nHuman opening\n', '\n\nHuman closing  \n'
        self.current['body'] = before + self.old_section() + after
        self.publish()
        self.assertTrue(self.current['body'].startswith(before + after))
        self.assertEqual(self.current['body'].count(publisher.MARK_START), 1)
        self.assertNotIn(OLD_ATTACHMENT, self.current['body'])
        self.assertTrue(self.current['body'].endswith(publisher.MARK_END))

    def test_latest_body_is_reread_after_upload_preserving_concurrent_user_edits(self):
        self.current['body'] = 'Initial user text\n' + self.old_section()
        def edit_body():
            self.current['body'] = 'Concurrent human edit\n' + self.old_section() + '\nNew conclusion'
        self.after_upload = edit_body
        self.publish()
        self.assertTrue(self.current['body'].startswith('Concurrent human edit\n\nNew conclusion'))
        self.assertNotIn('Initial user text', self.current['body'])

    def test_validated_snapshot_is_what_gets_uploaded_if_original_artifact_changes(self):
        original_fake = self.fake_gh
        def changing_artifact(*arguments, input_text=None):
            if arguments == ('api', f'repos/{REPOSITORY}/pulls/{NUMBER}') and self.reads == 0:
                self.video.write_bytes(b'changed after validation')
            return original_fake(*arguments, input_text=input_text)
        self.github.side_effect = changing_artifact
        self.assertEqual(self.publish()['status'], 'published')

    def test_ineligible_initial_prs_are_skipped_without_upload_or_patch(self):
        variants = [('closed', {'state': 'closed'}), ('draft', {'draft': True}),
                    ('fork', {'head': {'sha': HEAD_SHA, 'repo': {'full_name': 'someone/fork'}}}),
                    ('fork', {'head': {'sha': HEAD_SHA, 'repo': None}}),
                    ('stale', {'head': {'sha': 'e' * 40, 'repo': {'full_name': REPOSITORY}}})]
        for reason, changes in variants:
            with self.subTest(reason=reason, changes=changes):
                self.current = {**pull(), **changes}
                self.assertEqual(self.publish(), {'repository': REPOSITORY, 'number': NUMBER,
                                                 'headSha': HEAD_SHA, 'status': 'skipped', 'reason': reason})
        self.assertFalse(self.uploads)
        self.assertFalse(self.patches)

    def test_rechecks_stale_closed_draft_and_fork_state_after_the_upload(self):
        for reason, changes in [('closed', {'state': 'closed'}), ('draft', {'draft': True}),
                                ('fork', {'head': {'sha': HEAD_SHA, 'repo': {'full_name': 'someone/fork'}}}),
                                ('stale', {'head': {'sha': 'e' * 40, 'repo': {'full_name': REPOSITORY}}})]:
            with self.subTest(reason=reason):
                self.current = pull()
                self.after_upload = lambda changes=changes: self.current.update(changes)
                self.assertEqual(self.publish()['reason'], reason)
        self.assertEqual(len(self.uploads), 4)
        self.assertFalse(self.patches)

    def test_merge_base_is_validated_without_comparing_it_to_the_moving_base_branch(self):
        self.current['base'] = {'sha': 'f' * 40}
        self.assertEqual(self.publish()['status'], 'published')

    def test_failure_to_upload_preserves_the_existing_section_and_redacts_provider_diagnostics(self):
        original = 'User text\n' + self.old_section()
        self.current['body'] = original
        with (
            mock.patch.object(release_assets, 'upload_video', side_effect=SystemExit('::error::private-token-provider-body')),
            self.assertRaises(publisher.PublicationError) as failure,
        ):
            self.publish()
        self.assertNotIn('private-token', str(failure.exception))
        self.assertEqual(self.current['body'], original)
        self.assertFalse(self.patches)

    def test_untrusted_attachment_return_is_never_inserted(self):
        with (
            mock.patch.object(release_assets, 'upload_video', return_value='https://untrusted.invalid/video'),
            self.assertRaisesRegex(publisher.PublicationError, 'native video attachment'),
        ):
            self.publish()
        self.assertFalse(self.patches)

    def test_user_authored_reuse_marker_outside_managed_section_does_not_control_upload(self):
        checksum = self.manifest['video']['sha256']
        user_text = f'<!-- release-film-video sha256={checksum} url={OLD_ATTACHMENT} -->'
        self.current['body'] = user_text
        self.publish()
        self.assertEqual(len(self.uploads), 1)
        self.assertTrue(self.current['body'].startswith(user_text))

    def test_model_titles_render_only_as_literal_text_and_other_model_fields_never_render(self):
        self.manifest['flows'][0]['title'] = '[Link](https://evil.invalid) <script> & @person `code` ![image](bad)'
        self.write_manifest()
        self.publish()
        body = self.current['body']
        for forbidden in ('https://evil.invalid', '<script>', '@person', '`code`', '![image]', 'private/path'):
            self.assertNotIn(forbidden, body)
        self.assertIn('&#91;Link&#93;', body)

    def test_incorrect_bundle_identity_and_shapes_fail_before_any_github_call(self):
        originals = copy.deepcopy(self.manifest)
        changes = [('repository', 'another/repository'), ('number', NUMBER + 1), ('number', True),
                   ('headSha', 'e' * 40), ('workflowRunId', 'another-run'), ('workflowRunId', int(RUN_ID)),
                   ('schemaVersion', True), ('schemaVersion', 2), ('baseSha', 'short'),
                   ('flows', []), ('flows', [{'id': 'bad id', 'title': 'Title'}]),
                   ('flows', [{'id': 'valid', 'title': 'bad\ntitle'}]),
                   ('flows', [{'id': 'valid', 'title': 'x' * 201}]),
                   ('flows', [{'id': 'same', 'title': 'One'}, {'id': 'same', 'title': 'Two'}])]
        for field, value in changes:
            with self.subTest(field=field, value=value):
                self.manifest = {**copy.deepcopy(originals), field: value}
                self.write_manifest()
                with self.assertRaises(publisher.PublicationError):
                    self.publish()
        self.github.assert_not_called()

    def test_arbitrary_paths_wrong_sizes_and_digests_are_refused_before_github(self):
        original = copy.deepcopy(self.manifest['video'])
        changes = [('path', '../video.mp4'), ('path', '/tmp/video.mp4'), ('path', 'https://evil.invalid/video.mp4'),
                   ('sizeBytes', True), ('sizeBytes', len(MP4) + 1), ('sizeBytes', publisher.MAX_VIDEO_BYTES + 1),
                   ('sha256', 'f' * 64), ('sha256', 'bad-checksum')]
        for field, value in changes:
            with self.subTest(field=field, value=value):
                self.manifest['video'] = {**original, field: value}
                self.write_manifest()
                with self.assertRaises(publisher.PublicationError):
                    self.publish()
        self.github.assert_not_called()

    def test_symlinked_video_manifest_bundle_and_hardlinks_are_refused(self):
        for filename in ('video.mp4', 'pr-video.json'):
            with self.subTest(filename=filename):
                path = self.folder / filename
                original = path.read_bytes()
                target = self.folder / f'original-{filename}'
                path.rename(target)
                path.symlink_to(target)
                with self.assertRaises(publisher.PublicationError):
                    self.publish()
                path.unlink()
                path.write_bytes(original)
        alias = self.folder / 'bundle-link'
        alias.symlink_to(self.folder, target_is_directory=True)
        with self.assertRaises(publisher.PublicationError):
            publisher.publish(alias, REPOSITORY, NUMBER, HEAD_SHA, RUN_ID)
        hardlink = self.folder / 'hardlink.mp4'
        hardlink.hardlink_to(self.video)
        with self.assertRaises(publisher.PublicationError):
            self.publish()
        self.github.assert_not_called()

    def test_non_mp4_oversized_or_empty_files_are_refused_without_reading_large_payloads(self):
        for payload in (b'', b'not an mp4 header but a file'):
            self.video.write_bytes(payload)
            self.manifest['video'].update(sizeBytes=len(payload), sha256=hashlib.sha256(payload).hexdigest())
            self.write_manifest()
            with self.assertRaises(publisher.PublicationError):
                self.publish()
        with self.video.open('wb') as stream:
            stream.truncate(publisher.MAX_VIDEO_BYTES + 1)
        self.manifest['video'].update(sizeBytes=len(MP4), sha256=hashlib.sha256(MP4).hexdigest())
        self.write_manifest()
        with self.assertRaises(publisher.PublicationError):
            self.publish()
        self.github.assert_not_called()

    def test_manifest_must_be_small_unique_strict_json_without_extra_root_fields(self):
        for raw in ('{"schemaVersion":1,"schemaVersion":1}', '[1]', '{broken',
                    json.dumps(self.manifest)[:-1] + ',"unexpected":null}',
                    json.dumps(self.manifest).replace('"schemaVersion": 1', '"schemaVersion": NaN'),
                    ' ' * (publisher.MAX_MANIFEST_BYTES + 1)):
            with self.subTest(prefix=raw[:30]):
                self.manifest_path.write_text(raw)
                with self.assertRaises(publisher.PublicationError):
                    self.publish()
        self.github.assert_not_called()

    def test_invalid_job_identity_is_refused_before_reading_or_calling_github(self):
        for repository, number, head_sha, run_id in [('bad/repo/path', NUMBER, HEAD_SHA, RUN_ID),
                                                   (REPOSITORY, True, HEAD_SHA, RUN_ID),
                                                   (REPOSITORY, NUMBER, 'short', RUN_ID),
                                                   (REPOSITORY, NUMBER, HEAD_SHA, 'not-numeric')]:
            with self.assertRaises(publisher.PublicationError):
                publisher.publish(self.folder, repository, number, head_sha, run_id)
        self.github.assert_not_called()

    def test_ambiguous_managed_sections_fail_without_uploading_or_rewriting(self):
        for body in (publisher.MARK_START, publisher.MARK_END, publisher.MARK_END + publisher.MARK_START,
                     self.old_section() + self.old_section()):
            self.current = pull(body)
            with self.assertRaises(publisher.PublicationError):
                self.publish()
            self.assertEqual(self.current['body'], body)
        self.assertFalse(self.uploads)
        self.assertFalse(self.patches)

    def test_invalid_latest_markers_or_exhausted_body_capacity_do_not_patch(self):
        for body in (publisher.MARK_START, 'x' * publisher.MAX_BODY_CHARS):
            self.current = pull()
            self.after_upload = lambda body=body: self.current.update(body=body)
            with self.assertRaises(publisher.PublicationError):
                self.publish()
        self.assertFalse(self.patches)

    def test_malformed_or_mismatched_pr_responses_are_not_trusted(self):
        for changes in ({'number': NUMBER + 1}, {'number': True}, {'draft': 'false'},
                        {'head': {'sha': 'short'}}, {'body': []}, {'state': 'unknown'}):
            self.current = {**pull(), **changes}
            with self.assertRaises(publisher.PublicationError):
                self.publish()
        self.assertFalse(self.uploads)
        self.assertFalse(self.patches)

    def test_github_errors_are_redacted_and_do_not_produce_success(self):
        self.github.side_effect = SystemExit('::error::gh private-token body')
        with self.assertRaises(publisher.PublicationError) as failure:
            self.publish()
        self.assertNotIn('private-token', str(failure.exception))
        self.assertFalse(self.patches)

    def test_cli_returns_json_or_a_safe_failure(self):
        arguments = ['pr_video_publish.py', '--bundle', str(self.folder), '--repository', REPOSITORY,
                     '--number', str(NUMBER), '--head-sha', HEAD_SHA, '--run-id', RUN_ID]
        with mock.patch.object(sys, 'argv', arguments), mock.patch('sys.stdout', new_callable=io.StringIO) as output:
            publisher.main()
            self.assertEqual(json.loads(output.getvalue())['status'], 'published')
        with (
            mock.patch.object(sys, 'argv', arguments),
            mock.patch.object(publisher, 'publish', side_effect=publisher.PublicationError('Safe failure')),
            self.assertRaisesRegex(SystemExit, '::error::Safe failure'),
        ):
            publisher.main()


if __name__ == '__main__':
    unittest.main()
