"""Review sheets before the film is made: per chapter, for each sentence the still as it starts (before its pinned
action; a sentence without an action keeps the previous one) and the still after that action (its result), with the
sentence under them. Opus 5.5 checks every sentence against its pictures: a sentence that says more than they show is
rewritten, a chapter whose pictures never show its change is dropped (at most two, never the opening or the closing)."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import textwrap
import time

import core
import cut
import language
import takes

TILE = 640  # width of one still in a tile (two per sentence: before and after its action); stills are 16:9
COLUMNS = 2


def stills(capture_folder):
    """{action id: still the viewer sees as a sentence pinned to it starts}: the still taken before the action, but
    for a navigation the next one (the film cuts to the loaded page), and for the last action the end still."""
    folder = Path(capture_folder)
    actions = core.load(folder / 'actions.json', [])
    log = core.load(folder / 'page-log.json', {}) or {}
    ends = [folder / p['still'] for p in log.get('pages') or [] if p.get('still')]
    found = {}
    for index, action in enumerate(actions):
        pick = actions[index + 1:] if action['kind'] in takes.NAVIGATIONS else actions[index:]
        still = next((folder / a['still'] for a in pick if a.get('still') and (folder / a['still']).is_file()), None)
        found[action['id']] = still or next((e for e in ends if e.is_file()), None)
    return found


def results(capture_folder):
    """{action id: still after the action: its result}: a check's own still (taken once it passed), else the next
    action's still (taken before it acts), else the end still."""
    folder = Path(capture_folder)
    actions = core.load(folder / 'actions.json', [])
    log = core.load(folder / 'page-log.json', {}) or {}
    end = next((folder / p['still'] for p in log.get('pages') or [] if p.get('still') and (folder / p['still']).is_file()), None)
    found = {}
    for index, action in enumerate(actions):
        pick = actions[index:index + 1] if action['kind'] == takes.LOOK else actions[index + 1:]
        found[action['id']] = next((folder / a['still'] for a in pick if a.get('still') and (folder / a['still']).is_file()), end)
    return found


def framing(spec, capture):
    """What the film will show a share of the way through a sentence (the montage cut on estimated speech):
    ``at(sentence, share)`` gives (the camera's crop in the take's pixels, the capture time on screen)."""
    import montage
    film = montage.cut(spec, capture, montage.estimated_words(spec.get('narration')))
    _, spans = montage.camera(spec, capture, film, capture.get('scale') or 1)
    starts = film['sentences'] + [film['duration']]

    def shown(t):  # the capture time on screen at film time t (a piece's last frame holds until the next one starts)
        a, b, f = max((p for p in film['pieces'] if p[2] <= t), key=lambda p: p[2], default=film['pieces'][0])
        return a + (t - f) if t < f + (b - a) else b - 1 / montage.FPS

    def at(sentence, share):
        if not 1 <= sentence < len(starts):
            return None, None
        t = starts[sentence - 1] + share * (starts[sentence] - starts[sentence - 1])
        span = next((sp for sp in spans if sp['start'] <= t and (sp['end'] is None or t < sp['end'])), spans[-1])
        crop = span['crop'] if 'crop' in span else (span['to'] if t >= (span['start'] + span['end']) / 2 else span['from'])
        return montage.scale_crop(crop, capture.get('scale') or 1), shown(t)

    def labels(sentence):  # the transition labels the film shows while the sentence is spoken
        if not 1 <= sentence < len(starts):
            return []
        return [text for a, b, text in film.get('labels') or [] if a < starts[sentence] and b > starts[sentence - 1]]
    at.labels = labels
    return at


def make_take(folder, ffmpeg):
    """The capture's take (video and its analysis), once: the review's pictures are its frames. A capture without
    recorded frames keeps its stills."""
    if takes.converted(folder) or not (Path(folder) / 'frames.json').is_file():
        return
    try:
        takes.convert(folder, ffmpeg, True)
    except (ValueError, OSError, subprocess.SubprocessError):
        pass


