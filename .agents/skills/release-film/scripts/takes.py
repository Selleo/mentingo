#!/usr/bin/env python3
"""A Playwright demo capture (frames, stills, actions, page log) as a take: take.mp4 and capture.json.

The take is built on the wall clock: frame k of take.mp4 shows the page at capture time k/30 s (capture time 0 is the
first recorded moment), so the timeline is exact. Where the page stands still, the still taken before the next action
replaces the screencast frame: the holds the film spends most of its time in show the page as it was at that moment.
"""
import argparse
import fcntl
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import core  # noqa: E402
import montage  # noqa: E402

FPS = 30
MOTION_LEVEL = 12  # grey levels a pixel must change by to count as page motion (encoder noise stays below)
BLANK_DETAIL = 0.003  # a frame this plain shows no page (a load paints white)
DETAIL_TABLES = {}
CLICKS = {'click', 'dblclick', 'check', 'uncheck', 'tap', 'setChecked', 'selectOption'}
NAVIGATIONS = {'goto', 'reload', 'goBack'}
LOOK = 'look'  # a check that passed: no pointer, a still of the state it proves
READABLE = re.compile(r'getBy(Role|Text|Label|Placeholder|AltText|Title)\(')  # locators that already say what is read


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def sources(capture_dir, frames, actions, pages):
    """Every image in time order: (ms, file, is_still), from the page the test acts on at that moment only: a test
    with several windows (an admin and a learner) shows each from its first action on until the next window's, never
    one window repainting behind the other."""
    items = [(f['t'], f['file'], False) for f in frames]
    items += [(a['still_t'], a['still'], True) for a in actions if a.get('still') and a.get('still_t')]
    items += [(p['still_t'], p['still'], True) for p in pages if p.get('still') and p.get('still_t')]
    items = [i for i in items if (Path(capture_dir) / i[1]).is_file()]
    page_of = {f['file']: f.get('page') for f in frames}
    page_of.update({a['still']: a.get('page') for a in actions if a.get('still')})
    page_of.update({p['still']: p.get('page') for p in pages if p.get('still')})
    switches = acting_pages(actions)
    if len({page for _, page in switches}) > 1:
        items = [i for i in items if page_of.get(i[1]) is None or page_of[i[1]] == page_at(switches, i[0])]
    return sorted(items, key=lambda i: (i[0], i[2]))


def entered(action):
    """When an action's page comes on screen: its still before the action, or the action itself."""
    return min(action['m'], action.get('still_t') or action['m'])


def acting_pages(actions):
    """[(ms, page)]: when the test starts acting on another page (window)."""
    switches = []
    for action in actions:
        page = action.get('page')
        if page is not None and (not switches or switches[-1][1] != page):
            switches.append((entered(action), page))
    return switches


def page_at(switches, moment):
    """The page the test acts on at ``moment`` (the first one before any action)."""
    current = switches[0][1] if switches else None
    for when, page in switches:
        if when > moment:
            break
        current = page
    return current


def jpeg_size(path):
    """(width, height) of a JPEG from its frame header, or None."""
    try:
        data = Path(path).read_bytes()[:131072]
    except OSError:
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            return int.from_bytes(data[i + 7:i + 9], 'big'), int.from_bytes(data[i + 5:i + 7], 'big')
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        i += 2 + int.from_bytes(data[i + 2:i + 4], 'big')
    return None


def regular_frames(capture_dir, items):
    """The screencast frames of the size most frames have: one the screencast sent at another scale would be
    stretched into a broken picture ("ustomer" on white), so the frame before it stays up instead."""
    folder = Path(capture_dir)
    sizes = {file: jpeg_size(folder / file) for _, file, still in items if not still}
    counted = {}
    for size in sizes.values():
        if size:
            counted[size] = counted.get(size, 0) + 1
    if not counted:
        return items
    common = max(counted, key=counted.get)
    return [item for item in items if item[2] or sizes.get(item[1]) == common]


GLITCH = 24  # mean brightness difference (0-255, on 32x18 thumbnails) that makes a lone frame a flash


