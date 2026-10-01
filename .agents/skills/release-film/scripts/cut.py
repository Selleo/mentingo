"""The film from the story: narration per chapter, each filmed test cut to its narration, one render.

A chapter's sentences are pinned to actions of its test; the montage lands each action as its sentence starts, plays
the page's motion at normal speed, holds still pages (the sharp stills) while the voice talks, draws the pointer,
moves an eased camera and leaves out loading, blank pages and redirect hops.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import core
import editor
import language
import metrics
import montage
import pronunciation
import takes

POLISH = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ„”–'
CHAPTER_TAIL = 1.5  # seconds of the test kept after a chapter's last narrated action
# the local narrator, VoxCPM2 (OpenBMB, Apache-2.0), made ready by `film.py voice-setup`: its own Python, the model, the
# narrator's reference recording in each language (narrator-<code>.wav) and ready.json
VOXCPM = core.HOME / 'tools' / 'voxcpm'
VOXCPM_MODEL = 'openbmb/VoxCPM2'
# the narrator VoxCPM2 is asked for when no recording of one is given
NARRATOR = '(A calm, professional male narrator in his thirties, warm and clear voice, moderate pace)'
# A sentence ends at least PAUSE seconds before the next one starts, while the picture holds what it named: a little
# longer than the voice's own pause (a film whose sentences followed each other at once was too fast to follow, and one
# read slower was too slow)
PAUSE = montage.SPEECH_PAUSE


# DejaVu Sans where fontconfig does not find it (Linux distributions; macOS: Homebrew's font-dejavu cask), then macOS's
# own Arial, which covers Polish
FONT_CANDIDATES = ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf',
                   str(Path.home() / 'Library' / 'Fonts' / 'DejaVuSans.ttf'), '/Library/Fonts/DejaVuSans.ttf',
                   '/System/Library/Fonts/Supplemental/Arial.ttf')


def font_path():
    if shutil.which('fc-match'):
        out = subprocess.run(['fc-match', '-f', '%{file}', 'DejaVu Sans'], capture_output=True, text=True, timeout=60).stdout.strip()
        if out and Path(out).is_file() and 'dejavu' in Path(out).name.lower():
            return out
    for candidate in FONT_CANDIDATES:
        if Path(candidate).is_file():
            return candidate
    raise SystemExit('No Polish-capable TrueType font found (install DejaVu Sans)')


def font_family(path):
    """The family of a font_path font, as the film's summary names it."""
    return 'DejaVu Sans' if 'dejavu' in Path(path).name.lower() else Path(path).stem


def covers(font, text):
    """Whether ``font`` has every letter of ``text``; None when that cannot be checked (no fontconfig: macOS without
    Homebrew's), and an unchecked brand font is not kept. A variable font has a charset per named instance: each ends
    its line (written one after another, "fb01-fb02" and "20-7e" read "fb01-fb0220-7e")."""
    if not shutil.which('fc-query'):
        return None
    completed = subprocess.run(['fc-query', '--format', '%{charset}\n', str(font)], capture_output=True, text=True, timeout=60)
    if completed.returncode != 0:
        return False
    ranges = []
    for part in completed.stdout.split():
        low, _, high = part.partition('-')
        try:
            ranges.append((int(low, 16), int(high or low, 16)))
        except ValueError:  # not a range: its letters count as missing
            continue
    return all(any(a <= ord(c) <= b for a, b in ranges) for c in text)


