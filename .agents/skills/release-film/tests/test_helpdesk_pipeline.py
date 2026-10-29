"""Helpdesk assembly, checkpoint recovery and workflow boundaries without providers."""
import copy
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
import core
import cut
import gaps
import helpdesk
import helpdesk_catalog
import helpdesk_recording as recording
import helpdesk_store as store
import render_demo

try:
    import yaml
except ImportError:
    yaml = None


class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.cache = self.root / 'cache'
        self.catalog = helpdesk_catalog.load_catalog(SKILL / 'projects' / 'mentingo-helpdesk.json')
        self.domain = copy.deepcopy(self.catalog['domains'][0])
        self.commit = 'a' * 40

    def state_flow(self, flow, segment=None):
        return {'contract': flow, 'commit': self.commit, 'voiceProfile': 'profile',
                'segment': segment or {'path': 'segments/x/demo.mp4', 'sha256': 'b' * 64}}

    def test_diagnostics_do_not_change_video_identity_but_media_does(self):
        flows = {f['id']: self.state_flow(f) for f in self.domain['flows']}
        before = helpdesk.domain_identity(self.domain, flows)
        changed = copy.deepcopy(self.domain)
        changed['coverage'] = {'decision': 'complete', 'reason': 'Refactor did not change the flow'}
        changed['flows'][0].update(action='reuse', reason='New implementation', evidence=[{'path': 'x'}])
        self.assertEqual(before, helpdesk.domain_identity(changed, flows))
        flows[self.domain['flows'][0]['id']]['segment']['sha256'] = 'c' * 64
        self.assertNotEqual(before, helpdesk.domain_identity(changed, flows))

    def test_incomplete_plan_cannot_enter_recorder(self):
        plan = self.root / 'plan.json'
        core.save(plan, {'schemaVersion': 1, 'reports': [{'ok': False, 'domains': [], 'commit': self.commit}]})
        with patch.object(helpdesk.harness, 'setup') as setup:
            with self.assertRaisesRegex(ValueError, 'unresolved'):
                helpdesk.generate(SimpleNamespace(plan=str(plan)))
            setup.assert_not_called()

    def test_missing_flow_is_rejected_before_environment_setup(self):
        domain = copy.deepcopy(self.domain)
        domain['coverage'] = {'decision': 'complete'}
        domain['flows'] = [dict(f, action='record') for f in domain['flows'][:-1]]
        plan = self.root / 'plan.json'
        core.save(plan, {'schemaVersion': 1, 'reports': [{'ok': True, 'domains': [domain], 'commit': self.commit, 'language': 'en'}]})
        with self.assertRaisesRegex(ValueError, 'omits'):
            helpdesk.generate(SimpleNamespace(plan=str(plan)))

    def test_pending_bundle_restores_without_recording_and_checks_version(self):
        domain = copy.deepcopy(self.domain)
        domain['coverage'] = {'decision': 'complete'}
        domain['flows'] = [dict(f, action='reuse') for f in domain['flows']]
        plan = self.root / 'plan.json'
        core.save(plan, {'schemaVersion': 1, 'reports': [{'ok': True, 'domains': [domain],
            'commit': self.commit, 'version': '1.2.0', 'language': 'en'}]})
        core.save(self.cache/'state.json', {'schemaVersion': 1, 'languages': {}, 'pendingBundle': 'bundles/test',
                                          'pendingSelection': [['en', self.domain['key']]]})
        manifest = self.cache/'bundles/test/manifest.json'
        core.save(manifest, {'commit': self.commit, 'version': '1.2.0', 'domains': [1]})
        args = SimpleNamespace(plan=str(plan), run=str(self.root/'run'), cache=str(self.cache), out=str(self.cache/'bundles/new'))
        with patch.object(helpdesk.recording, 'record_flow') as record:
            self.assertTrue(helpdesk.generate(args)['resumed'])
            record.assert_not_called()
        core.save(manifest, {'commit': self.commit, 'version': '1.1.0', 'domains': [1]})
        with self.assertRaisesRegex(ValueError, 'earlier publication'):
            helpdesk.generate(args)

    def test_tutorial_brief_has_explicit_language_and_complete_flow_rules(self):
        brief = 'intro\n## Where to start\nFilm setup\n## Narration\nold\nThe format (of 1, list only the pull requests):\n# chapter K | 1 | title\nIf you learned stuff'
        result = recording.tutorial_brief(brief, self.domain['flows'][0], 'Business specification', 'pl')
        self.assertIn('Polish', result)
        self.assertIn('Every prerequisite', result)
        self.assertNotIn('list only the pull requests', result)
        self.assertIn('Business specification', result)

    def test_exact_business_spec_selects_its_complete_feature_video(self):
        selected = helpdesk.select_spec_domains(self.catalog, 'docs/specs/learning-paths-business-spec.md')
        self.assertEqual(selected, ['development-paths.guide'])
        self.assertEqual(len(self.catalog['domains'][0]['flows']), 19)
        with self.assertRaisesRegex(ValueError, 'exact'):
            helpdesk.select_spec_domains(self.catalog, 'docs/specs/../../secrets.md')
        with self.assertRaisesRegex(ValueError, 'no registered'):
            helpdesk.select_spec_domains(self.catalog, 'docs/specs/nonexistent-business-spec.md')
        with self.assertRaisesRegex(ValueError, 'no registered'):
            helpdesk.select_spec_domains(self.catalog, 'docs/specs/learning-paths-business-spec.md', ['course-authoring'])

    def test_production_cannot_select_an_untagged_ref(self):
        args = SimpleNamespace(cache=str(self.cache), catalog=str(SKILL/'projects/mentingo-helpdesk.json'),
                               target_ref='HEAD', test_mode=False)
        with self.assertRaisesRegex(ValueError, 'isolated test mode'):
            helpdesk.analyze(args)

    def test_unchanged_run_skips_capture_assembly_and_publication_but_dirty_domain_recovers(self):
        import hashlib
        domain = copy.deepcopy(self.domain)
        domain['flows'] = domain['flows'][:2]
        registry = {'domains': [copy.deepcopy(domain)]}
        profile = hashlib.sha256(json.dumps({'provider': {}, 'pronunciation': {}, 'renderer': 'tutorial-v1'}, sort_keys=True).encode()).hexdigest()
        states = {}
        for flow in domain['flows']:
            video = self.cache/'segments'/flow['id']/'demo.mp4'
            video.parent.mkdir(parents=True)
            video.write_bytes(b'unchanged')
            segment = {'path': str(video.relative_to(self.cache)), 'sha256': recording.digest(video)}
            states[flow['id']] = dict(self.state_flow(flow, segment), voiceProfile=profile)
        identity = helpdesk.domain_identity(domain, states)
        saved = {'commit': self.commit, 'identity': identity, 'flows': states, 'needsPublication': False}
        state = {'schemaVersion': 1, 'languages': {'en': {'domains': {domain['key']: saved}}}}
        core.save(self.cache/'state.json', state)
        domain['coverage'] = {'decision': 'complete', 'reason': 'Internal refactor'}
        domain['flows'] = [dict(f, action='reuse', reason='No visible change', evidence=[]) for f in domain['flows']]
        plan = self.root/'plan.json'
        core.save(plan, {'schemaVersion': 1, 'reports': [{'ok': True, 'domains': [domain],
            'commit': self.commit, 'version': '1.2.0', 'language': 'en'}]})
        args = SimpleNamespace(plan=str(plan), run=str(self.root/'run'), cache=str(self.cache),
            out=str(self.cache/'bundles/new'), repository='Selleo/mentingo', repo=str(self.root), workflow_run_id='123')
        with patch.object(helpdesk_catalog, 'load_catalog', return_value=registry), \
             patch.object(helpdesk.core, 'addon', return_value={}), \
             patch.object(helpdesk.voice_provider, 'elevenlabs_config', return_value={}), \
             patch.object(helpdesk.recording, 'record_flow') as record, \
             patch.object(helpdesk.recording, 'assemble') as assemble:
            self.assertEqual(helpdesk.generate(args)['videos'], 0)
            record.assert_not_called()
            assemble.assert_not_called()
            self.assertNotIn('pendingBundle', core.load(self.cache/'state.json'))
            # An earlier complete domain must still publish after a later domain
            # failed before the whole bundle was finished.
            checkpoint = core.load(self.cache/'state.json')
            checkpoint['languages']['en']['domains'][domain['key']]['needsPublication'] = True
            core.save(self.cache/'state.json', checkpoint)
            assemble.return_value = {'key': domain['key'], 'language': 'en',
                'video': str(self.cache/'bundles/new/video.mp4')}
            self.assertEqual(helpdesk.generate(args)['videos'], 1)
            record.assert_not_called()
            assemble.assert_called_once()
            self.assertEqual(core.load(self.cache/'state.json')['pendingBundle'], 'bundles/new')

    def test_scene_workers_receive_no_voice_storage_or_publisher_credentials(self):
        names = ['ELEVENLABS_API_KEY', 'GUIDE_PUBLISH_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
        with patch.dict(os.environ, {name: 'private-value' for name in names}):
            environment = gaps.worker_environ()
        for name in names:
            self.assertNotIn(name, environment)

    def test_flow_waiting_ignores_earlier_workers_and_their_release_quorum(self):
        run = self.root/'run'
        for scene in ('previous-flow', 'current-flow'):
            core.save(run/'gaps'/scene/'worker.json', {'started': 0})
        with patch.object(gaps, 'alive', return_value=False), patch.object(gaps, 'settle'), \
             patch.object(core, 'worker_result', return_value={'result': 'ok capture'}):
            result = gaps.wait_for_workers(run, only={'current-flow'})
        self.assertEqual(set(result), {'current-flow'})

    def test_archive_rejects_traversal_and_links(self):
        for name, kind in [('../escape.json', tarfile.REGTYPE), ('segments/link.json', tarfile.SYMTYPE)]:
            archive = self.root/'bad.tar'
            with tarfile.open(archive, 'w') as output:
                member = tarfile.TarInfo(name)
                member.type = kind
                member.size = 2 if kind == tarfile.REGTYPE else 0
                output.addfile(member, io.BytesIO(b'{}') if member.size else None)
            with self.assertRaisesRegex(ValueError, 'Invalid'):
                store.extract(archive, self.root/'restored')

    def test_snapshot_preserves_only_current_segments_and_pending_bundle(self):
        current = self.cache/'segments/current/demo.mp4'
        current.parent.mkdir(parents=True)
        current.write_bytes(b'current')
        old = self.cache/'segments/old/demo.mp4'
        old.parent.mkdir(parents=True)
        old.write_bytes(b'old')
        pending = self.cache/'bundles/pending/manifest.json'
        core.save(pending, {})
        core.save(self.cache/'state.json', {'schemaVersion': 1,
            'languages': {'en': {'domains': {'guide': {'flows': {'create': {'segment': {'path': 'segments/current/demo.mp4'}}}}}}},
            'pendingBundle': 'bundles/pending'})
        files = store.snapshot_files(self.cache)
        self.assertIn(current, files)
        self.assertIn(pending, files)
        self.assertNotIn(old, files)
        archive = self.root/'good.tar'
        with tarfile.open(archive, 'w') as output:
            for path in files:
                output.add(path, arcname=str(path.relative_to(self.cache)))
        store.extract(archive, self.root/'restored')
        self.assertEqual((self.root/'restored/segments/current/demo.mp4').read_bytes(), b'current')

    def test_storage_auth_failure_cannot_look_like_empty_catalog(self):
        with patch.object(store.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stderr='AccessDenied', stdout='')):
            with self.assertRaisesRegex(RuntimeError, 'storage'):
                store.pull('s3://bucket/helpdesk', self.cache)
        self.assertFalse((self.cache/'state.json').exists())

    @unittest.skipUnless(shutil.which('ffmpeg'), 'FFmpeg required')
    def test_real_assembly_keeps_ids_and_recalculates_offsets_without_rerecording(self):
        domain = copy.deepcopy(self.domain)
        domain['flows'] = domain['flows'][:2]
        states = {}
        render_demo.FFPROBE = core.tool('ffprobe') or 'ffprobe'
        for index, flow in enumerate(domain['flows'], 1):
            folder = self.cache/'segments'/flow['id']
            folder.mkdir(parents=True)
            video = folder/'demo.mp4'
            subprocess.run([core.tool('ffmpeg'), '-v', 'error', '-f', 'lavfi', '-i', f'color=c=blue:s=160x90:r=30:d={index}',
                '-f', 'lavfi', '-i', f'sine=frequency=440:duration={index}', '-c:v', 'libx264', '-threads', '1',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', str(video)], check=True, capture_output=True)
            captions = folder/'captions-en.srt'
            captions.write_text('1\n00:00:00,100 --> 00:00:00,500\nA result\n\n')
            segment = {'path': str(video.relative_to(self.cache)), 'sha256': recording.digest(video),
                'captions': str(captions.relative_to(self.cache)), 'captionsSha256': recording.digest(captions),
                'title': flow['title'], 'transcript': 'A real result in this synthetic renderer fixture.'}
            states[flow['id']] = self.state_flow(flow, segment)
        with patch.object(recording, 'record_flow') as camera:
            result = recording.assemble(domain, 'en', states, self.cache, self.root/'out', self.commit, '1.2.0', '123')
            camera.assert_not_called()
        chapters = result['metadata']['chapters']
        self.assertEqual([c['id'] for c in chapters], [f['id'] for f in domain['flows']])
        self.assertEqual(chapters[0]['startMs'], 0)
        self.assertAlmostEqual(chapters[1]['startMs'], 1000, delta=50)
        self.assertLessEqual(chapters[-1]['endMs'], result['metadata']['expectedDurationMs'])
        self.assertTrue((self.root/'out/captions-en.vtt').is_file())
        self.assertEqual(result['sha256'], recording.digest(self.root/'out/video.mp4'))


@unittest.skipUnless(yaml, 'PyYAML required')
class WorkflowsTest(unittest.TestCase):
    def load(self, filename):
        value = yaml.safe_load((SKILL.parents[2]/'.github/workflows'/filename).read_text())
        value['on'] = value.get('on') or value.pop(True, None)
        return value

    def test_versions_not_releases_queue_the_trusted_workflow(self):
        trigger = self.load('helpdesk-videos-on-version.yml')
        self.assertIn('push', trigger['on'])
        self.assertNotIn('release', trigger['on'])
        step = trigger['jobs']['queue']['steps'][0]
        self.assertIn('--ref "$DEFAULT_BRANCH"', step['run'])
        self.assertIn('-f domains=', step['run'])
        self.assertEqual(trigger['jobs']['queue']['permissions'], {'actions': 'write'})

    def test_keys_have_separate_scopes_and_state_is_never_public_artifact(self):
        workflow = self.load('helpdesk-videos.yml')
        generation = workflow['jobs']['generate']
        publication = workflow['jobs']['publish']
        self.assertFalse(workflow['concurrency']['cancel-in-progress'])
        self.assertNotIn('pull_request', workflow['on'])
        for job in (generation, publication):
            for step in job['steps']:
                env = step.get('env', {})
                if 'GUIDE_PUBLISH_API_KEY' in env:
                    self.assertIs(job, publication)
                    self.assertNotIn('ELEVENLABS_API_KEY', env)
                if 'ELEVENLABS_API_KEY' in env:
                    self.assertIs(job, generation)
                    self.assertNotIn('AWS_SECRET_ACCESS_KEY', env)
                if 'actions/upload-artifact' in step.get('uses', ''):
                    self.assertIs(job, generation)
                    self.assertIn('inputs.test_mode', step['if'])
                    self.assertIn('steps.redact.outcome', step['if'])
                    self.assertNotIn('state.json', step['with']['path'])
        self.assertIn('default_branch', generation['if'])

    def test_registered_release_workflow_can_dispatch_a_premerge_spec_test(self):
        entry = self.load('release-film.yml')
        test = entry['jobs']['helpdesk_test']
        self.assertEqual(test['uses'], './.github/workflows/helpdesk-videos.yml')
        self.assertTrue(test['with']['test_mode'])
        self.assertFalse(test['with']['publish'])
        self.assertIn('helpdesk_spec', test['if'])
        self.assertIn('helpdesk_spec', entry['jobs']['film']['if'])
        workflow = self.load('helpdesk-videos.yml')
        self.assertIn('workflow_call', workflow['on'])
        self.assertIn('inputs.test_mode', workflow['jobs']['generate']['if'])
        self.assertIn('!inputs.test_mode', workflow['jobs']['publish']['if'])
        steps = {step.get('id', step.get('name')): step for step in workflow['jobs']['generate']['steps']}
        self.assertIn('!inputs.test_mode', steps['restore']['if'])
        save = steps['Checkpoint private segments even after an interrupted later flow']
        self.assertIn('!inputs.test_mode', save['if'])


if __name__ == '__main__':
    unittest.main()