def flashes(capture_dir, items, ffmpeg):
    """Screencast frames that flash for one frame: far from both neighbours while the neighbours match (the screencast
    now and then sends one frame of a zoomed page fragment). The frame before stays up instead."""
    folder = Path(capture_dir)
    frames = [file for _, file, still in items if not still]
    pages = {}
    for file in frames:
        pages.setdefault(Path(file).name.split('-')[0], []).append(file)
    bad = set()
    for page, files in pages.items():
        files = sorted(files)
        if len(files) < 3:
            continue
        out = subprocess.run([ffmpeg, '-v', 'error', '-start_number', '0', '-i', str(folder / 'frames' / f'{page}-%06d.jpg'),
                              '-vf', 'scale=32:18,format=gray', '-f', 'rawvideo', '-'], capture_output=True, timeout=300).stdout
        thumbs = [out[i:i + 576] for i in range(0, len(out) - 575, 576)]
        by_name = {f'frames/{page}-{index:06d}.jpg': thumb for index, thumb in enumerate(thumbs)}
        ordered = [(f, by_name.get(f)) for f in files]
        diff = lambda a, b: sum(abs(x - y) for x, y in zip(a, b)) / 576
        for (_, before), (file, here), (_, after) in zip(ordered, ordered[1:], ordered[2:]):
            if not (before and here and after):
                continue
            away, back, around = diff(before, here), diff(here, after), diff(before, after)
            # a big flash between similar neighbours, or any clear one between identical neighbours (a near-white
            # page shows a zoomed fragment with less difference, but the page does not change back to the very frame)
            if (away > GLITCH and back > GLITCH and around < GLITCH / 3) or (around < 0.5 and away > 4 and back > 4):
                bad.add(file)
    return bad


def upscale_frames(capture_dir, items, ffmpeg, size):
    """Screencast frames at the stills' size, one ffmpeg pass per page: concat then sees images of one size. The camera
    takes its stills in CSS pixels, the very pictures of its frames, so frames of that size are used as they are:
    scaled or encoded again, they drew the text a little differently from the still beside them, and the text flickered
    where the take switched between them. Only captures made before (stills in device pixels) are scaled up."""
    folder = Path(capture_dir)
    pages = sorted({Path(file).name.split('-')[0] for _, file, still in items if not still})
    scaled = set()
    for page in pages:
        first = next(file for _, file, still in items if not still and Path(file).name.split('-')[0] == page)
        if jpeg_size(folder / first) == tuple(size):
            continue
        (folder / 'frames-hd').mkdir(exist_ok=True)
        subprocess.run([ffmpeg, '-v', 'error', '-y', '-start_number', '0', '-i', str(folder / 'frames' / f'{page}-%06d.jpg'),
                        '-vf', f'scale={size[0]}:{size[1]}:flags=lanczos', '-q:v', '3', '-start_number', '0',
                        str(folder / 'frames-hd' / f'{page}-%06d.jpg')], check=True, timeout=900)
        scaled.add(page)
    return [(t, file.replace('frames/', 'frames-hd/', 1) if not still and Path(file).name.split('-')[0] in scaled else file,
             still) for t, file, still in items]


TAKE_SIZE = (1600, 900)  # a take with no image of a readable size: the film's viewport


def still_size(capture_dir, items):
    """The take's size: the stills' (the one most have), which frames of another size are scaled to (the concat of
    images of two sizes stops at the first of the other one); a take without stills keeps its frames' size."""
    for stills in (True, False):
        counted = {}
        for _, file, still in items:
            size = jpeg_size(Path(capture_dir) / file) if still == stills else None
            if size:
                counted[size] = counted.get(size, 0) + 1
        if counted:
            return max(counted, key=counted.get)
    return TAKE_SIZE


def build_video(capture_dir, items, t0, end, out, ffmpeg='ffmpeg', size=None):
    """take.mp4 at FPS on the wall clock: each image shown until the next one (the last until ``end``), at the stills'
    size (``size``, else still_size)."""
    size = size or still_size(capture_dir, items)
    items = regular_frames(capture_dir, items)
    dropped = flashes(capture_dir, items, ffmpeg)
    items = upscale_frames(capture_dir, [i for i in items if i[1] not in dropped], ffmpeg, size)
    with tempfile.TemporaryDirectory(prefix='take-') as scratch:
        listing = Path(scratch) / 'list.txt'
        lines = []
        for (t, file, _), nxt in zip(items, items[1:] + [(end, None, None)]):
            duration = max(0.0, (min(nxt[0], end) - max(t, t0)) / 1000)
            if duration <= 0:
                continue
            lines.append(f"file '{(Path(capture_dir) / file).resolve()}'\nduration {duration:.4f}")
        lines.append(f"file '{(Path(capture_dir) / items[-1][1]).resolve()}'")  # concat needs the last file twice
        listing.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        start = (items[0][0] - t0) / 1000
        pad = f'tpad=start_duration={start:.3f}:start_mode=clone,' if start > 0 else ''
        cmd = [ffmpeg, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing), '-t', f'{(end - t0) / 1000:.3f}',
               '-vf', f'{pad}fps={FPS},format=yuv420p',
               '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-g', str(FPS * 2), '-movflags', '+faststart', str(out)]
        subprocess.run(cmd, check=True, timeout=900)


