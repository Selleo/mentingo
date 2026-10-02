#!/usr/bin/env python3
"""Film timing for event-driven takes (pure functions, no browser).

A capture (the camera around a scene's test, scripts/capture) runs a scene's steps as fast as the app answers and
records them once. The film is cut from that take here:

- footage in which the page changes plays at normal speed;
- a still page holds for as long as the narration needs, while a drawn pointer glides over it to the next target;
- when an action cannot land in its sentence, the narration waits (silence before the sentence) instead of the
  picture running ahead of it;
- waiting for the app is left out: blank pages, loading flashes, loading indicators and images still loading, and
  the way to the address an action led to (redirect hops, an empty shell). The film jumps from the action to the
  loaded page.

Times: *capture* seconds count from the take's start mark (the page clock, ``Date.now()``); *video* seconds are frame
times of the take file (the clock strip maps one to the other, dropped frames included); *film* seconds count from the
chapter's first narrated moment (the renderer puts the chapter card before it).
"""
import math
import re
from urllib.parse import urlsplit

import language

VIEWPORT = (1600, 900)
USABLE = (8, 0, 1584, 890)  # film area of the 1600x900 page above the clock strip (even sizes for ffmpeg)
FPS = 30
SENTENCE_END = re.compile(r'[.!?…]["”»)]*$')
# abbreviations a sentence goes on after, even before a capital or a digit (np. Excel, ok. 5 stron, e.g. PDF); those
# that mostly end one (itd., itp., etc.) are not here
ABBREVIATIONS = {'np.', 'ok.', 'tzw.', 'm.in.', 'ds.', 'nr.', 'godz.', 'min.', 'ul.', 'tj.', 'wg.', 'pn.', 'e.g.', 'i.e.',
                 'vs.', 'approx.', 'no.', 'Mr.', 'Mrs.', 'Ms.', 'Dr.'}
SPEECH_PAUSE = 1.1  # seconds at least between two sentences of the narration (cut.paced); edge-tts's own are 0.9
SPEECH_LETTER, SPEECH_SENTENCE = 0.063, 1.22  # seconds per letter and per sentence (incl. the pause after it), fitted
# on 93 sentences of release narration at the film's pace (2026-09-29: Guy and Marek at their own rate, SPEECH_PAUSE
# between sentences): mean error 0.20 s per sentence
LAND = -0.3  # an action lands this long after its sentence starts: a little before it, so what the action changes is on
# screen as the sentence about it begins (the sentences say what changed, not what is clicked)
LATE_TOLERANCE = 1.0  # the first action this much later than its moment is fine; later than that the narration waits
LATE_TOLERANCE_LATER = 0.5  # the same for the actions after it (a later caption then starts over the wrong picture)
VIEW = 0.25  # seconds a result stays on screen before the pointer leaves for the next action
END_VIEW = 0.8  # the chapter's last result stays at least this long
LOOK_HOLD = 2.0  # a sentence that starts on a passed check holds the state it proves this long at most (a toast fades)
CHAIN_MARGIN = 0.6  # steps no sentence names, between two that sentences do, end this long before the next one lands
# when the gap after the previous sentence allows it
LEFT = 0.35  # a change this soon after a sentence's own action still belongs to it (the page answering the action)
SAID = 0.05  # a sentence's action, or the cut to its page, comes at least this long after the last word of the one
# before (never under its words: its caption would stand over the next picture)
CHAIN_WAIT = 1.0  # intermediate steps wait for the sentence before to be said, even on the same page;
# when the next sentence would wait longer than this for them, they are cut instead
JUMP_MIN = 1.5  # such steps with this much footage are cut (a jump to the next step): they would play under a sentence
# about something else
JUMP_LEAD = 1.0  # the jump comes this long before the next sentence's action lands (its pointer glides in after it)
RESULT_PLAY = 3.0  # checks right after a sentence's action are its result (the page a click opened): up to this much
# footage of them plays under that sentence before the steps after them may be cut
IDLE_KEEP = 0.1  # a still stretch inside the action flow is shown this long at most (network waits, settling)
DWELL = 0.05  # footage kept after every action even when the page does not change
# Tight pacing: where the narration would otherwise wait, the montage first shortens what it controls itself (never the
# app's own footage): pointer glides to half (at least TIGHT_GLIDE s), result views to 40 % (at least TIGHT_VIEW s),
# still moments between motion to TIGHT_IDLE s.
TIGHT_GLIDE, TIGHT_VIEW, TIGHT_IDLE = 0.2, 0.1, 0.03
ACTIVE_THRESHOLD = 0.00005  # share of a frame's pixels (at 640x360) that must change for page motion: ~12 pixels, a digit
ACTIVE_PAD = 2  # frames kept around page motion
MAX_STILL = 5.9  # a still image (a downloaded PDF page) covers at most this much of a chapter's end
POINTER_REST = (800, 450)  # where the pointer waits before the first action (CSS pixels)
CLICK_SECONDS = 0.3  # the click ring stays this long
DEFAULT_TAIL = 0.6  # footage after the narration ends
# A transition the picture cannot show (the page reloaded, another window: the montage cuts the blank reload, and one
# app window looks like another) gets a short label in the corner, this long, from the moment the picture changes
LABEL_SECONDS = 1.8
# the transition labels, in the film's language (spec['language']; language.TEXTS 'reloaded' and 'another_window': a
# scene names its other user's part with test.step("Widok kursanta", …))
# what a user does that the page alone does not show: a key they press gets a badge in the picture's corner for
# KEY_SECONDS (a key the page acts on at once: a menu opened with the down arrow, a shortcut); where the pointer goes
# to a field to type in it or to focus it, it clicks there, as a user would
KEY_SECONDS = 1.2
TYPING = ('fill', 'type', 'pressSequentially', 'focus', 'selectOption', 'clear')
KEY_NAMES = {'ControlOrMeta': 'Ctrl', 'Control': 'Ctrl', 'Meta': 'Cmd', 'Escape': 'Esc', 'PageDown': 'Page Down',
             'PageUp': 'Page Up', '\n': 'Enter', '\r': 'Enter', '\t': 'Tab'}
