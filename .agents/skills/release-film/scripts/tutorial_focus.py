"""Measured tutorial focus, eased context framing and rounded control rings."""
import math
import unicodedata

import montage

ZOOM_MOVE = .35
ZOOM_READ = 1.8
ZOOM_WINDOW = 2 * ZOOM_MOVE + ZOOM_READ
CAMERA_EXIT_GAP = .35


def tokens(text):
    return [montage.lexical(unicodedata.normalize('NFC', token)) for token in str(text).split()
            if montage.lexical(token)]


def label_time(record, words, first, end):
    """A unique exact accessible-label match in one measured sentence, otherwise no cue."""
    text = record.get('text') or {}
    label = text.get('target') if isinstance(text, dict) else None
    phrase = tokens(label) if isinstance(label, str) else []
    if not phrase or len(phrase) > 12:
        return None
    candidates = [(i, tokens(words[i][2])) for i in range(first, end)]
    candidates = [(i, t[0]) for i, t in candidates if len(t) == 1]
    matches = [candidates[i][0] for i in range(len(candidates) - len(phrase) + 1)
               if [t for _, t in candidates[i:i+len(phrase)]] == phrase]
    return words[matches[0]][0] if len(matches) == 1 else None


def word_landings(chapter, capture, words):
    """Measured control words within their pinned sentence; unknown labels retain their proof pin."""
    sentences = chapter.get('sentences', [])
    firsts = montage.first_words(words, [s['text'] for s in sentences])
    if firsts is None:
        return {}
    records = {r['step']: r for r in capture.get('steps', [])}
    result = {}
    for beat, sentence in enumerate(sentences, 1):
        end = firsts[beat] if beat < len(firsts) else len(words)
        at = label_time(records.get(sentence.get('action'), {}), words, firsts[beat - 1], end)
        if at is not None:
            result[beat] = at
    return result


def align_actions(spec, chapter, capture, words):
    """Keep one narration pin per sentence; word cues never split its speech.

    Compound sentences retain their reviewed outcome pin. Their setup actions
    must not create additional audio edits inside the sentence.
    """
    spec['word_landings'] = word_landings(chapter, capture, words)


def from_film(film, capture):
    records = {record['step']: record for record in capture.get('steps', [])}
    actions = film.get('actions', [])
    anchors = {a['step']: a for a in film.get('anchors', []) if a.get('beat') or a.get('named')}
    result, zooms = [], 0
    scale = capture.get('scale', 1)
    for index, action in enumerate(actions):
        record = records.get(action['step'], {})
        anchor = anchors.get(action['step'])
        if 'anchors' in film and anchor is None:
            continue  # Internal helper actions have no spoken cue and do not drive the camera.
        if action.get('navigate') or record.get('scroll'):
            continue
        box = record.get('box') or (action.get('pre') or {}).get('target')
        if isinstance(box, dict):
            box = [box.get(k) for k in ('x', 'y', 'width', 'height')]
        if not isinstance(box, (list, tuple)) or len(box) != 4:
            continue
        if not all(type(v) in (int, float) and math.isfinite(v) for v in box):
            continue
        x, y, width, height = box
        if x < 0 or y < 0 or min(width, height) <= 1 or x + width > 1600 or y + height > 900:
            continue  # A pre-scroll or offscreen rectangle cannot identify the visible control.
        if width > 1000 or height > 600:
            continue  # Large containers do not need an outline around the whole page.
        previous = actions[index - 1]['t'] if index else 0
        start = max(result[-1]['end'] if result else 0, previous, action.get('t_pre', action['t']) - .35)
        following = actions[index + 1].get('t_pre', actions[index + 1]['t']) if index + 1 < len(actions) else film['footage']
        post = (record.get('post') or {}).get('target')
        if isinstance(post, dict):
            post = [post.get(k) for k in ('x', 'y', 'width', 'height')]
        same_page = (record.get('pre') or {}).get('url') == (record.get('post') or {}).get('url')
        stationary = bool(record.get('look')) or (same_page and isinstance(post, (list, tuple)) and len(post) == 4
            and all(type(a) in (int, float) and abs(a - b) <= 4 for a, b in zip(post, box)))
        if stationary and anchor:
            start = max(start, anchor['action'])  # Begin moving on the spoken control, never an arbitrary early pulse.
        # A click may remove its button or navigate. Stop outlining that target
        # as it changes, rather than drawing over unrelated content afterward.
        hold = 3.2 if stationary else -.03
        end = min(action['t'] + hold, following - CAMERA_EXIT_GAP, film['footage'])
        if end - start < .35:
            continue
        interior = x >= 180 and y >= 100 and x + width <= 1420 and y + height <= 800
        overlay = (record.get('pre') or {}).get('overlay') or (record.get('post') or {}).get('overlay')
        zoom = (anchor is None or anchor.get('named', False)) and not overlay and stationary and zooms < 2 and end - start >= ZOOM_WINDOW and interior and width < 600 and height < 240
        zooms += int(zoom)
        result.append({'start': round(start, 3), 'end': round(end, 3),
                       'box': [round(v * scale, 3) for v in box], 'zoom': zoom})
    return result


