"""Choose one of the configured multilingual narrators once per release-film run."""
import copy
import os
import re
import secrets
from pathlib import Path

import core

VOICE_VARIABLES = (
    'ELEVENLABS_VOICE_ID_FEMALE_1', 'ELEVENLABS_VOICE_ID_FEMALE_2',
    'ELEVENLABS_VOICE_ID_MALE_1', 'ELEVENLABS_VOICE_ID_MALE_2',
)


def configured_pool(required=False):
    voices = [os.environ.get(name, '').strip() for name in VOICE_VARIABLES]
    if not required and not any(voices):
        return ()
    if any(not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', voice) for voice in voices):
        raise ValueError('Configure all four narrator variables: ' + ', '.join(VOICE_VARIABLES))
    if len(set(voices)) != 4:
        raise ValueError('Configure four distinct ElevenLabs voice IDs')
    return tuple(voices)


def for_run(run, addon, persist=False):
    """Persist one nonsecret choice; read-only cache checks never draw or write."""
    pool = configured_pool()
    if not pool:
        return addon  # Explicit single-voice local configurations remain supported.
    if os.environ.get('ELEVENLABS_VOICE_ID'):
        raise ValueError('Unset ELEVENLABS_VOICE_ID when using the four-voice pool')
    path = Path(run) / 'narrator.json'
    saved = core.load(path) or {}
    narrator = saved.get('voice_id')
    if narrator is None:
        if not persist:
            raise ValueError('This run has no saved narrator; generate narration before recutting')
        narrator = secrets.choice(pool)
        core.save(path, {'voice_id': narrator})
    if narrator not in pool:
        raise ValueError('The saved narrator is no longer in the configured pool; restore it or start a new run')
    result = copy.deepcopy(addon)
    result.setdefault('elevenlabs', {})['voice_id'] = narrator
    return result