KEY_MOST = 30  # characters of a key's badge (render_demo): a longer combination is written without spaces, or not shown
FINAL_TAIL = 1.6  # after the film's last words: its last picture stays, then fades out (render_demo.ENDING)
PROOF_HOLD = 5.0  # the state after a chapter's last pinned action stays at least this long (viewers missed shorter
# proofs, and marked down holds of eight seconds)

MOVE_SECONDS = 0.5  # a setup chain starts at least this long after the previous sentence is said

# ------------------------------------------------------------------ narration

def srt_seconds(value):
    hours, minutes, rest = value.strip().split(':')
    return int(hours) * 3600 + int(minutes) * 60 + float(rest.replace(',', '.'))


def words_from_srt(text):
    """``[(start, end, word)]`` from a word-level SRT."""
    words = []
    for block in str(text).strip().split('\n\n'):
        lines = block.strip().splitlines()
        if len(lines) < 3 or '-->' not in lines[1]:
            continue
        start, end = lines[1].split('-->')
        words.append((round(srt_seconds(start), 3), round(srt_seconds(end), 3), ' '.join(lines[2:]).strip()))
    return words


def estimated_words(text):
    """Word timings estimated from the text alone (rehearsals, before the speech exists): every sentence lasts
    SPEECH_LETTER per letter plus SPEECH_SENTENCE, its words taking time by their letters before SPEECH_PAUSE."""
    sentences, current = [], []
    tokens = str(text or '').split()
    for index, word in enumerate(tokens):
        current.append(word)
        if ends_sentence(word, tokens[index + 1] if index + 1 < len(tokens) else None):
            sentences.append(current)
            current = []
    if current:
        sentences.append(current)
    words, clock = [], 0.0
    for sentence in sentences:
        letters = [max(1, sum(c.isalnum() for c in word)) for word in sentence]
        length = SPEECH_LETTER * sum(letters) + SPEECH_SENTENCE
        unit, at = (length - SPEECH_PAUSE) / sum(letters), clock
        for word, count in zip(sentence, letters):
            words.append((round(at, 3), round(at + unit * count, 3), word))
            at += unit * count
        clock += length
    return words


def ends_sentence(word, following):
    """A word ending in . ! ? … ends a sentence when the next word starts one (a capital or a digit): a question inside
    a quote („Leave this editor?” pyta…) or an abbreviation (np. ekran, np. Excel) does not."""
    if not SENTENCE_END.search(word) or word.lstrip('„"“«(') in ABBREVIATIONS:
        return False
    first = next((c for c in following or '' if c.isalnum()), '')
    return following is None or first.isupper() or first.isdigit()


def lexical(text):
    return ''.join(c for c in str(text) if c.isalnum()).casefold()


def first_words(words, sentences):
    """Index of each sentence's first word when ``words`` are the voice's words of ``sentences`` (the texts it read:
    every word with a letter or digit, in order; a lone dash or quote goes with the word before it), else None."""
    said = [[lexical(token) for token in str(sentence).split() if lexical(token)] for sentence in sentences or []]
    heard = [index for index, (_, _, text) in enumerate(words) if lexical(text)]
    if not said or not all(said) or [lexical(words[i][2]) for i in heard] != [w for sentence in said for w in sentence]:
        return None
    firsts, count = [0], len(said[0])
    for sentence in said[1:]:
        firsts.append(heard[count])
        count += len(sentence)
    return firsts


def sentence_starts(words, sentences=None):
    """Start of every sentence (its first word). ``sentences``: the texts the voice read, which place every sentence
    (an abbreviation before a capital, np. Excel, ends none); without them, or for other words, the punctuation does."""
    firsts = first_words(words, sentences)
    if firsts is None:
        firsts = [index for index in range(len(words)) if index == 0 or ends_sentence(words[index - 1][2], words[index][2])]
    return [words[index][0] for index in firsts]


def sentence_ends(words, sentences=None):
    """End of every sentence (its last word)."""
    starts = sentence_starts(words, sentences)
    return [max((e for s, e, _ in words if start <= s < (starts[i + 1] if i + 1 < len(starts) else float('inf'))),
                default=start) for i, start in enumerate(starts)]


def reloads(record):
    """Whether a step loads the page it is on again (a reload, or an address opened that the page already shows)."""
    if not record.get('navigate'):
        return False
    kind, target = ((record.get('cmd') or []) + ['', ''])[:2]
    if kind == 'reload':
        return True
    if kind != 'goto' or not target or not record.get('url'):
        return False
    here, there = urlsplit(str(record['url'])), urlsplit(str(target))
    same_site = not there.netloc or there.netloc == here.netloc
    return same_site and (there.path.rstrip('/') or '/') == (here.path.rstrip('/') or '/') and there.query == here.query