def film_frame(ffmpeg, capture, moment, target):
    """The take's frame showing capture time ``moment`` as an image (the film's own picture), or None without a take."""
    import montage
    take, timeline = capture.get('take'), capture.get('timeline')
    if moment is None or not take or not timeline or not Path(take).is_file():
        return None
    video = montage.video_before([tuple(p) for p in timeline], moment)
    subprocess.run([ffmpeg, '-v', 'error', '-y', '-ss', f'{video:.3f}', '-i', str(take), '-frames:v', '1', '-q:v', '3',
                    str(target)], capture_output=True, timeout=60)
    return target if Path(target).is_file() else None


def tile(ffmpeg, font, before, after, header, sentence, target, crops=(None, None)):
    """One sentence: the still as it starts and the still after its action side by side (each framed as the film frames
    it, ``crops``), the sentence under them."""
    lines = [header] + textwrap.wrap(sentence, 90)[:4]
    text = target.with_suffix('.txt')
    text.write_text('\n'.join(lines), encoding='utf-8')
    h = TILE * 9 // 16
    inputs = []
    for image in (before, after):
        inputs += ['-f', 'lavfi', '-i', f'color=c=gray:s={TILE}x{h}'] if image is None else ['-i', str(image)]
    cut_to = lambda crop: f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},' if crop else ''
    subprocess.run([ffmpeg, '-v', 'error', '-y', *inputs, '-frames:v', '1', '-filter_complex',
                    f'[0:v]{cut_to(crops[0] if before else None)}scale={TILE}:{h}[a];'
                    f'[1:v]{cut_to(crops[1] if after else None)}scale={TILE}:{h}[b];[a][b]hstack=inputs=2,'
                    f'pad={TILE * 2}:{h + 130}:0:0:white,'
                    f"drawtext=fontfile='{font}':textfile='{text}':expansion=none:x=10:y={h + 8}:fontsize=17:"
                    f'fontcolor=black:line_spacing=5', '-q:v', '3', str(target)], check=True, timeout=60)  # "75%" stays text


def chapter_sheet(ffmpeg, font, chapter, capture_folder, number, out, language_code=None):
    """One chapter's tiles in <out>/c<number>/ and its sheet <out>/chapter-<number>.jpg; returns the sheet."""
    images, after = stills(capture_folder), results(capture_folder)
    doc, beat = cut.document(chapter, core.load(Path(capture_folder) / 'capture.json', {}) or {})
    page = cut.document_still(doc) if doc else None  # the film shows the downloaded PDF's first page from there
    try:  # the pictures the film shows while each sentence is spoken, framed as the camera frames them
        at = framing(*cut.chapter_setup(chapter, capture_folder, language=language_code))
    except Exception:  # noqa: BLE001 a capture the montage cannot cut is shown whole, from its stills
        at = lambda sentence, share: (None, None)
    capture = core.load(Path(capture_folder) / 'capture.json', {}) or {}
    frames_dir = Path(out) / f'c{number}-frames'
    frames_dir.mkdir(parents=True, exist_ok=True)
    current = shown = None
    folder = Path(out) / f'c{number}'
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True)
    for index, sentence in enumerate(chapter['sentences'], 1):
        action = sentence.get('action')
        if action is not None:
            current, shown = images.get(action, current), after.get(action, shown)
        if page and index >= beat:
            current = shown = page
        header = (f"{number}.{index}  {chapter['film']} · " + (f'action {action}: early in the sentence | later in it'
                                                               if action is not None else 'same screen'))
        emptied = next((s.get('shows_empty') for s in capture.get('steps') or [] if s.get('step') == action), None) \
            if action is not None else None
        if emptied:  # read from the page: the screen the action leaves shows an empty state
            header += ' · EMPTY: ' + '; '.join(f'"{e}"' for e in emptied)[:90]
        shown_labels = getattr(at, 'labels', lambda sentence: [])(index)
        if shown_labels:  # drawn in the film's corner at render: the tiles are the take's own frames
            opening, closing = language.texts(language_code)['quotes']
            header += ' · label in the corner: ' + '; '.join(f'{opening}{text}{closing}' for text in shown_labels)
        if page and index >= beat:
            crops, pictures = (None, None), (current, shown)
        else:
            (early_crop, early_moment), (late_crop, late_moment) = at(index, 0.15), at(index, 0.7)
            crops = (early_crop, late_crop)
            # the film's own frames where the take exists (what the montage keeps and cuts); the action's stills otherwise
            pictures = (film_frame(ffmpeg, capture, early_moment, frames_dir / f'{index:02d}a.jpg') or current,
                        film_frame(ffmpeg, capture, late_moment, frames_dir / f'{index:02d}b.jpg') or shown)
        tile(ffmpeg, font, pictures[0], pictures[1], header, sentence['text'], folder / f'{index:02d}.jpg', crops)
    rows = -(-len(chapter['sentences']) // COLUMNS)
    target = Path(out) / f'chapter-{number}.jpg'
    subprocess.run([ffmpeg, '-v', 'error', '-y', '-framerate', '1', '-i', str(folder / '%02d.jpg'), '-vf',
                    f'tile={COLUMNS}x{rows}:padding=8:color=gray', '-frames:v', '1', '-q:v', '3', str(target)], check=True,
                   timeout=120)
    return str(target)


def sheets(run, story, only=None, fresh=True):
    """One image per chapter in <run>/review/ (only the chapter numbers in ``only`` when given: the others were checked
    already); returns their paths. ``fresh``: the folder is emptied first."""
    run = Path(run)
    out = run / 'review'
    if fresh:
        shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True, exist_ok=True)
    ffmpeg, font = core.tool('ffmpeg'), cut.font_path()
    wanted = [(n, c) for n, c in enumerate(story['chapters'], 1) if only is None or n in only]
    for folder in sorted({story['keys'][c['film']] for _, c in wanted}):  # the film's own frames for the pictures
        make_take(folder, ffmpeg)
    code = language.texts(core.load(run / 'sources.json') or {})['code']
    made = [chapter_sheet(ffmpeg, font, chapter, story['keys'][chapter['film']], number, out, code) for number, chapter in wanted]
    core.save(out / 'sheets.json', {'sheets': made, 'titles': [c['title'] for c in story['chapters']]})
    return made


