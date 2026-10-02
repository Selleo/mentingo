"""What a film and its run measure, from the same montage the render uses: captions over the next picture, how long
each chapter's proof stays on screen, frozen pictures, the share of wide shots, the voice's waits; the scenes, what
their workers cost and what of it went to scenes the film left out; the stages on the critical path.

    film.py metrics --run R      (make writes the film's part into film.json)
"""
from pathlib import Path
import re

import core
import montage
from prepare_captions import prepare_captions

FROZEN = 6.0  # a picture that stays still this long is frozen (viewers' complaints start about there)
PROOF_HOLD = 4.5  # a chapter's final state stays at least this long to count as shown
# Opus 5.5 list prices relative to its input price ($4 per million tokens), fitted exactly on the scene workers' reported
# costs: Claude Code writes its prompt cache for an hour (twice the input price), reads it at a twentieth
PRICE = {'input_tokens': 1, 'cache_creation_input_tokens': 2, 'cache_read_input_tokens': 0.05, 'output_tokens': 5}
INPUT_USD = 4e-6
DENIED = ('permission for this tool use was denied', 'requires approval', 'tool use rejected by user')


def token_units(usage):
    """A model message's tokens weighted as list prices weigh them (PRICE)."""
    return sum(weight * (usage.get(kind) or 0) for kind, weight in PRICE.items())


def union(intervals):
    merged = []
    for a, b in sorted((a, b) for a, b in intervals if b > a):
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return merged


def empty_states(film, capture):
    """Measured empty intervals, with unknown coverage retained for takes recorded before the DOM probe.

    The probe emits [] for a checked clean screen. Missing/None readings cannot establish an empty-state rate.
    """
    duration = film['duration']
    moments = {a['step']: a['t'] for a in film['actions']} | {a['step']: a['action'] for a in film['anchors']}
    timed = sorted((max(0.0, t), step) for step, t in moments.items() if t < duration)
    steps = {s['step']: s for s in capture.get('steps') or []}
    intervals = []
    if timed:
        intervals.append((0.0, timed[0][0], (steps.get(timed[0][1]) or {}).get('empty')))
        for (t, step), following in zip(timed, timed[1:] + [(duration, None)]):
            intervals.append((t, following[0], (steps.get(step) or {}).get('shows_empty')))
    # A PDF insert has no DOM probe. Its seconds remain unknown, never silently counted as a clean page.
    until = film.get('insert_from') if film.get('insert_from') is not None else duration
    checked = emptied = 0.0
    for start, end, reading in intervals:
        if isinstance(reading, list):
            seconds = max(0.0, min(end, until) - start)
            checked += seconds
            if reading:
                emptied += seconds
    last = (steps.get(timed[-1][1]) or {}).get('shows_empty') if timed else None
    complete = checked >= duration - 0.001 and duration > 0
    return {'empty_state_s': round(emptied, 2) if complete else None,
            'empty_state_observed_s': round(emptied, 2), 'empty_probe_s': round(checked, 2),
            'empty_probe_coverage': round(checked / duration, 3) if duration else 0.0,
            'ends_empty': bool(last) if isinstance(last, list) and until == duration else None}


def chapter(film, spans, captions, capture):
    """One chapter's measures. ``film``: montage.cut; ``spans``: montage.camera's segments; ``captions``: the
    chapter's caption cues in film time (prepare_captions with offset 0)."""
    duration = film['duration']
    pinned = sorted((a['beat'], a['step'], a['action']) for a in film['anchors'] if a.get('beat'))
    starts = film['sentences']
    leaves = montage.leaves(film)  # where the picture leaves each sentence
    upcoming = montage.next_actions(film)  # where the next sentence's own action begins
    over = {'next': 0.0, 'chain': 0.0}
    cues_over = 0
    for cue in captions:
        beat = sum(1 for s in starts if s <= cue['start'] + 0.05) or 1
        # over the next sentence's action (or the cut to it): behind its picture
        following = upcoming[beat - 1] if beat - 1 < len(upcoming) else None
        extra = cue['end'] - max(cue['start'], following) if following is not None else 0.0
        if extra > 0.04:
            over['next'] += extra
            cues_over += 1
        # over steps no sentence names before it (informative: the sentence usually says them)
        if beat in leaves and leaves[beat][1] == 'chain':
            leave = leaves[beat][0]
            chained = min(cue['end'], following if following is not None else cue['end']) - max(cue['start'], leave)
            if chained > 0.04:
                over['chain'] += chained
    proved = max((t for _, _, t in pinned), default=None)
    # still: no page motion on screen, no pointer glide, no camera move
    shown = []
    pieces = film['pieces']
    for (c0, c1, f0) in pieces:
        for a, b in capture.get('active') or []:
            low, high = max(a, c0), min(b, c1)
            if high > low:
                shown.append((f0 + low - c0, f0 + high - c0))
    shown += [(m[0], m[1]) for m in film['pointer']['moves']]
    shown += [(s['start'], s['end'] if s['end'] is not None else duration) for s in spans if 'from' in s]
    motion = union([(max(0.0, a), min(duration, b)) for a, b in shown])
    edges = [0.0] + [x for a, b in motion for x in (a, b)] + [duration]
    stills = [edges[i + 1] - edges[i] for i in range(0, len(edges) - 1, 2)]
    wide = sum((s['end'] if s['end'] is not None else duration) - s['start'] for s in spans
               if 'crop' in s and s['crop'] is None)
    return {'seconds': round(duration, 2),
            'caption_over_next_s': round(over['next'], 2), 'caption_over_chain_s': round(over['chain'], 2),
            'captions_over': cues_over,
            'proof_hold_s': round(duration - proved, 2) if proved is not None else None,
            'frozen_max_s': round(max(stills, default=0.0), 2),
            'frozen_s': round(sum(s for s in stills if s >= FROZEN), 2),
            'wide_share': round(wide / duration, 3) if duration else 0.0,
            'narration_waits_s': round(sum(d for _, d in film['silences']), 2),
            'late_beats': sum(1 for a in film['anchors'] if a['late'] > 0.5), **empty_states(film, capture)}


