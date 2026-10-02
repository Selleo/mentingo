#!/usr/bin/env python3
"""Render the film from an editing plan; Python 3 + FFmpeg/ffprobe with drawtext.

A chapter is a title card, the chapter's footage and, optionally, a real still (a downloaded PDF page). Footage is
rendered in one pass over its take: the frames the montage keeps, re-timed to the film (a frame stays until the next
one, so still pages hold), and a drawn pointer that glides and clicks over the whole page. Rendered segments are
cached by content, so a changed chapter renders alone.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile
import time
import zlib

from prepare_captions import prepare_captions

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"
FILTERS = ('drawtext', 'overlay', 'select', 'pad', 'fade', 'tpad', 'atrim', 'adelay', 'apad')
ENCODERS = ('libx264', 'aac', 'libmp3lame')  # libmp3lame: the narration paced (cut.paced)
FRAME = 1 / 30
OUTPUT = (1564, 880)  # a 16:9 view in the 1840x880 picture area of the graphite frame
CLICK_SECONDS = 0.3  # the click ring stays this long
ENDING = 0.8  # the film's last picture and sound fade out this long, to the card's ground (the film ends, not stops)
POINTER_HOTSPOT = (18, 18)  # CSS pixels of the pointer image where the arrow's tip is
# the film's colours: ``frame``, the ground of its cards, the band around the picture and the labels' tabs; ``accent``,
# the bars, the step labels' marks and the key caps. A project's brand may set either (a plan's ``colors``, #rrggbb).
COLORS = {'frame': '0x2f3033', 'accent': '0xff6d2a'}


def colors_of(value):
    """The plan's colours for FFmpeg ('0xrrggbb'), COLORS where it sets none: {'frame': '#222949', 'accent': …}."""
    if value is None:
        return dict(COLORS)
    if not isinstance(value, dict) or set(value) - set(COLORS):
        raise ValueError(f'colors may set only {sorted(COLORS)}')
    found = dict(COLORS)
    for key, color in value.items():
        if not isinstance(color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color):
            raise ValueError(f'colors.{key} must be a #rrggbb colour')
        found[key] = '0x' + color[1:].lower()
    return found


def run(args, cwd=None, timeout=1800):
    args = list(args)
    if args[0] == 'ffmpeg':
        args[0] = FFMPEG
    elif args[0] == 'ffprobe':
        args[0] = FFPROBE
    result = subprocess.run([str(x) for x in args], capture_output=True, text=True, cwd=cwd, timeout=timeout)
    if result.returncode:
        raise ValueError(f'{args[0]} failed: {result.stderr[-3000:]}')
    return result.stdout


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]))


def number(value, name, low=0, high=86400):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f'{name} must be finite in [{low}, {high}]')
    return float(value)


def fields(obj, allowed, required):
    if not isinstance(obj, dict) or set(obj) - set(allowed) or set(required) - set(obj):
        raise ValueError(f'Expected fields {required}; allowed {allowed}')


def checked_crop(crop, frame):
    if not isinstance(crop, list) or len(crop) != 4 or any(type(v) is not int for v in crop):
        raise ValueError('crop must be integer [x,y,width,height]')
    x, y, w, h = crop
    if min(x, y) < 0 or min(w, h) < 2 or x + w > frame[0] or y + h > frame[1]:
        raise ValueError('crop outside capture')
    return crop