def leaves(film):
    """{beat: (film time, 'next' or 'chain')}: where the picture leaves each pinned sentence: the first change (an
    action's moment, never a passed check) after its own action has landed (LEFT), at the next sentence's own action
    or at a step between them no sentence names. A caption of the sentence showing past it is behind its picture."""
    moments = sorted({a['t'] for a in film['actions'] if not a.get('look')})
    landed = {a['beat']: a['action'] for a in film['anchors'] if a.get('beat')}
    found = {}
    for beat, moment in sorted(landed.items()):
        later = [t for t in moments if t > moment + LEFT]
        if later:
            following = landed.get(beat + 1)
            found[beat] = (later[0], 'next' if following is not None and abs(later[0] - following) < 0.05 else 'chain')
    return found


def caption_limits(film):
    """``[[sentence start, the moment the next sentence's action begins or None]]`` in film time: its click, or the
    cut to its page; no caption of a sentence stays on screen past it (prepare_captions). The steps no sentence names
    between them stay under the sentence before (it usually says them)."""
    return [[round(start, 3), round(limit, 3) if limit is not None else None]
            for start, limit in zip(film['sentences'], next_actions(film))]


def next_actions(film):
    """For each sentence, the film time its picture is left (None for the last): the next sentence's own action (its
    click or moment, or the cut that jumps to its page), or earlier a step that turns the page before it (a dialog
    closed, another page opened)."""
    step_of = {a['beat']: a['step'] for a in film['anchors'] if a.get('beat')}
    left = film.get('left') or {}
    found = []
    for beat in range(1, len(film['sentences']) + 1):
        step = step_of.get(beat + 1)
        moments = [a['t'] for a in film['actions'] if step is not None and a['step'] == step and not a.get('look')]
        moments += [a['action'] for a in film['anchors'] if a.get('beat') == beat + 1]
        moments += [left[str(beat)]] if str(beat) in left else []
        found.append(min(moments) if moments else None)
    return found


def shifted_srt(words, silences):
    """Word-level SRT of narration with silences inserted (``[(original time, seconds)]``)."""
    def stamp(seconds):
        ms = int(round(seconds * 1000))
        return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'
    blocks = []
    for index, (start, end, text) in enumerate(words, 1):
        shift = sum(d for t, d in silences if t <= start + 1e-6)
        blocks.append(f'{index}\n{stamp(start + shift)} --> {stamp(end + shift)}\n{text}\n')
    return '\n'.join(blocks)


# ------------------------------------------------------------------ intervals

def merge(intervals):
    out = []
    for a, b in sorted((float(a), float(b)) for a, b in intervals if b > a):
        if out and a <= out[-1][1] + 1e-6:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return [(a, b) for a, b in out]


def subtract(intervals, holes):
    result = []
    for a, b in intervals:
        pieces = [(a, b)]
        for h0, h1 in holes:
            pieces = [p for x, y in pieces for p in ((x, min(y, h0)), (max(x, h1), y)) if p[1] - p[0] > 1e-6]
        result.extend(pieces)
    return merge(result)


def clip(intervals, low, high):
    return [(max(a, low), min(b, high)) for a, b in intervals if min(b, high) - max(a, low) > 1e-6]


def covered(intervals, low, high):
    """Total length of the intervals inside [low, high]."""
    return sum(b - a for a, b in clip(intervals, low, high))


# ---------------------------------------------------------- clock and frames

def video_before(timeline, t):
    """Video time of the last decoded frame at or before capture time t."""
    if t <= timeline[0][1]:
        return timeline[0][0]
    lo, hi = 0, len(timeline) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if timeline[mid][1] <= t:
            lo = mid
        else:
            hi = mid - 1
    return timeline[lo][0]


def capture_at(timeline, video, after=False):
    """Capture time a video time shows: counted on from the last decoded frame before it, or (``after``) back
    from the next one, so a stretch without a readable clock maps to its real ends."""
    earlier = [(v, n) for v, n in timeline if v <= video]
    later = [(v, n) for v, n in timeline if v >= video]
    if after and later:
        v, n = later[0]
        return n - (v - video) if not earlier else max(earlier[-1][1], n - (v - video))
    if earlier:
        v, n = earlier[-1]
        return n + (video - v) if not later else min(later[0][1], n + (video - v))
    return later[0][1] - (later[0][0] - video) if later else None


LOADING_DETAIL = 0.012  # a page this sparse between two richer ones is a loading flash (a spinner on white, an empty shell)
LOADING_LONGEST = 2.5  # longer sparse stretches may be real content and stay


def empty_frames(details, blank, fps=FPS):
    """Frames the film leaves out: blank pages (page detail below ``blank``) and short loading flashes between two
    richer pages (below LOADING_DETAIL for at most LOADING_LONGEST s)."""
    flags = [d < blank for d in details]
    start = None
    for index, value in enumerate(list(details) + [1.0]):
        if value < LOADING_DETAIL:
            start = index if start is None else start
            continue
        if start is not None and start > 0 and index < len(details) and (index - start) / fps <= LOADING_LONGEST \
                and details[start - 1] >= 2 * LOADING_DETAIL and details[index] >= 2 * LOADING_DETAIL:
            flags[start:index] = [True] * (index - start)
        start = None
    return flags


