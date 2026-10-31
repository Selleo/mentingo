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
import self_onboarding
import self_onboarding_catalog
import self_onboarding_diagnostics as diagnostics
import self_onboarding_recording as recording
import self_onboarding_store as store
import self_onboarding_voices as narrators
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
        self.catalog = self_onboarding_catalog.load_catalog(SKILL / 'projects' / 'mentingo-self-onboarding.json')
        self.domain = copy.deepcopy(self.catalog['domains'][0])
        self.commit = 'a' * 40

    def state_flow(self, flow, segment=None):
        return {'contract': flow, 'commit': self.commit, 'voiceProfile': 'profile',
                'segment': segment or {'path': 'segments/x/demo.mp4', 'sha256': 'b' * 64}}

    def test_startup_diagnostics_include_page_errors_without_fixture_secrets_or_sessions(self):
        run = self.root/'run'
        core.save(run/'secrets.json', {'MASTER_KEY': 'generated-private-master-key'})
        (run/'keeper.log').write_text('x'*20_000 + '\x1b[31mUnknown tenant: https://localhost:5173\x1b[0m\ngenerated-private-master-key')
        result = run/'checkout/apps/web/test-results/setup-auth'
        result.mkdir(parents=True)
        (result/'error-context.md').write_text('# Page snapshot\nTenant not found')
        (result/'storage-state.json').write_text('private session cookies')
        (result/'trace.zip').write_bytes(b'private browser trace')
        outside = self.root/'outside.log'
        outside.write_text('not part of this run')
        (run/'env.log').symlink_to(outside)
        report = diagnostics.startup_report(run)
        self.assertEqual(len(report), 2)
        self.assertIn('Unknown tenant: https://localhost:5173', report[0]['tail'])
        self.assertIn('Tenant not found', report[1]['tail'])
        self.assertTrue(all(len(entry['tail']) <= diagnostics.LIMIT for entry in report))
        self.assertNotIn('generated-private-master-key', json.dumps(report))
        self.assertNotIn('private session', json.dumps(report))
        self.assertNotIn('not part of this run', json.dumps(report))
        self.assertTrue(all('\x1b' not in entry['tail'] for entry in report))

    def test_diagnostics_do_not_change_video_identity_but_media_does(self):
        flows = {f['id']: self.state_flow(f) for f in self.domain['flows']}
        before = self_onboarding.domain_identity(self.domain, flows)
        changed = copy.deepcopy(self.domain)
        changed['coverage'] = {'decision': 'complete', 'reason': 'Refactor did not change the flow'}
        changed['flows'][0].update(action='reuse', reason='New implementation', evidence=[{'path': 'x'}])
        self.assertEqual(before, self_onboarding.domain_identity(changed, flows))
        flows[self.domain['flows'][0]['id']]['segment']['sha256'] = 'c' * 64
        self.assertNotEqual(before, self_onboarding.domain_identity(changed, flows))

    def test_incomplete_plan_cannot_enter_recorder(self):
        plan = self.root / 'plan.json'
        core.save(plan, {'schemaVersion': 1, 'reports': [{'ok': False, 'domains': [], 'commit': self.commit}]})
        with patch.object(self_onboarding.harness, 'setup') as setup:
            with self.assertRaisesRegex(ValueError, 'unresolved'):
                self_onboarding.generate(SimpleNamespace(plan=str(plan)))
            setup.assert_not_called()

    def test_missing_flow_is_rejected_before_environment_setup(self):
        domain = copy.deepcopy(self.domain)
        domain['coverage'] = {'decision': 'complete'}
        domain['flows'] = [dict(f, action='record') for f in domain['flows'][:-1]]
        plan = self.root / 'plan.json'
        core.save(plan, {'schemaVersion': 1, 'reports': [{'ok': True, 'domains': [domain], 'commit': self.commit, 'language': 'en'}]})
        with self.assertRaisesRegex(ValueError, 'omits'):
            self_onboarding.generate(SimpleNamespace(plan=str(plan)))

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
        with patch.object(self_onboarding.recording, 'record_flow') as record:
            self.assertTrue(self_onboarding.generate(args)['resumed'])
            record.assert_not_called()
        core.save(manifest, {'commit': self.commit, 'version': '1.1.0', 'domains': [1]})
        with self.assertRaisesRegex(ValueError, 'earlier publication'):
            self_onboarding.generate(args)

    def test_tutorial_brief_has_explicit_language_and_complete_flow_rules(self):
        brief = 'intro\n## Where to start\nFilm setup\n## Narration\nold\nThe format (of 1, list only the pull requests):\n# chapter K | 1 | title\nIf you learned stuff'
        result = recording.tutorial_brief(brief, self.domain['flows'][0], 'Business specification', 'pl')
        self.assertIn('Polish', result)
        self.assertIn('Every prerequisite', result)
        self.assertNotIn('list only the pull requests', result)
        self.assertIn('Business specification', result)
        self.assertIn('self-onboarding.fixture.ts', result)
        self.assertIn('Reuse seeded courses, groups and people', result)
        self.assertIn('expectLearningPathAccessFlow', result)
        self.assertIn('Both Start path and Continue path are valid', result)

    def test_exact_business_spec_selects_its_complete_feature_video(self):
        selected = self_onboarding.select_spec_domains(self.catalog, 'docs/specs/learning-paths-business-spec.md')
        self.assertEqual(selected, ['development-paths.guide'])
        self.assertEqual(len(self.catalog['domains'][0]['flows']), 20)
        ids = {flow['id'] for flow in self.catalog['domains'][0]['flows']}
        self.assertTrue({'configure-path-certificates', 'path-certificates'} <= ids)
        with self.assertRaisesRegex(ValueError, 'exact'):
            self_onboarding.select_spec_domains(self.catalog, 'docs/specs/../../secrets.md')
        with self.assertRaisesRegex(ValueError, 'no registered'):
            self_onboarding.select_spec_domains(self.catalog, 'docs/specs/nonexistent-business-spec.md')
        with self.assertRaisesRegex(ValueError, 'no registered'):
            self_onboarding.select_spec_domains(self.catalog, 'docs/specs/learning-paths-business-spec.md', ['course-authoring'])

    def test_production_cannot_select_an_untagged_ref(self):
        args = SimpleNamespace(cache=str(self.cache), catalog=str(SKILL/'projects/mentingo-self-onboarding.json'),
                               target_ref='HEAD', test_mode=False)
        with self.assertRaisesRegex(ValueError, 'isolated test mode'):
            self_onboarding.analyze(args)

    def test_unchanged_run_skips_capture_assembly_and_publication_but_dirty_domain_recovers(self):
        import hashlib
        domain = copy.deepcopy(self.domain)
        domain['flows'] = domain['flows'][:2]
        registry = {'domains': [copy.deepcopy(domain)]}
        profile = hashlib.sha256(json.dumps({'provider': {}, 'pronunciation': {}, 'brand': {}, 'renderer': 'tutorial-v3'}, sort_keys=True).encode()).hexdigest()
        states = {}
        for flow in domain['flows']:
            video = self.cache/'segments'/flow['id']/'demo.mp4'
            video.parent.mkdir(parents=True)
            video.write_bytes(b'unchanged')
            segment = {'path': str(video.relative_to(self.cache)), 'sha256': recording.digest(video)}
            states[flow['id']] = dict(self.state_flow(flow, segment), voiceProfile=profile)
        identity = self_onboarding.domain_identity(domain, states)
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
        with patch.object(self_onboarding_catalog, 'load_catalog', return_value=registry), \
             patch.object(self_onboarding.core, 'addon', return_value={}), \
             patch.object(self_onboarding.voice_provider, 'elevenlabs_config', return_value={}), \
             patch.object(self_onboarding.recording, 'record_flow') as record, \
             patch.object(self_onboarding.recording, 'assemble') as assemble:
            self.assertEqual(self_onboarding.generate(args)['videos'], 0)
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
            self.assertEqual(self_onboarding.generate(args)['videos'], 1)
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
        trigger = self.load('self-onboarding-on-version.yml')
        self.assertIn('push', trigger['on'])
        self.assertNotIn('release', trigger['on'])
        step = trigger['jobs']['queue']['steps'][0]
        self.assertIn('--ref "$DEFAULT_BRANCH"', step['run'])
        self.assertIn('-f domains=', step['run'])
        self.assertEqual(trigger['jobs']['queue']['permissions'], {'actions': 'write'})

    def test_recording_seeds_the_same_https_tenant_origin_used_by_browser_auth(self):
        recipe = core.load(SKILL/'projects/selleo__mentingo.json')['harness']
        origin = self.load('e2e.yml')['env']['CORS_ORIGIN']
        self.assertEqual(recipe['env']['CORS_ORIGIN'], origin)
        self.assertTrue(origin.startswith('https://'))
        root = SKILL.parents[2]
        for source in ('apps/web/playwright.config.ts', 'apps/web/e2e/auth.setup.ts'):
            self.assertIn('"' + origin + '"', (root/source).read_text())
        workflow = self.load('self-onboarding.yml')
        step = next(s for s in workflow['jobs']['generate']['steps'] if s.get('name') == 'Report recorder startup diagnostics')
        self.assertIn('failure()', step['if'])
        self.assertIn("steps.redact.outcome == 'success'", step['if'])
        self.assertNotIn('env', step)

    def test_zero_video_failure_happens_after_uploads_but_partial_and_noop_pass(self):
        steps = self.load('self-onboarding.yml')['jobs']['generate']['steps']
        gate = next(step for step in steps if step.get('name') == 'Reject an empty result after preserving artifacts')
        upload = next(step for step in steps if step.get('name') == 'Downloadable test videos and chapter metadata')
        self.assertGreater(steps.index(gate), steps.index(upload))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'bundles/123/manifest.json'
            for domains, skipped, expected in [([], [{'flowId': 'browse'}], 1),
                                               ([{'key': 'guide'}], [{'flowId': 'browse'}], 0), ([], [], 0)]:
                core.save(path, {'domains': domains, 'skippedFlows': skipped})
                result = subprocess.run(['bash', '-e', '-c', gate['run']],
                    env={**os.environ, 'CACHE': folder, 'GITHUB_RUN_ID': '123'}, capture_output=True, text=True)
                self.assertEqual(result.returncode, expected, result.stderr)
                if expected:
                    self.assertIn('::error::No usable videos', result.stdout)

    def test_runner_can_create_voice_environment_and_runs_after_workspace_setup(self):
        workflow = self.load('self-onboarding.yml')
        job = workflow['jobs']['generate']
        self.assertEqual(job['env']['RELEASE_FILM_HOME'], '/mnt/self-onboarding')
        self.assertNotIn('helpdesk-film', str(workflow))
        setup = next(step for step in job['steps'] if step.get('id') == 'source')
        installation = '\n'.join(line for line in setup['run'].splitlines() if line.startswith('sudo install -d'))
        self.assertTrue(installation)
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder)/'self-onboarding'
            (home/'projects').mkdir(parents=True)
            # Previously only projects was writable, leaving its parent unable to
            # accept tools or runs. Use our own read-only directory, without sudo.
            home.chmod(0o555)
            try:
                result = subprocess.run(['bash', '-e', '-c', 'sudo() { "$@"; }\n' + installation],
                    env={**os.environ, 'RELEASE_FILM_HOME': str(home)}, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(home.stat().st_mode & 0o200)
                result = subprocess.run([sys.executable, '-m', 'venv', '--without-pip', str(home/'tools/elevenlabs')],
                    capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue((home/'tools/elevenlabs/bin/python').exists())
                (home/'runs/probe.txt').write_text('The recorder can write here.')
            finally:
                home.chmod(0o755)

    def test_incomplete_analysis_reason_is_available_in_logs_and_summary(self):
        workflow = self.load('self-onboarding.yml')
        report = next(step for step in workflow['jobs']['generate']['steps'] if step.get('name') == 'Report semantic decisions')
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            core.save(root/'self-onboarding-plan.json', {'reports': [{'version': '1.0.0', 'language': 'en', 'domains': [{
                'title': 'Development Paths', 'flows': [{'id': 'create'}],
                'coverage': {'decision': 'uncertain', 'reason': 'Missing implementation evidence'},
                'error': 'Semantic coverage analysis returned invalid JSON'}]}]})
            result = subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', report['run']],
                env={**os.environ, 'RUNNER_TEMP': folder, 'GITHUB_STEP_SUMMARY': str(root/'summary.md')},
                capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('Missing implementation evidence', result.stdout)
            self.assertIn('Semantic coverage analysis returned invalid JSON', result.stdout)
            self.assertEqual((root/'summary.md').read_text(), result.stdout)

    def test_narrator_pool_is_checked_before_models_and_forwarded_to_generation(self):
        workflow = self.load('self-onboarding.yml')
        steps = workflow['jobs']['generate']['steps']
        preflight = next(step for step in steps if step.get('name') == 'Check recording credentials before model work')
        recording = next(step for step in steps if step.get('name') == 'Record changed flows and assemble available videos')
        for name in narrators.VOICE_VARIABLES:
            self.assertEqual(preflight['env'][name], '${{ vars.' + name + ' }}')
            self.assertEqual(recording['env'][name], preflight['env'][name])
        environment = {**os.environ, 'S': str(SKILL/'scripts'), 'CLAUDE_CODE_OAUTH_TOKEN': 'test-placeholder',
                       'ELEVENLABS_API_KEY': 'test-placeholder', 'DRY_RUN': 'false'}
        for name in narrators.VOICE_VARIABLES:
            environment.pop(name, None)
        result = subprocess.run(['bash', '-e', '-c', preflight['run']], env=environment, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        environment.update(dict(zip(narrators.VOICE_VARIABLES, ('female-one', 'female-two', 'male-one', 'male-two'))))
        result = subprocess.run(['bash', '-e', '-c', preflight['run']], env=environment, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        for name in narrators.VOICE_VARIABLES:
            environment.pop(name)
        environment['DRY_RUN'] = 'true'
        result = subprocess.run(['bash', '-e', '-c', preflight['run']], env=environment, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode())

    def test_keys_have_separate_scopes_and_state_is_never_public_artifact(self):
        workflow = self.load('self-onboarding.yml')
        generation = workflow['jobs']['generate']
        publication = workflow['jobs']['publish']
        self.assertFalse(workflow['concurrency']['cancel-in-progress'])
        self.assertNotIn('pull_request', workflow['on'])
        for job in (generation, publication):
            self.assertNotIn('${{ runner.', str(job.get('env', {})))
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
                    self.assertIn('steps.redact.outcome', step['if'])
                    if step['with']['name'] == 'self-onboarding-progress':
                        self.assertIn('always()', step['if'])
                        self.assertIn('steps.progress.outcome', step['if'])
                    else:
                        self.assertIn('inputs.test_mode', step['if'])
                    self.assertNotIn('state.json', step['with']['path'])
        self.assertIn('default_branch', generation['if'])

    def test_helpdesk_owns_its_manual_trigger_without_changing_release_recording(self):
        entry = self.load('release-film.yml')
        self.assertNotIn('helpdesk_test', entry['jobs'])
        self.assertNotIn('helpdesk_spec', entry['on']['workflow_dispatch']['inputs'])
        self.assertNotIn('if', entry['jobs']['film'])
        workflow = self.load('self-onboarding.yml')
        self.assertIn('workflow_dispatch', workflow['on'])
        self.assertNotIn('workflow_call', workflow['on'])
        self.assertIn('push', workflow['on'])
        self.assertNotIn('secrets', str(workflow['jobs']['register']))
        self.assertIn("github.event_name == 'workflow_dispatch'", workflow['jobs']['generate']['if'])
        self.assertIn('!inputs.registration_only', workflow['jobs']['generate']['if'])
        self.assertIn('!inputs.registration_only', workflow['jobs']['publish']['if'])
        self.assertIn('inputs.test_mode', workflow['jobs']['generate']['if'])
        self.assertIn('!inputs.test_mode', workflow['jobs']['publish']['if'])
        steps = {step.get('id', step.get('name')): step for step in workflow['jobs']['generate']['steps']}
        self.assertIn('!inputs.test_mode', steps['restore']['if'])
        save = steps['Checkpoint private segments even after an interrupted later flow']
        self.assertIn('!inputs.test_mode', save['if'])

    def test_helpdesk_ci_has_its_own_publisher_checks(self):
        legacy = self.load('pr-release-film-ci.yml')
        self.assertNotIn('scripts/self-onboarding-publish', str(legacy))
        own = self.load('pr-self-onboarding-ci.yml')
        self.assertIn('publisher.test.mjs', str(own['jobs']['test']['steps']))


if __name__ == '__main__':
    unittest.main()
