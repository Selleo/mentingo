"""A balanced, randomly assigned narrator pool for Self-onboarding feature videos."""
import os
import re
import secrets


VOICE_VARIABLES = (
    'ELEVENLABS_VOICE_ID_FEMALE_1',
    'ELEVENLABS_VOICE_ID_FEMALE_2',
    'ELEVENLABS_VOICE_ID_MALE_1',
    'ELEVENLABS_VOICE_ID_MALE_2',
)


def configured_pool(required=False):
    """Read four unique IDs; gender labels are assigned by the maintainer."""
    voices = [os.environ.get(name, '').strip() for name in VOICE_VARIABLES]
    if not required and not any(voices):
        return ()  # Preserve the existing single-narrator local configuration.
    if any(not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', voice) for voice in voices):
        raise ValueError('Configure all four narrator variables: ' + ', '.join(VOICE_VARIABLES))
    if len(set(voices)) != len(voices):
        raise ValueError('Self-onboarding requires four distinct ElevenLabs voice IDs')
    return tuple(voices)


def select_voice(pool, previous=None):
    """Draw once per feature video, retaining its narrator while present in the pool."""
    if previous in pool:
        return previous
    return secrets.choice(pool)