def footage_segment(footage, source, info):
    """Validate a footage clip against its take."""
    fields(footage, ['source', 'duration', 'pieces', 'camera', 'pointer', 'scale', 'labels', 'keys'],
           ['source', 'duration', 'pieces', 'camera', 'pointer'])
    video = next((s for s in info['streams'] if s['codec_type'] == 'video'), None)
    if not video:
        raise ValueError('Capture has no video stream')
    frame = [video['width'], video['height']]
    take = float(info['format']['duration'])
    duration = number(footage['duration'], 'footage duration', 0.5, 600)
    pieces, last = [], -1.0
    if not isinstance(footage['pieces'], list) or not footage['pieces']:
        raise ValueError('Footage needs pieces of its take')
    for piece in footage['pieces']:
        if not isinstance(piece, list) or len(piece) != 3:
            raise ValueError('A piece is [video start, video end, film start]')
        v0, v1, f0 = (number(v, 'piece time', 0, max(take + 1, duration + 1)) for v in piece)
        if v1 <= v0 or v0 > take + FRAME or f0 <= last - 1e-6 or f0 > duration:
            raise ValueError('Pieces must lie in the take, in film order')
        pieces.append([v0, v1, f0])
        last = f0
    if len(footage['camera']) != 1 or 'crop' not in footage['camera'][0]:
        raise ValueError('Footage shows one framing throughout: the whole page')
    fields(footage['camera'][0], ['start', 'end', 'crop'], ['crop'])
    crop = checked_crop(footage['camera'][0]['crop'], frame)
    pointer = footage['pointer']
    fields(pointer, ['start', 'moves', 'clicks'], ['start', 'moves', 'clicks'])
    for move in pointer['moves']:
        if not isinstance(move, list) or len(move) != 6 or move[1] <= move[0]:
            raise ValueError('A pointer move is [start, end, x0, y0, x1, y1] with end after start')
        for value in move:
            number(value, 'pointer move', -1, 10000)
    for click in pointer['clicks']:
        number(click, 'click time', 0, 600)
    labels = []
    for label in footage.get('labels') or []:  # a transition the picture cannot show: [start, end, text]
        if not isinstance(label, list) or len(label) != 3 or not isinstance(label[2], str) or not label[2].strip() \
                or len(label[2]) > 40 or '\n' in label[2]:
            raise ValueError('A label is [start, end, one line of at most 40 characters]')
        start, end = number(label[0], 'label start', 0, duration), number(label[1], 'label end', 0, duration)
        if end <= start:
            raise ValueError('A label needs an end after its start')
        labels.append([start, end, label[2]])
    keys = []
    for key in footage.get('keys') or []:  # a key the user pressed: [start, end, its name]
        if not isinstance(key, list) or len(key) != 3 or not isinstance(key[2], str) or not key[2].strip() \
                or len(key[2]) > 30 or '\n' in key[2]:
            raise ValueError('A key is [start, end, its name in one line of at most 30 characters]')
        start, end = number(key[0], 'key start', 0, duration), number(key[1], 'key end', 0, duration)
        if end <= start:
            raise ValueError('A key needs an end after its start')
        keys.append([start, end, key[2]])
    return dict(kind='footage', source=source, pieces=pieces, crop=crop, frame=frame,
                pointer={'start': list(pointer['start']), 'moves': pointer['moves'], 'clicks': pointer['clicks']},
                scale=number(footage.get('scale', 1), 'capture scale', 0.1, 3), footage_duration=duration,
                **({'labels': labels} if labels else {}), **({'keys': keys} if keys else {}))