def frame_spans(flags, timeline, fps=FPS, pad=0):
    """Capture intervals covered by flagged frames (``flags[k]`` for the frame at k/fps), ``pad`` frames around."""
    spans, start = [], None
    for index, flag in enumerate(list(flags) + [False]):
        if flag:
            start = index if start is None else start
            continue
        if start is not None and timeline:
            a = capture_at(timeline, max(0, start - pad) / fps)
            b = capture_at(timeline, (index + pad) / fps, after=True)
            if a is not None and b is not None and b > a:
                spans.append((round(a - 0.5 / fps, 3), round(b + 0.5 / fps, 3)))
        start = None
    return merge(spans)


# ------------------------------------------------------------------ geometry

def scale_crop(crop, scale):
    """A CSS-pixel crop (None = the film area) in the take's pixels (``scale`` of them per CSS pixel), even-sized."""
    x, y, w, h = crop or USABLE
    return [int(round(v * scale / 2)) * 2 for v in (x, y, w, h)]


# ---------------------------------------------------------------------- cut

def glide_seconds(start, end):
    """A person's pointer move between two points (CSS pixels): longer for farther targets."""
    if not start or not end:
        return 0.0
    distance = math.dist(start, end)
    return 0.0 if distance < 4 else round(min(0.7, max(0.25, 0.18 + 0.00045 * distance)), 3)


def off_film(steps):
    """Steps in segments opened by a negative ``at``: they run before the narration, off film."""
    off, current = set(), False
    for index, step in enumerate(steps):
        if step.get('beat') is not None or step.get('at') is not None:
            current = step.get('at') is not None and float(step['at']) < 0
        if current:
            off.add(index)
    return off


def painted(capture, record, cuts):
    """When a passed check shows the state it proves: its still, taken once the element was painted (Playwright
    counts an element at opacity 0 as visible, so the check passes before a fading dialog shows), or the check."""
    for moment in capture.get('stills') or []:
        if record['a'] - 1e-6 <= moment <= record['b'] + 1e-6:
            return record['a'] if any(c0 < moment < c1 for c0, c1 in cuts) else moment
    return record['a']


def settled(cuts, moment, limit):
    """``moment``, or the end of the blank or loading stretch it opens, when that ends by ``limit``."""
    for c0, c1 in cuts:
        if c0 - 1e-6 <= moment < c1 <= limit + 1e-6:
            return c1
    return moment


def window_stop(cutter, record, switching, moment):
    """Where the picture may stop before ``moment``: a step in another window leaves the one before at the switch (the
    one before holds until then), never on the other window's page before the step."""
    if switching and record.get('enter') is not None:
        return max(cutter.c, min(moment, record['enter'] - 1 / FPS))
    return moment


def hold_point(rigid, start, moment):
    """Where the picture can wait before ``moment``: the start of the still stretch that ends there, or the
    moment itself while the page is still moving."""
    point = start
    for a, b in rigid:
        if b <= moment + 1e-6:
            point = max(point, b)
            continue
        if a < moment - 1e-6:
            return max(start, moment)
        break
    return point


LOADING_MAX = 6.0  # of a loading indicator shown longer than this only a glimpse of its start and end stays
LOADING_GLIMPSE = 0.6  # seconds of a long loading kept at each end (the viewer sees that it takes a while)
LOADING_PAD = 0.07  # the indicator's first and last painted frames around its logged times (sampled every 50 ms)


def address(url):
    parts = urlsplit(url)
    return parts.path + (f'?{parts.query}' if parts.query else '')


def reached(routes, record):
    """When the address an action led to took over the page (``routes``: ``[(capture time, path)]`` the page
    showed), or None when the action kept its address or the log missed the change."""
    before, after = (record.get('pre') or {}).get('url'), (record.get('post') or {}).get('url')
    if not before or not after or address(before) == address(after):
        return None
    moments = [t for t, path in routes if path == address(after) and record['a'] <= t <= record['b'] + 0.5]
    return moments[-1] if moments and moments[-1] - record['a'] <= LOADING_MAX else None


def waiting(capture, answers, kept, jumps=()):
    """Stretches left out while the page answers an action: the way to the address the action led to (``jumps``:
    redirect hops, an empty shell) and loading indicators or images still loading. The film jumps from the action
    to the loaded page; the actions themselves and live stretches (``kept``) stay."""
    cuts = list(jumps)
    for shown, hidden in capture.get('loading') or []:
        if hidden - shown > LOADING_MAX:  # a long job: the film jumps from its first moments to its last
            cuts += [(shown + LOADING_GLIMPSE, hidden - LOADING_GLIMPSE) for low, high in answers if shown < high and hidden > low]
            continue
        cuts += [(max(shown - LOADING_PAD, low), hidden + LOADING_PAD) for low, high in answers
                 if shown < high and hidden > low]
    return subtract(merge(cuts), merge(kept))