CHECK = """These images are chapter {number} of a narrated {language} demo film, one image per sentence: two pictures of the film
while the sentence is spoken, early in it (left) and later in it (right), with the sentence under them (its number
first).
The chapter is about: {title}. The texts on screen that prove it: {proofs}.
{part}Each picture is framed as the film frames it (a close-up shows only its part of the screen) and the film shows it full
size, so small text you can make out counts as visible; what lies outside a picture is not shown. A header marked
EMPTY quotes an empty state the page itself showed after that sentence's action (read from the page, even where a
picture is too small to read); a header's "label in the corner" is a label the film draws over those pictures. The film shows the
page alone, never the browser's address bar, tabs or buttons: an address, a link, going back or reloading is shown only
by what the page shows after it.

Read every image (Read tool), then check every sentence as a strict viewer would: each claim in it (a label, a value,
a section, a list, a result such as {result_examples}, a benefit, an earlier state) must be visible in its two
pictures. A loading spinner, a blank page or an unreadable wide shot shows nothing. The chapter's change itself, as its
title names it, is not such a claim: a sentence may say it in plain words where the pictures show its effect (the list
narrows to the chosen status: {change_example}); keep it, and rewrite only the details the pictures lack.
A change over time (it resumes where it stopped, it stays after a reload, another user now sees it) is shown only
when the pictures show both states and the passage between them; a label in a picture's corner such as
{reloaded}, or the name of the other user's view, is that passage. Without it, rewrite the sentence to what the
pictures show.
Compare neighboring sentences too: a value claimed to stay or grow must not visibly reset between them.
Keep your private reasoning short and answer in a single pass.

Answer one line per sentence with a problem, and nothing else:
<number> | <what it claims that the pictures do not show> | <the sentence rewritten to say only what they show>
or, for a sentence that only fills time, spoken where both its pictures show just an empty state (zeros, an empty
list or card, a "No … yet" message) that no rewrite can fix:
<number> | cut | <why>
This includes opening setup sentences that merely describe an empty list before the useful workflow begins.
Keep a necessary before/after comparison, a populated result with an unrelated empty background widget, and the
film's introduction or closing. After cuts, at least three pinned sentences must remain and still name the change.
A rewrite keeps the chapter's voice: natural spoken {language}, present tense, "we" form, its subject and verb where
they are right, and the chapter's change named where the sentence named it; it says what happens, not a list of
labels, {no_fillers}.
Then check the chapter as a whole, as its viewer would:
- when no sentence says plainly what is new (the change its title names), add a line for its first sentence (in
  chapter 1 the one after the film's introduction): the problem "the change is not named" and that sentence rewritten
  to name the change where its pictures show it;
- when a sentence only strings on-screen labels or values together, add a line for it: the problem "a list of labels"
  and the sentence rewritten in natural {language} (what happens, at most one short quoted name);
- {review_language}
Only when no picture of the chapter shows what it is about (blank, still loading or unreadable wherever its proof
should be, or empty there: only zeros, an empty list or card, a "No … yet" message where the change should show),
answer this one line instead: drop | <why>
Answer "ok" when every sentence is fine.
Images:
{images}
"""
DROPS = 2  # chapters the check may drop from one film
CUT_KEEP = 3  # a chapter keeps at least this many pinned sentences when the check cuts one
CHECK_TIMEOUT = 360  # seconds one chapter's check may take on its tiles (a dense chapter took over 240 s three times)
SHEET_TIMEOUT = 240  # the one retry after a timeout, on the chapter's single sheet (fewer, smaller pictures)
SPLIT_AT = 5  # a chapter of more sentences is checked in two parts at once, one sentence shared: the check of the last
# scene's chapter is on the film's critical path, and its time grows with the pictures it thinks about (120–280 s)
PART = '''These images are sentences {first}–{last} of the chapter's {total}; the check of its other sentences runs beside this
one. All its sentences, for context: {sentences}
Check only the sentences these images show. Answer "drop" only when none of these pictures shows what the chapter is
about.{rest}
'''


