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
import subprocess
from types import SimpleNamespace

sys.dont_write_bytecode = True
import core
import cut
import doctor
import film
import gaps
import harness
import self_onboarding_catalog
import self_onboarding_model
import self_onboarding_recording as recording
import self_onboarding_voices as narrators
import voice as voice_provider

CATALOG = core.SKILL / 'projects' / 'mentingo-self-onboarding.json'


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
    catalog = self_onboarding_catalog.load_catalog(args.catalog)
    if Path(args.catalog).resolve() == CATALOG.resolve():
        # Audit the control checkout: older target versions may predate this registry.
        control_repo = core.SKILL.parents[2]
        self_onboarding_catalog.validate_app_coverage(catalog,
            core.load(control_repo / 'packages/shared/src/constants/self-onboarding-areas.json'),
            control_repo)
    spec = getattr(args, 'business_spec', '')
    test_mode = getattr(args, 'test_mode', False)
    target_ref = getattr(args, 'target_ref', None)
    test_flow = getattr(args, 'test_flow', '')
    if test_flow and not test_mode:
        raise ValueError('A single-flow selection is supported only in isolated test mode')
    if target_ref and not test_mode:
        raise ValueError('An untagged source ref is supported only in isolated test mode')
    selected = select_spec_domains(catalog, spec, args.domains.split(',') if args.domains else None)
    if test_flow:
        selected_features = [d for d in catalog['domains'] if not selected or d['key'] in selected or d['domain'] in selected]
        scope_test_flow([{'domains':selected_features}], test_flow)
    codes = [code.strip() for code in args.languages.split(',')]
    if not codes or len(set(codes)) != len(codes) or any(code not in ('en', 'pl') for code in codes):
        raise ValueError('Recorder languages must be unique en,pl values')
    chosen = [d for d in catalog['domains'] if not selected or d['key'] in selected or d['domain'] in selected]
    if sum(len(d['videos']) for d in chosen) * len(codes) > 256:
        raise ValueError('Select fewer features; a publication bundle supports at most 256 videos')
    reports = []
    try:
        report = self_onboarding_catalog.plan(Path(args.repo), args.target, visual_baseline(state), catalog,
            domains=selected, force=args.force, target_ref=target_ref)
        for domain in report['domains']:
            try:
                self_onboarding_catalog.validate_video_groups(domain)
            except ValueError as error:
                domain['error'] = str(error)
                report['ok'] = False
        reports = [dict(copy.deepcopy(report), language=code) for code in codes]
        if not report['ok']:
            raise ValueError('Update the video-group registry: ' + '; '.join(
                d['error'] for d in report['domains'] if d.get('error')))
    except self_onboarding_catalog.ImpactUncertainError as error:
        reports = [dict(copy.deepcopy(error.plan), language=code) for code in codes]
        raise
    finally:
        if reports:
            core.save(args.out, {'schemaVersion': 1, 'force': args.force, 'testMode': test_mode,
                                'businessSpec': spec, 'testFlow': test_flow, 'reports': reports})
    selected_report = scope_test_flow(reports, test_flow)[0] if test_flow else report
    return {'ok': True, 'plan': args.out,
            'record': sum(f['action'] == 'record' for d in selected_report['domains'] for f in d['flows'])}


def scope_test_flow(reports, flow_id):
    """Narrow only a test run after validating the complete trusted feature registry and plan."""
    if not self_onboarding_catalog.KEY.fullmatch(flow_id):
        raise ValueError('Invalid test flow ID')
    result = copy.deepcopy(reports)
    for report in result:
        matches = [(domain, flow) for domain in report['domains'] for flow in domain['flows'] if flow['id'] == flow_id]
        if len(matches) != 1:
            raise ValueError('Test flow must identify exactly one registered flow in the selected features')
        domain, flow = matches[0]
        video = next(video for video in domain['videos'] if flow_id in video['flowIds'])
        domain['flows'] = [flow]
        domain['videos'] = [dict(video, flowIds=[flow_id])]
        report['domains'] = [domain]
    return result


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
    data['voiceProfiles'] = [flows[f['id']].get('voiceProfile') for f in domain['flows']]
    data['domainLabel'] = domain.get('domainLabel', domain['title'])
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def video_registry_identity(reports):
    selected = sorted((domain['key'], report['language'], domain['videos'])
                      for report in reports for domain in report['domains'])
    return hashlib.sha256(json.dumps(selected, sort_keys=True).encode()).hexdigest()


