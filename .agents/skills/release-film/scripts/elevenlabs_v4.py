"""Eleven v3/v4 dialogue synthesis with sample-accurate streamed character timing.

The sync websockets 15.0.1 client performs one handshake and never follows redirects.
PCM avoids estimating timestamps from compressed audio sizes. Chunk-relative timing
is shifted by every preceding PCM byte, including audio-only leading chunks. The
provider key lives only in the handshake and transport diagnostics are discarded.
"""
import base64
import binascii
import json
import logging
import math
import time
from urllib.parse import urlencode

MODEL = 'eleven_v4_turbo'
OUTPUT_FORMAT = 'pcm_24000'
SAMPLE_RATE = 24_000
BYTES_PER_SAMPLE = 2
MESSAGE_LIMIT = 2 * 1024 * 1024
STREAM_LIMIT = 32 * 1024 * 1024
AUDIO_LIMIT = 24 * 1024 * 1024
FRAME_LIMIT = 4_096
DEADLINE = 120


class DialogueError(ValueError):
    """A safe actionable failure, never a provider payload or transport exception."""


def connect(uri, api_key):
    """One verified-TLS handshake, no proxy/redirect/reconnect and no debug credential logging."""
    try:
        from websockets.sync.client import connect as open_socket
    except ImportError:
        raise DialogueError('Eleven v4 narration requires websockets==15.0.1 in the configured TTS Python') from None
    logger = logging.Logger('release-film-elevenlabs', level=logging.CRITICAL + 1)
    logger.addHandler(logging.NullHandler())
    logger.propagate = False
    return open_socket(uri, additional_headers={'xi-api-key': api_key}, proxy=None, compression=None,
                       open_timeout=15, close_timeout=3, max_size=MESSAGE_LIMIT, max_queue=4,
                       ping_interval=10, ping_timeout=10, logger=logger)


def add_alignment(target, alignment, start_seconds, chunk_seconds):
    """Append validated snake_case dialogue timings, measured relative to this PCM chunk."""
    if not isinstance(alignment, dict):
        raise DialogueError('Eleven v4 returned malformed character alignment')
    chars = alignment.get('chars')
    starts = alignment.get('char_start_times_ms')
    durations = alignment.get('char_durations_ms')
    if not isinstance(chars, list) or not isinstance(starts, list) or not isinstance(durations, list) \
            or len(chars) != len(starts) or len(chars) != len(durations) \
            or any(not isinstance(char, str) or len(char) != 1 for char in chars):
        raise DialogueError('Eleven v4 returned malformed character alignment')
    if len(target['characters']) + len(chars) > 12_000:
        raise DialogueError('Eleven v4 character alignment exceeds its limit')
    previous_start = previous_end = 0.0
    for char, start, duration in zip(chars, starts, durations):
        if type(start) not in (int, float) or type(duration) not in (int, float) \
                or not math.isfinite(start) or not math.isfinite(duration) \
                or start < 0 or duration < 0 or start < previous_start or start + duration < previous_end \
                or start + duration > chunk_seconds * 1_000 + 250:
            raise DialogueError('Eleven v4 returned invalid chunk-relative timestamps')
        absolute_start = start_seconds + start / 1_000
        absolute_end = start_seconds + (start + duration) / 1_000
        if target['character_start_times_seconds'] and (absolute_start < target['character_start_times_seconds'][-1]
                or absolute_end < target['character_end_times_seconds'][-1]):
            raise DialogueError('Eleven v4 returned decreasing character timestamps')
        target['characters'].append(char)
        target['character_start_times_seconds'].append(absolute_start)
        target['character_end_times_seconds'].append(absolute_end)
        previous_start, previous_end = start, start + duration