# a clean verdict: "ok" as the check asks for it, or marked up ("OK.", "**ok**", "`ok`"); an answer that starts with
# it and names no sentence is clean too
CLEAN = re.compile(r'[\s*_`"\'>-]*(ok|okay)[\s*_`"\'.!]*', re.I)
CLEAN_START = re.compile(r'[\s*_`"\'>-]*(ok|okay)\b', re.I)


class ReviewUnavailable(RuntimeError):
    """A chapter was not checked; this must never count as a clean review."""


def check_chapter(chapter, number, sheet, said=None):
    """What Opus 5.5 finds on one chapter's sheet (its tiles next to it): the sentences whose claims the pictures do not
    show, or the chapter to drop. A long chapter is checked in two parts at once (SPLIT_AT); only both parts together
    drop it. ``said``: the film's language (language.texts)."""
    tiles = sorted((Path(sheet).parent / f'c{number}').glob('*.jpg'))  # one sentence each, sharper than the sheet
    if len(tiles) <= SPLIT_AT:
        return check_part(chapter, number, sheet, tiles, said=said)
    half = (len(tiles) + 1) // 2
    opening, closing = (said or language.texts())['quotes']
    listed = ' '.join(f'{number}.{i} {opening}{s["text"]}{closing}' for i, s in enumerate(chapter['sentences'], 1))
    parts = [(tiles[:half], PART.format(first=f'{number}.1', last=f'{number}.{half}', total=len(tiles), sentences=listed,
                                        rest='')),
             (tiles[half - 1:], PART.format(first=f'{number}.{half}', last=f'{number}.{len(tiles)}', total=len(tiles),
                                            sentences=listed, rest=' Whether the chapter names its change is checked '
                                            'by the other part: skip that check here.'))]
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=2) as pool:
        answers = list(pool.map(lambda part: check_part(chapter, number, sheet, *part, said=said), parts))
    if all(a and a[0].get('drop') for a in answers):
        return answers[0]
    found, seen = [], set()
    for finding in (f for a in answers for f in a if not f.get('drop')):
        if finding['sentence'] not in seen:  # the shared sentence: the first part's finding
            seen.add(finding['sentence'])
            found.append(finding)
    return found