def film_font(addon, text=''):
    """(path, family, warning): the add-on's brand font (``brand.font``: family, source URL of an OpenType/TrueType
    file) when it covers Polish and every letter of the film's ``text`` (a quoted French label: è, ç), else DejaVu
    Sans (macOS without it: Arial)."""
    font = (addon.get('brand') or {}).get('font') or {}
    fallback = font_path()
    plain = font_family(fallback)
    if not font.get('source'):
        return fallback, plain, None
    family = font.get('family', 'brand font')
    cache = core.HOME / 'fonts'
    target = cache / f"{hashlib.sha256(font['source'].encode()).hexdigest()[:16]}.otf"
    try:
        if not target.exists():
            with urllib.request.urlopen(font['source'], timeout=30) as response:
                data = response.read()
            cache.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    except OSError as error:
        return fallback, plain, f'{family} unavailable ({str(error)[:120]}): {plain} used'
    import render_demo
    text = text.translate(render_demo.LOOKALIKES)  # the renderer writes these as ASCII (a "2×1" size: "2x1")
    wanted = ''.join(sorted(set(POLISH + ''.join(c for c in text if not c.isspace()))))
    try:
        checked = covers(target, wanted)
        missing = ''.join(c for c in wanted if not covers(target, c))[:12] if checked is False else ''
    except (OSError, ValueError, subprocess.SubprocessError) as error:  # fontconfig cannot read it: the film goes on
        return fallback, plain, f'{family} not checked ({str(error)[:120]}): {plain} used'
    if checked is None:
        return fallback, plain, f'{family} not checked for Polish letters (no fc-query: install fontconfig): {plain} used'
    if not checked:
        return fallback, plain, f'{family} lacks the glyphs {missing!r}: {plain} used'
    return str(target), family, None


def film_colors(addon):
    """({'frame': …, 'accent': …} or None, warning): the add-on's brand colours (``brand.colors``, #rrggbb) for the
    film; colours the renderer does not take leave it in its own (a warning, never a lost film)."""
    import render_demo
    colors = (addon.get('brand') or {}).get('colors')
    if colors is None:
        return None, None
    try:
        render_demo.colors_of(colors)
    except ValueError as error:
        return None, f'brand colours not used ({error})'
    return dict(colors), None


def lexicon(addon, code=language.DEFAULT):
    """How the voice says names: in a Polish film the common lexicon (abbreviations a Polish voice says as letters),
    then the add-on's own (``pronunciation``). English words stay as written: both voices say them best so (Whisper
    heard 8 of 8 names right as written, 4 and 6 of 8 respelled in Polish letters)."""
    words = {}
    if code == 'pl':
        words = {k: v for k, v in (core.load(core.SKILL / 'projects' / 'common-pronunciation.json', {}) or {}).items()
                 if not k.startswith('_')}
    words.update(addon.get('pronunciation') or {})
    return words


def voice_ready():
    """Whether VoxCPM2 is set up here (`film.py voice-setup`)."""
    return (VOXCPM / 'ready.json').is_file() and (VOXCPM / 'venv' / 'bin' / 'python').exists()


def engine():
    """The narrator: RELEASE_FILM_VOICE when set (edge or voxcpm); else edge-tts, Microsoft's free voices, locally as
    in CI. VoxCPM2 clones every sentence anew, and its tone changed from chapter to chapter; it speaks only when asked."""
    chosen = os.environ.get('RELEASE_FILM_VOICE')
    if chosen and chosen not in ('edge', 'voxcpm'):
        raise SystemExit(f'RELEASE_FILM_VOICE must be edge or voxcpm, not {chosen!r}')
    return chosen or 'edge'


def spoken(run, story):
    """Whether the run's voice (voice/c<n>) speaks the story's sentences as they are now."""
    cached = core.load(Path(run) / 'voice' / 'done.json') or {}
    texts = [' '.join(s['text'].strip() for s in chapter['sentences']) for chapter in story['chapters']]
    return [j.get('text') for j in cached.get('jobs') or []] == texts and all(
        (Path(run) / 'voice' / f'c{n}' / name).is_file() for n in range(1, len(texts) + 1) for name in ('audio.mp3', 'subtitles.srt'))