def validate_output_coverage(reports, coverage, entries):
    """Do not silently lose an entire group during assembly, including unchanged and failed groups."""
    expected = {(domain['key'], video['key'], report['language']): video['flowIds']
                for report in reports for domain in report['domains'] for video in domain['videos']}
    seen, assembled = set(), set()
    for row in coverage:
        key = (row['featureKey'], row['key'], row['language'])
        if key not in expected or key in seen or row['requiredFlowIds'] != expected[key]:
            raise ValueError('Output video coverage duplicates or changes a registered group')
        if row['status'] not in ('assembled', 'unchanged', 'failed'):
            raise ValueError('Unknown video coverage status')
        seen.add(key)
        if row['status'] == 'assembled':
            assembled.add(key)
    actual = [(entry['featureKey'], entry['key'], entry['language']) for entry in entries]
    if seen != set(expected) or len(actual) != len(set(actual)) or set(actual) != assembled:
        raise ValueError('Output is missing or duplicates a registered video group')


def generate(args):
    """Keep every complete flow, record only planned changes and assemble affected domains."""
    plan = core.load(args.plan)
    if not plan or plan.get('schemaVersion') != 1:
        raise ValueError('A validated generation plan is required')
    reports = plan['reports']
    test_flow = plan.get('testFlow', '')
    if test_flow and not plan.get('testMode'):
        raise ValueError('A single-flow selection cannot be used in production')
    # A malformed/uncertain plan must not be usable as a way around the analysis gate.
    if not reports or any(p.get('ok') is not True or not p.get('domains') for p in reports) or any(
            d.get('coverage', {}).get('decision') != 'complete' or not d.get('flows') or
            any(f.get('action') not in ('record', 'reuse') for f in d['flows'])
            for p in reports for d in p['domains']):
        raise ValueError('Plan contains an unresolved flow decision')
    registry = self_onboarding_catalog.load_catalog(CATALOG)
    known = {d['key']: d for d in registry['domains']}
    codes = [p.get('language') for p in reports]
    if len(set(codes)) != len(codes) or any(code not in ('en', 'pl') for code in codes):
        raise ValueError('Plan languages must be unique supported recorder languages')
    for report in reports:
        keys = [domain['key'] for domain in report['domains']]
        if len(keys) != len(set(keys)):
            raise ValueError('Duplicate feature in generation plan')
        for domain in report['domains']:
            if domain['key'] not in known:
                raise ValueError('Unknown feature in generation plan')
            discovered = bool(domain.get('discoveredFlowIds'))
            self_onboarding_catalog.validate_planned_domain(domain, known[domain['key']],
                repo=Path(args.repo) if discovered else None, commit=report['commit'] if discovered else None,
                shared_watch_paths=registry.get('sharedWatchPaths', []))
            self_onboarding_catalog.validate_video_groups(domain)
    if test_flow:
        reports = scope_test_flow(reports, test_flow)
    if sum(len(d['videos']) for p in reports for d in p['domains']) > 256:
        raise ValueError('Select fewer features; a publication bundle supports at most 256 videos')
    commits = {p['commit'] for p in reports}
    if len(commits) != 1 or not self_onboarding_catalog.COMMIT.fullmatch(next(iter(commits))) or len({p['version'] for p in reports}) != 1:
        raise ValueError('All languages must record the same version')
    commit = next(iter(commits))
    run = Path(args.run).resolve()
    cache, out = Path(args.cache).resolve(), Path(args.out).resolve()
    if not out.is_relative_to(cache / 'bundles'):
        raise ValueError('Publication bundles must be inside the private build cache bundles directory')
    state = load_state(cache)
    # A key migration must explicitly retire published monoliths/removed groups, never leave duplicates live.
    for report in reports:
        for domain in report['domains']:
            keys = {v['key'] for v in domain['videos']}
            old = state.get('languages', {}).get(report['language'], {}).get('domains', {}).get(domain['key'], {})
            removed = set(old.get('videos', {})) - keys
            legacy = f"{domain['key']}:{report['language']}" in state.get('published', {}) and domain['key'] not in keys
            if removed or legacy:
                raise ValueError('Video keys were retired; explicitly retire their published revisions before regrouping')
    registry_identity = video_registry_identity(reports)
    pending = state.get('pendingBundle')
    if pending:
        bundle = (cache / pending).resolve()
        if not bundle.is_relative_to(cache):
            raise ValueError('Invalid pending publication path')
        existing = core.load(bundle / 'manifest.json')
        selections = {(p['language'], d['key']) for p in reports for d in p['domains']}
        if (not existing or existing.get('commit') != commit or existing.get('version') != reports[0]['version'] or
                state.get('pendingSelection') != sorted([list(v) for v in selections]) or
                state.get('pendingRegistry') != registry_identity):
            raise ValueError('An earlier publication is pending; resume it before changing versions or video groups')
        return {'ok': True, 'resumed': True, 'videos': len(existing['domains']), 'manifest': str(bundle / 'manifest.json')}
    # Capture and publication share no credential scope. Fail if accidentally configured together.
    if os.environ.get('GUIDE_PUBLISH_API_KEY') or os.environ.get('AWS_SECRET_ACCESS_KEY'):
        raise ValueError('Recording must run without publishing or storage credentials')
    entries, configured = [], False
    skipped = []
    video_coverage = []
    quota_reason = None

    def skip_flow(domain, flow, stage, error, code=None):
        nonlocal quota_reason
        reason = recording._hide_tokens(str(error), run)[:1000]
        if quota_reason is None and self_onboarding_model.quota_exhausted(error):
            quota_reason = reason
        entry = {'domain': domain['key'], 'flowId': flow['id'], 'stage': stage, 'reason': reason}
        if code:
            entry['language'] = code
        skipped.append(entry)
        core.save(run / 'review/skipped-flows.json', {'skippedFlows': skipped})
        print(f"Self-onboarding: skipped {flow['id']} ({code or 'all languages'}, {stage}): {reason}",
              file=sys.stderr, flush=True)
    def ensure_recorder():
        nonlocal configured, addon
        if configured:
            return
        ready = doctor.check(args.repository)
        if not ready['ok']:
            raise RuntimeError('Recorder prerequisites missing; run film.py doctor for details')
        checkout = harness.checkout(Path(args.repo), commit, run)
        if core.sh(['git', '-C', str(checkout), 'rev-parse', 'HEAD']).stdout.strip() != commit:
            raise ValueError('Existing recorder checkout is for a different version')
        recording.prepare_demo_checkout(checkout, Path(args.repo))
        addon = core.addon(args.repository, checkout)
        addon['elevenlabs'] = trusted_addon.get('elevenlabs', {})
        addon['pronunciation'] = trusted_addon.get('pronunciation', {})
        addon['harness'].setdefault('env', {})['DEMO_FAILURE_SCREENSHOTS'] = '1'
        addon['harness']['env']['SELF_ONBOARDING_DEMO'] = '1'
        addon['harness']['env']['SELF_ONBOARDING_LANGUAGE'] = 'en'
        core.save(run / 'meta.json', {'repo': args.repository, 'tag': commit, 'base': commit,
            'recordingMode': 'self-onboarding',
            'repo_dir': str(Path(args.repo).resolve()), 'run': str(run), 'addon': addon})
        harness.setup(run, addon['harness'])
        harness.keep_set(run, addon['harness'], harness.test_env(run, addon['harness']))
        configured = True

    original_environment = {name: os.environ.get(name) for name in
                            ('RELEASE_FILM_RUN', 'RELEASE_FILM_VOICE', 'ELEVENLABS_VOICE_ID')}
    trusted_addon = core.addon(args.repository, Path(args.repo))
    captures = state.setdefault('captures', {'schemaVersion': 1, 'domains': {}})
    pool = narrators.configured_pool()
    profiles = {} if pool else {code: voice_provider.elevenlabs_config(trusted_addon, code) for code in codes}
    if not pool and len({config.get('voice') for config in profiles.values()}) != 1:
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
            if pool:
                selected_voice = narrators.select_voice(pool, visual.get('voiceId'))
                os.environ['ELEVENLABS_VOICE_ID'] = selected_voice
                profiles = {code: voice_provider.elevenlabs_config(trusted_addon, code) for code in codes}
                visual['voiceId'] = selected_voice
                # Persist the random choice before any paid work or camera setup.
                core.save(cache / 'state.json', state, mode=0o600)
            # Author one scenario; each native language is captured with deterministic replay.
            references, failed_captures = {}, set()
            for flow_index, flow in enumerate(domain['flows'], 1):
                contract = flow_contract(flow)
                old_capture = visual['flows'].get(flow['id'], {})
                reference = old_capture.get('capture')
                changed = (flow['id'] in group['changedFlowIds'] or
                           bool(reference and reference.get('recordingProfile') != 'localized-v1'))
                already_captured = reference and old_capture.get('commit') == commit and old_capture.get('contract') == contract
                if plan.get('force') and old_capture.get('captureRequestId') != args.workflow_run_id:
                    already_captured = False
                if changed and not already_captured:
                    if quota_reason:
                        skip_flow(domain, flow, 'capture', self_onboarding_model.ModelQuotaError(
                            'Text model quota exhausted; capture not attempted after: ' + quota_reason))
                        failed_captures.add(flow['id'])
                        continue
                    print(f"Self-onboarding [{domain_key}] flow {flow_index}/{len(domain['flows'])}: recording {flow['id']}",
                          file=sys.stderr, flush=True)
                    ensure_recorder()
                    try:
                        reference = recording.capture_flow(run, flow, domain, commit, args.repository, addon, cache,
                                                           reference if old_capture.get('contract') == contract else None)
                    except (RuntimeError, ValueError, OSError, subprocess.SubprocessError) as error:
                        skip_flow(domain, flow, 'capture', error)
                        failed_captures.add(flow['id'])
                        continue
                    print(f"Self-onboarding [{domain_key}]: captured {flow['id']}", file=sys.stderr, flush=True)
                if reference:
                    recording.checked_file(cache, reference['path'], reference['sha256'])
                references[flow['id']] = reference
                visual['flows'][flow['id']] = {'contract': contract, 'commit': commit, 'capture': reference,
                    'captureRequestId': args.workflow_run_id if changed else old_capture.get('captureRequestId'),
                    'localizedCaptures': old_capture.get('localizedCaptures', {}) if (old_capture.get('capture') or {}).get('id') == (reference or {}).get('id') else {}}
                visual['discoveredFlowIds'] = [key for key in domain.get('discoveredFlowIds', []) if key in visual['flows']]
                visual['retiredFlowIds'] = domain.get('retiredFlowIds', [])
                core.save(cache / 'state.json', state, mode=0o600)
            # Drop removed flows from the current index; older published revisions remain intact.
            visual['flows'] = {f['id']: visual['flows'][f['id']] for f in domain['flows'] if f['id'] in visual['flows']}
            visual['commit'] = commit
            if len(failed_captures) == len(domain['flows']):
                for code in group['reports']:
                    for video in domain['videos']:
                        video_coverage.append({'key':video['key'], 'featureKey':domain_key, 'language':code,
                            'requiredFlowIds':video['flowIds'], 'status':'failed', 'skippedFlowIds':video['flowIds']})
                continue
            for code, report in group['reports'].items():
                profile = hashlib.sha256(json.dumps({'provider': profiles[code],
                    'pronunciation': trusted_addon.get('pronunciation', {}), 'brand': trusted_addon.get('brand', {}),
                    'renderer': 'tutorial-v5-full-viewport'}, sort_keys=True).encode()).hexdigest()
                current = state['languages'].setdefault(code, {'schemaVersion': 1, 'domains': {}})
                previous = current['domains'].get(domain_key, {})
                previous.setdefault('commit', None)
                try:
                    _, localized_metadata = recording.localize_domain(
                        domain, code, previous.get('localizedMetadata'), allow_model=quota_reason is None)
                except (RuntimeError, ValueError, OSError, subprocess.SubprocessError) as error:
                    for flow in domain['flows']:
                        if flow['id'] not in failed_captures:
                            skip_flow(domain, flow, 'localization', error, code)
                    for video in domain['videos']:
                        video_coverage.append({'key':video['key'], 'featureKey':domain_key, 'language':code,
                            'requiredFlowIds':video['flowIds'], 'status':'failed', 'skippedFlowIds':video['flowIds']})
                    continue
                flows = {}
                for flow in domain['flows']:
                    if flow['id'] in failed_captures:
                        continue
                    old = previous.get('flows', {}).get(flow['id'], {})
                    reference = references[flow['id']]
                    if reference and code != 'en':
                        localized = visual['flows'][flow['id']].setdefault('localizedCaptures', {})
                        localized_reference = localized.get(code)
                        if not localized_reference or localized_reference.get('parentCaptureId') != reference['id']:
                            try:
                                ensure_recorder()
                                print(f"Self-onboarding [{domain_key}/{code}]: replaying {flow['id']} without a model worker", file=sys.stderr, flush=True)
                                localized_reference = recording.replay_flow(run, flow, domain, code, commit,
                                    args.repository, addon, cache, reference)
                                localized[code] = localized_reference
                                core.save(cache / 'state.json', state, mode=0o600)
                            except (RuntimeError, ValueError, OSError, subprocess.SubprocessError) as error:
                                skip_flow(domain, flow, 'localized-capture', error, code)
                                continue
                        reference = localized_reference
                    capture_id = reference['id'] if reference else None
                    # Existing legacy-language outputs can remain readable, but cannot
                    # stand in for missing raw footage when adding or rebuilding a language.
                    reusable = old.get('segment') and old.get('voiceProfile') == profile \
                        and (old.get('captureId') == capture_id or not reference and not old.get('captureId'))
                    if reusable:
                        recording.checked_file(cache, old['segment']['path'], old['segment']['sha256'])
                        segment = old['segment']
                    else:
                        try:
                            if quota_reason and code != 'en':
                                raise self_onboarding_model.ModelQuotaError(
                                    'Text model quota exhausted; chapter translation not attempted')
                            if not reference:
                                raise ValueError('Legacy build has no portable raw capture; explicitly force this domain once before adding or rebuilding a language')
                            previous['needsPublication'] = True
                            print(f"Self-onboarding [{domain_key}/{code}]: rendering {flow['id']}", file=sys.stderr, flush=True)
                            segment = recording.render_flow(run, flow, domain, code, commit, args.repository, addon, cache,
                                                            reference, allow_model=quota_reason is None)
                        except (RuntimeError, ValueError, OSError, subprocess.SubprocessError, SystemExit) as error:
                            if isinstance(error, SystemExit) and error.code in (0, 130, 143):
                                raise
                            skip_flow(domain, flow, 'render', error, code)
                            continue
                    flows[flow['id']] = {'contract': flow_contract(flow), 'commit': commit, 'segment': segment,
                                        'voiceProfile': profile, 'captureId': capture_id}
                    previous.setdefault('flows', {})[flow['id']] = flows[flow['id']]
                    previous['discoveredFlowIds'] = [key for key in domain.get('discoveredFlowIds', []) if key in previous['flows']]
                    previous['retiredFlowIds'] = domain.get('retiredFlowIds', [])
                    previous['localizedMetadata'] = localized_metadata
                    current['domains'][domain_key] = previous
                    core.save(cache / 'state.json', state, mode=0o600)
                if not flows:
                    for video in domain['videos']:
                        video_coverage.append({'key':video['key'], 'featureKey':domain_key, 'language':code,
                            'requiredFlowIds':video['flowIds'], 'status':'failed', 'skippedFlowIds':video['flowIds']})
                    print(f"Self-onboarding: no usable flows for {domain_key}/{code}; no video generated", file=sys.stderr, flush=True)
                    continue
                video_states = copy.deepcopy(previous.get('videos', {}))
                members = {f['id']: f for f in domain['flows']}
                for video in domain['videos']:
                    available = [members[key] for key in video['flowIds'] if key in flows]
                    coverage = {'key':video['key'], 'featureKey':domain_key, 'language':code,
                                'requiredFlowIds':list(video['flowIds']),
                                'skippedFlowIds':[key for key in video['flowIds'] if key not in flows]}
                    if not available:
                        video_coverage.append(dict(coverage, status='failed'))
                        continue
                    video_domain = dict(domain, key=video['key'], title=video['title'],
                                        description=video['description'], flows=available,
                                        domainLabel=localized_metadata['title'])
                    identity = domain_identity(video_domain, flows)
                    old_video = video_states.get(video['key'], {})
                    # Compatibility for a one-video legacy checkpoint whose public key is unchanged.
                    if not old_video and len(domain['videos']) == 1 and video['key'] == domain_key:
                        old_video = previous
                    changed = old_video.get('needsPublication') or old_video.get('identity') != identity
                    localized = old_video.get('localizedMetadata')
                    if changed:
                        try:
                            localized_domain, localized = recording.localize_domain(
                                video_domain, code, localized, allow_model=quota_reason is None)
                        except (RuntimeError, ValueError, OSError, subprocess.SubprocessError) as error:
                            for flow in available:
                                skip_flow(domain, flow, 'localization', error, code)
                            video_coverage.append(dict(coverage, status='failed', skippedFlowIds=video['flowIds']))
                            continue
                        destination = out / video['key'] / code
                        print(f"Self-onboarding [{video['key']}/{code}]: assembling {len(available)} chapters", file=sys.stderr, flush=True)
                        entry = recording.assemble(localized_domain, code, flows, cache, destination, commit,
                                                   report['version'], args.workflow_run_id)
                        entry['video'] = str(Path(entry['video']).relative_to(out))
                        entry['featureKey'] = domain_key
                        entry['requiredFlowIds'] = list(video['flowIds'])
                        entry['skippedFlowIds'] = [key for key in video['flowIds'] if key not in flows]
                        entries.append(entry)
                    video_coverage.append(dict(coverage, status='assembled' if changed else 'unchanged'))
                    video_states[video['key']] = {'identity': identity, 'needsPublication': bool(changed),
                        'localizedMetadata': localized, 'flowIds': list(video['flowIds'])}
                    previous['videos'] = video_states
                    current['domains'][domain_key] = previous
                    core.save(cache / 'state.json', state, mode=0o600)
                current['domains'][domain_key] = {'commit': commit, 'flows': flows, 'videos': video_states,
                    'needsPublication': any(v.get('needsPublication') for v in video_states.values()),
                    'localizedMetadata': localized_metadata,
                    'discoveredFlowIds': domain.get('discoveredFlowIds', []), 'retiredFlowIds': domain.get('retiredFlowIds', [])}
                current['commit'] = commit
                core.save(cache / 'state.json', state, mode=0o600)
        validate_output_coverage(reports, video_coverage, entries)
        captures['commit'] = commit
        out.mkdir(parents=True, exist_ok=True)
        manifest = {'schemaVersion': 1, 'testMode': plan.get('testMode', False), 'commit': commit, 'version': reports[0]['version'],
                    'workflowRunId': args.workflow_run_id, 'domains': entries, 'complete': not skipped, 'skippedFlows': skipped,
                    'textModelQuota': quota_reason, 'videoCoverage': video_coverage, 'testFlow': test_flow}
        core.save(out / 'manifest.json', manifest)
        if entries:
            state['pendingRegistry'] = registry_identity
            state['pendingBundle'] = str(out.relative_to(cache))
            state['pendingSelection'] = sorted([[p['language'], d['key']] for p in reports for d in p['domains']])
        core.save(cache / 'state.json', state, mode=0o600)
        return {'ok': True, 'videos': len(entries), 'skippedFlows': skipped, 'manifest': str(out / 'manifest.json')}
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


