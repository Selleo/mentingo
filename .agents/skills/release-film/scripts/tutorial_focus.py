"""Recorded control outlines and restrained, subpixel tutorial zooms; never guessed screen targets."""
import math


def from_film(film, capture):
    records = {record['step']: record for record in capture.get('steps', [])}
    actions = film.get('actions', [])
    result, zooms = [], 0
    scale = capture.get('scale', 1)
    for index, action in enumerate(actions):
        record = records.get(action['step'], {})
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
        start = max(result[-1]['end'] if result else 0, action.get('t_pre', action['t']) - .5)
        following = actions[index + 1].get('t_pre', actions[index + 1]['t']) if index + 1 < len(actions) else film['footage']
        post = (record.get('post') or {}).get('target')
        if isinstance(post, dict):
            post = [post.get(k) for k in ('x', 'y', 'width', 'height')]
        stationary = bool(record.get('look')) or (isinstance(post, (list, tuple)) and len(post) == 4
            and all(type(a) in (int, float) and abs(a - b) <= 4 for a, b in zip(post, box)))
        # A click may remove its button or navigate. Stop outlining that target
        # as it changes, rather than drawing over unrelated content afterward.
        hold = 1.8 if stationary else .12
        end = min(action['t'] + hold, following - .05, film['footage'])
        if end - start < .35:
            continue
        interior = x >= 180 and y >= 100 and x + width <= 1420 and y + height <= 800
        overlay = (record.get('pre') or {}).get('overlay') or (record.get('post') or {}).get('overlay')
        zoom = not overlay and stationary and zooms < 2 and end - start >= 1.2 and interior and width < 600 and height < 240
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


def filters(values):
    """Stable frame dimensions; cubic perspective interpolates fractional coordinates, avoiding integer crop shake."""
    parts, zooms = [], []
    for value in values:
        start, end = value['start'], value['end']
        x, y, width, height = value['box']
        parts.append(f'drawbox=x={x:.3f}:y={y:.3f}:w={width:.3f}:h={height:.3f}:'
                     f"color=0x4796fd@0.9:t=3:enable='between(t,{start:.3f},{end:.3f})'")
        if value['zoom']:
            ramp = f'min(clip((on/30-{start:.3f})/0.3,0,1),clip(({end:.3f}-on/30)/0.3,0,1))'
            amount = f'(0.12*(1-cos(PI*({ramp})))/2)'
            zooms.append((amount, x + width / 2, y + height / 2))
    if zooms:
        left = '+'.join(f'({amount})*{x:.3f}' for amount, x, _ in zooms)
        top = '+'.join(f'({amount})*{y:.3f}' for amount, _, y in zooms)
        right = '+'.join(f'({amount})*(W-{x:.3f})' for amount, x, _ in zooms)
        bottom = '+'.join(f'({amount})*(H-{y:.3f})' for amount, _, y in zooms)
        parts.append(f"perspective=x0='-({left})':y0='-({top})':x1='W+({right})':y1='-({top})':"
                     f"x2='-({left})':y2='H+({bottom})':x3='W+({right})':y3='H+({bottom})':"
                     'sense=destination:eval=frame:interpolation=cubic')
    return ','.join(parts) + (',' if parts else '')
