"""PR checks keep unit coverage; real rendering and browser checks remain manual."""
from pathlib import Path
import unittest
import run_checks
import yaml

ROOT = Path(__file__).resolve().parents[4]


class CheckSelection(unittest.TestCase):
    def test_mixed_modules_keep_unit_cases_and_exclude_real_media(self):
        self.assertTrue(run_checks.is_media('test_render.RenderTest.test_real_image_after_footage'))
        self.assertTrue(run_checks.is_media('test_self_onboarding_pipeline.PipelineTest.test_real_assembly_keeps_ids_and_recalculates_offsets_without_rerecording'))
        self.assertFalse(run_checks.is_media('test_montage.Cut.test_timing'))
        self.assertFalse(run_checks.is_media('test_core.Tools.test_ffprobe_is_the_one_beside_the_ffmpeg_in_use'))
        self.assertFalse(run_checks.is_media('test_self_onboarding_pipeline.WorkflowsTest.test_keys_have_separate_scopes_and_state_is_never_public_artifact'))

    def test_pr_workflows_have_no_system_media_or_browser_installation(self):
        for name in ('pr-release-film-ci.yml', 'pr-self-onboarding-ci.yml'):
            text = (ROOT / '.github/workflows' / name).read_text()
            self.assertNotIn('apt-get', text)
            self.assertNotIn('playwright install', text)
            self.assertIn('run_checks.py', text)
        workflow = yaml.safe_load((ROOT / '.github/workflows/pr-self-onboarding-ci.yml').read_text())
        commands = '\n'.join(s.get('run', '') for s in workflow['jobs']['test']['steps'])
        self.assertIn('publisher.test.mjs', commands)
        self.assertIn('self-onboarding-data-seed.spec.ts', commands)

    def test_manual_workflow_retains_full_media_and_browser_checks(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/media-integration-tests.yml').read_text())
        triggers = workflow.get('on', workflow.get(True))
        self.assertIn('workflow_dispatch', triggers)
        for name in ('release-media', 'onboarding-media'):
            self.assertEqual(workflow['jobs'][name]['if'], "github.event_name == 'workflow_dispatch'")
        commands = '\n'.join(s.get('run', '') for j in workflow['jobs'].values() for s in j.get('steps', []))
        self.assertIn('unittest discover -s tests', commands)
        self.assertIn('test_tutorial_media', commands)
        self.assertIn('playwright install --with-deps chromium', commands)
        self.assertNotIn('run_checks.py', commands)