class Cutter:
    """Walks the take in capture time and lays it on the film clock: rigid footage plays 1:1, still stretches
    collapse to at most IDLE_KEEP, holds stretch the film at chosen points."""

    def __init__(self, rigid, start):
        self.rigid, self.c, self.film, self.pieces = rigid, start, 0.0, [(start, start + 1 / FPS, 0.0)]

    def play(self, to, idle=IDLE_KEEP, first_idle=True):
        """Footage up to capture time ``to``; still stretches between moving ones last at most ``idle`` seconds (none
        before the first piece after a hold, which already showed that still page: ``first_idle`` False)."""
        for a, b in clip(self.rigid, self.c, to):
            gap = a - self.c
            if gap > 1e-6 and first_idle:
                self.film += min(gap, idle)  # the last frame stays for a short still moment
            self.pieces.append((a, b, self.film))
            self.film += b - a
            self.c = b
            first_idle = True
        self.c = max(self.c, to)

    def jump(self, to, show=None):
        """Leave out the footage up to capture time ``to``: a cut. The page at ``show`` (default ``to``) is on screen from
        now on; without a frame of it the picture would keep the page from before the cut until the next motion."""
        if to > self.c + 1e-6:
            self.c = to
            self.land(max(to, show if show is not None else to))

    def land(self, to):
        """One frame of capture time ``to`` from now on (the page a cut arrives at, the painted state of a check)."""
        if to < self.c - 1e-6 or any(a - 1e-6 <= to < b for a, b, _ in self.pieces[-1:]):
            return
        self.pieces.append((to, to + 1 / FPS, self.film))
        self.film += 1 / FPS
        self.c = to + 1 / FPS

    def film_at(self, capture):
        """Film time showing capture time ``capture`` (a moment inside a skipped still stretch: when footage resumes)."""
        best = None
        for a, b, f in self.pieces:
            if a - 1e-6 <= capture < b:
                return f + (capture - a)
            if a >= capture and best is None:
                best = f
        return best if best is not None else self.film


def cut(spec, capture, words, audio_duration=None, tail=None):
    """The chapter's film from a capture and its narration's word timings.

    Returns capture ``pieces`` ``[(c0, c1, film0)]`` (footage from c0 to c1 plays from film0 on; the last frame of a
    piece holds until the next one starts), the narration ``silences`` ``[(time in the speech, seconds)]``, the
    film ``duration``, the ``pointer`` track and click moments (CSS pixels), per-beat ``anchors``, the camera
    measurements in film time (``actions``, ``changes``) and the steps paced tightly (``tight``): where the
    narration would wait for the actions before a beat, those steps get shorter glides and views first.
    """
    tight = set()
    for _ in range(4):
        film = _cut(spec, capture, words, audio_duration, tail, tight)
        anchored = sorted(a['step'] for a in film['anchors'])
        grow = set()
        for anchor in film['anchors']:
            if anchor['waits'] > 0:
                previous = max((s for s in anchored if s < anchor['step']), default=-1)
                grow |= set(range(previous + 1, anchor['step'] + 1))
        if grow <= tight:
            break
        tight |= grow
    film['tight'] = sorted(tight)
    return film


def key_name(value, texts):
    """How a pressed key reads on its badge: "ControlOrMeta+a" -> "Ctrl + A", "ArrowDown" -> "Down arrow" (in the
    film's language, ``texts``); a "+" that starts a key is the plus key, as Playwright reads it ("Control++" -> "Ctrl +
    +"). A combination too long for the badge (KEY_MOST) is written without the spaces; '' (no badge) when even that
    is, or when nothing is left to show."""
    names = {**KEY_NAMES, **texts['keys']}
    parts, building = [], ''
    for char in str(value):
        if char == '+' and building:
            parts.append(building)
            building = ''
        else:
            building += char
    shown = [names.get(part, part.upper() if len(part) == 1 else part) for part in parts + [building] if part]
    for name in (' + '.join(shown), '+'.join(shown)):
        if name.strip() and len(name) <= KEY_MOST and '\n' not in name:
            return name
    return ''