def narrate(run, story, addon, root=None):
    """audio.mp3 and a word SRT per chapter in ``root`` (default <run>/voice), in the film's language by the narrator
    ``engine`` chooses; a chapter spoken already with the same sentences, voice and lexicon terms is kept (the review
    speaks, then make speaks only what the review rewrote)."""
    run = Path(run)
    root = Path(root) if root else run / 'voice'
    said = language.texts(core.load(run / 'sources.json') or {})
    words, voice = lexicon(addon, said['code']), engine()
    reference = VOXCPM / f"narrator-{said['code']}.wav"
    if voice == 'voxcpm' and not (voice_ready() and reference.is_file()):
        raise SystemExit(f"VoxCPM2 speaks, but its {said['name']} narrator is not set up here: film.py voice-setup")
    jobs = []
    for index, chapter in enumerate(story['chapters']):
        sentences = [s['text'].strip() for s in chapter['sentences']]
        text = ' '.join(sentences)
        used = pronunciation.used_terms(pronunciation.speakable(text, words, said['code'])[1])  # a term elsewhere changes no job
        jobs.append({'text': text, 'sentences': sentences, 'out': str(root / f'c{index + 1}'), 'engine': voice,
                     'language': said['code'], 'lexicon': {term: words[term] for term in used},
                     'voice': str(reference) if voice == 'voxcpm' else addon.get('voice') or said['edge_voice'],
                     'pause': PAUSE})
    done = root / 'done.json'
    cached = core.load(done) or {}
    before = {job['out']: (job, result) for job, result in zip(cached.get('jobs') or [], cached.get('results') or [])}
    todo = [job for job in jobs if before.get(job['out'], (None,))[0] != job
            or not all((Path(job['out']) / name).is_file() for name in ('audio.mp3', 'subtitles.srt'))]
    if todo:
        core.save(root / 'jobs.json', todo)
        core.mark(root.parent, 'voice', 'start', f'{voice}: {len(todo)} of {len(jobs)} chapters')
        python = str(VOXCPM / 'venv' / 'bin' / 'python') if voice == 'voxcpm' else core.ensure_tts()
        out = core.sh([python, str(core.SKILL / 'scripts' / 'voice.py'), str(root / 'jobs.json')],
                      timeout=3600 if voice == 'voxcpm' else 600).stdout
        core.mark(root.parent, 'voice', 'end')
        results = json.loads(out.strip().splitlines()[-1])
        failed = [r for r in results if r.get('error')]
        if failed:
            raise SystemExit(f'narration failed: {failed}')
        for job in todo:
            paced(core.tool('ffmpeg') or 'ffmpeg', job['out'], job['sentences'])
        before.update({job['out']: (job, result) for job, result in zip(todo, results)})
    results = [before[job['out']][1] for job in jobs]
    core.save(done, {'jobs': jobs, 'results': results})
    return results


def voice_check(code='en'):
    """One sentence in language ``code`` spoken by the narrator a run would use here (edge-tts in CI, a service that
    may refuse a cloud machine), before a film spends anything: {'ok', 'engine', 'seconds'} or the error."""
    sentence = language.texts(code)['intro'].format(name='Demo')
    with tempfile.TemporaryDirectory(prefix='rf-voice-') as folder:
        core.save(Path(folder) / 'sources.json', {'language': code})
        started = time.time()
        try:
            narrate(folder, {'chapters': [{'sentences': [{'text': sentence}]}]}, {})
        except (SystemExit, Exception) as failed:  # noqa: BLE001 the check reports every failure
            return {'ok': False, 'engine': engine(), 'error': str(failed)[:500]}
        audio = Path(folder) / 'voice' / 'c1' / 'audio.mp3'
        return {'ok': audio.is_file() and audio.stat().st_size > 0, 'engine': engine(),
                'seconds': round(time.time() - started, 1)}


