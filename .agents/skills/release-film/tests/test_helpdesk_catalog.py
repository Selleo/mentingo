"""Semantic planning regressions: file changes are evidence, never regeneration decisions."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import helpdesk_catalog as catalog
import helpdesk_model


SPEC = 'docs/specs/paths-business-spec.md'
CODE = 'apps/web/path.tsx'


def flow(identifier='create'):
    return {'id': identifier, 'title': 'Create a path', 'description': 'Create a draft.',
            'audiences': ['administrator'], 'featureRequirements': [], 'pageKeys': ['development-paths'],
            'specPaths': [SPEC], 'watchPaths': [CODE], 'goal': 'Create a path.',
            'preconditions': ['May create paths.'], 'actions': ['Open create and save.'],
            'outcomes': ['A draft path exists.']}


def registry():
    return {'schemaVersion': 1, 'sharedWatchPaths': ['apps/web/nav.tsx'], 'domains': [
        {'key': 'development-paths.guide', 'domain': 'development-paths', 'title': 'Development Paths',
         'description': 'Manage development paths.', 'specPaths': [SPEC], 'watchPaths': [CODE], 'flows': [flow()]}]}


def classifier(decision='unchanged'):
    def classify(context):
        evidence = [{'path': SPEC, 'reason': 'The spec still describes the same create action.'}]
        if context['phase'] == 'coverage':
            return {'decision': 'complete', 'reason': 'All current tasks have explicit flow coverage.',
                    'evidence': evidence, 'proposedFlows': []}
        return {'decision': decision, 'reason': 'The user performs the same visible actions.', 'evidence': evidence}
    return classify


class PlannerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.repo = Path(self.directory.name)
        self.git('init', '-q')
        self.git('config', 'user.email', 'film-test@example.invalid')
        self.git('config', 'user.name', 'Film Test')
        self.write(SPEC, '# Paths\nCreate a path by opening create and saving.\n')
        self.write(CODE, 'export const save = () => create();\n')
        self.base = self.commit('Initial', 'v1.0.0')
        self.catalog = registry()
        self.previous = self.state(self.base)

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.repo), *args], capture_output=True, text=True, check=True).stdout.strip()

    def write(self, path, text):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def commit(self, message, tag):
        self.git('add', '.')
        self.git('commit', '-qm', message)
        self.git('tag', tag)
        return self.git('rev-parse', 'HEAD')

    def state(self, commit):
        return {'commit': commit, 'domains': {'development-paths.guide': {'commit': commit, 'flows': {
            'create': {'contract': flow(), 'commit': commit, 'segment': {'path': 'retained.mp4'}}}}}}

    def run_plan(self, **kwargs):
        return catalog.plan(self.repo, 'v1.1.0', self.previous, self.catalog, **kwargs)

    def first_flow(self, plan):
        return plan['domains'][0]['flows'][0]

    def test_initial_version_records_every_registered_flow_after_coverage_check(self):
        self.write(CODE, 'export const save = () => create(); // current\n')
        self.commit('Version', 'v1.1.0')
        result = catalog.plan(self.repo, 'v1.1.0', None, self.catalog, classify=classifier())
        self.assertEqual(result['version'], '1.1.0')
        self.assertEqual(self.first_flow(result)['action'], 'record')

    def test_claude_fenced_json_does_not_block_initial_feature_coverage(self):
        self.git('tag', 'v1.1.0')
        answer = classifier()({'phase': 'coverage'})
        for prefix, suffix in [('', ''), ('```json\n', '\n```'), ('```\n', '\n```'),
                               ('\ufeff\r\n```JSON\r\n', '\r\n```')]:
            with self.subTest(prefix=prefix), patch.object(catalog.llm, 'complete',
                    return_value=(prefix + json.dumps(answer) + suffix, {'provider': 'cli'})):
                plan = catalog.plan(self.repo, 'v1.1.0', None, self.catalog)
                self.assertTrue(plan['ok'])
                self.assertEqual(self.first_flow(plan)['action'], 'record')

    def test_claude_fenced_impact_result_still_distinguishes_refactors_from_changes(self):
        self.write(CODE, 'export const save = () => repository.create();\n')
        self.commit('Internal refactor', 'v1.1.0')
        for decision, action in [('unchanged', 'reuse'), ('changed', 'record'), ('uncertain', 'blocked')]:
            def complete(prompt, *_args, **_kwargs):
                answer = classifier(decision)(json.loads(prompt))
                return '```json\n' + json.dumps(answer) + '\n```', {'provider': 'cli'}
            with self.subTest(decision=decision), patch.object(catalog.llm, 'complete', side_effect=complete):
                if action == 'blocked':
                    with self.assertRaises(catalog.ImpactUncertainError): self.run_plan()
                else:
                    self.assertEqual(self.first_flow(self.run_plan())['action'], action)

    def test_invalid_model_json_reports_the_analysis_stage_without_echoing_response(self):
        self.git('tag', 'v1.1.0')
        for text in ['Not JSON private-provider-response', '```json\n{truncated\n```',
                     '```json\n{}\n```\n```json\n{}\n```', '[]', 'null']:
            with self.subTest(text=text), patch.object(catalog.llm, 'complete', return_value=(text, {'provider': 'cli'})):
                with self.assertRaises(catalog.ImpactUncertainError) as caught:
                    catalog.plan(self.repo, 'v1.1.0', None, self.catalog)
                error = caught.exception.plan['domains'][0]['error']
                self.assertIn('Semantic coverage analysis', error)
                self.assertNotIn('private-provider-response', error)
                self.assertEqual(caught.exception.plan['domains'][0]['flows'], [])

    def test_json_parser_rejects_empty_prose_and_multiple_values(self):
        for text in ['', '  ', 'Here is the result: {"decision":"complete"}', '{} {}']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                helpdesk_model.json_object(text, 'Semantic coverage analysis')

    def test_isolated_test_can_record_an_untagged_branch_commit(self):
        self.write(CODE, 'export const save = () => create(); // branch change\n')
        self.git('add', '.')
        self.git('commit', '-qm', 'Untagged branch build')
        commit = self.git('rev-parse', 'HEAD')
        result = catalog.plan(self.repo, 'v0.0.0-helpdesk-test.123', None, self.catalog,
                              target_ref='HEAD', classify=classifier())
        self.assertEqual(result['commit'], commit)
        self.assertEqual(result['version'], '0.0.0-helpdesk-test.123')
        self.assertEqual(self.first_flow(result)['action'], 'record')

    def test_unrelated_change_reuses_without_any_model_call(self):
        self.write('internal/metrics.py', 'retries = 2\n')
        self.commit('Metrics', 'v1.1.0')
        def unexpected(_):
            self.fail('No semantic classification should be needed for unrelated changes')
        self.assertEqual(self.first_flow(self.run_plan(classify=unexpected))['action'], 'reuse')

    def test_internal_refactor_does_not_rerecord(self):
        self.write(CODE, 'export const save = () => repository.create();\n')
        self.commit('Internal refactor', 'v1.1.0')
        phases = []
        decide = classifier()
        def observe(context):
            phases.append(context['phase'])
            self.assertIn('repository.create', context['diff'])
            return decide(context)
        self.assertEqual(self.first_flow(self.run_plan(classify=observe))['action'], 'reuse')
        self.assertEqual(phases, ['coverage', 'impact'])

    def test_spec_grammar_does_not_rerecord(self):
        self.write(SPEC, '# Paths\nTo create a path, open create and save.\n')
        self.commit('Reword documentation', 'v1.1.0')
        self.assertEqual(self.first_flow(self.run_plan(classify=classifier()))['action'], 'reuse')

    def test_navigation_change_can_regenerate_affected_flow(self):
        self.write('apps/web/nav.tsx', 'export const route = "/programs";\n')
        self.commit('New navigation', 'v1.1.0')
        result = self.run_plan(classify=classifier('changed'))
        self.assertEqual(self.first_flow(result)['action'], 'record')
        self.assertTrue(self.first_flow(result)['evidence'])

    def test_registry_wording_is_semantically_classified(self):
        self.write('internal/build', '1')
        self.commit('Version', 'v1.1.0')
        self.catalog['domains'][0]['flows'][0]['description'] = 'Create and save a draft path.'
        self.assertEqual(self.first_flow(self.run_plan(classify=classifier()))['action'], 'reuse')

    def test_flow_baseline_prevents_filtered_domain_run_hiding_changes(self):
        self.write(CODE, 'export const save = () => openWizard();\n')
        middle = self.commit('Flow changed during another domain run', 'v1.0.1')
        self.write('internal/build', '2')
        self.commit('Other changes', 'v1.1.0')
        self.previous['commit'] = middle
        self.previous['domains']['development-paths.guide']['commit'] = middle
        calls = []
        decide = classifier('changed')
        def observe(context):
            calls.append(context)
            return decide(context)
        result = self.run_plan(classify=observe)
        impact = next(c for c in calls if c['phase'] == 'impact')
        self.assertIn('openWizard', impact['diff'])
        self.assertEqual(self.first_flow(result)['action'], 'record')

    def test_moved_file_out_of_watched_path_is_still_classified(self):
        target = self.repo / 'apps/web/moved.tsx'
        (self.repo / CODE).rename(target)
        self.commit('Move implementation', 'v1.1.0')
        phases = []
        decide = classifier()
        def observe(context):
            phases.append(context['phase'])
            self.assertIn(CODE, context['changedPaths'])
            self.assertIn('apps/web/moved.tsx', context['changedPaths'])
            self.assertIn('apps/web/moved.tsx', context['diff'])
            return decide(context)
        self.assertEqual(self.first_flow(self.run_plan(classify=observe))['action'], 'reuse')
        self.assertIn('impact', phases)

    def test_removed_flow_is_reported_and_never_retained(self):
        self.previous['domains']['development-paths.guide']['flows']['obsolete'] = {'contract': flow('obsolete')}
        self.write('internal/build', '3')
        self.commit('Version', 'v1.1.0')
        def retire(context):
            if context['phase'] == 'coverage' and not context.get('rosterRecheck'):
                return {'decision': 'incomplete', 'reason': 'The obsolete flow was removed from the product.',
                        'evidence': [{'path': SPEC, 'reason': 'Only create remains supported.'}],
                        'proposedFlows': [], 'retiredFlowIds': ['obsolete']}
            return classifier()(context)
        result = self.run_plan(classify=retire)
        self.assertEqual(result['domains'][0]['removedFlows'], ['obsolete'])
        self.assertEqual([f['id'] for f in result['domains'][0]['flows']], ['create'])

    def test_uncertain_impact_attaches_report_and_blocks_before_recording(self):
        self.write(CODE, 'export const save = () => conditionalWizard();\n')
        self.commit('Unclear change', 'v1.1.0')
        with self.assertRaises(catalog.ImpactUncertainError) as raised:
            self.run_plan(classify=classifier('uncertain'))
        self.assertFalse(raised.exception.plan['ok'])
        self.assertEqual(self.first_flow(raised.exception.plan)['action'], 'blocked')

    def test_unknown_model_evidence_is_not_accepted_as_unchanged(self):
        self.write(CODE, 'export const save = () => changed();\n')
        self.commit('Change', 'v1.1.0')
        def fabricated(context):
            result = classifier()(context)
            result['evidence'][0]['path'] = '/etc/passwd'
            return result
        with self.assertRaises(catalog.ImpactUncertainError) as raised:
            self.run_plan(classify=fabricated)
        self.assertIn('unknown evidence', raised.exception.plan['domains'][0]['error'])

    def test_missing_or_malformed_classifier_result_fails_closed(self):
        self.write(CODE, 'export const save = () => changed();\n')
        self.commit('Change', 'v1.1.0')
        for value in (None, {}, {'decision': 'unchanged'}, 'unchanged'):
            with self.subTest(value=value), self.assertRaises(catalog.ImpactUncertainError):
                self.run_plan(classify=lambda _: value)

    def test_new_spec_flow_is_discovered_recorded_and_validated_twice(self):
        self.write(SPEC, '# Paths\nCreate and duplicate development paths.\n')
        self.commit('Add duplicate flow', 'v1.1.0')
        calls = []
        def discover(context):
            calls.append(context)
            if context['phase'] == 'coverage' and not context.get('rosterRecheck'):
                return {'decision': 'incomplete', 'reason': 'Duplication has no registered recording.',
                        'evidence': [{'path': SPEC, 'reason': 'The spec now adds duplication.'}],
                        'proposedFlows': [flow('duplicate')]}
            return classifier()(context)
        result = self.run_plan(classify=discover)
        domain = result['domains'][0]
        self.assertEqual(domain['coverage']['decision'], 'complete')
        self.assertEqual(len(domain['coverageReviews']), 2)
        self.assertEqual(domain['discoveredFlowIds'], ['duplicate'])
        self.assertEqual([(f['id'], f['action']) for f in domain['flows']], [('create', 'reuse'), ('duplicate', 'record')])
        self.assertEqual([f['id'] for f in next(c for c in calls if c.get('rosterRecheck'))['domain']['flows']],
                         ['create', 'duplicate'])
        catalog.validate_planned_domain(domain, self.catalog['domains'][0], self.repo, result['commit'])

    def test_discovery_persists_and_is_reused_only_after_current_coverage_check(self):
        self.write(SPEC, '# Paths\nCreate and duplicate development paths.\n')
        first = self.commit('Add duplication', 'v1.0.1')
        self.previous = self.state(first)
        self.previous['domains']['development-paths.guide']['flows']['duplicate'] = {
            'contract': flow('duplicate'), 'commit': first, 'segment': {'path': 'retained-duplicate.mp4'}}
        self.previous['domains']['development-paths.guide']['discoveredFlowIds'] = ['duplicate']
        self.write('internal/build', '2')
        self.commit('No flow changes', 'v1.1.0')
        calls = []
        def observe(context):
            calls.append(context)
            return classifier()(context)
        result = self.run_plan(classify=observe)
        self.assertEqual([c['phase'] for c in calls], ['coverage'])
        self.assertEqual(result['domains'][0]['discoveredFlowIds'], ['duplicate'])
        self.assertTrue(all(f['action'] == 'reuse' for f in result['domains'][0]['flows']))

    def test_unsafe_colliding_or_hallucinated_discoveries_are_blocked(self):
        self.write(SPEC, '# Paths\nCreate and duplicate development paths.\n')
        self.commit('New feature', 'v1.1.0')
        candidates = []
        invented_spec = flow('duplicate')
        invented_spec['specPaths'] = ['docs/specs/invented.md']
        candidates.append([invented_spec])
        outside = flow('duplicate')
        outside['watchPaths'] = ['apps/api/unrelated/**']
        candidates.append([outside])
        nonexistent = flow('duplicate')
        nonexistent['watchPaths'] = ['apps/web/nonexistent.tsx']
        candidates.append([nonexistent])
        candidates.extend(([flow('create')], [flow('duplicate'), flow('duplicate')]))
        executable = flow('duplicate')
        executable['shell'] = 'echo forbidden'
        candidates.append([executable])
        for proposed in candidates:
            def bad(_):
                return {'decision': 'incomplete', 'reason': 'Add another flow.',
                        'evidence': [{'path': SPEC, 'reason': 'The source describes another task.'}],
                        'proposedFlows': proposed}
            with self.subTest(proposed=proposed), self.assertRaises(catalog.ImpactUncertainError):
                self.run_plan(classify=bad)

    def test_uncertain_or_further_proposals_in_second_coverage_block_every_recording(self):
        self.write(SPEC, '# Paths\nCreate and duplicate development paths.\n')
        self.commit('New feature', 'v1.1.0')
        for second in ('uncertain', 'incomplete'):
            def review(context):
                again = context.get('rosterRecheck')
                return {'decision': second if again else 'incomplete',
                        'reason': 'Coverage needs more evidence.',
                        'evidence': [{'path': SPEC, 'reason': 'Duplication was added.'}],
                        'proposedFlows': [flow('another')] if again and second == 'incomplete'
                        else [] if again else [flow('duplicate')]}
            with self.subTest(second=second), self.assertRaises(catalog.ImpactUncertainError) as raised:
                self.run_plan(classify=review)
            self.assertEqual(len(raised.exception.plan['domains'][0]['coverageReviews']), 2)
            self.assertEqual(raised.exception.plan['domains'][0]['flows'], [])

    def test_retirement_persists_without_resurrecting_a_seed_flow(self):
        self.catalog['domains'][0]['flows'].append(flow('delete'))
        self.previous['domains']['development-paths.guide']['retiredFlowIds'] = ['delete']
        self.write('internal/build', '2')
        self.commit('No flow changes', 'v1.1.0')
        calls = []
        def observe(context):
            calls.append(context)
            return classifier()(context)
        result = self.run_plan(classify=observe)
        self.assertEqual([f['id'] for f in result['domains'][0]['flows']], ['create'])
        self.assertEqual(result['domains'][0]['retiredFlowIds'], ['delete'])
        self.assertEqual([c['phase'] for c in calls], ['coverage'])
        catalog.validate_planned_domain(result['domains'][0], self.catalog['domains'][0])

    def test_retired_seed_flow_can_be_restored_after_two_coverage_reviews(self):
        self.catalog['domains'][0]['flows'].append(flow('delete'))
        self.previous['domains']['development-paths.guide']['retiredFlowIds'] = ['delete']
        self.write(SPEC, '# Paths\nCreate and delete development paths.\n')
        self.commit('Restore deletion', 'v1.1.0')
        def restore(context):
            if context['phase'] == 'coverage' and not context.get('rosterRecheck'):
                return {'decision': 'incomplete', 'reason': 'Deletion is supported again.',
                        'evidence': [{'path': SPEC, 'reason': 'The current spec includes deletion.'}],
                        'proposedFlows': [flow('delete')]}
            return classifier()(context)
        result = self.run_plan(classify=restore)
        domain = result['domains'][0]
        self.assertEqual(domain['retiredFlowIds'], [])
        self.assertEqual(domain['discoveredFlowIds'], [])
        self.assertEqual([(f['id'], f['action']) for f in domain['flows']], [('create', 'reuse'), ('delete', 'record')])

    def test_discovered_flow_generation_requires_actual_target_tree_validation(self):
        proposed = {**copy.deepcopy(self.catalog['domains'][0]), 'flows': [flow(), flow('duplicate')],
                    'discoveredFlowIds': ['duplicate'], 'retiredFlowIds': []}
        with self.assertRaisesRegex(ValueError, 'Target source evidence'):
            catalog.validate_planned_domain(proposed, self.catalog['domains'][0])
        proposed['flows'][1]['watchPaths'] = ['apps/web/invented.tsx']
        with self.assertRaises(ValueError):
            catalog.validate_planned_domain(proposed, self.catalog['domains'][0], self.repo, self.base)

    def test_nonancestor_baseline_fails_before_model(self):
        self.git('checkout', '-qb', 'other')
        self.write('internal/other', '1')
        other = self.commit('Other branch', 'v0.1.0')
        self.git('checkout', '-q', '-')
        self.write('internal/main', '2')
        self.commit('Main branch', 'v1.1.0')
        self.previous['commit'] = other
        self.previous['domains']['development-paths.guide']['commit'] = other
        with self.assertRaises(catalog.ImpactUncertainError):
            self.run_plan(classify=lambda _: self.fail('Unrelated histories cannot be classified'))

    def test_force_does_not_bypass_incomplete_coverage(self):
        self.write(SPEC, '# New undocumented flow\n')
        self.commit('Version', 'v1.1.0')
        def incomplete(_):
            return {'decision': 'uncertain', 'reason': 'Cannot establish coverage.',
                    'evidence': [{'path': SPEC, 'reason': 'The required steps are missing.'}], 'proposedFlows': []}
        with self.assertRaises(catalog.ImpactUncertainError):
            self.run_plan(classify=incomplete, force=True)

    def test_unknown_domain_and_non_version_target_are_rejected(self):
        self.git('tag', 'v1.1.0')
        for kwargs in ({'domains': ['other']}, {'domains': ['development-paths', 'development-paths']}):
            with self.subTest(kwargs=kwargs), self.assertRaisesRegex(ValueError, 'Unknown or duplicate'):
                self.run_plan(**kwargs)
        for target in ('HEAD', 'v01.1.0', 'v1.1.0-01', 'v1.1.0-rc..1'):
            with self.subTest(target=target), self.assertRaisesRegex(ValueError, 'semantic-version'):
                catalog.plan(self.repo, target, self.previous, self.catalog)

    def test_optional_subflow_dependency_participates_in_domain_coverage(self):
        other_spec = 'docs/specs/certificates-business-spec.md'
        self.write(other_spec, '# Certificates\nDownload a certificate.\n')
        baseline = self.commit('Certificate source', 'v1.0.2')
        self.catalog['domains'][0]['flows'][0]['specPaths'].append(other_spec)
        self.catalog['domains'][0]['flows'][0]['watchPaths'].append('apps/api/certificates/**')
        self.previous = self.state(baseline)
        self.previous['domains']['development-paths.guide']['flows']['create']['contract'] = copy.deepcopy(
            self.catalog['domains'][0]['flows'][0])
        self.write('apps/api/certificates/preview.ts', 'export const download = true;\n')
        self.commit('Change optional subflow', 'v1.1.0')
        phases = []
        decide = classifier()
        def observe(context):
            phases.append(context['phase'])
            if context['phase'] == 'coverage':
                self.assertIn(other_spec, context['currentSpecs'])
            return decide(context)
        self.assertEqual(self.first_flow(self.run_plan(classify=observe))['action'], 'reuse')
        self.assertEqual(phases, ['coverage', 'impact'])


class RegistryTests(unittest.TestCase):
    def test_reviewed_registry_covers_domains_and_explicit_path_flows(self):
        path = Path(__file__).resolve().parents[1] / 'projects' / 'mentingo-helpdesk.json'
        loaded = catalog.load_catalog(path)
        self.assertEqual({d['domain'] for d in loaded['domains']},
                         {'development-paths', 'course-authoring', 'course-learning'})
        paths = next(d for d in loaded['domains'] if d['domain'] == 'development-paths')
        ids = {f['id'] for f in paths['flows']}
        self.assertTrue({'create-path', 'browse-paths', 'edit-path', 'delete-path', 'assign-learners',
                         'assign-groups', 'remove-enrollment', 'self-enroll', 'configure-sequence',
                         'import-package', 'export-package', 'share-path'} <= ids)

    def test_unsafe_paths_duplicate_ids_and_unknown_fields_are_rejected(self):
        mutations = (
            lambda r: r['domains'][0]['flows'][0].update(specPaths=['docs/../secret']),
            lambda r: r['sharedWatchPaths'].append('/etc/passwd'),
            lambda r: r['domains'][0]['flows'].append(flow()),
            lambda r: r['domains'][0]['flows'][0].update(shell='echo unsafe'),
        )
        for mutate in mutations:
            source = registry()
            mutate(source)
            with self.subTest(source=source), self.assertRaises(ValueError):
                catalog.validate_catalog(source)


if __name__ == '__main__':
    unittest.main()