def _cut(spec, capture, words, audio_duration, tail, tight):
    texts = language.texts(spec.get('language'))  # the labels the montage adds
    steps = spec.get('steps') or []
    records = {r['step']: r for r in capture.get('steps') or []}
    tail = DEFAULT_TAIL if tail is None else tail
    known = spec.get('sentences')  # the texts the voice read: its words are counted into them
    starts, finished = sentence_starts(words, known), sentence_ends(words, known)
    speech = float(audio_duration if audio_duration is not None else (words[-1][1] + 0.3 if words else 0.0))

    def landing(beat, shift):
        """When the sentence's action lands: a little before its first word (LAND), never before the last word of
        the sentence before."""
        return max(starts[beat - 1] + shift + LAND, finished[beat - 2] + shift + SAID if beat > 1 else float('-inf'))
    off = off_film(steps)
    begin = max([records[i]['b'] for i in off if i in records] + [float(capture.get('start', 0.0))])
    shown = [i for i in range(len(steps)) if i not in off and i in records]
    if shown:  # the recorder's warm-up before the first step is off film, and so is the page answering the off-film
        # steps, but never the first shown step itself (a navigation's answer lasts until the next action, past checks)
        begin = max(min(begin, records[shown[0]]['m']), records[shown[0]]['w'])
    first = next((records[i] for i in shown if records[i].get('acting')
                  or ((records[i].get('look') or records[i].get('navigate')) and steps[i].get('beat') is not None)), None)
    if first and first.get('look'):  # a sentence opens on a check (a dialog the page opens with, which may close by
        # itself before the first action): the chapter opens on its painted state
        begin = max(begin, painted(capture, first, capture.get('blank') or []))
    elif first and first.get('navigate'):  # a sentence opens on an address opened: the chapter opens on the page it
        # leads to, loaded (not on the page before it)
        waits = merge(list(capture.get('blank') or []) + [(a, b) for a, b in capture.get('loading') or [] if b > a])
        begin = settled(waits, max(begin, first['a']), first['b'])
    elif first:  # the page still loading or re-rendering before the first action is off film: the chapter opens settled
        begin = max([begin] + [b for a, b in capture.get('active') or [] if begin <= b <= first['m']])
    end = max([float(capture.get('end', 0.0))] + [r['b'] for r in records.values()])
    kept, answers, jumps = [], [], []  # footage always shown (actions, live stretches); the page answering an action
    for index, record in records.items():
        if index in off:
            continue
        if record.get('acting'):
            kept.append((record['m'], record['a'] + DWELL))
        if record.get('acting') or record.get('navigate'):
            answers.append((record['a'] + DWELL, record['b']))
            arrived = reached(capture.get('routes') or [], record)
            if arrived is not None:
                jumps.append((record['a'] + DWELL, arrived))
    cuts = merge(list(capture.get('blank') or []) + waiting(capture, answers, kept, jumps))
    rigid = subtract(clip(merge(list(capture.get('active') or []) + kept), begin, end), cuts)
    landings = []  # after a cut on the way to an action's result, one frame of the settled result: the picture
    for low, high in answers:  # then holds on the page the action led to, not on the page before it
        ends = [c1 for c0, c1 in cuts if c0 < high and c1 > low]
        if ends:
            moment = max(high, max(ends))
            landings.append((moment, moment + 1 / FPS))
    rigid = subtract(merge(rigid + clip(landings, begin, end)), cuts)
    cutter = Cutter(rigid, begin)
    silences, shift, anchors, beats = [], 0.0, [], set()
    here, view_until, pending_view = tuple(POINTER_REST), 0.0, None
    moves, clicks, actions, keys = [], [], [], []
    order = [i for i in range(len(steps)) if i not in off and i in records]
    pinned = {i for i in order if steps[i].get('beat') is not None and 1 <= steps[i]['beat'] <= len(starts)}
    next_pinned, upcoming = {}, None
    for i in reversed(order):
        next_pinned[i], upcoming = upcoming, (i if i in pinned else upcoming)
    after_pinned, skipped, result_of, last_page, last_beat = False, set(), None, None, None
    switched = []  # (capture time, label): the picture changes to another window then
    labels = []  # (film time, label)
    leave_at, turning = {}, None  # {beat: film time the next setup chain starts}; the beat being left
    for index in order:
        if index in skipped:
            continue
        record, step = records[index], steps[index]
        acting, tighter = bool(record.get('acting')), index in tight
        switching = record.get('page') is not None and last_page is not None and record['page'] != last_page
        # a check right after a sentence's action proves what it did (the page a click opened, a saved value): it plays
        # under that sentence, and only the steps after it may be cut
        result = (record.get('look') and index not in pinned and step.get('at') is None and result_of is not None
                  and covered(rigid, records[result_of]['a'], record['a']) <= RESULT_PLAY)
        if acting or record.get('navigate') or (record.get('look') and index in pinned):
            result_of = index if index in pinned else None
        if not result and index not in pinned and step.get('at') is None and after_pinned and next_pinned.get(index) is not None:
            # steps no sentence names (closing a dialog, opening the next page) come right before the sentence they lead
            # to, not right after the one before: the picture a sentence talks about stays while it is spoken
            following = next_pinned[index]
            if steps[following]['beat'] not in beats:
                # the page answering the sentence's own action plays first, under that sentence: the wait comes after
                # it (before, the picture stood on the moment of the click until the steps after it began)
                cutter.play(hold_point(rigid, cutter.c, window_stop(cutter, record, switching, record['m'])),
                            idle=TIGHT_IDLE if tighter else IDLE_KEEP)
                lands = landing(steps[following]['beat'], shift)
                arrival = hold_point(rigid, cutter.c, records[following]['m'])
                chain = covered(rigid, cutter.c, arrival)
                needed = covered(rigid, cutter.c, records[following]['a'])
                beat = steps[following]['beat']
                said = finished[beat - 2] + shift + SAID if beat > 1 else 0.0  # the sentence before, said
                # These steps set up the next proof. Even filling a field on the same page must wait
                # for the current sentence; its pointer and camera approach must wait too.
                at, glides, lead = here, 0.0, None
                for i in order:
                    target_point = records[i].get('point') if index <= i <= following and records[i].get('acting') else None
                    if target_point and 0 <= target_point[0] <= VIEWPORT[0] and 0 <= target_point[1] <= VIEWPORT[1]:
                        glide = glide_seconds(at, tuple(target_point))
                        if lead is None:
                            lead = glide
                        glides += glide
                        at = tuple(target_point)
                begins = max(cutter.film, lands - CHAIN_MARGIN - needed, said + max(MOVE_SECONDS, lead or 0.0))
                # The first glide is already allowed for by begins; budget the remaining moves once.
                if chain >= JUMP_MIN or begins + needed + glides - (lead or 0.0) - lands > CHAIN_WAIT:
                    # they take a while (another page, a form filled): cut them, so the picture the sentence talks about
                    # stays until the next sentence and the page that one talks about is shown, whole, from just before it
                    cutter.film = max(cutter.film, lands - JUMP_LEAD, said)  # the cut, too, waits for the sentence before
                    if last_beat is not None:
                        leave_at.setdefault(last_beat, cutter.film)
                    cutter.jump(arrival, settled(cuts, arrival, records[following]['a']))
                    if any(reloads(records[i]) for i in order if index <= i < following):  # the cut passes a reload
                        labels.append((cutter.film, texts['reloaded']))
                    skipped |= {i for i in order if index <= i < following}
                    context = next(
                        (records[i]['post'] for i in reversed(order) if index <= i < following
                         and records[i].get('post')), {})
                    context = dict(context, **(records[following].get('pre') or {}))
                    actions.append({'step': following, 't': round(cutter.film, 3), 'navigate': True,
                                    'post': context})
                    after_pinned = False
                    continue
                cutter.film = begins
                turning = last_beat
        after_pinned = index in pinned or (result and after_pinned)
        cutter.play(hold_point(rigid, cutter.c, window_stop(cutter, record, switching, record['m'])),
                    idle=TIGHT_IDLE if tighter else IDLE_KEEP)
        # the other window opens on an address: it shows up loaded, never on the page it was left on (another account's
        # landing page, often an empty list, under the sentence before)
        opens = switching and bool(record.get('navigate'))
        if switching:
            # a scene's own name for the part, in one line (the label holds one)
            titled = spec.get('sections') and ' '.join(str(record.get('section') or '').split())[:40].strip()
            switched.append((record.get('enter') if record.get('enter') is not None else record['m'],
                             titled or texts['another_window']))
        last_page = record.get('page', last_page)
        if acting and pending_view is not None:
            view = min(pending_view, max(TIGHT_VIEW, pending_view * 0.4)) if tighter else pending_view
            view_until, pending_view = cutter.film + view, None
        beat, target, spoken = step.get('beat'), None, None
        if beat is not None and beat not in beats and 1 <= beat <= len(starts):
            beats.add(beat)
            last_beat = beat
            spoken = starts[beat - 1]
            target = landing(beat, shift)
        elif step.get('at') is not None and float(step['at']) >= 0:
            spoken = float(step['at'])
            target = spoken + shift
        to_arrival = 0.0 if opens else covered(rigid, cutter.c, record['m'])
        to_action = 0.0 if opens else covered(rigid, cutter.c, record['a'])
        point = tuple(record['point']) if record.get('point') else None
        if point and not (0 <= point[0] <= VIEWPORT[0] and 0 <= point[1] <= VIEWPORT[1]):
            point = None  # a box taken before the page scrolled to the element: the pointer stays where it is
        glide = glide_seconds(here, point) if point else 0.0
        if tighter and glide:
            glide = max(TIGHT_GLIDE, glide * 0.5)
        hold = 0.0
        if acting:
            hold = max(hold, view_until + glide - (cutter.film + to_arrival))
        if target is not None:
            hold = max(hold, target - (cutter.film + to_action))
        cutter.film += max(0.0, hold)
        arrival, moment = cutter.film + to_arrival, cutter.film + to_action
        if target is not None:
            late = moment - target
            tolerance = LATE_TOLERANCE_LATER if beat is not None and beat > 1 else LATE_TOLERANCE
            if late > tolerance:  # the narration waits for the action: silence before its sentence
                silences.append((round(spoken, 3), round(late, 3)))
                shift += late
            anchors.append({'step': index, 'beat': beat, 'at': step.get('at'), 'target': round(target, 3),
                            'action': round(moment, 3), 'late': round(late, 3),
                            'waits': round(late, 3) if late > tolerance else 0.0})
        verb = (record.get('cmd') or [''])[0]
        if point:
            if glide:
                moves.append([round(arrival - glide, 3), round(arrival, 3), *here, *point])
            here = point
            if record.get('click') or verb in TYPING and glide:  # a field clicked before typing in it
                clicks.append(round(moment, 3))
        pressed = key_name(record['value'], texts) if verb == 'press' and record.get('value') else ''
        if pressed:  # a combination no badge can hold has none
            keys.append((round(moment, 3), pressed))
        if opens:
            cutter.jump(record['a'], settled(cuts, record['a'] + DWELL, record['b']))
        else:
            cutter.play(record['a'], first_idle=False)
        if record.get('look'):  # the element painting in (a dialog fading in), then its painted state
            proof = painted(capture, record, cuts)
            if proof > cutter.c + 1e-6:
                cutter.play(proof, first_idle=False)
                cutter.land(proof)
        if turning is not None and index not in pinned and (acting or record.get('navigate')):
            # The previous caption ends when the setup's camera or pointer starts moving.
            leave_at.setdefault(turning, round(arrival - max(glide, MOVE_SECONDS) if acting else moment, 3))
            turning = None
        if index in pinned:
            turning = None
        if record.get('navigate'):
            actions.append({'step': index, 't': round(moment, 3), 'navigate': True, 'post': record.get('post')})
            if reloads(record):
                labels.append((moment, texts['reloaded']))
        elif acting and record.get('pre') is not None:
            actions.append({'step': index, 't': round(moment, 3), 't_pre': round(arrival, 3), 'pre': record.get('pre'),
                            'post': record.get('post'), 'scroll': bool(record.get('scroll')), 'toast': record.get('toast')})
        elif record.get('look') and record.get('box'):
            # A passed check frames its whole proof. A wide heading/panel must be able to widen the
            # previous close-up; omitting it would retain a crop that can hide the asserted content.
            actions.append({'step': index, 't': round(moment, 3), 't_pre': round(moment, 3), 'pre': {},
                            'post': {'target': record['box']}, 'page': record.get('page'), 'beat': last_beat,
                            'scroll': False, 'look': True})
        if record.get('look') and target is not None and beat is not None and beat < len(starts):
            # a sentence starts on a passed check: the picture stays on the state it proves (a toast, a new value)
            # while the sentence says it, instead of playing on as the toast fades
            cutter.film += max(0.0, min(LOOK_HOLD, starts[beat] + shift - cutter.film))
        if acting:
            pending_view = VIEW
    cutter.play(end)
    last_motion = cutter.film
    spoken_length = speech + shift
    duration = max(spoken_length + tail, last_motion + END_VIEW)
    proved = [a['action'] for a in anchors if a.get('beat')]
    if proved:
        duration = max(duration, max(proved) + PROOF_HOLD)
    insert_from = None
    insert = spec.get('insert')
    if insert and insert.get('from_beat') and insert['from_beat'] <= len(starts):
        sentence = starts[insert['from_beat'] - 1] + sum(d for t, d in silences if t <= starts[insert['from_beat'] - 1] + 1e-6)
        # never over the page's last motion, and never less footage than render_demo takes (0.5 s)
        insert_from = round(max(sentence, duration - MAX_STILL, last_motion + 0.3, 0.5), 3)
        duration = max(duration, insert_from + 0.5)
    changes = [(round(cutter.film_at(c[0]), 3), *c[1:]) for c in capture.get('changes') or [] if c[0] >= begin]
    labels += [(cutter.film_at(at), text) for at, text in switched]
    # labels and keys are drawn on the footage: a still after it (a PDF page) covers the rest of the chapter
    footage = round(insert_from if insert_from is not None else duration, 3)
    shown_keys = [[at, round(min(at + KEY_SECONDS, following, footage), 3), text]
                  for (at, text), following in zip(keys, [k[0] for k in keys[1:]] + [footage])
                  if at < footage - 0.2 and following > at]
    shown_labels, free = [], 0.0
    for at, text in sorted(labels):  # one at a time, inside the footage
        at = max(at, free)
        if at < footage - 0.5:
            shown_labels.append([round(at, 3), round(min(footage, at + LABEL_SECONDS), 3), text])
            free = at + LABEL_SECONDS
    return {'pieces': [(round(a, 4), round(b, 4), round(f, 4)) for a, b, f in cutter.pieces],
            'duration': round(duration, 3), 'footage': footage,
            'insert_from': insert_from, 'silences': silences, 'speech': round(spoken_length, 3),
            'last_motion': round(last_motion, 3), 'begin': round(begin, 3),
            'pointer': {'start': list(POINTER_REST), 'moves': moves, 'clicks': clicks},
            'anchors': anchors, 'actions': actions, 'changes': changes, 'labels': shown_labels, 'keys': shown_keys,
            'left': {str(beat): round(t, 3) for beat, t in leave_at.items()},
            'sentences': [round(s + sum(d for t, d in silences if t <= s + 1e-6), 3) for s in starts]}


