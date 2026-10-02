"""A chapter's caption cues from its voice's word SRT (one measured word per cue, as the voice gives it).

Words are grouped into cues of at most two 40-character lines and six seconds, never across a sentence's end; a pause
of more than 0.8 s starts a new cue. A cue stays on screen through the pause before the next one (CAPTION_HOLD s at most), so captions do not
flicker off between sentences, but never past the moment the picture leaves its sentence (``limits``, from the
montage): a caption over the next picture reads as a caption behind it.
Overlaps up to 60 ms advance the next word's start to the previous word's end; larger overlaps and words collapsed by
it are rejected. A word ending up to 1 ms past the audio is clamped to it; a larger overhang is rejected.
"""
from decimal import Decimal
import math
import re
import textwrap

from montage import ends_sentence

CAPTION_HOLD = 1.0  # long enough to bridge a breath, short enough not to stay over the next picture (at 2 s viewers
# read a caption over the dialog closing after it)
CUT_MARGIN = 0.03  # a caption leaves this long before its picture does
LINE = 40  # characters per caption line
PAUSE = 0.8  # a pause this long between words starts a new cue
LONGEST = 6  # seconds a cue spans at most


def milliseconds(value):
    match = re.fullmatch(r'(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})', value)
    if not match:
        raise ValueError(f'Malformed SRT timestamp: {value!r}')
    hours, minutes, seconds, fraction = map(int, match.groups())
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + fraction


def words_of(srt, audio_seconds):
    """[{'start', 'end', 'text'}] in seconds from a word SRT, checked and normalised."""
    source = srt.lstrip('﻿').strip()
    if not source:
        raise ValueError('SRT is empty')
    words = []
    audio_milliseconds = Decimal(str(audio_seconds)) * 1000
    previous_start = previous_end = 0
    for block in re.split(r'\n\s*\n', source.replace('\r\n', '\n')):
        lines = block.splitlines()
        if len(lines) < 3 or not re.fullmatch(r'\d+', lines[0].strip()):
            raise ValueError('Expected SRT index, interval and nonempty text')
        interval = lines[1].split(' --> ')
        if len(interval) != 2:
            raise ValueError('Malformed SRT interval')
        start, end = map(milliseconds, interval)
        if start < previous_start or end <= start or end > audio_milliseconds + 1:
            raise ValueError('SRT intervals must be ordered, positive and within audio')
        end = min(end, audio_seconds * 1000)
        previous_start = start
        if previous_end - start > 60:
            raise ValueError('SRT overlap exceeds 60 ms')
        start = max(start, previous_end)
        if end <= start:
            raise ValueError('Timing normalization collapses cue')
        previous_end = end
        text = ' '.join(lines[2:]).split()
        if not text:
            raise ValueError('SRT cue has empty text')
        # a word too long for a caption line (an address read out) is cut short, not the whole film lost for it
        text = [word if len(word) <= LINE else word[:LINE - 1] + '…' for word in text]
        if sum(any(c.isalnum() for c in word) for word in text) != 1:
            raise ValueError('A word cue must hold exactly one word')
        words.append(dict(start=start / 1000, end=end / 1000, text=' '.join(text)))
    return words


def prepare_captions(srt, audio_seconds, offset=2, limits=None):
    """Caption cues ``[{'start', 'end', 'text', 'timing'}]`` in chapter time (``offset``: when the voice starts).
    ``limits``: ``[[sentence start, the moment the picture leaves the sentence or None]]`` in voice time."""
    for name, value, low, high in [('audio_seconds', audio_seconds, .01, 86400), ('offset', offset, 0, 2)]:
        if (isinstance(value, bool) or not isinstance(value, (int, float))
                or not math.isfinite(value) or not low <= value <= high):
            raise ValueError(f'{name} must be finite in [{low}, {high}]')
    captions, group = [], []

    def lines(words):
        return textwrap.wrap(' '.join(w['text'] for w in words), width=LINE, break_long_words=False,
                             break_on_hyphens=False)

    def emit():
        captions.append(dict(start=offset + group[0]['start'], end=offset + group[-1]['end'], text='\n'.join(lines(group)),
                             timing='word_boundary'))

    for word in words_of(srt, audio_seconds):
        if group and (len(lines([*group, word])) > 2 or word['start'] - group[-1]['end'] > PAUSE
                      or word['end'] - group[0]['start'] > LONGEST or ends_sentence(group[-1]['text'], word['text'])):
            emit()
            group = []
        group.append(word)
    if group:
        emit()
    bounds = sorted((offset + start, None if leave is None else offset + leave) for start, leave in limits or [])
    for caption, following in zip(captions, captions[1:]):
        end = min(following['start'], caption['end'] + CAPTION_HOLD)
        leave = next((left for start, left in reversed(bounds) if start <= caption['start'] + 0.05), None)
        if leave is not None:
            end = min(end, leave - CUT_MARGIN)
        caption['end'] = max(caption['end'], end)  # never before its own words end
    return captions
