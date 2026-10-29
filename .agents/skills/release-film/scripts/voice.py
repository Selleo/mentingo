#!/usr/bin/env python3
"""Narration with word timings: audio.mp3 plus a word-level SRT in the written words. Every voice is told the same
text (pronunciation.speakable, in the film's language: in Polish numbers, units, dates and abbreviations in words);
captions keep the written text. Three providers:
- edge: edge-tts, Microsoft's free neural voices (pl-PL-MarekNeural, en-US-GuyNeural), whose service times each word;
  the voice in CI;
- voxcpm: VoxCPM2 (OpenBMB, Apache-2.0) on this machine's GPU, where `film.py voice-setup` installed it: one sentence at
  a time in the narrator's voice (its reference recording in the film's language), each word timed by its share of the
  sentence's syllables;
- elevenlabs: Eleven v4 Turbo through the dialogue WebSocket, or an explicitly configured legacy TTS model through
  REST with-timestamps. Character timing becomes word captions; failures never fall back or repeat a paid request.

Run with the Python that has the engine: voice.py <jobs.json>, jobs = [{"text", "sentences", "out", "engine",
"language", "voice", "lexicon"}]; voice.py --narrator <narrator.json>: the narrator's reference recordings.
"""
import asyncio
import base64
import binascii
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import pronunciation  # noqa: E402

PAUSE = 0.4  # seconds between two sentences of VoxCPM2's
SEED = 7  # each sentence drawn the same way: the same sentence sounds the same when spoken again
REFERENCE = 12  # seconds of a given recording the narrator's voice is cloned from
# how loud every sentence of VoxCPM2's is made: edge-tts's narrators measure -19.6 LUFS in every chapter, VoxCPM2's own
# chapters ranged from -25.9 to -30 LUFS; its peaks stay under the ceiling
LOUDNESS = -19.5
CEILING = 10 ** (-1.5 / 20)
ELEVENLABS_MODEL = 'eleven_v4_turbo'
ELEVENLABS_OUTPUT = 'mp3_44100_128'
ELEVENLABS_RESPONSE_LIMIT = 24 * 1024 * 1024
ELEVENLABS_TIMEOUT = 120
ELEVENLABS_TEXT_LIMIT = 6_000