def camera(spec, capture, film, scale):
    """Camera keyframes and segments in film time: the whole page (crop None) throughout. The close-ups and push-ins
    were removed (2026-09-28): the renderer's zoompan moved their crop by whole pixels, so every one of them shook."""
    return [(0.0, None, 'establish')], [{'start': 0.0, 'end': None, 'crop': None}]


CLOCK_JITTER = 0.12  # a frame's clock may drift this far from its neighbours' before a piece is split (a real drop)
FRAME_REACH = 0.1  # a capture piece without a frame of its own shows the next frame this close after its start


def video_pieces(pieces, timeline, fps=FPS):
    """Renderer pieces ``[(v0, v1, film0)]`` from capture pieces: the frames whose clock reads inside each capture
    piece, played frame after frame; split where the recorder dropped frames (the clock jumps by more than
    CLOCK_JITTER) so the footage after a drop keeps its capture timing; a frame is used once. A piece shorter than
    the frame spacing around it shows the next frame (within FRAME_REACH)."""
    if not timeline:
        return []
    used, runs = set(), []
    points = [(v, c) for v, c in timeline]
    for c0, c1, f0 in pieces:
        run = None
        for v, c in points:
            if c < c0 - 1e-6 or c >= c1 - 1e-6:
                if c >= c1:
                    break
                continue
            frame = int(round(v * fps))
            if frame in used:
                continue
            used.add(frame)
            film = f0 + (c - c0)
            if run and frame == run[1] and abs(film - (run[2] + (frame - run[0]) / fps)) < CLOCK_JITTER:
                run[1] = frame + 1
                continue
            if run:
                runs.append(run)
            run = [frame, frame + 1, film]
        if run is None:
            nearest = next(((v, c) for v, c in points if c0 - 1e-6 <= c < c0 + FRAME_REACH
                            and int(round(v * fps)) not in used), None)
            if nearest:
                frame = int(round(nearest[0] * fps))
                used.add(frame)
                run = [frame, frame + 1, f0]
        if run:
            runs.append(run)
    runs.sort(key=lambda r: r[0])
    result, last_film = [], -1.0
    for first, stop, film in runs:
        if film <= last_film:  # frames must play in order; a later frame can never show earlier
            continue
        result.append((round(first / fps, 4), round(stop / fps, 4), round(film, 4)))
        last_film = film + (stop - first - 1) / fps
    return result