def synthesize(voice_id, payload, api_key):
    """Return raw mono s16le PCM and absolute alignment after a complete single-turn dialogue stream.

    `is_final_audio_for_turn` isn't completion: only `is_final` after close_socket
    proves all encoder output was flushed. No failed or incomplete paid session is
    automatically retried, and missing alignment never produces estimated captions.
    """
    model = payload['model_id']
    if not model.startswith(('eleven_v3', 'eleven_v4')):
        raise DialogueError('Dialogue transport requires an Eleven v3 or v4 model')
    query = urlencode({'model_id': model, 'output_format': OUTPUT_FORMAT,
                       'language_code': payload['language_code'], 'sync_alignment': 'true',
                       'apply_text_normalization': 'off'})
    uri = 'wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?' + query
    start_time = time.monotonic()
    received = 0
    audio = bytearray()
    alignment = {'characters': [], 'character_start_times_seconds': [], 'character_end_times_seconds': []}
    completed = False
    try:
        with connect(uri, api_key) as socket:
            socket.send(json.dumps({'voices': [voice_id], 'voice_settings': payload['voice_settings']}))
            socket.send(json.dumps({'inputs': [{'text': payload['text'], 'voice_id': voice_id}], 'flush': True}))
            socket.send(json.dumps({'close_socket': True}))
            for _ in range(FRAME_LIMIT):
                remaining = DEADLINE - (time.monotonic() - start_time)
                if remaining <= 0:
                    raise DialogueError('Eleven v4 speech stream exceeded its deadline; no automatic paid retry')
                try:
                    raw = socket.recv(timeout=min(10, remaining))
                except TimeoutError:
                    # The service expects a client message within 20s, even while waiting for audio.
                    socket.send('{"keep_alive":true}')
                    continue
                if not isinstance(raw, (str, bytes)):
                    raise DialogueError('Eleven v4 returned an invalid stream frame')
                size = len(raw.encode('utf-8')) if isinstance(raw, str) else len(raw)
                received += size
                if size > MESSAGE_LIMIT or received > STREAM_LIMIT:
                    raise DialogueError('Eleven v4 speech stream exceeds its response limit')
                try:
                    message = json.loads(raw)
                except (ValueError, UnicodeError):
                    raise DialogueError('Eleven v4 returned invalid stream JSON') from None
                if not isinstance(message, dict):
                    raise DialogueError('Eleven v4 returned an invalid stream frame')
                if any(key in message for key in ('error', 'detail', 'error_message')):
                    raise DialogueError('Eleven v4 rejected the speech request; check model, voice and account access')
                chunk = b''
                if message.get('audio') is not None:
                    encoded = message['audio']
                    if not isinstance(encoded, str):
                        raise DialogueError('Eleven v4 returned invalid audio encoding')
                    try:
                        chunk = base64.b64decode(encoded, validate=True)
                    except (ValueError, binascii.Error):
                        raise DialogueError('Eleven v4 returned invalid audio encoding') from None
                    if len(audio) + len(chunk) > AUDIO_LIMIT:
                        raise DialogueError('Eleven v4 generated audio exceeds its size limit')
                evidence = message.get('alignment') or message.get('normalized_alignment')
                if evidence is not None:
                    if not chunk:
                        raise DialogueError('Eleven v4 returned alignment without its PCM chunk')
                    add_alignment(alignment, evidence, len(audio) / (SAMPLE_RATE * BYTES_PER_SAMPLE),
                                  len(chunk) / (SAMPLE_RATE * BYTES_PER_SAMPLE))
                audio.extend(chunk)
                if message.get('is_final') is True:
                    completed = True
                    break
            if not completed:
                raise DialogueError('Eleven v4 speech stream did not finish within its frame limit')
    except DialogueError:
        raise
    except Exception:
        # WebSocket close reasons / failed handshakes can echo the key or provider text.
        raise DialogueError('Eleven v4 speech connection failed before completion; no automatic paid retry') from None
    if not audio or len(audio) % BYTES_PER_SAMPLE:
        raise DialogueError('Eleven v4 returned empty or incomplete PCM audio')
    if not alignment['characters']:
        raise DialogueError('Eleven v4 returned no timing evidence; narration cannot be synchronized')
    text = ''.join(alignment['characters'])
    if ' '.join(text.split()) != ' '.join(payload['text'].split()):
        raise DialogueError('Eleven v4 alignment does not cover the requested narration')
    duration = len(audio) / (SAMPLE_RATE * BYTES_PER_SAMPLE)
    if alignment['character_end_times_seconds'][-1] > duration + 0.05:
        raise DialogueError('Eleven v4 character timings exceed generated audio')
    return bytes(audio), alignment