def captions_of(words, film, speech):
    """The chapter's caption cues in film time, as the render makes them (the voice retimed around its waits)."""
    silences = film['silences']
    return prepare_captions(montage.shifted_srt(words, silences), speech + sum(d for _, d in silences), 0,
                            limits=montage.caption_limits(film))


def summary(chapters):
    """The film's measures from its chapters'."""
    if not chapters:
        return {}
    holds = [c['proof_hold_s'] for c in chapters if c['proof_hold_s'] is not None]
    seconds = sum(c['seconds'] for c in chapters)
    empty_complete = all(c.get('empty_state_s') is not None for c in chapters)
    empty_seconds = sum(c.get('empty_state_s') or 0.0 for c in chapters) if empty_complete else None
    endings_complete = all(c.get('ends_empty') is not None for c in chapters)
    return {'seconds': round(sum(c['seconds'] for c in chapters) + 2 * len(chapters), 1),  # a 2 s card each
            'caption_over_s': round(sum(c['caption_over_next_s'] + c['caption_over_chain_s'] for c in chapters), 1),
            'caption_over_next_s': round(sum(c['caption_over_next_s'] for c in chapters), 1),
            'caption_over_chain_s': round(sum(c['caption_over_chain_s'] for c in chapters), 1),
            'proof_hold_min_s': round(min(holds), 1) if holds else None,
            'proof_held_share': round(sum(h >= PROOF_HOLD for h in holds) / len(holds), 2) if holds else None,
            'frozen_max_s': round(max(c['frozen_max_s'] for c in chapters), 1),
            'frozen_s': round(sum(c['frozen_s'] for c in chapters), 1),
            'wide_share': round(sum(c['wide_share'] * c['seconds'] for c in chapters)
                                / max(1e-6, sum(c['seconds'] for c in chapters)), 3),
            'narration_waits_s': round(sum(c['narration_waits_s'] for c in chapters), 1),
            'late_beats': sum(c['late_beats'] for c in chapters),
            'empty_state_s': round(empty_seconds, 1) if empty_complete else None,
            'empty_share': round(empty_seconds / max(1e-6, seconds), 3) if empty_complete else None,
            'empty_state_observed_s': round(sum(c.get('empty_state_observed_s') or 0.0 for c in chapters), 1),
            'empty_probe_coverage': round(sum(c.get('empty_probe_s') or 0.0 for c in chapters) / max(1e-6, seconds), 3),
            'ends_empty': sum(bool(c['ends_empty']) for c in chapters) if endings_complete else None,
            'ends_empty_observed': sum(bool(c.get('ends_empty')) for c in chapters)}


def seat_usage(run):
    """How much of the Claude subscription's limits went while the scene workers ran (most of a film's use): each
    window's utilization (0–1) in the first and the last rate-limit report of their CLIs, {} without one. A window
    that reset in between (``resets_at`` passed) shows less at the end."""
    reports = sorted(((moment, event['rate_limit_info']) for log in Path(run).glob('gaps/*/worker.log')
                      for moment, event in core.worker_events(log)
                      if moment is not None and event.get('type') == 'rate_limit_event'
                      and isinstance(event.get('rate_limit_info'), dict)),
                     key=lambda report: report[0])  # by time alone: two workers can report at one moment
    if not reports:
        return {}
    windows = lambda info: {name: w for name, w in (info.get('unifiedWindows') or {}).items() if isinstance(w, dict)}
    first, last = windows(reports[0][1]), windows(reports[-1][1])
    return {name: {'from': (first.get(name) or {}).get('utilization'), 'to': last[name].get('utilization'),
                   'resets_at': last[name].get('resetsAt')} for name in sorted(last)}