def elevenlabs_config(addon, code):
    """Nonsecret narrator identity. One shared voice takes precedence across all narration languages."""
    config = addon.get('elevenlabs') or {}
    if not isinstance(config, dict):
        raise ValueError('elevenlabs must be a configuration object')
    voices = config.get('voice_ids') or {}
    if not isinstance(voices, dict):
        raise ValueError('elevenlabs.voice_ids must map language codes to voice IDs')
    voice = os.environ.get('ELEVENLABS_VOICE_ID') or config.get('voice_id') \
        or os.environ.get(f'ELEVENLABS_VOICE_ID_{code.upper()}') or voices.get(code)
    model = os.environ.get('ELEVENLABS_MODEL_ID') or config.get('model_id') or ELEVENLABS_MODEL
    if not isinstance(voice, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', voice):
        raise ValueError('Configure ELEVENLABS_VOICE_ID or elevenlabs.voice_id')
    if not isinstance(model, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', model):
        raise ValueError('Invalid ElevenLabs model_id')
    settings = config.get('voice_settings') or {}
    if not isinstance(settings, dict) or set(settings) - {'stability', 'similarity_boost', 'style', 'speed', 'use_speaker_boost'}:
        raise ValueError('Invalid ElevenLabs voice_settings')
    for name, value in settings.items():
        if name == 'use_speaker_boost':
            if not isinstance(value, bool):
                raise ValueError('ElevenLabs use_speaker_boost must be boolean')
        elif type(value) not in (int, float) or not math.isfinite(value) \
                or not ((0.7 <= value <= 1.2) if name == 'speed' else (0 <= value <= 1)):
            raise ValueError(f'Invalid ElevenLabs {name} setting')
    return {'voice': voice, 'model_id': model, 'voice_settings': dict(settings),
            'output_format': 'pcm_24000' if dialogue_model(model) else ELEVENLABS_OUTPUT,
            'apply_text_normalization': 'off'}


def dialogue_model(model):
    """Eleven v3/v4 use the dialogue protocol, never the legacy TTS endpoint."""
    return model.startswith(('eleven_v3', 'eleven_v4'))


def pcm_to_mp3(pcm):
    """Encode the verified PCM stream for the recorder's existing MP3 contract; FFmpeg adds no speech."""
    import core
    ffmpeg = core.tool('ffmpeg')
    if not ffmpeg:
        raise ValueError('FFmpeg is required to encode Eleven v4 narration')
    # The input is bounded by the transport. Use files so the encoded output is also bounded before reading it.
    with tempfile.TemporaryDirectory(prefix='elevenlabs-voice-') as folder:
        source, target = Path(folder) / 'audio.pcm', Path(folder) / 'audio.mp3'
        source.write_bytes(pcm)
        try:
            result = subprocess.run([ffmpeg, '-v', 'error', '-nostdin', '-f', 's16le', '-ar', '24000', '-ac', '1',
                                     '-i', str(source), '-c:a', 'libmp3lame', '-b:a', '128k', str(target)],
                                    capture_output=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired):
            raise ValueError('Could not encode Eleven v4 narration') from None
        if result.returncode or not target.is_file() or not 0 < target.stat().st_size <= ELEVENLABS_RESPONSE_LIMIT:
            raise ValueError('Could not encode Eleven v4 narration')
        return target.read_bytes()


class NoVoiceRedirects(urllib.request.HTTPRedirectHandler):
    """Never forward the provider key, including to a redirect on another origin."""

    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def elevenlabs_request(voice, payload, api_key):
    """A bounded, single paid request to the fixed provider origin; failures never echo bodies or credentials."""
    url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format={ELEVENLABS_OUTPUT}'
    request = urllib.request.Request(url, json.dumps(payload).encode('utf-8'),
                                     headers={'Content-Type': 'application/json', 'xi-api-key': api_key}, method='POST')
    try:
        opener = urllib.request.build_opener(NoVoiceRedirects())
        with opener.open(request, timeout=ELEVENLABS_TIMEOUT) as response:
            raw = response.read(ELEVENLABS_RESPONSE_LIMIT + 1)
    except urllib.error.HTTPError as error:
        raise ValueError(f'ElevenLabs speech request failed (HTTP {error.code}); no automatic paid retry') from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise ValueError('ElevenLabs speech request failed or timed out; no automatic paid retry') from None
    if len(raw) > ELEVENLABS_RESPONSE_LIMIT:
        raise ValueError('ElevenLabs response exceeds the size limit')
    try:
        result = json.loads(raw)
    except (UnicodeError, json.JSONDecodeError):
        raise ValueError('ElevenLabs returned invalid JSON') from None
    if not isinstance(result, dict):
        raise ValueError('ElevenLabs returned an invalid response')
    return result


def aligned_words(alignment, spoken):
    """Validate character timing evidence and fold it into the word events used by captions and montage."""
    if not isinstance(alignment, dict):
        raise ValueError('ElevenLabs returned no character alignment')
    chars = alignment.get('characters')
    starts = alignment.get('character_start_times_seconds')
    ends = alignment.get('character_end_times_seconds')
    if not isinstance(chars, list) or not isinstance(starts, list) or not isinstance(ends, list) \
            or not chars or len(chars) != len(starts) or len(chars) != len(ends) \
            or any(not isinstance(char, str) or len(char) != 1 for char in chars):
        raise ValueError('ElevenLabs returned malformed character alignment')
    text = ''.join(chars)
    if text != spoken:
        raise ValueError('ElevenLabs alignment does not match the requested narration')
    previous_start = previous_end = 0.0
    for start, end in zip(starts, ends):
        if type(start) not in (int, float) or type(end) not in (int, float) \
                or not math.isfinite(start) or not math.isfinite(end) \
                or start < previous_start or end < previous_end or start < 0 or end < start or end > 3_600:
            raise ValueError('ElevenLabs returned invalid character timestamps')
        previous_start, previous_end = start, end
    events = []
    for match in re.finditer(r'\S+', text):
        if not any(char.isalnum() for char in match.group()):
            continue
        start, end = starts[match.start()], ends[match.end() - 1]
        if end <= start or (events and start < (events[-1]['offset'] + events[-1]['duration']) / 1e7):
            raise ValueError('ElevenLabs returned overlapping or empty word timestamps')
        events.append({'type': 'WordBoundary', 'offset': round(start * 1e7), 'duration': round((end - start) * 1e7),
                       'text': match.group()})
    if not events:
        raise ValueError('ElevenLabs returned no word timings')
    return events


def elevenlabs(jobs):
    """One request per chapter, preserving written captions; the key is read only here and never serialized."""
    results = []
    for job in jobs:
        try:
            api_key = os.environ.get('ELEVENLABS_API_KEY')
            if not api_key:
                raise ValueError('ELEVENLABS_API_KEY is required for ElevenLabs narration')
            config = elevenlabs_config({'elevenlabs': {'voice_id': job.get('voice'), 'model_id': job.get('model_id'),
                                                       'voice_settings': job.get('voice_settings')}}, job.get('language') or 'en')
            spoken, units = pronunciation.speakable(job['text'], job.get('lexicon') or {}, job.get('language') or 'en')
            if not spoken.strip() or len(spoken) > ELEVENLABS_TEXT_LIMIT:
                raise ValueError(f'ElevenLabs narration must contain 1-{ELEVENLABS_TEXT_LIMIT} characters per flow')
            payload = {'text': spoken, 'model_id': config['model_id'], 'voice_settings': config['voice_settings'],
                       'apply_text_normalization': 'off'}
            # Multilingual v2 does not accept language_code. The written/spoken text already has its language.
            if config['model_id'] != 'eleven_multilingual_v2':
                payload['language_code'] = job.get('language') or 'en'
            if dialogue_model(config['model_id']):
                import elevenlabs_v4
                pcm, alignment = elevenlabs_v4.synthesize(config['voice'], payload, api_key)
                # Dialogue may add boundary whitespace; transport checked every requested word before this point.
                events = aligned_words(alignment, ''.join(alignment['characters']))
                audio = pcm_to_mp3(pcm)
            else:
                answer = elevenlabs_request(config['voice'], payload, api_key)
                events = aligned_words(answer.get('alignment') or answer.get('normalized_alignment'), spoken)
                audio_base64 = answer.get('audio_base64')
                if not isinstance(audio_base64, str):
                    raise ValueError('ElevenLabs returned no audio')
                try:
                    audio = base64.b64decode(audio_base64, validate=True)
                except (ValueError, binascii.Error):
                    raise ValueError('ElevenLabs returned invalid audio encoding') from None
            if not audio:
                raise ValueError('ElevenLabs returned empty audio')
            differently = []
            captions = srt(pronunciation.written_events(units, events, differently))
            out = Path(job['out'])
            out.mkdir(parents=True, exist_ok=True)
            (out / 'audio.mp3').write_bytes(audio)
            (out / 'subtitles.srt').write_text(captions, encoding='utf-8')
            results.append({'out': str(out), 'terms': pronunciation.used_terms(units), 'read_differently': differently})
        except (KeyError, TypeError, ValueError) as error:
            # Only our own validation/provider errors are returned, never an arbitrary transport response or secret.
            message = str(error) if isinstance(error, ValueError) else 'Invalid ElevenLabs narration job'
            results.append({'out': str(job.get('out') or ''), 'error': message})
    return results


async def speak(job):
    import edge_tts
    text = job['text']
    spoken, units = pronunciation.speakable(text, job.get('lexicon') or {}, job.get('language') or 'pl')
    out = Path(job['out'])
    out.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            events = []
            with open(out / 'audio.mp3', 'wb') as audio:
                async for event in edge_tts.Communicate(spoken, job.get('voice') or 'pl-PL-MarekNeural', boundary='WordBoundary').stream():
                    if event['type'] == 'audio':
                        audio.write(event['data'])
                    elif event['type'] == 'WordBoundary':
                        events.append(event)
            maker, differently = edge_tts.SubMaker(), []
            for event in pronunciation.written_events(units, events, differently):
                maker.feed(event)
            (out / 'subtitles.srt').write_text(maker.get_srt(), encoding='utf-8')
            # words the voice read differently (worth a "pronunciation" entry in the project add-on when they sound wrong)
            return {'out': str(out), 'terms': pronunciation.used_terms(units), 'read_differently': differently}
        except Exception as error:  # noqa: BLE001 the free service drops connections now and then
            if attempt == 2:
                return {'out': str(out), 'error': str(error)[:300]}
            await asyncio.sleep(1 + attempt)


async def edge(jobs):
    return await asyncio.gather(*(speak(job) for job in jobs))


def srt(events):
    """A word-level SRT of word events (offsets and durations in 100 ns, as edge-tts gives them)."""
    def stamp(ticks):
        ms = int(round(ticks / 10_000))
        return f'{ms // 3_600_000:02d}:{ms // 60_000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
    return ''.join(f"{n}\n{stamp(e['offset'])} --> {stamp(e['offset'] + e['duration'])}\n{e['text']}\n\n"
                   for n, e in enumerate(events, 1))


def weight(word):
    """A spoken word's share of its sentence's time: its syllables (vowel groups), and the pause after a comma."""
    return max(1, len(re.findall(r'[aąeęioóuy]+', word.lower()))) + (0.8 if word.endswith((',', ';', ':', '—', '–')) else 0)


def timed(words, start, seconds):
    """Word events (as edge-tts gives them) for the spoken ``words`` of one sentence heard from ``start`` for
    ``seconds``."""
    shares = [weight(word) for word in words]
    events, at = [], start
    for word, share in zip(words, shares):
        length = seconds * share / sum(shares)
        events.append({'type': 'WordBoundary', 'offset': int(round(at * 1e7)), 'duration': int(round(length * 1e7)),
                       'text': word})
        at += length
    return events


def trimmed(wav, rate, floor=0.01, margin=0.05):
    """The sound of ``wav`` without its silent start and end (``margin`` seconds kept)."""
    import numpy
    loud = numpy.flatnonzero(numpy.abs(wav) > floor)
    if not len(loud):
        return wav
    return wav[max(0, loud[0] - int(margin * rate)):min(len(wav), loud[-1] + int(margin * rate))]


def k_weighted(wav, rate):
    """``wav`` through ITU-R BS.1770's K-weighting (a high shelf, then a high pass), as loudness is measured."""
    import math
    from scipy.signal import lfilter
    gain, q, fc = 3.999843853973347, 0.7071752369554196, 1681.974450955533
    a_, w0 = 10 ** (gain / 40), 2 * math.pi * fc / rate
    alpha, cos = math.sin(w0) / (2 * q), math.cos(w0)
    wav = lfilter([a_ * ((a_ + 1) + (a_ - 1) * cos + 2 * math.sqrt(a_) * alpha), -2 * a_ * ((a_ - 1) + (a_ + 1) * cos),
                   a_ * ((a_ + 1) + (a_ - 1) * cos - 2 * math.sqrt(a_) * alpha)],
                  [(a_ + 1) - (a_ - 1) * cos + 2 * math.sqrt(a_) * alpha, 2 * ((a_ - 1) - (a_ + 1) * cos),
                   (a_ + 1) - (a_ - 1) * cos - 2 * math.sqrt(a_) * alpha], wav)
    q, fc = 0.5003270373238773, 38.13547087602444
    w0 = 2 * math.pi * fc / rate
    alpha, cos = math.sin(w0) / (2 * q), math.cos(w0)
    return lfilter([(1 + cos) / 2, -(1 + cos), (1 + cos) / 2], [1 + alpha, -2 * cos, 1 - alpha], wav)


def loudness(wav, rate):
    """Integrated loudness in LUFS (ITU-R BS.1770: K-weighted 400 ms blocks, gated at -70 LUFS and 10 LU under their
    mean); None for silence."""
    import numpy
    weighted = k_weighted(numpy.asarray(wav, dtype='float64'), rate)
    block, step = int(0.4 * rate), int(0.1 * rate)
    power = numpy.array([numpy.mean(weighted[at:at + block] ** 2)
                         for at in range(0, max(1, len(weighted) - block + 1), step)])
    lufs = lambda value: -0.691 + 10 * numpy.log10(numpy.maximum(value, 1e-12))
    kept = power[lufs(power) > -70]
    if not len(kept):
        return None
    kept = kept[lufs(kept) > lufs(kept.mean()) - 10]
    return float(lufs(kept.mean()))


def levelled(wav, rate, target=LOUDNESS, ceiling=CEILING):
    """``wav`` made ``target`` LUFS loud, its peaks held under ``ceiling`` by a limiter that reacts within 5 ms."""
    import numpy
    from scipy.ndimage import minimum_filter1d
    measured = loudness(wav, rate)
    if measured is None:
        return wav
    wav = numpy.asarray(wav, dtype='float64') * 10 ** ((target - measured) / 20)
    window = max(1, int(0.005 * rate))
    gain = minimum_filter1d(numpy.minimum(1.0, ceiling / numpy.maximum(numpy.abs(wav), 1e-9)), size=2 * window + 1)
    gain = numpy.convolve(gain, numpy.ones(window) / window, mode='same')  # every sample near a peak held under it
    return (wav * gain).astype('float32')


def model_of(path):
    os.environ.setdefault('TORCHDYNAMO_DISABLE', '1')  # no torch.compile: Triton would need the Python headers
    from voxcpm import VoxCPM
    return VoxCPM.from_pretrained(path, load_denoiser=False)


def voxcpm(jobs):
    """Every job with one VoxCPM2 model (the one beside the narrator's recording): each sentence cloned from that
    recording, PAUSE between them."""
    import numpy
    import soundfile
    import torch
    model = model_of(str(Path(jobs[0]['voice']).parent / 'model'))
    rate = model.tts_model.sample_rate
    results = []
    for job in jobs:
        out = Path(job['out'])
        out.mkdir(parents=True, exist_ok=True)
        try:
            pieces, events, units, clock = [], [], [], 0.0
            for sentence in job['sentences']:
                spoken, said = pronunciation.speakable(sentence, job.get('lexicon') or {}, job.get('language') or 'pl')
                torch.manual_seed(SEED)
                wav = levelled(trimmed(model.generate(text=spoken, reference_wav_path=job['voice'], cfg_value=2.0,
                                                      inference_timesteps=10), rate), rate)  # every sentence as loud
                if pieces:
                    pieces.append(numpy.zeros(int(PAUSE * rate), dtype=wav.dtype))
                    clock += PAUSE
                words = [w for _, spoken_words, _ in said for w in spoken_words if any(c.isalnum() for c in w)]
                events += timed(words, clock, len(wav) / rate)
                units += said
                pieces.append(wav)
                clock += len(wav) / rate
            soundfile.write(str(out / 'audio.mp3'), numpy.concatenate(pieces), rate, format='MP3')
            (out / 'subtitles.srt').write_text(srt(pronunciation.written_events(units, events)), encoding='utf-8')
            results.append({'out': str(out), 'terms': pronunciation.used_terms(units), 'read_differently': []})
        except Exception as error:  # noqa: BLE001 reported per chapter, as edge's
            results.append({'out': str(out), 'error': str(error)[:300]})
    return results


def narrator(asked):
    """The narrator's reference recording in each language (<folder>/narrator-<code>.wav): its line said by the wanted
    voice, cloned from the first REFERENCE seconds of a recording (``source``, cut at its quietest moment near the end)
    or from the voice the ``design`` describes (said once, in English). Returns the device VoxCPM2 runs on and how
    fast it speaks there."""
    import time
    import numpy
    import soundfile
    import torch
    asked = json.loads(Path(asked).read_text(encoding='utf-8'))
    model = model_of(asked['model'])
    rate = model.tts_model.sample_rate
    folder = Path(asked['folder'])
    voice = folder / 'narrator.wav'  # the wanted voice, which every language's line is cloned from
    if asked.get('source'):
        wav, source_rate = soundfile.read(asked['source'], dtype='float32')
        wav = wav if wav.ndim == 1 else wav.mean(axis=1)
        end = min(len(wav), REFERENCE * source_rate)
        window = int(0.05 * source_rate)
        quiet = [numpy.abs(wav[at:at + window]).mean() for at in range(int(end * 0.6), end - window, window)]
        soundfile.write(str(voice), wav[:int(end * 0.6) + window * int(numpy.argmin(quiet))] if quiet else wav[:end],
                        source_rate)
    else:
        torch.manual_seed(42)
        soundfile.write(str(voice), trimmed(model.generate(text=asked['design'] + asked['lines']['en'], cfg_value=2.0,
                                                           inference_timesteps=10), rate), rate)
    seconds = spoken = 0.0
    for code, line in asked['lines'].items():
        torch.manual_seed(SEED)
        started = time.time()
        wav = trimmed(model.generate(text=line, reference_wav_path=str(voice), cfg_value=2.0, inference_timesteps=10), rate)
        seconds, spoken = seconds + time.time() - started, spoken + len(wav) / rate
        soundfile.write(str(folder / f'narrator-{code}.wav'), wav, rate)
    return {'device': str(next(model.tts_model.parameters()).device).split(':')[0],
            'seconds_per_second': round(seconds / max(spoken, 0.1), 2), 'languages': sorted(asked['lines'])}


def main():
    if sys.argv[1] == '--narrator':
        print(json.dumps(narrator(sys.argv[2])))
        return
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    engines = {job.get('engine') or 'edge' for job in jobs}
    if engines == {'voxcpm'}:
        results = voxcpm(jobs)
    elif engines == {'elevenlabs'}:
        results = elevenlabs(jobs)
    elif engines == {'edge'}:
        results = asyncio.run(edge(jobs))
    else:
        raise SystemExit('Voice jobs must use one supported engine: edge, voxcpm or elevenlabs')
    print(json.dumps(results, ensure_ascii=False))


if __name__ == '__main__':
    main()