def check_part(chapter, number, sheet, tiles, part='', said=None):
    """One check call on some of a chapter's tiles (all of them by default); ``part`` says which part of it they are,
    ``said`` the film's language (language.texts)."""
    import llm
    said = said or language.texts()
    proofs = '; '.join(f'"{p}"' for p in chapter.get('proofs') or []) or 'none given'
    # the tiles first; a check that runs out of time on them is asked once more on the chapter's one sheet
    tries = [(tiles, CHECK_TIMEOUT), ([Path(sheet)], SHEET_TIMEOUT)] if tiles else [([Path(sheet)], CHECK_TIMEOUT)]
    text, error = None, None
    quoted = '{0}{1}{2}'.format(said['quotes'][0], said['reloaded'], said['quotes'][1])
    for images, limit in tries:
        prompt = CHECK.format(number=number, title=chapter.get('title') or '', images='\n'.join(str(i) for i in images),
                              proofs=proofs, part=part if images is tiles else '', language=said['name'],
                              result_examples=said['result_examples'], change_example=said['change_example'],
                              reloaded=quoted, no_fillers=said['no_fillers'], review_language=said['review_language'])
        for attempt in range(llm.ATTEMPTS):
            try:
                text, _ = llm.visual(prompt, 'You check a demo film against its pictures.', 'medium',
                                     read=[Path(sheet).parent], timeout=limit)
                break
            except RuntimeError as caught:
                error = caught
                if attempt + 1 < llm.ATTEMPTS and any(word in str(caught).lower() for word in llm.TRANSIENT):
                    time.sleep(10 * (attempt + 1))
                    continue
                break
        if text is not None or 'within' not in str(error):  # only a check out of time tries the sheet
            break
    if text is None:
        raise ReviewUnavailable(f'the check of chapter {number} failed: {str(error)[:300]}') from error
    if CLEAN.fullmatch(text.strip()):
        return []
    found = []
    for line in text.splitlines():
        parts = [p.strip() for p in line.split('|')]
        head = re.sub(r'^[\s*•>`-]+|[\s*`:.]+$', '', parts[0])  # "**2.5**", "- 2.5", "2.5:"
        if re.fullmatch(r'\d+', head):  # the sentence alone ("5 | …" for 2.5: 7 of 9 checks of one run)
            head = f'{number}.{head}'
        if len(parts) >= 3 and re.fullmatch(r'\d+\.\d+', head) and parts[1].lower() == 'cut':
            found.append({'sentence': head, 'problem': f'said over an empty screen: {parts[2]}', 'cut': True})
        elif len(parts) >= 3 and re.fullmatch(r'\d+\.\d+', head):
            found.append({'sentence': head, 'problem': parts[1], 'fix': parts[2]})
        elif len(parts) >= 2 and head.lower() == 'drop':
            return [{'chapter': number, 'drop': parts[1]}]
    if not found and CLEAN_START.match(text.strip()) \
            and not re.search(rf'\b{number}\.\d+\b|\b(drop|cut)\b', text, re.I):  # "OK, every sentence matches."
        return []
    if not found:
        raise ReviewUnavailable(f'the check of chapter {number} returned no verdict: {" ".join(text.split())[:200]!r}')
    return found


def check_claims(run, sheets, story, provider=None, done=None):
    """What Opus 5.5 finds looking at each sheet (all chapters at once): sentences whose claims their pictures do not
    show, [{'sentence': 'chapter.sentence', 'problem', 'fix'}], and chapters whose pictures never show their change,
    [{'chapter': number, 'drop': why}]; [] when no model can look. ``done``: {chapter number: findings} checked
    already (a scene checked as soon as it was filmed): used as they are."""
    import llm
    if not llm.capabilities(provider)['review']:
        if sheets:
            llm.degraded(run, 'review', 'no Claude Code CLI: no sentence was checked against its pictures')
        return []
    done = done or {}
    said = language.texts(core.load(Path(run) / 'sources.json') or {})

    def one(sheet):
        number = int(re.search(r'chapter-(\d+)', Path(sheet).name).group(1))
        return done[number] if number in done else check_chapter(story['chapters'][number - 1], number, sheet, said)

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=min(core.ci_profile()['checks'], max(1, len(sheets)))) as pool:
        return [f for chapter in pool.map(one, sheets) for f in chapter]