def load_plan(path, enforce_duration=True, strict=True):
    """The checked plan. Not ``strict``: a long unnarrated tail and result images over a fifth of the film are
    warnings (the plan's ``warnings``), not failures: a whole film is not lost at its very end for them."""
    path = Path(path).resolve()
    warnings = []
    data = json.loads(path.read_text())
    fields(data, ['font', 'chapters', 'language', 'colors'], ['font', 'chapters'])
    colors = colors_of(data.get('colors'))
    def asset(name):
        if not isinstance(name, str) or not name:
            raise ValueError('Input path must be a nonempty string')
        p = (path.parent / name).resolve()
        if not p.is_file():
            raise ValueError(f'Missing input: {p}')
        return p
    probe_cache = {}
    def input_probe(source):
        if source not in probe_cache:
            probe_cache[source] = probe(source)
        return probe_cache[source]
    font = asset(data['font'])
    if not isinstance(data['chapters'], list) or not 1 <= len(data['chapters']) <= 20:
        raise ValueError('Expected 1–20 chapters')
    segments, captions, steps, chapters, cursor, held = [], [], [], [], 0.0, 0.0
    for chapter in data['chapters']:
        fields(chapter, ['title', 'prs', 'audio', 'audio_offset', 'clips', 'captions', 'review_points', 'steps'], ['title', 'prs', 'audio', 'clips', 'captions'])
        title = chapter['title']
        if not isinstance(title, str) or not title.strip() or '\n' in title or len(title) > 85:
            raise ValueError('Chapter title must be one nonempty line, at most 85 characters')
        if not isinstance(chapter['prs'], list) or not chapter['prs'] or any(not isinstance(p, str) or not p.startswith('https://github.com/') or '/pull/' not in p for p in chapter['prs']):
            raise ValueError('Each chapter needs real GitHub PR URLs')
        audio = asset(chapter['audio'])
        audio_info = input_probe(audio)
        if not any(s['codec_type'] == 'audio' for s in audio_info['streams']):
            raise ValueError('Narration has no audio stream')
        audio_duration = number(float(audio_info['format']['duration']), 'audio duration', .01)
        offset = number(chapter.get('audio_offset', 2), 'audio_offset', 0, 2)
        start = cursor
        segments.append(dict(kind='card', title=title, start=cursor, duration=2))
        cursor += 2
        if not isinstance(chapter['clips'], list) or not chapter['clips']:
            raise ValueError('Chapter needs actual capture intervals')
        for clip in chapter['clips']:
            if 'footage' in clip:
                fields(clip, ['footage'], ['footage'])
                source = asset(clip['footage'].get('source'))
                segment = footage_segment(clip['footage'], source, input_probe(source))
                duration = segment['footage_duration']
            else:
                fields(clip, ['image', 'duration', 'evidence'], ['image', 'duration', 'evidence'])
                source = asset(clip['image'])
                if not isinstance(clip.get('evidence'), str) or not clip['evidence'].strip():
                    raise ValueError('Real result image needs provenance evidence and duration')
                image_info = input_probe(source)
                if not any(s["codec_type"] == "video" and s["codec_name"] in ("png", "mjpeg", "webp") for s in image_info["streams"]):
                    raise ValueError("Expected a real PNG, JPEG or WebP result image")
                duration = number(clip.get('duration'), 'image duration', .5, 6)
                held += duration
                segment = dict(kind='image', source=source, evidence=clip['evidence'])
            duration = round(duration * 30) / 30
            segment.update(start=cursor, duration=duration)
            segments.append(segment)
            cursor += duration
        chapter_duration = cursor - start
        if offset + audio_duration > chapter_duration + .04:
            raise ValueError('Narration exceeds chapter; add meaningful footage, not padding')
        if chapter_duration - offset - audio_duration > 10:
            if strict:
                raise ValueError('More than 10 seconds of unnarrated chapter tail')
            warnings.append(f'chapter {len(chapters) + 1}: {chapter_duration - offset - audio_duration:.1f} s without narration at its end')
        if not isinstance(chapter['captions'], list) or not chapter['captions']:
            raise ValueError('Narration needs timed captions')
        previous = 0
        for cue in chapter['captions']:
            fields(cue, ['start', 'end', 'text'], ['start', 'end', 'text'])
            a = number(cue['start'], 'caption start', offset, offset+audio_duration)
            b = number(cue['end'], 'caption end', 0, min(chapter_duration, offset+audio_duration+.04))
            text = cue['text']
            if b <= a or a < previous or not isinstance(text, str) or not text.strip():
                raise ValueError('Captions must be nonempty, ordered, nonoverlapping intervals')
            lines = text.split('\n')
            if len(lines) > 2 or any(not line.strip() or len(line) > 40 for line in lines):
                raise ValueError('Caption exceeds two lines or 40 characters per line at 44px; split cue')
            captions.append(dict(start=start+a, end=start+b, text=text))
            previous = b
        marks = chapter.get('steps') or []
        for index, mark in enumerate(marks):  # the bottom bar: [start in chapter time, its text], until the next one
            if not isinstance(mark, list) or len(mark) != 2 or not isinstance(mark[1], str) or not mark[1].strip() \
                    or len(mark[1]) > STEP_MOST or '\n' in mark[1]:
                raise ValueError(f'A step label is [start, its text: at most {STEP_MOST} characters, no line breaks]')
            a = number(mark[0], 'step start', 0, chapter_duration)
            b = number(marks[index + 1][0], 'step start', 0, chapter_duration) if index + 1 < len(marks) else chapter_duration
            if b <= a:
                raise ValueError('Step labels must be ordered in their chapter')
            steps.append(dict(start=start + a, end=start + b, text=mark[1]))
        points = chapter.get('review_points', {})
        fields(points, ['action', 'result'], [])
        for label, value in points.items():
            number(value, f'review {label}', 2, chapter_duration - 1/30)
        chapters.append(dict(review_points=points, title=title, prs=chapter['prs'], start=start, duration=chapter_duration, audio=audio, audio_offset=offset, audio_duration=audio_duration))
    if held > cursor * .2:
        if strict:
            raise ValueError('Result images exceed 20% of film')
        warnings.append(f'result images take {held / cursor:.0%} of the film')
    if enforce_duration and not 180 <= cursor <= 300:
        raise ValueError(f'Meaningful story must last 180–300 seconds; planned {cursor:.3f}')
    return dict(font=font, segments=segments, captions=captions, steps=steps, chapters=chapters, duration=cursor,
                warnings=warnings, language=data.get('language') or 'pl', colors=colors)


def lacks(ffmpeg):
    """The filters and encoders the film needs that this FFmpeg lacks (Homebrew's plain ffmpeg has no drawtext)."""
    try:
        filters = subprocess.run([ffmpeg, '-hide_banner', '-filters'], capture_output=True, text=True, timeout=60).stdout
        encoders = subprocess.run([ffmpeg, '-hide_banner', '-encoders'], capture_output=True, text=True, timeout=60).stdout
    except (OSError, subprocess.TimeoutExpired):
        return list(FILTERS + ENCODERS)
    return [name for name in FILTERS if name not in filters] + [name for name in ENCODERS if name not in encoders]


def capabilities():
    for command in [FFMPEG, FFPROBE]:
        if not shutil.which(command):
            raise ValueError(f'Missing {command}')
    missing = lacks(FFMPEG)
    if missing:
        raise ValueError(f'FFmpeg lacks {missing[0]}')


def card_lines(text, width=34):
    """A card title in one line, or two balanced at a space when it is long (a long single line gets tiny letters)."""
    if len(text) <= width:
        return [text]
    spaces = [i for i, c in enumerate(text) if c == ' ']
    if not spaces:
        return [text]
    cut = min(spaces, key=lambda i: abs(i - len(text) / 2))
    return [text[:cut].strip(), text[cut:].strip()]


LOOKALIKES = str.maketrans({'×': 'x', '−': '-', '′': "'", '″': '"'})  # written as their ASCII twins on cards and
# captions: a brand font often lacks them, and one such sign used to cost the whole film its brand font


