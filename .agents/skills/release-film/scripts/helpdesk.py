#!/usr/bin/env python3
"""Version-triggered, business-spec-driven Helpdesk tutorial generation.

plan performs semantic impact analysis without recording. generate consumes that
validated plan, reuses immutable flow segments and emits feature video bundles.
Publication and durable private storage run separately, with separate credentials.
"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
import core
import cut
import doctor
import film
import gaps
import harness
import helpdesk_catalog
import helpdesk_recording as recording
import voice as voice_provider

CATALOG = core.SKILL / 'projects' / 'mentingo-helpdesk.json'


def load_state(cache):
    """Read a private build checkpoint. Missing state is valid only for initial builds."""
    state = core.load(Path(cache) / 'state.json')
    if state is None:
        return {'schemaVersion': 1, 'languages': {}, 'published': {}, 'publications': {}}
    if state.get('schemaVersion') != 1 or not isinstance(state.get('languages'), dict):
        raise ValueError('Unsupported or incomplete Helpdesk build state')
    return state


def analyze(args):
    """Persist a complete decision report, including uncertainty that blocks recording."""
    state = load_state(args.cache)
    catalog = helpdesk_catalog.load_catalog(args.catalog)
    spec = getattr(args, 'business_spec', '')
    test_mode = getattr(args, 'test_mode', False)
    target_ref = getattr(args, 'target_ref', None)
    if target_ref and not test_mode:
        raise ValueError('An untagged source ref is supported only in isolated test mode')
    selected = select_spec_domains(catalog, spec, args.domains.split(',') if args.domains else None)
    codes = [code.strip() for code in args.languages.split(',')]
    if not codes or len(set(codes)) != len(codes) or any(code not in ('en', 'pl') for code in codes):
        raise ValueError('Recorder languages must be unique en,pl values')
    reports = []
    try:
        report = helpdesk_catalog.plan(Path(args.repo), args.target, visual_baseline(state), catalog,
            domains=selected, force=args.force, target_ref=target_ref)
        reports = [dict(copy.deepcopy(report), language=code) for code in codes]
    except helpdesk_catalog.ImpactUncertainError as error:
        reports = [dict(copy.deepcopy(error.plan), language=code) for code in codes]
        raise
    finally:
        if reports:
            core.save(args.out, {'schemaVersion': 1, 'force': args.force, 'testMode': test_mode,
                                'businessSpec': spec, 'reports': reports})
    return {'ok': True, 'plan': args.out,
            'record': sum(f['action'] == 'record' for d in report['domains'] for f in d['flows'])}


def flow_contract(flow):
    return {key: value for key, value in flow.items() if key not in ('action', 'reason', 'evidence')}


def visual_baseline(state):
    """Use one semantic baseline across languages, retaining legacy migration evidence."""
    previous = {'schemaVersion': 1, 'domains': {}}
    languages = state.get('languages', {})
    for code in ['en', 'pl'] + sorted(set(languages) - {'en', 'pl'}):
        for key, domain in languages.get(code, {}).get('domains', {}).items():
            previous['domains'].setdefault(key, copy.deepcopy(domain))
    captures = state.get('captures', {})
    for key, domain in captures.get('domains', {}).items():
        legacy = previous['domains'].get(key, {})
        merged = copy.deepcopy(domain)
        merged['flows'] = {**legacy.get('flows', {}), **merged.get('flows', {})}
        previous['domains'][key] = merged
    return previous if previous['domains'] else None


def select_spec_domains(catalog, spec, selected=None):
    """Select complete feature videos whose declared sources include an exact spec.

    Selecting a spec never truncates its feature's required flows. Unknown paths
    fail before model calls, and optional domain selection narrows shared specs.
    """
    if not spec:
        return selected
    if not re.fullmatch(r'docs/specs/[a-z0-9][a-z0-9_-]*\.md', spec):
        raise ValueError('business-spec must be an exact docs/specs/*.md path, without globs')
    matches = [d['key'] for d in catalog['domains'] if
        spec in set(d['specPaths']) | {path for flow in d['flows'] for path in flow['specPaths']} and
        (not selected or d['key'] in selected or d['domain'] in selected)]
    if not matches:
        raise ValueError('Business spec has no registered feature video in the selected domains')
    return matches


def domain_identity(domain, flows):
    """Identity of chapter order and public catalog text, independent of code churn."""
    data = {k: domain[k] for k in ('key', 'domain', 'title', 'description', 'specPaths')}
    data['flows'] = [{k: flow[k] for k in ('id', 'title', 'description', 'audiences', 'pageKeys', 'featureRequirements')}
                     for flow in domain['flows']]
    data['segments'] = [flows[f['id']]['segment'] for f in domain['flows']]
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def generate(args):
    """Keep every complete flow, record only planned changes and assemble affected domains."""
    plan = core.load(args.plan)
    if not plan or plan.get('schemaVersion') != 1:
        raise ValueError('A validated generation plan is required')
    reports = plan['reports']
    # A malformed/uncertain plan must not be usable as a way around the analysis gate.
    if not reports or any(p.get('ok') is not True or not p.get('domains') for p in reports) or any(
            d.get('coverage', {}).get('decision') != 'complete' or not d.get('flows') or
            any(f.get('action') not in ('record', 'reuse') for f in d['flows'])
            for p in reports for d in p['domains']):
        raise ValueError('Plan contains an unresolved flow decision')
    registry = helpdesk_catalog.load_catalog(CATALOG)
    known = {d['key']: d for d in registry['domains']}
    codes = [p.get('language') for p in reports]
    if len(set(codes)) != len(codes) or any(code not in ('en', 'pl') for code in codes):
        raise ValueError('Plan languages must be unique supported recorder languages')
    for report in reports:
        for domain in report['domains']:
            if domain['key'] not in known:
                raise ValueError('Unknown feature in generation plan')
            discovered = bool(domain.get('discoveredFlowIds'))
            helpdesk_catalog.validate_planned_domain(domain, known[domain['key']],
                repo=Path(args.repo) if discovered else None, commit=report['commit'] if discovered else None,
                shared_watch_paths=registry.get('sharedWatchPaths', []))
    commits = {p['commit'] for p in reports}
    if len(commits) != 1 or not helpdesk_catalog.COMMIT.fullmatch(next(iter(commits))) or len({p['version'] for p in reports}) != 1:
        raise ValueError('All languages must record the same version')
    commit = next(iter(commits))
    run = Path(args.run).resolve()
    cache, out = Path(args.cache).resolve(), Path(args.out).resolve()
    if not out.is_relative_to(cache / 'bundles'):
        raise ValueError('Publication bundles must be inside the private build cache bundles directory')
    state = load_state(cache)
    pending = state.get('pendingBundle')
    if pending:
        bundle = (cache / pending).resolve()
        if not bundle.is_relative_to(cache):
            raise ValueError('Invalid pending publication path')
        existing = core.load(bundle / 'manifest.json')
        selections = {(p['language'], d['key']) for p in reports for d in p['domains']}
        if (not existing or existing.get('commit') != commit or existing.get('version') != reports[0]['version'] or
                state.get('pendingSelection') != sorted([list(v) for v in selections])):
            raise ValueError('An earlier publication is pending; resume it before generating another version')
        return {'ok': True, 'resumed': True, 'videos': len(existing['domains']), 'manifest': str(bundle / 'manifest.json')}
    # Capture and publication share no credential scope. Fail if accidentally configured together.
    if os.environ.get('GUIDE_PUBLISH_API_KEY') or os.environ.get('AWS_SECRET_ACCESS_KEY'):
        raise ValueError('Recording must run without publishing or storage credentials')
    entries, configured = [], False
    original_environment = {name: os.environ.get(name) for name in ('RELEASE_FILM_RUN', 'RELEASE_FILM_VOICE')}
    trusted_addon = core.addon(args.repository, Path(args.repo))
    captures = state.setdefault('captures', {'schemaVersion': 1, 'domains': {}})
    profiles = {code: voice_provider.elevenlabs_config(trusted_addon, code) for code in codes}
    if len({config.get('voice') for config in profiles.values()}) != 1:
        raise ValueError('English and Polish Helpdesk narration must use the same ElevenLabs voice ID')
    grouped = {}
    for report in reports:
        for domain in report['domains']:
            group = grouped.setdefault(domain['key'], {'domain': domain, 'reports': {}, 'changedFlowIds': set()})
            if [flow_contract(f) for f in group['domain']['flows']] != [flow_contract(f) for f in domain['flows']]:
                raise ValueError('Languages must share the same visual flow contracts and order')
            group['reports'][report['language']] = report
            group['changedFlowIds'].update(flow['id'] for flow in domain['flows'] if flow['action'] == 'record')
    addon = trusted_addon
    os.environ['RELEASE_FILM_RUN'] = str(run)
    os.environ['RELEASE_FILM_VOICE'] = 'elevenlabs'
    try:
        for domain_key, group in grouped.items():
            domain = group['domain']
            visual = captures['domains'].setdefault(domain_key, {'commit': None, 'flows': {}})
            # The browser is invoked only here, never once per language.
            references = {}
            for flow in domain['flows']:
                contract = flow_contract(flow)
                old_capture = visual['flows'].get(flow['id'], {})
                reference = old_capture.get('capture')
                changed = flow['id'] in group['changedFlowIds']
                already_captured = reference and old_capture.get('commit') == commit and old_capture.get('contract') == contract
                if plan.get('force') and old_capture.get('captureRequestId') != args.workflow_run_id:
                    already_captured = False
                if changed and not already_captured:
                    if not configured:
                        ready = doctor.check(args.repository)
                        if not ready['ok']:
                            raise RuntimeError('Recorder prerequisites missing; run film.py doctor for details')
                        checkout = harness.checkout(Path(args.repo), commit, run)
                        if core.sh(['git', '-C', str(checkout), 'rev-parse', 'HEAD']).stdout.strip() != commit:
                            raise ValueError('Existing recorder checkout is for a different version')
                        addon = core.addon(args.repository, checkout)
                        addon['elevenlabs'] = trusted_addon.get('elevenlabs', {})
                        addon['pronunciation'] = trusted_addon.get('pronunciation', {})
                        core.save(run / 'meta.json', {'repo': args.repository, 'tag': commit, 'base': commit,
                            'repo_dir': str(Path(args.repo).resolve()), 'run': str(run), 'addon': addon})
                        harness.setup(run, addon['harness'])
                        harness.keep_set(run, addon['harness'], harness.test_env(run, addon['harness']))
                        configured = True
                    reference = recording.capture_flow(run, flow, domain, commit, args.repository, addon, cache)
                if reference:
                    recording.checked_file(cache, reference['path'], reference['sha256'])
                references[flow['id']] = reference
                visual['flows'][flow['id']] = {'contract': contract, 'commit': commit, 'capture': reference,
                    'captureRequestId': args.workflow_run_id if changed else old_capture.get('captureRequestId')}
                visual['discoveredFlowIds'] = [key for key in domain.get('discoveredFlowIds', []) if key in visual['flows']]
                visual['retiredFlowIds'] = domain.get('retiredFlowIds', [])
                core.save(cache / 'state.json', state, mode=0o600)
            # Drop removed flows from the current index; older published revisions remain intact.
            visual['flows'] = {f['id']: visual['flows'][f['id']] for f in domain['flows']}
            visual['commit'] = commit
            for code, report in group['reports'].items():
                profile = hashlib.sha256(json.dumps({'provider': profiles[code],
                    'pronunciation': trusted_addon.get('pronunciation', {}), 'renderer': 'tutorial-v1'}, sort_keys=True).encode()).hexdigest()
                current = state['languages'].setdefault(code, {'schemaVersion': 1, 'domains': {}})
                previous = current['domains'].get(domain_key, {})
                previous.setdefault('commit', None)
                localized_domain, localized_metadata = recording.localize_domain(domain, code, previous.get('localizedMetadata'))
                flows = {}
                for flow in domain['flows']:
                    old = previous.get('flows', {}).get(flow['id'], {})
                    reference = references[flow['id']]
                    capture_id = reference['id'] if reference else None
                    # Existing legacy-language outputs can remain readable, but cannot
                    # stand in for missing raw footage when adding or rebuilding a language.
                    reusable = old.get('segment') and old.get('voiceProfile') == profile \
                        and (old.get('captureId') == capture_id or not reference and not old.get('captureId'))
                    if reusable:
                        recording.checked_file(cache, old['segment']['path'], old['segment']['sha256'])
                        segment = old['segment']
                    else:
                        if not reference:
                            raise ValueError('Legacy build has no portable raw capture; explicitly force this domain once before adding or rebuilding a language')
                        previous['needsPublication'] = True
                        segment = recording.render_flow(run, flow, domain, code, commit, args.repository, addon, cache, reference)
                    flows[flow['id']] = {'contract': flow_contract(flow), 'commit': commit, 'segment': segment,
                                        'voiceProfile': profile, 'captureId': capture_id}
                    previous.setdefault('flows', {})[flow['id']] = flows[flow['id']]
                    previous['discoveredFlowIds'] = [key for key in domain.get('discoveredFlowIds', []) if key in previous['flows']]
                    previous['retiredFlowIds'] = domain.get('retiredFlowIds', [])
                    previous['localizedMetadata'] = localized_metadata
                    current['domains'][domain_key] = previous
                    core.save(cache / 'state.json', state, mode=0o600)
                identity = domain_identity(localized_domain, flows)
                changed = previous.get('needsPublication') or previous.get('identity') != identity
                if changed:
                    destination = out / domain_key / code
                    entry = recording.assemble(localized_domain, code, flows, cache, destination, commit,
                                               report['version'], args.workflow_run_id)
                    entry['video'] = str(Path(entry['video']).relative_to(out))
                    entries.append(entry)
                current['domains'][domain_key] = {'commit': commit, 'identity': identity, 'flows': flows,
                    'needsPublication': bool(changed), 'localizedMetadata': localized_metadata,
                    'discoveredFlowIds': domain.get('discoveredFlowIds', []), 'retiredFlowIds': domain.get('retiredFlowIds', [])}
                current['commit'] = commit
                core.save(cache / 'state.json', state, mode=0o600)
        captures['commit'] = commit
        out.mkdir(parents=True, exist_ok=True)
        manifest = {'schemaVersion': 1, 'testMode': plan.get('testMode', False), 'commit': commit, 'version': reports[0]['version'],
                    'workflowRunId': args.workflow_run_id, 'domains': entries}
        core.save(out / 'manifest.json', manifest)
        if entries:
            state['pendingBundle'] = str(out.relative_to(cache))
            state['pendingSelection'] = sorted([[p['language'], d['key']] for p in reports for d in p['domains']])
        core.save(cache / 'state.json', state, mode=0o600)
        return {'ok': True, 'videos': len(entries), 'manifest': str(out / 'manifest.json')}
    finally:
        # Stop all owned children before a later trusted step receives storage credentials.
        try:
            if (run / 'meta.json').is_file():
                film.stop(SimpleNamespace(run=str(run), keep_checkout=True))
        finally:
            for name, value in original_environment.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    p = commands.add_parser('plan')
    p.add_argument('--repo', default=str(core.REPO))
    p.add_argument('--target', required=True)
    p.add_argument('--cache', required=True)
    p.add_argument('--catalog', default=str(CATALOG))
    p.add_argument('--out', required=True)
    p.add_argument('--languages', default='en,pl')
    p.add_argument('--domains', default='')
    p.add_argument('--force', action='store_true')
    p.add_argument('--business-spec', default='')
    p.add_argument('--test-mode', action='store_true')
    p.add_argument('--target-ref', help='Exact branch/commit to demonstrate in isolated test mode')
    p = commands.add_parser('generate')
    p.add_argument('--repo', default=str(core.REPO))
    p.add_argument('--repository', default='Selleo/mentingo')
    p.add_argument('--plan', required=True)
    p.add_argument('--cache', required=True)
    p.add_argument('--run', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--workflow-run-id', required=True)
    args = parser.parse_args()
    if args.command == 'generate' and not re.fullmatch(r'[0-9]{1,32}', args.workflow_run_id):
        parser.error('workflow-run-id must identify the actual GitHub Actions run')
    try:
        result = analyze(args) if args.command == 'plan' else generate(args)
        print(json.dumps(result))
    except (ValueError, RuntimeError) as error:
        # Provider and publication helpers sanitize errors; never dump subprocess environments.
        print(json.dumps({'ok': False, 'error': str(error)[:1000]}), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