def worker_costs(run):
    """{scene id: (USD or None, estimated)} of the scene workers: what their answer reports, or for one stopped before
    its answer, an estimate from its streamed messages at the price per token the answered ones paid. A streamed
    message carries its input tokens whole but only the first of its output tokens: a stopped worker's output is
    taken as at least the answered workers' output per message."""
    seen = {}
    for log in Path(run).glob('gaps/*/worker.log'):
        events = [e for _, e in core.worker_events(log)]
        usage = {}  # one per model message (a message streams as several events)
        for event in events:
            message = event.get('message') if event.get('type') == 'assistant' else None
            if isinstance(message, dict) and message.get('usage'):
                usage[message.get('id') or len(usage)] = message['usage']
        result = core.worker_result(log)
        gap = log.parent.name
        seen[gap] = (usage, result)

    def streamed_output(usage):
        return sum(u.get('output_tokens') or 0 for u in usage.values())

    def output(usage, result):
        return (result.get('usage') or {}).get('output_tokens') or streamed_output(usage) if result else streamed_output(usage)

    answered = {gap: (usage, result) for gap, (usage, result) in seen.items() if result}
    messages = sum(len(usage) for usage, _ in answered.values())
    per_message = sum(output(u, r) for u, r in answered.values()) / messages if messages else 0.0

    def units(usage, out):
        return sum(token_units(dict(u, output_tokens=0)) for u in usage.values()) + PRICE['output_tokens'] * out

    paid = sum(result.get('total_cost_usd') or 0.0 for _, result in answered.values())
    counted = sum(units(u, output(u, r)) for u, r in answered.values())
    rate = paid / counted if counted and paid else INPUT_USD
    found = {}
    for gap, (usage, result) in seen.items():
        if result:
            found[gap] = (result.get('total_cost_usd') or 0.0, False)
        elif usage:
            found[gap] = (rate * units(usage, max(streamed_output(usage), per_message * len(usage))), True)
        else:
            found[gap] = (None, False)
    return found


def worker_denials(events):
    """Tool permission refusals, not failed tests or OS file permissions."""
    denied = 0
    for event in events:
        if event.get('type') == 'user':
            for result in (event.get('message') or {}).get('content') or []:
                if isinstance(result, dict) and result.get('type') == 'tool_result' and result.get('is_error') \
                        and any(marker in str(result.get('content')).lower() for marker in DENIED):
                    denied += 1
    return denied


def scenes(run, story):
    """The run's scenes: chosen, passed, in the film, narrated by the chapter writer (stand-ins), passed at their first
    try, tries, commands denied; what their workers cost and the share spent on scenes the film left out."""
    import knowledge  # noqa: PLC0415 (it imports the editor, which imports cut, which imports this module)
    run = Path(run)
    tries = knowledge.scene_tries(core.load(run / 'captures.json', {}) or {})
    shown = {m.group(1) for c in (story or {}).get('chapters') or []
             if (m := re.match(r'gaps/([^/]+)/story\.txt$', (c.get('source') or {}).get('file') or ''))}
    costs = worker_costs(run)
    rows = []
    for folder in sorted(p for p in (run / 'gaps').glob('*/') if (p / 'gap.json').is_file()):
        gap = folder.name
        events = [e for _, e in core.worker_events(folder / 'worker.log')]
        tools = [b for e in events if e.get('type') == 'assistant'
                 for b in (e.get('message') or {}).get('content') or [] if isinstance(b, dict) and b.get('type') == 'tool_use']
        wrote_story = any(str((t.get('input') or {}).get('file_path') or '').endswith('story.txt') for t in tools)
        denied = worker_denials(events)
        own = tries.get(gap) or []
        preflight = folder / 'preflight.jsonl'
        rows.append({'id': gap, 'passed': bool((core.load(folder / 'result.json') or {}).get('ok')),
                     'in_film': gap in shown, 'tries': len(own), 'first_try': bool(own) and own[0][1] == 'passed',
                     'preflight_rejections': len(preflight.read_text().splitlines()) if preflight.is_file() else 0,
                     'stand_in': (folder / 'story.standin').exists() or (bool(tools) and not wrote_story
                                                                        and (folder / 'story.txt').is_file()),
                     'denied': denied, 'usd': round(costs[gap][0], 3) if costs.get(gap) and costs[gap][0] is not None else None})
    spent = sum(r['usd'] or 0.0 for r in rows)
    wasted = sum(r['usd'] or 0.0 for r in rows if not r['in_film'])
    unpriced = sum(r['usd'] is None for r in rows)
    wasted_unpriced = any(r['usd'] is None and not r['in_film'] for r in rows)
    passed = [r for r in rows if r['passed']]
    return {'chosen': len(rows), 'passed': len(passed), 'in_film': sum(r['in_film'] for r in rows),
            'first_try': sum(r['first_try'] for r in rows), 'stand_ins': sum(r['stand_in'] for r in rows),
            'denied': sum(r['denied'] for r in rows), 'tries': sum(r['tries'] for r in rows),
            'preflight_rejections': sum(r['preflight_rejections'] for r in rows),
            'usd_workers': None if unpriced else round(spent, 2), 'usd_workers_known': round(spent, 2),
            'workers_unpriced': unpriced, 'usd_wasted': None if wasted_unpriced else round(wasted, 2),
            'usd_wasted_known': round(wasted, 2),
            'wasted_share': None if unpriced else round(wasted / spent, 2) if spent else 0.0, 'scenes': rows}