def text_filter(path, text, card=False):
    text = text.translate(LOOKALIKES)
    lines = card_lines(text) if card else [text]
    path.write_text('\n'.join(lines))
    size = min(72, int(1700 / max(len(line) for line in lines))) if card else 44
    y = ('462' if len(lines) > 1 else '495') if card else ('957' if '\n' in text else '983')
    return f"drawtext=fontfile=font.ttf:textfile={path.name}:expansion=none:fontsize={size}:fontcolor=white:x=(w-text_w)/2:y={y}:line_spacing=14"


def key_filter(path, text, colors=COLORS):
    """A key the user pressed, on a keycap of the film's accent in the picture's bottom right corner (the picture:
    OUTPUT at x 178), seen on a light page and on a dark one alike."""
    path.write_text(text.translate(LOOKALIKES))
    right, bottom = (1920 + OUTPUT[0]) // 2, 30 + OUTPUT[1]
    return ('drawtext=fontfile=font.ttf:textfile=' + path.name + ':expansion=none:fontsize=34:fontcolor=white:'
            f"box=1:boxcolor={colors['accent']}@0.95:boxborderw=16:x={right}-tw-44:y={bottom}-th-44")


def label_filter(path, text, colors=COLORS):
    """A transition's label in the picture's top left corner, on a dark tab."""
    path.write_text(text.translate(LOOKALIKES))
    return ('drawtext=fontfile=font.ttf:textfile=' + path.name + ':expansion=none:fontsize=30:fontcolor=white:'
            f"box=1:boxcolor={colors['frame']}@0.88:boxborderw=14:x=206:y=58")


STEP_X, STEP_Y = 206, 958  # a step label's text in the bottom band under the picture; its accent sits left of it
STEP_MOST, STEP_LINE = 120, 62  # a step label's characters: in at most two lines of this many