def chapter_key(chapter, capture=None):
    """The reviewed evidence and the code that chooses and frames its pictures."""
    kept = [(s.get('text'), s.get('action')) for s in chapter.get('sentences') or [] if not s.get('added')]
    evidence = None
    if capture:
        folder = Path(capture).resolve()
        metadata = folder / 'capture.json'
        evidence = [str(folder), hashlib.sha256(metadata.read_bytes()).hexdigest() if metadata.is_file() else None]
    scripts = Path(__file__).resolve().parent
    framing = [(name, hashlib.sha256((scripts / name).read_bytes()).hexdigest())
               for name in ('review.py', 'cut.py', 'montage.py')]
    return hashlib.sha1(json.dumps([CHECK, framing, evidence, chapter.get('film'), chapter.get('title'), chapter.get('proofs'), kept],
                                   ensure_ascii=False).encode('utf-8')).hexdigest()


def early_check(run, gap_id, keys):
    """A scene's chapter checked as soon as its worker is done, while the other scenes are still filmed: the findings
    wait in <run>/early/<id>.json (with the chapter they were found on) for the review."""
    import editor
    run = Path(run)
    said = language.texts(core.load(run / 'sources.json') or {})
    narration = run / 'gaps' / gap_id / 'story.txt'
    written = narration.stat().st_mtime
    story = editor.tidy(editor.parse(narration.read_text(encoding='utf-8')), quotes=said['quotes'])
    if not story['chapters'] or story['chapters'][0].get('film') not in keys:
        return None
    editor.mend_proofs(story, keys)  # as adopt mends and pins it: a change would make the review check it again
    editor.repin(story, keys)
    chapter = story['chapters'][0]
    make_take(keys[chapter['film']], core.tool('ffmpeg'))  # the film's own frames for the pictures
    editor.reopen({'chapters': [{'sentences': [{'text': ''}]}, chapter]}, said)  # as adopt words it: never the first line
    editor.unlabel(story, said)
    done = core.load(run / 'early' / f'{gap_id}.json')
    key = chapter_key(chapter, keys[chapter['film']])
    if done and done.get('checked') is True and done.get('key') == key:
        return done.get('found')
    out = run / 'early' / gap_id / key[:12]  # its own pictures: a check of a newer narration may run beside it
    sheet = chapter_sheet(core.tool('ffmpeg'), cut.font_path(), chapter, keys[chapter['film']], 1, out, said['code'])
    found = check_chapter(chapter, 1, sheet, said)
    if narration.stat().st_mtime == written:  # a narration rewritten meanwhile has its own check
        core.save(run / 'early' / f'{gap_id}.json', {'key': key, 'checked': True, 'found': found})
    return found


def scene_ids(story):
    """{chapter number: the scene id} of the chapters that come from scenes."""
    found = {}
    for number, chapter in enumerate(story['chapters'], 1):
        match = re.match(r'gaps/([^/]+)/story\.txt$', (chapter.get('source') or {}).get('file') or '')
        if match:
            found[number] = match.group(1)
    return found


def early_findings(run, story):
    """{chapter number: findings} of the scene chapters checked early and unchanged since, numbered as in the film
    (a line adopt added, the film's opening, shifts the sentences after it)."""
    found = {}
    for number, gap in scene_ids(story).items():
        chapter = story['chapters'][number - 1]
        early = core.load(Path(run) / 'early' / f'{gap}.json')
        capture = (story.get('keys') or {}).get(chapter.get('film'))
        if not early or early.get('checked') is not True or early.get('key') != chapter_key(chapter, capture):
            continue
        written = [i for i, s in enumerate(chapter['sentences'], 1) if not s.get('added')]  # the file's sentences
        kept = []
        for item in early.get('found') or []:
            if item.get('drop'):
                kept = [{'chapter': number, 'drop': item['drop']}]
                break
            index = int(item['sentence'].partition('.')[2] or 0)
            if 1 <= index <= len(written):
                kept.append(dict(item, sentence=f'{number}.{written[index - 1]}'))
        found[number] = kept
    return found