def page_detail(frame):
    """Share of a grey page image's pixels that differ from its median grey by more than 12 levels (~0 blank)."""
    sample = sorted(frame[::7])
    median = sample[len(sample) // 2] if sample else 0
    table = DETAIL_TABLES.get(median)
    if table is None:
        table = DETAIL_TABLES[median] = bytes(0 if abs(v - median) <= 12 else 1 for v in range(256))
    return frame.translate(table).count(1) / max(len(frame), 1)


def analyse(take, masks, ffmpeg, viewport=(1600, 900)):
    """Per frame of the take: page detail (blank pages) and the share of pixels (at 640x360) that changed by more
    than MOTION_LEVEL since the previous frame; ambient regions (``masks``, CSS pixels) left out of the motion."""
    sx, sy = 640 / viewport[0], 360 / viewport[1]
    hide = ''.join(f'drawbox=x={int(x * sx) - 2}:y={int(y * sy) - 2}:w={int(w * sx) + 4}:h={int(h * sy) + 4}:color=black:t=fill,'
                   for x, y, w, h in masks or ())
    with tempfile.TemporaryDirectory(prefix='take-motion-') as scratch:
        stats = Path(scratch) / 'motion.txt'
        graph = (f'[0:v]fps={FPS},split=2[p][c];[p]scale=256:144:flags=area,format=gray[d];'
                 f'[c]scale=640:360:flags=area,format=gray,{hide}tpad=start=1:start_mode=clone,tblend=all_mode=difference,'
                 f"lut=y='if(gt(val,{MOTION_LEVEL}),255,0)',signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file={stats},nullsink")
        raw = subprocess.run([ffmpeg, '-v', 'error', '-i', str(take), '-filter_complex', graph, '-map', '[d]', '-f', 'rawvideo', '-'],
                             capture_output=True, check=True, timeout=900).stdout
        text = stats.read_text(encoding='utf-8') if stats.exists() else ''
    size = 256 * 144
    details = [page_detail(raw[i:i + size]) for i in range(0, len(raw) - size + 1, size)]
    motion = [float(line.split('=', 1)[1]) / 255 for line in text.splitlines() if 'signalstats.YAVG=' in line]
    return details, motion


def probe_seconds(probe, t0):
    if not isinstance(probe, dict):
        return None
    probe = dict(probe)
    if isinstance(probe.get('t'), (int, float)):
        probe['t'] = round((probe['t'] - t0) / 1000, 3)
    probe['changes'] = [[round((c[0] - t0) / 1000, 3), *c[1:]] for c in probe.get('changes') or []]
    return probe


def action_line(action, before=None):
    """One line the writer reads: id, kind, target, what was typed or chosen, what a passed check proves, and the
    text the viewer can read where it changed since the previous line."""
    target = (action.get('target') or '')[:150]
    if action['kind'] == LOOK:
        expect = action.get('expect') or {}
        what = (expect.get('expression') or '').replace('to.', '').replace('.', ' ')
        line = f"{action['id']} look{' NOT' if expect.get('not') else ''} {what}: {target}"
        if expect.get('expected'):
            line += ' expects ' + '; '.join(f'"{e}"' for e in expect['expected'])
    else:
        line = f"{action['id']} {action['kind']} {target}"
        if action.get('value'):
            line += f' = "{action["value"]}"'
    text, before = action.get('text') or {}, before or {}
    if text.get('target') and not READABLE.search(target):  # a test id or CSS locator: say what the element reads
        line += f' [text "{text["target"]}"]'
    seen = []
    for key in ('dialog', 'toasts', 'headings'):
        value = text.get(key)
        if value and value != before.get(key):
            seen.append(f'{key} ' + '; '.join(f'"{v}"' for v in (value if isinstance(value, list) else [value])))
    if seen:
        line += ' | on screen: ' + ', '.join(seen)
    if text.get('empty'):  # the screen it starts on shows nothing of a change
        line += ' | empty on screen: ' + '; '.join(f'"{e}"' for e in text['empty'])
    return line + f" @ {urlparse(action.get('url') or '').path or '/'}"


PDF_TEXT_MAC = ('function run(argv) { ObjC.import("PDFKit"); '  # macOS's own PDFKit, through JavaScript for Automation
                'const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0])); '
                'return doc && doc.pageCount > 0 ? ObjC.unwrap(doc.pageAtIndex(0).string) || "" : ""; }')


def pdf_text(path, limit=160):
    """The start of a PDF's first page as plain text ('' without pdftotext or text; macOS without poppler reads it with
    PDFKit)."""
    tool = shutil.which('pdftotext')
    if tool:
        cmd = [tool, '-f', '1', '-l', '1', '-layout', str(path), '-']
    elif core.DARWIN and shutil.which('osascript'):
        cmd = ['osascript', '-l', 'JavaScript', '-e', PDF_TEXT_MAC, str(path)]
    else:
        return ''
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30).stdout
    except subprocess.TimeoutExpired:
        return ''
    return re.sub(r'\s+', ' ', out).strip()[:limit]