def voice_setup(narrator=None):
    """VoxCPM2 as this machine's narrator: its own Python (uv's 3.12 when uv is there), the model (about 5 GB) and the
    narrator's reference recording in each film language, each a line of it said in the wanted voice (``narrator``: a
    recording of that voice, its first seconds used; else the voice NARRATOR describes), then ready.json. It needs an
    NVIDIA GPU: on a CPU a film's voice would take over an hour (ready stays unwritten)."""
    python = VOXCPM / 'venv' / 'bin' / 'python'
    uv = shutil.which('uv')
    if not python.exists():
        core.sh([uv, 'venv', '-q', '--python', '3.12', str(VOXCPM / 'venv')] if uv
                else [sys.executable, '-m', 'venv', str(VOXCPM / 'venv')], timeout=900)
    pip = [uv, 'pip', 'install', '-q', '--python', str(python)] if uv else [str(python), '-m', 'pip', 'install', '-q']
    core.sh(pip + ['voxcpm', 'soundfile'], timeout=3600)
    core.sh([str(python), '-c', 'import sys; from huggingface_hub import snapshot_download; '
             'snapshot_download(sys.argv[1], local_dir=sys.argv[2])', VOXCPM_MODEL, str(VOXCPM / 'model')], timeout=3600)
    asked = core.save(VOXCPM / 'narrator.json', {
        'model': str(VOXCPM / 'model'), 'folder': str(VOXCPM), 'source': str(narrator) if narrator else None,
        'design': NARRATOR, 'lines': {code: texts['narrator'] for code, texts in language.TEXTS.items()}})
    made = core.sh([str(python), str(core.SKILL / 'scripts' / 'voice.py'), '--narrator', str(asked)], timeout=1800).stdout
    found = json.loads(made.strip().splitlines()[-1])
    if found.get('device') != 'cuda':
        return dict(found, ok=False, error='no CUDA GPU: VoxCPM2 would need over an hour for a film here; edge-tts '
                                           'stays the narrator')
    core.save(VOXCPM / 'ready.json', dict(found, at=core.now()))
    return dict(found, ok=True, narrators=sorted(str(p) for p in VOXCPM.glob('narrator-*.wav')))


def voice_waits(chapter, folder, voice_dir, limit=1.0, language=None):
    """Where the spoken voice (its real word timings) would pause for the picture, longer than ``limit`` seconds:
    [{'sentence', 'seconds', 'fix'}]."""
    spec, capture = chapter_setup(chapter, folder, language=language)
    words = montage.words_from_srt((Path(voice_dir) / 'subtitles.srt').read_text(encoding='utf-8'))
    film = montage.cut(spec, capture, words, audio_duration=audio_seconds(Path(voice_dir) / 'audio.mp3'))
    starts = montage.sentence_starts(words, spec.get('sentences'))
    found = []
    for at, seconds in film['silences']:
        if seconds <= limit:
            continue
        number = next((i + 1 for i, start in enumerate(starts) if abs(start - at) < 0.05), None)
        found.append({'sentence': number, 'seconds': round(seconds, 1),
                      'fix': f'the actions before sentence {number} outlast the words before it by {seconds:.1f} s: pin '
                             f'sentence {number} to a later action, add a short sentence pinned to an action in between, '
                             f'or lengthen sentence {(number or 2) - 1}'})
    return found