def mark_published(args):
    """Clear only groups confirmed published by the SDK publisher; feature capture baselines stay intact."""
    cache = Path(args.cache)
    state = load_state(cache)
    pending = state.get('pendingBundle')
    if not pending:
        return {'ok': True, 'videos': 0}
    bundle = (cache / pending).resolve()
    if not bundle.is_relative_to(cache.resolve()):
        raise ValueError('Invalid pending publication path')
    manifest = core.load(bundle / 'manifest.json')
    for entry in manifest['domains']:
        published = state.get('published', {}).get(f"{entry['key']}:{entry['language']}", {})
        if not published.get('revisionId') or published.get('commit') != manifest['commit'] or published.get('version') != manifest['version']:
            raise ValueError('Video group has not been confirmed published')
        feature = state['languages'][entry['language']]['domains'][entry.get('featureKey', entry['key'])]
        if entry.get('featureKey'):
            feature['videos'][entry['key']]['needsPublication'] = False
            feature['needsPublication'] = any(v.get('needsPublication') for v in feature['videos'].values())
        else:
            feature['needsPublication'] = False
    state.pop('pendingBundle', None)
    state.pop('pendingSelection', None)
    state.pop('pendingRegistry', None)
    core.save(cache / 'state.json', state, mode=0o600)
    return {'ok': True, 'videos': len(manifest['domains'])}


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
    p.add_argument('--test-flow', default='', help='Isolated test only: record exactly one registered flow')
    p.add_argument('--target-ref', help='Exact branch/commit to demonstrate in isolated test mode')
    p = commands.add_parser('generate')
    p.add_argument('--repo', default=str(core.REPO))
    p.add_argument('--repository', default='Selleo/mentingo')
    p.add_argument('--plan', required=True)
    p.add_argument('--cache', required=True)
    p.add_argument('--run', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--workflow-run-id', required=True)
    p = commands.add_parser('published')
    p.add_argument('--cache', required=True)
    args = parser.parse_args()
    if args.command == 'generate' and not re.fullmatch(r'[0-9]{1,32}', args.workflow_run_id):
        parser.error('workflow-run-id must identify the actual GitHub Actions run')
    try:
        handlers = {'plan': analyze, 'generate': generate, 'published': mark_published}
        result = handlers[args.command](args)
        print(json.dumps(result))
    except (ValueError, RuntimeError) as error:
        # Provider and publication helpers sanitize errors; never dump subprocess environments.
        print(json.dumps({'ok': False, 'error': str(error)[:1000]}), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