def documents(capture_dir, log, count):
    """The PDFs the test downloaded: [{'name', 'file', 'step' (the action it followed), 'text' (page 1's start)}]."""
    found = []
    for item in log.get('downloads') or []:
        path = Path(capture_dir) / item['file']
        if path.suffix.lower() == '.pdf' and path.is_file() and 0 <= item.get('after', -1) < count:
            found.append({'name': item['name'], 'file': str(path), 'step': item['after'], 'text': pdf_text(path)})
    return found


def capture_record(capture_dir, t0, end, actions, pages, log, details=(), motion=(), size=TAKE_SIZE):
    s = lambda ms: round((ms - t0) / 1000, 3)
    resized = next((i for i, a in enumerate(actions) if a['kind'] == 'setViewportSize'), None)
    if resized is not None:  # the page changes size (a phone view): the film ends before the frames change shape
        end = min(end, actions[resized].get('m') or end)
        actions = actions[:resized]
    steps, changes = [], []
    for index, action in enumerate(actions):
        look = action['kind'] == LOOK
        nxt = actions[index + 1] if index + 1 < len(actions) else None
        # a check right after an action does not end the page's answer to it: the next action does
        answer_end = next((a for a in actions[index + 1:] if a['kind'] != LOOK), None) if not look else nxt
        box = action.get('box') if isinstance(action.get('box'), dict) else None
        point = [round(box['x'] + box['width'] / 2, 1), round(box['y'] + box['height'] / 2, 1)] if box and not look else None
        pre, post = probe_seconds(action.get('pre'), t0), probe_seconds(action.get('post'), t0)
        for probe in (pre, post):
            changes += [tuple(c) for c in (probe or {}).pop('changes', [])]
        navigate = action['kind'] in NAVIGATIONS
        steps.append({'step': index, 'cmd': [action['kind'], action.get('target', '')], 'acting': not navigate and not look,
                      'click': action['kind'] in CLICKS and point is not None, 'navigate': navigate, 'look': look,
                      'scroll': False, 'w': s(actions[index - 1]['a']) if index else s(action['m']), 'm': s(action['m']),
                      'a': s(action['a']),
                      'b': s((answer_end.get('still_t') or answer_end['m'])) if answer_end else s(end), 'point': point,
                      'pre': pre, 'post': post, 'url': action.get('url'), 'error': action.get('error'),
                      'value': action.get('value'), 'expect': action.get('expect'), 'text': action.get('text'),
                      'box': box if look else None,  # a check's box: the camera frames the state it proves
                      'page': action.get('page'), 'enter': s(entered(action)) if action.get('m') else None,
                      'section': action.get('step'),  # the test.step block it ran in
                      'empty': (action.get('text') or {}).get('empty')})  # an empty state on screen before it
    # what each step leaves on screen: the empty state the next action in its window starts on, or where that window
    # ends (another window's next action starts on that window's page, not on this one)
    final = next((p.get('text') for p in pages if p.get('page') == (actions[-1].get('page') if actions else None)), None) or {}
    closed = {p.get('page'): p.get('text') or {} for p in pages}
    for index, step in enumerate(steps):
        later = next((s for s in steps[index + 1:] if s.get('page') == step.get('page')), None)
        if later is not None:
            step['shows_empty'] = later['empty']
        elif index + 1 == len(steps):
            step['shows_empty'] = final.get('empty')
        else:  # a window the scene leaves for good: where it ends (unknown there: the next action's, as before)
            closing = (closed.get(step.get('page')) or {}).get('empty')
            step['shows_empty'] = closing if closing is not None else steps[index + 1]['empty']
    for index, step in enumerate(steps):  # the message an action brought up (read at a later check or action): its box
        if not step['acting']:
            continue
        seen = set((step.get('text') or {}).get('toasts') or [])
        for later in steps[index + 1:]:
            text = later.get('text') or {}
            if text.get('toastBox') and any(t not in seen for t in text.get('toasts') or []):
                step['toast'] = text['toastBox']
                break
            if later['acting'] or later['navigate']:
                break
    loading = [(s(a), s(b)) for p in pages for a, b in p.get('loading') or [] if b and b > a]
    routes = sorted((s(t), url) for p in pages for t, url in p.get('routes') or [])
    stills = sorted(s(a['still_t']) for a in actions if a.get('still_t'))
    timeline = [(round(k / FPS, 4), round(k / FPS, 4)) for k in range(int(s(end) * FPS) + 1)]
    lines = [action_line(a, actions[i - 1].get('text') if i else None) for i, a in enumerate(actions)]
    docs = documents(capture_dir, log, len(actions))
    for doc in docs:  # the writer reads what the downloaded document says: the film shows its first page
        lines[doc['step']] += f' | downloads "{doc["name"]}"' + (f' (page 1: "{doc["text"]}")' if doc['text'] else '')
    if final.get('empty'):
        lines.append(f'(the test ends) | empty on screen: ' + '; '.join(f'"{e}"' for e in final['empty']))
    return {'take': str(Path(capture_dir) / 'take.mp4'), 'scale': round(size[0] / (log.get('viewport') or {}).get('width', 1600), 3),
            'start': 0.0, 'end': s(end), 'timeline': timeline,
            'active': montage.frame_spans([m > montage.ACTIVE_THRESHOLD for m in motion], timeline, pad=montage.ACTIVE_PAD),
            'blank': montage.frame_spans(montage.empty_frames(list(details), BLANK_DETAIL), timeline),
            'steps': steps, 'changes': sorted(changes), 'loading': loading, 'routes': routes, 'stills': stills,
            'actions_text': lines, 'documents': docs,
            'ambient': [box for p in pages for box in p.get('ambient') or []], 'status': log.get('status'), 'title': log.get('title')}