def step_lines(text):
    """A step label's lines: one, or two cut at a word, the second never longer than STEP_LINE."""
    import textwrap
    lines = textwrap.wrap(text, STEP_LINE)
    if len(lines) <= 1:
        return lines
    first = textwrap.wrap(text, max(len(text) // 2, len(text) - STEP_LINE))[0]  # two lines of about the same length
    return [first, text[len(first):].strip()]


def step_filter(path, text, start, end, colors=COLORS):
    """A step label in the film's bottom band, one or two lines saying what happens: an orange accent and the text,
    which fades in (times in the segment's own seconds). A label begun in an earlier segment (``start`` below 0: the
    footage before a PDF page) goes on as it was there, never fading in again."""
    lines = step_lines(text)
    path.write_text('\n'.join(lines).translate(LOOKALIKES))
    shown = f"enable='gte(t,{max(0.0, start):.6f})*lt(t,{end:.6f})'"
    top, height = (STEP_Y, 58) if len(lines) < 2 else (STEP_Y - 28, 108)
    return (f"drawbox=x={STEP_X - 26}:y={top - 8}:w=8:h={height}:color={colors['accent']}:t=fill:{shown},"
            f"drawtext=fontfile=font.ttf:textfile={path.name}:expansion=none:fontsize=40:line_spacing=6:"
            f"fontcolor=white:x={STEP_X}:y={top}:alpha='min(1,max(0,(t-({start:.6f}))/0.25))':{shown}")


def timestamp(seconds, separator):
    ms = round(seconds*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{separator}{ms%1000:03}'


def write_captions(captions, out, language='pl'):
    """captions-<language>.srt and .vtt: the narration as the player's subtitles."""
    for ext, separator in [('srt', ','), ('vtt', '.')]:
        blocks = [f'{i}\n{timestamp(c["start"], separator)} --> {timestamp(c["end"], separator)}\n{c["text"]}\n' for i, c in enumerate(captions, 1)]
        (out / f'captions-{language}.{ext}').write_text(('WEBVTT\n\n' if ext == 'vtt' else '') + '\n'.join(blocks))


# ------------------------------------------------------------------ pointer

def png(path, width, height, pixels):
    """Write an RGBA PNG (``pixels``: rows of RGBA bytes)."""
    raw = b''.join(b'\x00' + bytes(row) for row in pixels)
    chunk = lambda kind, data: struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    Path(path).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def pointer_images(folder, scale):
    """The drawn pointer at the take's scale: a white arrow with a dark outline, and the same arrow over an orange
    click ring. Both share one canvas, so the tip is at POINTER_HOTSPOT (CSS pixels) in either."""
    arrow = [(0, 0), (0, 17.5), (4.4, 13.6), (7.6, 20.7), (10.4, 19.6), (7.2, 12.6), (12.6, 12.6)]
    width, height = 44, 46
    hx, hy = POINTER_HOTSPOT

    def inside(x, y, polygon):
        result = False
        for (x1, y1), (x2, y2) in zip(polygon, polygon[1:] + polygon[:1]):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                result = not result
        return result

    def edge_distance(x, y, polygon):
        best = float('inf')
        for (x1, y1), (x2, y2) in zip(polygon, polygon[1:] + polygon[:1]):
            dx, dy = x2 - x1, y2 - y1
            t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
            best = min(best, math.hypot(x - x1 - t * dx, y - y1 - t * dy))
        return best

    def colour(x, y, ring):
        """RGBA of one sample point (CSS pixels relative to the tip)."""
        stroke = 1.1
        near = edge_distance(x, y, arrow)
        if inside(x, y, arrow) and near > stroke:
            return (255, 255, 255, 255)
        if near <= stroke:
            return (24, 24, 27, 255)
        if ring and abs(math.hypot(x, y) - 12.5) <= 2.2:
            return (255, 109, 42, 225)
        return (0, 0, 0, 0)
    size = (int(round(width * scale)), int(round(height * scale)))
    samples = 4
    paths = []
    for ring, name in ((False, 'pointer.png'), (True, 'pointer-click.png')):
        rows = []
        for py in range(size[1]):
            row = []
            for px in range(size[0]):
                total = [0, 0, 0, 0]
                for sy in range(samples):
                    for sx in range(samples):
                        x = (px + (sx + 0.5) / samples) / scale - hx
                        y = (py + (sy + 0.5) / samples) / scale - hy
                        r, g, b, a = colour(x, y, ring)
                        total[0] += r * a
                        total[1] += g * a
                        total[2] += b * a
                        total[3] += a
                alpha = total[3] / samples ** 2
                row += [round(total[i] / total[3]) if total[3] else 0 for i in range(3)] + [round(alpha)]
            rows.append(row)
        png(folder / name, size[0], size[1], rows)
        paths.append(folder / name)
    return paths[0], paths[1], (hx * scale, hy * scale)


def sum_terms(terms, group=40):
    """A sum of expression terms, nested in groups: FFmpeg 9 refuses a flat sum of about 100 function calls."""
    terms = list(terms)
    while len(terms) > group:
        terms = ['(' + '+'.join(terms[i:i + group]) + ')' for i in range(0, len(terms), group)]
    return '+'.join(terms)


def eased(progress):
    return f'(({progress})*({progress})*(3-2*({progress})))'


def track(start, moves, time_var, index):
    """A coordinate over film time: its start value plus every eased move's change (moves chain end to start)."""
    terms = [f'{start[index]:.2f}']
    for move in moves:
        t0, t1 = move[0], move[1]
        delta = move[4 + index] - move[2 + index]
        if abs(delta) > 0.01:
            progress = f'clip(({time_var}-{t0:.4f})/{max(t1 - t0, 1e-3):.4f},0,1)'
            terms.append(f'{delta:.2f}*{eased(progress)}')
    return sum_terms(terms)


def footage_visual(segment, relative, length, pointer, colors=COLORS):
    """One pass over the take: kept frames re-timed to the film (a frame holds until the next one), the pointer drawn
    on the page, then the page's film area scaled into the graphite frame."""
    half = FRAME / 2
    pieces = segment['pieces']
    keep = sum_terms(f'gte(t,{v0 - half:.4f})*lt(t,{v1 - half:.4f})' for v0, v1, _ in pieces)
    retime = sum_terms(f'gte(T,{v0 - half:.4f})*lt(T,{v1 - half:.4f})*({f0:.4f}+T-{v0:.4f})' for v0, v1, f0 in pieces)
    normal, pressed, (hx, hy) = pointer
    scale = segment['scale']
    moves = [[m[0], m[1], m[2] * scale, m[3] * scale, m[4] * scale, m[5] * scale] for m in segment['pointer']['moves']]
    start = [v * scale for v in segment['pointer']['start']]
    x = track(start, moves, 't', 0)
    y = track(start, moves, 't', 1)
    clicked = sum_terms(f'between(t,{c:.3f},{c + CLICK_SECONDS:.3f})' for c in segment['pointer']['clicks']) or '0'
    total = segment['footage_duration']
    left, top, width, height = segment['crop']
    inputs = ['-i', segment['source'], '-loop', '1', '-framerate', '30', '-i', normal,
              '-loop', '1', '-framerate', '30', '-i', pressed]
    visual = (f"[0:v]select='{keep}',setpts='({retime})/TB',fps=30,tpad=stop_mode=clone:stop_duration={total:.3f},"
              f"trim=duration={total:.4f}[base];[1:v]format=rgba[p1];[2:v]format=rgba[p2];"
              f"[base][p1]overlay=x='{x}-{hx:.1f}':y='{y}-{hy:.1f}':eval=frame:shortest=1:enable='not({clicked})'[c1];"
              f"[c1][p2]overlay=x='{x}-{hx:.1f}':y='{y}-{hy:.1f}':eval=frame:shortest=1:enable='{clicked}'[c2];"
              f"[c2]crop={width}:{height}:{left}:{top},scale={OUTPUT[0]}:{OUTPUT[1]}:flags=lanczos,"
              f'trim=start={relative:.9f}:duration={length:.9f},setpts=PTS-STARTPTS,'
              f"pad=1920:1080:(ow-iw)/2:30:color={colors['frame']},setsar=1,"
              f"drawbox=x=0:y=0:w=iw:h=5:color={colors['accent']}:t=fill[v0]")
    return inputs, visual


def card_visual(segment, relative, length, title_path, colors=COLORS):
    """Keep title, fades and frame timing identical in review and final render."""
    title_filter = text_filter(title_path, segment['title'], True)
    inputs = ['-f', 'lavfi', '-i', f"color=c={colors['frame']}:s=1920x1080:r=30"]
    visual = (f"[0:v]{title_filter},drawbox=x=90:y=420:w=190:h=7:color={colors['accent']}:t=fill,"
              # the title fades in and out on the card's own ground, never through black (a still taken mid-fade read
              # as a black frame to viewers)
              f"format=yuv420p,fade=t=in:st=0:d=0.1:color={colors['frame']},fade=t=out:st=1.9:d=0.1:color={colors['frame']},"
              f'trim=start={relative:.9f}:duration={length:.9f},setpts=PTS-STARTPTS[v0]')
    return inputs, visual


def image_visual(segment, relative, length, colors=COLORS):
    inputs = ['-loop', '1', '-framerate', '30', '-i', segment['source']]
    visual = (f'[0:v]trim=start={relative:.9f}:duration={length:.9f},setpts=PTS-STARTPTS,'
              'scale=1840:880:force_original_aspect_ratio=decrease:force_divisible_by=2,'
              f"pad=1920:1080:(ow-iw)/2:30:color={colors['frame']},setsar=1,"
              f"drawbox=x=0:y=0:w=iw:h=5:color={colors['accent']}:t=fill[v0]")
    return inputs, visual


# -------------------------------------------------------------------- render

def file_digest(path, cache={}):
    path = str(path)
    if path not in cache:
        digest = hashlib.sha256()
        with open(path, 'rb') as source:
            for block in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(block)
        cache[path] = digest.hexdigest()
    return cache[path]


def segment_key(plan, segment, chapter, cues):
    """What a rendered segment depends on: its plan entry, the narration it plays, its step labels, source bytes and
    this renderer."""
    content = {'segment': {k: v for k, v in segment.items() if k != 'start'}, 'offset': segment['start'] - chapter['start'],
               'ending': segment is plan['segments'][-1],
               'audio': file_digest(chapter['audio']), 'audio_offset': chapter['audio_offset'],
               'cues': [(c['start'] - segment['start'], c['end'] - segment['start'], c['text']) for c in cues],
               'font': file_digest(plan['font']), 'colors': plan.get('colors') or COLORS, 'renderer': file_digest(__file__)}
    if 'source' in segment:
        content['source'] = file_digest(segment['source'])
    return hashlib.sha256(json.dumps(content, sort_keys=True, default=str).encode()).hexdigest()[:24]


def encode_segment(plan, segment, work, pointers, output):
    """Encode one segment (visual, step labels, its slice of the chapter narration) to ``output``."""
    start, length = segment['start'], round(segment['duration'] * 30) / 30
    chapter = next(c for c in reversed(plan['chapters']) if c['start'] <= start + .001)
    args = ['ffmpeg', '-v', 'error', '-nostdin', '-y', '-filter_complex_threads', '1']
    name = Path(output).stem
    colors = plan.get('colors') or COLORS
    if segment['kind'] == 'card':
        inputs, visual = card_visual(segment, 0, length, work / f'{name}-card.txt', colors)
    elif segment['kind'] == 'image':
        inputs, visual = image_visual(segment, 0, length, colors)
    else:
        scale = segment['scale']
        if scale not in pointers:
            folder = work / f'pointer-{scale}'
            folder.mkdir(exist_ok=True)
            pointers[scale] = pointer_images(folder, scale)
        inputs, visual = footage_visual(segment, 0, length, pointers[scale], colors)
    audio_index = inputs.count('-i')
    args += inputs + ['-i', chapter['audio']]
    delta = start - chapter['start'] - chapter['audio_offset']
    # fixed-point numbers: a rounding residue such as 1.4e-14 printed in exponent form is not a time FFmpeg reads
    graph = [visual, f'[{audio_index}:a]atrim=start={max(0, delta):.6f},asetpts=PTS-STARTPTS,'
                     f'adelay={round(max(0, -delta) * 1000)}:all=1,apad,atrim=duration={length:.6f}[a]']
    layer = 'v0'
    for label_index, (label_start, label_end, text) in enumerate(segment.get('labels') or []):
        if label_end <= 0 or label_start >= length:
            continue
        next_layer = f'label{label_index}'
        graph.append(f"[{layer}]{label_filter(work / f'{name}-label{label_index}.txt', text, colors)}:"
                     f"enable='gte(t,{max(0, label_start):.6f})*lt(t,{min(length, label_end):.6f})'[{next_layer}]")
        layer = next_layer
    for key_index, (key_start, key_end, text) in enumerate(segment.get('keys') or []):
        if key_end <= 0 or key_start >= length:
            continue
        next_layer = f'key{key_index}'
        graph.append(f"[{layer}]{key_filter(work / f'{name}-key{key_index}.txt', text, colors)}:"
                     f"enable='gte(t,{max(0, key_start):.6f})*lt(t,{min(length, key_end):.6f})'[{next_layer}]")
        layer = next_layer
    for step_index, step in enumerate(plan.get('steps') or []):  # the narration itself is the player's subtitles
        if segment['kind'] == 'card' or step['end'] <= start or step['start'] >= start + length:
            continue
        next_layer = f'step{step_index}'
        graph.append(f"[{layer}]{step_filter(work / f'{name}-step{step_index}.txt', step['text'], step['start'] - start, min(length, step['end'] - start), colors)}[{next_layer}]")
        layer = next_layer
    audio = 'a'
    if segment is plan['segments'][-1] and length > 2 * ENDING:  # the film's end fades out
        graph.append(f"[{layer}]fade=t=out:st={length - ENDING:.6f}:d={ENDING}:color={colors['frame']}[ending]")
        graph.append(f'[a]afade=t=out:st={length - ENDING:.6f}:d={ENDING}[fade]')
        layer, audio = 'ending', 'fade'
    args += ['-filter_complex', ';'.join(graph), '-map', f'[{layer}]', '-map', f'[{audio}]', '-t', length, '-r', '30',
             '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-threads', '2', '-pix_fmt', 'yuv420p',
             '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output]
    run(args, cwd=work)


def render_segments(plan, cache, jobs=2):
    """Every segment rendered (or taken from ``cache``): ``[(path, entry)]`` in film order."""
    if type(jobs) is not int or not 1 <= jobs <= 8:
        raise ValueError('jobs must be an integer from 1 to 8')
    capabilities()
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='demo-render-') as scratch:
        work = Path(scratch)
        shutil.copyfile(plan['font'], work / 'font.ttf')
        pointers = {}

        def one(segment):
            chapter = next(c for c in reversed(plan['chapters']) if c['start'] <= segment['start'] + .001)
            cues = [c for c in plan.get('steps') or [] if c['end'] > segment['start'] and c['start'] < segment['start'] + segment['duration']]
            target = cache / f"{segment_key(plan, segment, chapter, cues)}.mp4"
            began = time.monotonic()
            reused = target.exists()
            if not reused:
                partial = work / f'{target.stem}.mp4'
                encode_segment(plan, segment, work, pointers, partial)
                shutil.move(str(partial), target)
            video = next(s for s in probe(target)['streams'] if s['codec_type'] == 'video')
            return target, dict(duration=float(video['duration']), planned_start=segment['start'], kind=segment['kind'],
                                title=chapter['title'], cached=reused, encoder_seconds=round(time.monotonic() - began, 3))
        if any(s['kind'] == 'footage' for s in plan['segments']):  # draw the pointers once, before parallel encodes
            for scale in sorted({s['scale'] for s in plan['segments'] if s['kind'] == 'footage'}):
                folder = work / f'pointer-{scale}'
                folder.mkdir(exist_ok=True)
                pointers[scale] = pointer_images(folder, scale)
        with ThreadPoolExecutor(max_workers=jobs) as pool:
            return list(pool.map(one, plan['segments']))


def render(plan, out, jobs=2, cache=None, plan_fingerprint=None):
    """The film: segments (cached), concatenated with the narration re-encoded once, decoded in full, with the
    caption files, the poster and checksums."""
    out = Path(out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    target = out / 'demo.mp4'
    if target.exists():
        raise ValueError(f'Output exists: {target}; use a fresh output directory')
    started = time.monotonic()
    encoded = render_segments(plan, cache or out / 'segments', jobs)
    timeline = []
    for _, entry in encoded:
        entry['start'] = sum(t['duration'] for t in timeline)
        timeline.append(entry)
    with tempfile.TemporaryDirectory(prefix='demo-concat-') as scratch:
        listing = Path(scratch) / 'concat.txt'
        listing.write_text(''.join(f"file '{p}'\nduration {t['duration']}\n" for (p, _), t in zip(encoded, timeline)))
        concat_started = time.monotonic()
        # Decode/re-encode audio once to remove packet-boundary accumulation between segments.
        run(['ffmpeg', '-v', 'error', '-nostdin', '-f', 'concat', '-safe', '0', '-i', listing, '-c:v', 'copy', '-c:a', 'aac',
             '-af', 'aresample=async=1:first_pts=0', '-t', sum(t['duration'] for t in timeline), '-movflags', '+faststart', target])
        concat_seconds = time.monotonic() - concat_started
    decode_started = time.monotonic()
    run(['ffmpeg', '-v', 'error', '-i', target, '-f', 'null', '-'])
    decode_seconds = time.monotonic() - decode_started
    result = dict(duration=float(probe(target)['format']['duration']), segments=timeline, jobs=jobs,
                  cached_segments=sum(1 for t in timeline if t['cached']), concat_seconds=round(concat_seconds, 3),
                  decode_seconds=round(decode_seconds, 3))
    write_captions(plan['captions'], out, plan['language'])
    run(['ffmpeg', '-v', 'error', '-ss', min(3, plan['duration'] / 2), '-i', target, '-frames:v', '1', '-update', '1', out / 'poster.jpg'])
    card_starts = [t['start'] for t in timeline if t['kind'] == 'card']
    boundaries = card_starts + [sum(t['duration'] for t in timeline)]
    result['chapters'] = [dict(title=c['title'], prs=c['prs'], start=boundaries[i], duration=boundaries[i+1]-boundaries[i]) for i, c in enumerate(plan['chapters'])]
    result['artifact_sha256'] = {name: file_digest(out / name, {}) for name in ('demo.mp4', 'poster.jpg', f"captions-{plan['language']}.srt",
                                                                           f"captions-{plan['language']}.vtt")}
    result['plan_fingerprint'] = plan_fingerprint or fingerprint(plan)
    result['elapsed_seconds'] = round(time.monotonic() - started, 3)
    (out / 'timeline.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def fingerprint(plan):
    """Bind reusable evidence to this renderer, the plan and all source bytes."""
    digest = hashlib.sha256(json.dumps(plan, sort_keys=True, default=str).encode())
    digest.update(Path(__file__).read_bytes())
    assets = {plan['font']} | {c['audio'] for c in plan['chapters']} | {
        s['source'] for s in plan['segments'] if 'source' in s}
    for asset in sorted(assets, key=str):
        digest.update(file_digest(asset).encode())
    return digest.hexdigest()


def prepare(path, out, enforce_duration=True, strict=True):
    """Translate authored choices and SRT, never select or extend footage."""
    started = time.monotonic()
    path, out = Path(path).resolve(), Path(out).resolve()
    data = json.loads(path.read_text())
    fields(data, ['font', 'chapters', 'language', 'colors'], ['font', 'chapters'])
    if not isinstance(data['chapters'], list) or not data['chapters']:
        raise ValueError('Expected authored chapters')
    result = dict(font=str((path.parent / data['font']).resolve()), chapters=[], language=data.get('language') or 'pl')
    if data.get('colors') is not None:
        result['colors'] = data['colors']
    caption_timing = []
    for chapter in data['chapters']:
        fields(chapter, ['title', 'prs', 'audio', 'srt', 'audio_offset', 'clips', 'review_points', 'caption_limits', 'steps'],
               ['title', 'prs', 'audio', 'srt', 'clips'])
        copied = dict(chapter)
        limits = copied.pop('caption_limits', None)  # where the picture leaves each sentence (montage.caption_limits)
        srt = (path.parent / copied.pop('srt')).resolve()
        copied['audio'] = str((path.parent / chapter['audio']).resolve())
        info = probe(copied['audio'])
        if not any(s['codec_type'] == 'audio' for s in info['streams']):
            raise ValueError('Narration has no audio stream')
        prepared = prepare_captions(srt.read_text(encoding='utf-8-sig'),
            float(info['format']['duration']), chapter.get('audio_offset', 2), limits=limits)
        copied['captions'] = [{key: cue[key] for key in ['start', 'end', 'text']} for cue in prepared]
        caption_timing.append(dict(chapter=len(result['chapters'])+1, cues=[cue['timing'] for cue in prepared]))
        copied['clips'] = []
        for clip in chapter['clips']:
            copied_clip = json.loads(json.dumps(clip))
            if 'image' in clip:
                copied_clip['image'] = str((path.parent / clip['image']).resolve())
            if 'footage' in clip:
                copied_clip['footage']['source'] = str((path.parent / clip['footage']['source']).resolve())
            copied['clips'].append(copied_clip)
        result['chapters'].append(copied)
    # Validate before publishing any prepared artifact.
    with tempfile.TemporaryDirectory(prefix='demo-prepare-') as scratch:
        candidate = Path(scratch) / 'plan.json'
        candidate.write_text(json.dumps(result, ensure_ascii=False))
        plan = load_plan(candidate, enforce_duration=enforce_duration, strict=strict)
    out.mkdir(parents=True, exist_ok=True)
    if any((out / name).exists() for name in ['editing-plan.json', 'prepared-timeline.json']):
        raise ValueError('Prepared output exists; use a fresh output directory')
    (out / 'editing-plan.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    report = dict(duration=plan['duration'], chapters=plan['chapters'], caption_timing=caption_timing,
                  segments=[{k: v for k, v in s.items() if k not in ('pieces',)} for s in plan['segments']],
                  captions=plan['captions'], elapsed_seconds=round(time.monotonic()-started, 3))
    (out / 'prepared-timeline.json').write_text(json.dumps(report, default=str, ensure_ascii=False, indent=2)+'\n')
    return report
