#!/usr/bin/env python3
"""Narration with word timings: audio.mp3 plus a word-level SRT in the written words. Every voice is told the same
text (pronunciation.speakable, in the film's language: in Polish numbers, units, dates and abbreviations in words);
captions keep the written text. Two voices:
- edge: edge-tts, Microsoft's free neural voices (pl-PL-MarekNeural, en-US-GuyNeural), whose service times each word;
  the voice in CI;
- voxcpm: VoxCPM2 (OpenBMB, Apache-2.0) on this machine's GPU, where `film.py voice-setup` installed it: one sentence at
  a time in the narrator's voice (its reference recording in the film's language), each word timed by its share of the
  sentence's syllables.

Run with the Python that has the engine: voice.py <jobs.json>, jobs = [{"text", "sentences", "out", "engine",
"language", "voice", "lexicon"}]; voice.py --narrator <narrator.json>: the narrator's reference recordings.
"""
import asyncio
import json
import os
from pathlib import Path
import re
import sys

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
    results = voxcpm(jobs) if engines == {'voxcpm'} else asyncio.run(edge(jobs))
    print(json.dumps(results, ensure_ascii=False))


if __name__ == '__main__':
    main()