def converted(folder):
    """Whether a capture folder already has its take and the video analysis (convert with video)."""
    path = Path(folder) / 'capture.json'
    record = load(path) if path.is_file() else {}
    take = record.get('take')
    return bool(take) and Path(take).is_file() and (Path(folder) / 'capture.json').stat().st_mtime >= Path(take).stat().st_mtime


def convert(folder, ffmpeg='ffmpeg', video=True):
    """capture.json (and take.mp4 with its motion and blank analysis when ``video``) in a capture folder. One conversion
    of a folder at a time (a scene's early check and the review's pauses both want its take): a second one waits, and
    finds the take made."""
    folder = Path(folder)
    with open(folder / '.convert.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if video and converted(folder):
            record = load(folder / 'capture.json')
            return {'take': record['take'], 'seconds': record['end'], 'steps': len(record['steps']),
                    'stills': len(record.get('stills') or []), 'frames': len(load(folder / 'frames.json') or [])}
        return _convert(folder, ffmpeg, video)


def _convert(folder, ffmpeg, video):
    frames, actions, log = load(folder / 'frames.json'), load(folder / 'actions.json'), load(folder / 'page-log.json')
    pages = log.get('pages') or []
    items = sources(folder, frames, actions, pages)
    if not items:
        raise ValueError('no frames captured')
    t0 = min([items[0][0]] + [a['m'] for a in actions if a.get('m')])
    end = max([log.get('end') or items[-1][0], items[-1][0]])
    details = motion = ()
    size = still_size(folder, items)  # the take's pixels per CSS pixel follow the stills'
    if video:
        build_video(folder, items, t0, end, folder / 'take.mp4', ffmpeg, size)
        viewport = log.get('viewport') or {}
        details, motion = analyse(folder / 'take.mp4', [b for p in pages for b in p.get('ambient') or []], ffmpeg,
                                  (viewport.get('width', 1600), viewport.get('height', 900)))
    record = capture_record(folder, t0, end, actions, pages, log, details, motion, size)
    if not video:
        record['take'] = None
    core.save(folder / 'capture.json', record)  # whole or not at all: the review and scene checks read it meanwhile
    return {'take': record['take'], 'seconds': record['end'], 'steps': len(record['steps']),
            'stills': len(record['stills']), 'frames': len(frames)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('capture_dir')
    parser.add_argument('--ffmpeg', default='ffmpeg')
    args = parser.parse_args()
    try:
        print(json.dumps(convert(args.capture_dir, args.ffmpeg)))
    except ValueError as error:
        sys.exit(str(error))


if __name__ == '__main__':
    main()