def audio_seconds(path):
    out = subprocess.run([core.tool('ffprobe') or 'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'json', str(path)], capture_output=True, text=True, check=True, timeout=120).stdout
    return float(json.loads(out)['format']['duration'])


def splice(ffmpeg, audio, silences, target, codec):
    """``audio`` with ``silences`` ``[(time in it, seconds)]`` inserted, encoded with ``codec`` into ``target``."""
    bounds = [0.0] + [t for t, _ in silences] + [None]
    form = 'aformat=sample_fmts=fltp:sample_rates=24000:channel_layouts=mono'
    graph = [f'[0:a]{form},asplit={len(bounds) - 1}' + ''.join(f'[in{i}]' for i in range(len(bounds) - 1))]
    parts = []
    for i in range(len(bounds) - 1):
        end = f':end={bounds[i + 1]:.3f}' if bounds[i + 1] is not None else ''
        graph.append(f'[in{i}]atrim=start={bounds[i]:.3f}{end},asetpts=PTS-STARTPTS[s{i}]')
        parts.append(f'[s{i}]')
        if i < len(silences):
            graph.append(f'aevalsrc=0:c=mono:s=24000:d={silences[i][1]:.3f},{form}[z{i}]')
            parts.append(f'[z{i}]')
    graph.append(''.join(parts) + f'concat=n={len(parts)}:v=0:a=1[out]')
    core.sh([ffmpeg, '-v', 'error', '-y', '-i', str(audio), '-filter_complex', ';'.join(graph), '-map', '[out]', *codec,
             str(target)], timeout=300)


def paced(ffmpeg, folder, sentences):
    """The narration in ``folder`` (audio.mp3 and its word SRT) with at least PAUSE between two sentences: the silence
    goes in halfway between one sentence's last word and the next one's first, and the words after it move."""
    folder = Path(folder)
    words = montage.words_from_srt((folder / 'subtitles.srt').read_text(encoding='utf-8'))
    starts, ends = montage.sentence_starts(words, sentences), montage.sentence_ends(words, sentences)
    silences = [(round((ends[i - 1] + starts[i]) / 2, 3), round(PAUSE - (starts[i] - ends[i - 1]), 3))
                for i in range(1, len(starts)) if starts[i] - ends[i - 1] < PAUSE - 0.05]
    if not silences:
        return
    splice(ffmpeg, folder / 'audio.mp3', silences, folder / 'paced.mp3', ['-c:a', 'libmp3lame', '-b:a', '64k'])
    (folder / 'paced.srt').write_text(montage.shifted_srt(words, silences), encoding='utf-8')
    (folder / 'paced.mp3').replace(folder / 'audio.mp3')
    (folder / 'paced.srt').replace(folder / 'subtitles.srt')


def retime(ffmpeg, audio, srt, words, silences, folder):
    """The narration with silences inserted where it waits for the picture, and its word timings shifted."""
    if not silences:
        return str(audio), str(srt)
    target, shifted = folder / 'film-narration.wav', folder / 'film-subtitles.srt'
    splice(ffmpeg, audio, silences, target, ['-c:a', 'pcm_s16le'])
    shifted.write_text(montage.shifted_srt(words, silences), encoding='utf-8')
    return str(target), str(shifted)


DOCUMENT_REACH = 3  # a download this many actions after the chapter's last pinned one still ends the chapter


def document(chapter, capture):
    """The downloaded PDF a chapter ends on and the sentence its first page starts under, (doc, sentence number), or
    (None, None): the first sentence pinned to the download's action or a later one; a download right after the last
    pinned action (the writer pinned the sentence about it to the click before) comes under the last sentence."""
    beats = [s.get('action') for s in chapter['sentences']]
    pinned = [b for b in beats if b is not None]
    for doc in capture.get('documents') or []:
        beat = next((n for n, action in enumerate(beats, 1) if action is not None and action >= doc['step']), None)
        if beat:
            return doc, beat
        if pinned and 0 < doc['step'] - max(pinned) <= DOCUMENT_REACH:
            return doc, len(beats)
    return None, None


def document_still(doc, crop=(0, 0.02, 1, 0.45), cached_only=False):
    """The top of a downloaded PDF's first page as an image (readable at film size), rendered once; None without
    pdftoppm (on macOS without it, Quick Look renders the page)."""
    target = Path(doc['file']).with_suffix('.page1.png')
    if target.is_file():
        return target
    if cached_only:
        raise SystemExit(f'cached document image missing: {target}; prepare it in a separate copy of the run first')
    tool = shutil.which('pdftoppm')
    prefix = Path(doc['file']).with_suffix('.render')
    if tool:
        subprocess.run([tool, '-png', '-r', '120', '-f', '1', '-l', '1', doc['file'], str(prefix)], capture_output=True, timeout=60)
        rendered = next(iter(sorted(prefix.parent.glob(prefix.name + '*.png'))), None)
    elif core.DARWIN and shutil.which('qlmanage'):  # macOS without poppler: Quick Look draws page 1 (A4: as at 120 dpi)
        prefix.mkdir(exist_ok=True)
        subprocess.run(['qlmanage', '-t', '-s', '1403', '-o', str(prefix), doc['file']], capture_output=True, timeout=60)
        rendered = next(iter(sorted(prefix.glob('*.png'))), None)
    else:
        return None
    if not rendered:
        return None
    fx, fy, fw, fh = crop
    subprocess.run([core.tool('ffmpeg'), '-v', 'error', '-y', '-i', str(rendered), '-vf',
                    f'crop=iw*{fw}:ih*{fh}:iw*{fx}:ih*{fy}', str(target)], capture_output=True, timeout=60)
    rendered.unlink(missing_ok=True)
    if prefix.is_dir():
        shutil.rmtree(prefix, ignore_errors=True)
    return target if target.is_file() else None


def chapter_setup(chapter, folder, cached_only=False, language=None):
    """(spec, capture) of a chapter for the montage: the test up to shortly after its last narrated action (earlier
    steps run off film), each sentence a beat on the action it is pinned to (``language``: the film's, for the labels
    the montage adds)."""
    capture = core.load(Path(folder) / 'capture.json')
    beats = [s.get('action') for s in chapter['sentences']]
    pinned = [b for b in beats if b is not None]
    first, last = (min(pinned), max(pinned)) if pinned else (0, len(capture['steps']) - 1)
    steps = capture['steps'][:last + 1]
    end = min(capture['end'], steps[-1]['b'] + CHAPTER_TAIL)
    following = next((s for s in capture['steps'][last + 1:] if s.get('acting') or s.get('navigate')), None)
    if following is not None:  # the tail never shows the next action (a click that opens another page)
        end = min(end, max(steps[-1]['a'], following['m'] - 0.05))
    capture = dict(capture, steps=steps, end=end)
    capture['active'] = list(capture.get('active') or []) + [(s, s + 1 / montage.FPS) for s in capture.get('stills') or []]
    beat_of = {}
    for number, action in enumerate(beats, 1):
        if action is not None and action not in beat_of:
            beat_of[action] = number
    # Pins are reviewed evidence: a sentence on a passed check describes that result. Moving it back to
    # the preceding click/goto starts the claim over the old page or a loading shell. The montage can
    # fit unpinned actions before the check; an author can explicitly pin to a click when it is the subject.
    first = min([first] + list(beat_of))
    spec = {'steps': [dict({'cmd': s['cmd']}, **({'beat': beat_of[s['step']]} if s['step'] in beat_of else {}),
                           **({'at': -1} if s['step'] < first else {})) for s in steps],
            'narration': ' '.join(s['text'] for s in chapter['sentences']),
            # what the voice read, sentence by sentence: its words are counted into them (an abbreviation before a
            # capital, np. Excel, ends no sentence)
            'sentences': [s['text'] for s in chapter['sentences']],
            # a scene's test.step titles name its windows (a project's own tests may title them in English)
            'sections': ((chapter.get('source') or {}).get('file') or '').startswith('gaps/'), 'language': language}
    doc, beat = document(chapter, capture)
    if doc and document_still(doc, cached_only=cached_only):  # the downloaded PDF's first page covers the chapter's end
        spec['insert'] = {'from_beat': beat}
    return spec, capture


def steps_of(chapter, film, offset, said=None):
    """A chapter's bottom-bar labels in chapter time, ``[[start, text]]``: each from its sentence's start (the first
    from the footage's) until the next one; an unlabelled first sentence shows the chapter's title. When the voice's
    sentences do not match the story's, only the title shows."""
    title = editor.short_label(chapter.get('title') or '', opening=(said or language.texts())['quotes'][0])
    if len(film['sentences']) != len(chapter['sentences']):
        return [[offset, title]] if title else []
    steps, shown = [], None
    for index, (start, sentence) in enumerate(zip(film['sentences'], chapter['sentences'])):
        text = sentence.get('label') or (title if index == 0 else None)
        if text and text != shown:
            steps.append([round(offset + (0 if index == 0 else start), 3), text])
            shown = text
    return steps


def chapter_film(chapter, folder, voice_dir, last=False, cached_only=False, language=None):
    """(spec, capture, words, speech seconds, film, camera spans) of a chapter: its montage on its spoken voice
    (``last``: the film's last chapter, whose last picture stays a little longer before the film fades out)."""
    spec, capture = chapter_setup(chapter, folder, cached_only=cached_only, language=language)
    words = montage.words_from_srt((Path(voice_dir) / 'subtitles.srt').read_text(encoding='utf-8'))
    speech = audio_seconds(Path(voice_dir) / 'audio.mp3')
    film = montage.cut(spec, capture, words, audio_duration=speech, tail=montage.FINAL_TAIL if last else None)
    _, spans = montage.camera(spec, capture, film, capture['scale'])
    return spec, capture, words, speech, film, spans


def chapter_metrics(chapter, folder, voice_dir, last=False, language=None):
    """A chapter's measures (metrics.chapter) from the montage the render uses."""
    _, capture, words, speech, film, spans = chapter_film(chapter, folder, voice_dir, last, cached_only=True,
                                                          language=language)
    return metrics.chapter(film, spans, metrics.captions_of(words, film, speech), capture)


def chapter_cut(ffmpeg, chapter, folder, voice_dir, sources, retimed=None, last=False, cached_only=False):
    """``retimed``: the folder for the voice retimed around its waits (default the voice's own)."""
    said = language.texts(sources)
    spec, capture, words, speech, film, spans = chapter_film(chapter, folder, voice_dir, last, cached_only=cached_only,
                                                             language=said['code'])
    camera = []
    for span in spans:
        entry = {'start': span['start'], 'end': span['end']}
        if 'crop' in span:
            entry['crop'] = montage.scale_crop(span['crop'], capture['scale'])
        else:
            entry.update({'from': montage.scale_crop(span['from'], capture['scale']), 'to': montage.scale_crop(span['to'], capture['scale'])})
        camera.append(entry)
    pieces = [list(p) for p in montage.video_pieces(film['pieces'], [tuple(p) for p in capture['timeline']])]
    audio, srt = retime(ffmpeg, Path(voice_dir) / 'audio.mp3', Path(voice_dir) / 'subtitles.srt', words, film['silences'],
                        Path(retimed or voice_dir))
    urls = {pr['number']: pr['url'] for pr in sources['prs']}
    entry = {'title': chapter['title'], 'prs': [urls[n] for n in chapter['prs'] if n in urls], 'audio': audio, 'srt': srt,
             'caption_limits': montage.caption_limits(film), 'audio_offset': 2, 'steps': steps_of(chapter, film, 2, said),
             'clips': [{'footage': dict({'source': str(Path(folder) / 'take.mp4'), 'scale': capture['scale'],
                                         'duration': film['footage'], 'pieces': pieces, 'camera': camera,
                                         'pointer': film['pointer']},
                                        **({'labels': film['labels']} if film.get('labels') else {}),
                                        **({'keys': film['keys']} if film.get('keys') else {}))}],
             'review_points': {}}
    if film['insert_from'] is not None:
        doc, _ = document(chapter, capture)
        entry['clips'].append({'image': str(document_still(doc, cached_only=cached_only)),
                               'duration': round(film['duration'] - film['insert_from'], 3),
                               'evidence': f"Page 1 of {doc['name']}, downloaded in this test"})
    stats = {'film_seconds': film['duration'], 'narration_waits': [[round(t, 1), round(d, 1)] for t, d in film['silences']],
             'late': [[a['beat'], a['late']] for a in film['anchors'] if a['late'] > 0.5],
             'metrics': metrics.chapter(film, spans, metrics.captions_of(words, film, speech), capture)}
    return entry, stats


def recut_inputs(run, story, out):
    """Validate a recut before any write: fresh output, existing takes and unchanged cached narration."""
    run, out = Path(run).resolve(), Path(out).resolve()
    folders = {Path(story['keys'][c['film']]).resolve() for c in story['chapters']}
    for source in {run, *folders}:
        if out == source or out.is_relative_to(source) or source.is_relative_to(out):
            raise SystemExit(f'recut output overlaps a source folder: {source}; choose a separate fresh --out folder')
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        raise SystemExit(f'recut output is not empty: {out}; choose a separate fresh --out folder')
    if not story['chapters'] or not spoken(run, story):
        raise SystemExit(f'recut requires cached narration matching every chapter in {run / "voice"}; '
                         'restore the matching cache or prepare a separate copy first (recut never calls TTS)')
    for n in range(1, len(story['chapters']) + 1):
        for name in ('audio.mp3', 'subtitles.srt'):
            path = run / 'voice' / f'c{n}' / name
            if not path.stat().st_size:
                raise SystemExit(f'recut cached narration is empty: {path}; restore the matching cache first')
    for folder in sorted(folders):
        if not (folder / 'take.mp4').is_file() or not takes.converted(folder):
            raise SystemExit(f'recut requires an already converted take: {folder}; '
                             'restore its take.mp4 and capture.json or convert a separate copy first')
    for chapter in story['chapters']:
        capture = core.load(Path(story['keys'][chapter['film']]) / 'capture.json')
        doc, _ = document(chapter, capture)
        if doc:
            document_still(doc, cached_only=True)
    return out


def drawn_text(chapters):
    """Every text the film draws in its font: the chapter cards' titles, the bar under the picture and the labels and
    key names over the footage (the narration is spoken and captioned, never drawn)."""
    texts = []
    for chapter in chapters:
        texts += [chapter['title'], *(text for _, text in chapter.get('steps') or [])]
        for clip in chapter.get('clips') or []:
            footage = clip.get('footage') or {}
            texts += [item[2] for item in (footage.get('labels') or []) + (footage.get('keys') or [])]
    return ' '.join(texts)


def make(run, story, sources, addon, jobs=8, out=None):
    """Narration, cuts and the rendered film in <out>/film/ (``out``: default the run; another folder for a recut:
    a recut requires cached narration and converted takes, and never writes into the source run)."""
    import render_demo
    run = Path(run).resolve()
    recutting = out is not None
    out = recut_inputs(run, story, out) if recutting else run
    voice = run / 'voice'
    out.mkdir(parents=True, exist_ok=True)
    ffmpeg = core.tool('ffmpeg')
    render_demo.FFMPEG = ffmpeg
    render_demo.FFPROBE = core.tool('ffprobe') or 'ffprobe'
    colors, colors_warning = film_colors(addon)
    from concurrent.futures import ThreadPoolExecutor
    folders = sorted({story['keys'][c['film']] for c in story['chapters']})
    core.mark(out, 'takes', 'start', f'{len(folders)} films')
    if not recutting:
        with ThreadPoolExecutor(max_workers=3) as pool:  # the takes of the chosen tests, while the voice speaks
            converting = [pool.submit(takes.convert, folder, ffmpeg, True) for folder in folders if not takes.converted(folder)]
            narrate(run, story, addon, voice)
            for job in converting:
                job.result()
    core.mark(out, 'takes', 'end')
    core.mark(out, 'cut', 'start')
    chapters, notes = [], {}
    for index, chapter in enumerate(story['chapters'], 1):
        retimed = out / 'voice' / f'c{index}' if out != run else None
        if retimed:
            retimed.mkdir(parents=True, exist_ok=True)
        entry, stats = chapter_cut(ffmpeg, chapter, story['keys'][chapter['film']], voice / f'c{index}', sources, retimed,
                                   last=index == len(story['chapters']), cached_only=recutting)
        chapters.append(entry)
        notes[f'{index}. {chapter["title"]}'] = stats
    font, family, warning = film_font(addon, drawn_text(chapters).translate(render_demo.LOOKALIKES))
    authored = out / 'film-plan' / 'authored.json'
    core.save(authored, dict({'font': font, 'chapters': chapters, 'language': language.texts(sources)['code']},
                             **({'colors': colors} if colors else {})))
    core.mark(out, 'cut', 'end')
    core.mark(out, 'render', 'start')
    for folder in (out / 'film-plan' / 'prepared', out / 'film'):  # a new make replaces the previous film
        core.sh(['rm', '-rf', str(folder)])
    render_demo.prepare(authored, out / 'film-plan' / 'prepared', enforce_duration=False, strict=False)
    plan = render_demo.load_plan(out / 'film-plan' / 'prepared' / 'editing-plan.json', enforce_duration=False, strict=False)
    render_demo.render(plan, out / 'film', jobs, out / 'film-plan' / 'segments')
    core.mark(out, 'render', 'end')
    seconds = audio_seconds(out / 'film' / 'demo.mp4')
    summary = {'film': str(out / 'film' / 'demo.mp4'), 'seconds': round(seconds, 1), 'font': family, 'font_warning': warning,
               'metrics': metrics.summary([s['metrics'] for s in notes.values()]), 'chapters': notes}
    if not 180 <= seconds <= 300:
        summary['length_warning'] = f'{seconds:.0f} s: aim for 180–300 s (change the narration length)'
    if plan.get('warnings') or colors_warning:
        summary['warnings'] = list(plan.get('warnings') or []) + ([colors_warning] if colors_warning else [])
    if core.load(run / 'degraded.json'):  # steps left out for want of a model (llm.degraded)
        summary['degraded'] = core.load(run / 'degraded.json')
    core.save(out / 'film.json', summary)
    return summary