def apply_claims(run, story, claims):
    """Put each claim's rewrite in place of its sentence, in the file the chapter came from (story.txt or a scene's
    story.txt; the action it is pinned to stays); a sentence to cut leaves its chapter when CUT_KEEP pinned sentences
    stay. Returns the claims applied."""
    import editor
    run = Path(run)
    applied, files, cuts = [], {}, []
    for claim in claims:
        if not claim.get('sentence'):
            continue
        chapter_no, _, sentence_no = claim['sentence'].partition('.')
        try:
            chapter = story['chapters'][int(chapter_no) - 1]
            source = chapter['source']
            index = int(sentence_no) - 1
            if index < 0 or chapter['sentences'][index].get('added'):
                continue  # the film's opening or closing line adopt adds: in no file
            # its place in the file: tidy may have left out lines before it (a story adopted before sentences kept
            # their line: counted without the added ones)
            line = chapter['sentences'][index].get('line')
            index = line if isinstance(line, int) else index - sum(1 for s in chapter['sentences'][:index] if s.get('added'))
        except (ValueError, IndexError, KeyError):
            continue
        path = run / source['file']
        if path not in files:
            files[path] = editor.parse_lines(path.read_text(encoding='utf-8'))
        written = files[path]
        try:
            block = written['reserves'][source['reserve']] if 'reserve' in source else written['chapters'][source['chapter']]
            sentence = block['sentences'][index]
        except (ValueError, IndexError, KeyError):
            continue
        if claim.get('cut'):
            cuts.append((index, block, claim))
            continue
        rewrite = (claim.get('fix') or '').strip()
        if rewrite and rewrite != sentence['text']:
            claim['before'] = sentence['text']
            sentence['text'] = rewrite
            applied.append(claim)
    for index, block, claim in sorted(cuts, key=lambda c: -c[0]):  # the last first: the others keep their places
        sentence = block['sentences'][index]
        pinned = sum(1 for s in block['sentences'] if s.get('action') is not None)
        if pinned - (sentence.get('action') is not None) < CUT_KEEP:
            continue  # the model may cut empty setup at the start; a chapter still keeps its story
        claim.update(before=sentence['text'], fix='(cut)')
        block['sentences'].pop(index)
        applied.append(claim)
    for path, written in files.items():
        path.write_text(editor.render_lines(written), encoding='utf-8')
    return applied


def record_drops(run, story, found, limit=DROPS):
    """The chapters the check found showing nothing of their change, kept in <run>/drops.json for adopt (which leaves
    them out and lists their pull requests as not shown), beside those an earlier review dropped (finish run again):
    at most ``limit`` in all, never the first or last chapter (the opening and the closing), and at least three
    chapters stay. Returns the drops this review added."""
    chapters = story['chapters']
    earlier = core.load(Path(run) / 'drops.json') or []
    drops = []
    for item in found:
        index = int(item.get('chapter') or 0) - 1
        if 0 < index < len(chapters) - 1 and len(earlier) + len(drops) < limit and len(chapters) - len(drops) > 3:
            chapter = chapters[index]
            drops.append(dict(chapter.get('source') or {}, prs=chapter.get('prs') or [], title=chapter.get('title'),
                              reason=item.get('drop') or ''))
    if drops:
        core.save(Path(run) / 'drops.json', earlier + drops)
    return drops


def story_files(run):
    """{path: text} of the story files (story.txt and the scenes' story.txt): a review that breaks the story puts them
    back."""
    run = Path(run)
    return {p: p.read_text(encoding='utf-8') for p in [run / 'story.txt', *sorted(run.glob('gaps/*/story.txt'))] if p.is_file()}


def waits(run, story, addon):
    """Where the voice pauses for the picture, per chapter: the voice is spoken now (make reuses it while the
    sentences stay the same) and its real word timings are cut against the film. The sheets cannot show a pause,
    so they are listed next to them."""
    ffmpeg = core.tool('ffmpeg')
    for folder in sorted({story['keys'][c['film']] for c in story['chapters']}):
        if not takes.converted(folder):  # the video analysis make uses: the pauses come out the same
            takes.convert(folder, ffmpeg, True)
    cut.narrate(run, story, addon)
    code = language.texts(core.load(Path(run) / 'sources.json') or {})['code']
    found = []
    for number, chapter in enumerate(story['chapters'], 1):
        found += [dict(w, chapter=number) for w in cut.voice_waits(chapter, story['keys'][chapter['film']],
                                                                   Path(run) / 'voice' / f'c{number}', language=code)]
    return found


if __name__ == '__main__':
    import sys
    print(json.dumps(sheets(sys.argv[1], core.load(Path(sys.argv[1]) / 'story.json'))))