def validate(values, frame, duration):
    if not isinstance(values, list) or len(values) > 100:
        raise ValueError('Tutorial focus must be a bounded list')
    previous_end = 0
    zooms = 0
    for value in values:
        if not isinstance(value, dict) or set(value) != {'start', 'end', 'box', 'zoom'}:
            raise ValueError('Invalid tutorial focus fields')
        start, end, box = value['start'], value['end'], value['box']
        if not all(type(v) in (int, float) and math.isfinite(v) for v in (start, end)) or not 0 <= start < end <= duration or start < previous_end:
            raise ValueError('Tutorial focus times must be ordered and within footage')
        previous_end = end
        if not isinstance(box, list) or len(box) != 4 or not all(type(v) in (int, float) and math.isfinite(v) for v in box):
            raise ValueError('Invalid tutorial focus rectangle')
        x, y, width, height = box
        if min(x, y) < 0 or min(width, height) <= 1 or x + width > frame[0] or y + height > frame[1]:
            raise ValueError('Tutorial focus rectangle is outside the viewport')
        if type(value['zoom']) is not bool:
            raise ValueError('Tutorial focus zoom must be a boolean')
        zooms += int(value['zoom'])
        if value['zoom'] and (end - start < 1.2 or x < frame[0] * .1125 or y < frame[1] / 9
                              or x + width > frame[0] * .8875 or y + height > frame[1] * 8 / 9):
            raise ValueError('Tutorial zoom must retain context around an interior target')
    if zooms > 2:
        raise ValueError('At most two tutorial zooms per flow')
    return values


def camera(box, frame):
    """Fit measured context, like the clips skill; clamp translation to avoid blank edges.

    A recording is a bitmap: cap magnification at 1.45, keep at least 32% of
    the viewport as context, and never treat a button's tiny bounds as a shot.
    """
    x, y, width, height = box
    fw, fh = frame
    zoom = max(1, min(1.45, fw / (width + fw * .32), fh / (height + fh * .32)))
    left = min(0, max(fw * (1 - zoom), fw / 2 - (x + width / 2) * zoom))
    top = min(0, max(fh * (1 - zoom), fh / 2 - (y + height / 2) * zoom))
    return zoom, left, top


def zoom_enabled(value):
    # Older authored plans remain renderable, but a short legacy zoom becomes
    # a highlight rather than a rushed camera pulse.
    return value['zoom'] and value['end'] - value['start'] >= ZOOM_WINDOW


def filters(values, frame=(1600, 900)):
    """A short eased camera move, at least 1.8s steady reading, then a short return.

    Fractional perspective coordinates avoid the integer crop jitter that made
    earlier zoompan cameras unusable. The pointer and ring move with the page.
    """
    zooms = []
    for value in values:
        if not zoom_enabled(value):
            continue
        start, end = value['start'], value['end']
        ramp = f'min(clip((on/30-{start:.3f})/{ZOOM_MOVE},0,1),clip(({end:.3f}-on/30)/{ZOOM_MOVE},0,1))'
        ease = f'(({ramp})*({ramp})*(3-2*({ramp})))'
        zoom, left, top = camera(value['box'], frame)
        zooms.append((ease, zoom, left, top))
    if not zooms:
        return ''
    left = '+'.join(f'({ease})*{x:.6f}' for ease, _, x, _ in zooms)
    top = '+'.join(f'({ease})*{y:.6f}' for ease, _, _, y in zooms)
    right = '+'.join(f'({ease})*{(zoom - 1) * frame[0] + x:.6f}' for ease, zoom, x, _ in zooms)
    bottom = '+'.join(f'({ease})*{(zoom - 1) * frame[1] + y:.6f}' for ease, zoom, _, y in zooms)
    return (f"perspective=x0='{left}':y0='{top}':x1='W+({right})':y1='{top}':"
            f"x2='{left}':y2='H+({bottom})':x3='W+({right})':y3='H+({bottom})':"
            'sense=destination:eval=frame:interpolation=cubic,')


def ring(width, height):
    """Antialiased rounded Mentingo ring + soft halo; transparent inside, no dimming.

    Returns an RGBA bitmap with 14px padding. Analytic distance keeps this
    offline and dependency-free; rasterize once, not once per video frame.
    """
    width, height = math.ceil(width), math.ceil(height)
    padding, radius = 14, min(14, height / 2 + 5)
    size = width + padding * 2, height + padding * 2
    rows = []
    for y in range(size[1]):
        row = bytearray()
        for x in range(size[0]):
            qx = abs(x + .5 - size[0] / 2) - (width / 2 + 6 - radius)
            qy = abs(y + .5 - size[1] / 2) - (height / 2 + 6 - radius)
            distance = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - radius
            stroke = max(0, min(1, 2 - abs(distance)))
            halo = max(0, min(1, 7 - abs(distance))) * .16
            alpha = round(255 * max(stroke, halo))
            row.extend((71, 150, 253, alpha))
        rows.append(row)
    return size, rows


def overlays(inputs, values, work, write_png):
    """Ring only a recorded target, fade after the camera settles, before the next action."""
    graph, layer = [], 'c2'
    for index, value in enumerate(values):
        x, y, width, height = value['box']
        asset = work / f'tutorial-ring-{math.ceil(width)}-{math.ceil(height)}.png'
        if not asset.exists():
            (w, h), rows = ring(width, height)
            write_png(asset, w, h, rows)
        source = inputs.count('-i')
        inputs += ['-loop', '1', '-framerate', '30', '-threads', '1', '-i', asset]
        start, end = value['start'], value['end']
        reveal = start + (ZOOM_MOVE if zoom_enabled(value) else 0)
        fade = min(.25, (end - reveal) / 3)
        graph.append(f'[{source}:v]format=rgba,fade=t=in:st={reveal:.3f}:d={fade:.3f}:alpha=1,'
                     f'fade=t=out:st={end - fade:.3f}:d={fade:.3f}:alpha=1[ring{index}]')
        graph.append(f'[{layer}][ring{index}]overlay=x={x - 14:.3f}:y={y - 14:.3f}:shortest=1:'
                     f"enable='between(t,{reveal:.3f},{end:.3f})'[focus{index}]")
        layer = f'focus{index}'
    return ';'.join(graph), layer
