"""What the skill learns about a project, run after run, without anyone writing it down.

After a run (`film.py learn`, started in the background by `finish`), <HOME>/projects/<owner>__<name>/knowledge/ keeps:
- scenes/ and scenes.json: every scene that passed its try, with its change, base test and tag: the next scene on the
  same screen starts from a test whose login, data and locators already worked;
- lessons.md: what a scene writer should know to pass on the first try (logins, data, helpers, locators, traps), written
  by Opus 5.5 from the tries' errors and the tests that passed, merged with the lessons of earlier runs;
- narration.md (narration-<language>.md for a language other than Polish): what the narration of this project's films
  should avoid or keep, from what the review had to rewrite
  (claims the pictures did not show, chapters dropped), merged with earlier runs;
- features.json: which change each chapter showed, with a test or a scene on which base test, and its proofs: a later
  change on the same screen gets a hint for its scene;
- history.jsonl: one line per run (tag, minutes, chapters, scenes filmed and tries).
Later runs read it: the scene briefs carry the lessons and the nearest earlier scene, the scene writers the narration
lessons.
"""
import json
from pathlib import Path
import re
import shutil

import core

LIBRARY = 40  # scenes kept (the oldest go first)
LESSONS = 15  # bullets kept in lessons.md
LIMITS = 8  # things the test stack cannot show, kept in limits.json (for the scene choice)
RECIPES = 30  # data recipes kept in recipes.json (how a passed scene made an entity with full data)
# a scene writer's "failed: …" names a limit of the test stack when it names a service it lacks, not its own mistake
LIMIT = re.compile(r'\b(AI|LLM|model|OpenAI|provider|e-?mail|SMTP|mail|payment|Stripe|S3|storage|upload|video|camera|'
                   r'microphone|voice|webhook|third-party|external|service|disabled|not configured|not running|'
                   r'unavailable|no key|API key)\b', re.I)
WORD = re.compile(r'[a-ząćęłńóśźż]{4,}', re.I)
PLAIN = {'with', 'from', 'that', 'this', 'test', 'spec', 'specs', 'shows', 'show', 'change', 'changes', 'feat', 'feature',
         'page', 'user', 'screen', 'the', 'and', 'into', 'when', 'after', 'before', 'adds', 'added', 'fix', 'fixes'}


# A bounded scene preflight, not a JavaScript sandbox. Project helpers may access the
# database internally; only direct clients / SQL authored in this scene are checked.
_JS_LITERALS = re.compile(r"//[^\n]*|/\*[\s\S]*?\*/|'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|`(?:\\.|[^`\\])*`")
_DB_PACKAGE = re.compile(r'(?:pg|pg-promise|postgres|mysql2?(?:/promise)?|sqlite3|better-sqlite3|node:sqlite|'
                         r'mssql|oracledb|@prisma/client|typeorm|sequelize|knex)(?:/.*)?$')
_SQL_START = re.compile(r'\s*(?:SELECT\b[\s\S]*?\bFROM\b|INSERT\s+INTO\b|UPDATE\s+[\w."`]+\s+SET\b|'
                       r'DELETE\s+FROM\b|(?:CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\b|WITH\s+\w+\s+AS\s*\()', re.I)
_SQL_CALL = re.compile(r'(?:\.\s*(?:query|execute|exec|raw|\$queryRaw(?:Unsafe)?|\$executeRaw(?:Unsafe)?)|'
                       r'\b(?:query|executeSQL|sql|raw))\s*(?:\(\s*)?$')
_DIRECT_RAW = re.compile(r'\.\s*\$(?:query|execute)Raw(?:Unsafe)?\b|'
                         r'\bnew\s+(?:pg\s*\.\s*(?:Client|Pool)|PrismaClient)\s*\(')
_DATA_SQL = re.compile(r'\bpg[.\s]+(?:Client|Pool)\b|\b(?:raw|direct|custom)\s+SQL\b|'
                       r'\bINSERT\s+INTO\s+[\w."]+|\bUPDATE\s+[\w."]+\s+SET\b|'
                       r'(?-i:\bSELECT)\s+[\w."*,\s]+\s+(?-i:FROM)\s+[\w."]+|'
                       r'\bDELETE\s+FROM\s+[\w."]+|\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\b', re.I)


def scene_policy_issue(source):
    """Return a precise direct-DB violation; do not scan imported project helpers."""
    pieces, literals, end = [], [], 0
    for token in _JS_LITERALS.finditer(source):
        pieces.append(source[end:token.start()])
        pieces.append(re.sub(r'[^\n]', ' ', token.group()))
        if not token.group().startswith(('//', '/*')):
            literals.append((token.start(), token.group()[1:-1]))
        end = token.end()
    code = ''.join(pieces) + source[end:]
    for start, value in literals:
        prefix = code[:start].rstrip()
        if _DB_PACKAGE.fullmatch(value) and re.search(r'\b(?:from|require\s*\(|import\s*\(?)\s*$', prefix):
            kind = f'direct database client import {value!r}'
        elif _SQL_START.match(value) and _SQL_CALL.search(prefix):
            kind = 'raw SQL call'
        else:
            continue
        return f'{kind} at line {source.count(chr(10), 0, start) + 1}'
    match = _DIRECT_RAW.search(code)
    if match:
        return f'direct database / raw SQL call at line {source.count(chr(10), 0, match.start()) + 1}'
    return ''


def scene_spec(gap_folder):
    passed = Path(gap_folder) / 'scene.passed.spec.ts'
    return passed if passed.is_file() else Path(gap_folder) / 'scene.spec.ts'


def loose_role_names(source):
    """Fixed-name getByRole calls without an explicit exact choice: [(where `exact: true` goes, the text to insert,
    line)]. Imported helpers stay unchanged."""
    code = _JS_LITERALS.sub(lambda match: re.sub(r'[^\n]', ' ', match.group()), source)
    # comments blank, literals kept: where the options' own text ends
    bare = _JS_LITERALS.sub(lambda match: re.sub(r'[^\n]', ' ', match.group()) if match.group()[0] == '/'
                            else match.group(), source)
    found = []
    for call in re.finditer(r'\.\s*getByRole\s*\(\s*[^,(){}]*,\s*\{([^{}]*)\}\s*\)', code):
        options = call.group(1)
        name = re.search(r'\bname\s*:\s*', options)
        if not name or re.search(r'\bexact\s*:', options):
            continue
        # The masked literal is whitespace, so find its original value after the colon.
        original = source[call.start(1):call.end(1)]
        value = original[name.start():].partition(':')[2].lstrip()
        if value.startswith(('"', "'", '`')):
            kept = bare[call.start(1):call.end(1)].rstrip()
            found.append((call.start(1) + len(kept), ' exact: true' if kept.endswith(',') else ', exact: true',
                          source.count('\n', 0, call.start()) + 1))
    return found


def scene_locator_issue(source):
    """Catch an ambiguous fixed-name role selector before spending camera time."""
    found = loose_role_names(source)
    return f'fixed-name getByRole lacks an explicit exact match at line {found[0][2]}' if found else ''


def exact_role_names(source):
    """The scene with `exact: true` in every fixed-name getByRole without an explicit exact choice (what every writer
    did when the check refused the scene), and the lines changed."""
    found = loose_role_names(source)
    for at, text, _ in reversed(found):
        source = source[:at] + text + source[at:]
    return source, sorted({line for _, _, line in found})


def allowed_scene(spec):
    return spec.is_file() and not scene_policy_issue(spec.read_text(encoding='utf-8', errors='ignore'))


def allowed_data_note(text):
    return not (_DATA_SQL.search(text) or scene_policy_issue(text))


def allowed_recipe(repo, recipe):
    if not allowed_data_note(recipe.get('text') or ''):
        return False
    # Older recipes carry only scene/tag. Check their preserved source as well: a
    # recipe may describe an SQL-written scene without quoting its SQL itself.
    name = f"{recipe.get('scene')}--{re.sub(r'[^A-Za-z0-9.-]+', '-', recipe.get('tag') or '')}.spec.ts"
    spec = folder(repo) / 'scenes' / name
    return not spec.is_file() or allowed_scene(spec)


def folder(repo):
    return core.HOME / 'projects' / core.project_key(repo) / 'knowledge'


def words(*texts):
    return {w.lower() for t in texts for w in WORD.findall(t or '')} - PLAIN


def scene_tries(index):
    """{scene id: [(batch, status, error)]}: every try of every scene, from the capture index's batches."""
    tries = {}
    for batch, info in sorted((index.get('batches') or {}).items()):
        for result in info.get('results') or []:
            name = Path(result.get('file') or '').name.replace('demo--', '', 1)
            match = re.match(r'rf-([a-z0-9-]+)(?:\.(?:spec|test|e2e))+\.[cm]?[jt]sx?$', name)  # gaps.test_suffix
            if match:
                tries.setdefault(match.group(1), []).append((batch, result.get('status'), (result.get('error') or '')[:300]))
    return tries


def related(repo, gap, limit=2):
    """Earlier scenes nearest to ``gap``: the same base test first, then shared words of titles, flows and bases."""
    home = folder(repo)
    wanted = words(gap.get('title'), gap.get('show'), Path(gap.get('base') or '').stem.replace('-', ' '))
    ranked = []
    for scene in core.load(home / 'scenes.json', []) or []:
        if not allowed_scene(home / 'scenes' / scene['file']):
            continue
        shared = len(wanted & words(scene.get('title'), scene.get('show'), Path(scene.get('base') or '').stem.replace('-', ' ')))
        score = 3 * (scene.get('base') == gap.get('base')) + shared
        if score >= 2:
            ranked.append((score, scene.get('tag') or '', scene))
    ranked.sort(key=lambda r: (r[0], r[1]), reverse=True)
    return [r[2] for r in ranked[:limit]]


def recall(repo, gap, lines=200):
    """The brief's section of what earlier runs learned ('' when nothing is known yet)."""
    home = folder(repo)
    lessons = (home / 'lessons.md').read_text(encoding='utf-8').strip() if (home / 'lessons.md').is_file() else ''
    lessons = '\n'.join(line for line in lessons.splitlines() if allowed_data_note(line))
    near = related(repo, gap)
    recipes = recipes_for(repo, gap)
    if not lessons and not near and not recipes:
        return ''
    out = ['## What earlier runs on this project learned']
    if lessons:
        out += ['Lessons from earlier scenes (logins, data, helpers, locators, traps):', lessons]
    if recipes:
        out += ['Data recipes from scenes that passed (full data through the project\'s own helpers; use one that fits):']
        out += [f'- {r}' for r in recipes]
    if near:
        best, others = near[0], near[1:]
        source = (home / 'scenes' / best['file']).read_text(encoding='utf-8', errors='ignore').splitlines()
        out += [f"A scene that passed in an earlier run ({best.get('tag')}, #{', #'.join(map(str, best.get('prs') or []))}: "
                f"{best.get('title')}; base `{best.get('base')}`): its login, data and locators worked, reuse what fits.",
                '```ts', '\n'.join(source[:lines]) + ('\n// … (shortened)' if len(source) > lines else ''), '```']
        out += [f"Another earlier scene: `{home / 'scenes' / s['file']}` ({s.get('tag')}: {s.get('title')})." for s in others]
    return '\n'.join(out) + '\n'


DISTILL = """Short Playwright tests ("scenes") were written for a demo film of the release {repo} {tag}. Below: each
scene's tries (the error of every failed try), how it ended, and the test that passed. Write what the writer of the next
scene for this project should know to pass on the first try: how to log in or pick a user with the right permissions,
how to create data through the project's existing helpers/factories, which fixtures or page objects to use, locators and waits that work
on these screens, and the traps the failed tries hit. Only facts these tries or tests show, stated generally (not tied
to this release's changes). Never write a password, token or key: say where the test gets it (a fixture, a seed file). Merge them with the lessons from earlier runs below: keep what still holds, drop what these
tries contradict, keep the list short. Never teach custom SQL, direct database clients, or mocking the application's own API.
Use existing project helpers/factories; mock external services only through the project's existing test patterns.
Drop earlier lessons that recommend custom SQL, direct database clients, or mocking the application's own API.
{brief}

Answer with at most {limit} bullets ("- …"), one line each, nothing else.

Lessons from earlier runs:
{lessons}

Scenes:
{scenes}
"""


def distill(run, repo, tag, tries, provider=None, lines=120):
    """lessons.md merged with what this run's scene tries teach; returns the bullets ([] when no model can answer)."""
    import editor
    import llm
    run, home = Path(run), folder(repo)
    blocks = []
    for gap_folder in sorted((run / 'gaps').glob('*/')):
        gap = core.load(gap_folder / 'gap.json') or {}
        result = core.load(gap_folder / 'result.json') or {}
        history = tries.get(gap_folder.name) or []
        if not gap or not history and not result:
            continue
        spec = scene_spec(gap_folder)
        authored = gap_folder / 'scene.spec.ts'
        if ((spec.is_file() and not allowed_scene(spec))
                or (authored.is_file() and not allowed_scene(authored))):
            continue  # neither its source nor its recipes/errors may teach custom SQL
        said = (core.worker_result(gap_folder / 'worker.log').get('result') or '')[:200]
        block = [f"### {gap.get('title')} (base {gap.get('base')})"]
        block += [f"- try {batch}: {status}" + (f": {error}" if error else '') for batch, status, error in history]
        block.append(f"- ended: {'passed' if result.get('ok') else 'failed'}" + (f"; the writer said: {said}" if said else ''))
        notes = (gap_folder / 'notes.txt').read_text(encoding='utf-8').strip() if (gap_folder / 'notes.txt').is_file() else ''
        block += [f'- the writer noted: {line}' for line in notes.splitlines()[:5] if allowed_data_note(line)]
        if result.get('ok') and spec.is_file():
            source = spec.read_text(encoding='utf-8', errors='ignore').splitlines()
            block += ['```ts', '\n'.join(source[:lines]), '```']
        blocks.append('\n'.join(block))
    if not blocks:
        return []
    earlier = (home / 'lessons.md').read_text(encoding='utf-8').strip() if (home / 'lessons.md').is_file() else '(none yet)'
    earlier = '\n'.join(line for line in earlier.splitlines() if allowed_data_note(line))
    prompt = DISTILL.format(repo=repo, tag=tag, brief=editor.BRIEF, limit=LESSONS, lessons=earlier, scenes='\n\n'.join(blocks))
    text, usage = llm.complete(prompt, 'You keep the notes a test writer reads before writing a test for this project.',
                               provider, effort='medium')
    if usage.get('provider') == 'agent':
        return []
    bullets = [line.strip() for line in text.splitlines()
               if line.strip().startswith('- ') and allowed_data_note(line)][:LESSONS]
    if bullets:
        (home / 'lessons.md').write_text('\n'.join(bullets) + '\n', encoding='utf-8')
    return bullets


def recipes_for(repo, gap, limit=3):
    """The data recipes nearest to a scene (shared words with its title and flow), at most ``limit``."""
    wanted = words(gap.get('title'), gap.get('show'), Path(gap.get('base') or '').stem.replace('-', ' '))
    ranked = sorted(((len(wanted & set(r.get('words') or [])), -i, r['text'])
                     for i, r in enumerate(reversed(core.load(folder(repo) / 'recipes.json', []) or []))
                     if allowed_recipe(repo, r)), reverse=True)
    return [text for shared, _, text in ranked if shared][:limit]


def found_recipes(run, known):
    """``known`` (recipes.json entries) with the recipes this run's passed scenes left (`film.py note --kind recipe`)."""
    info = core.load(Path(run) / 'meta.json') or {}
    tag, repo = info.get('tag'), info.get('repo')
    known = [r for r in known if allowed_recipe(repo, r)]
    for gap_folder in sorted(Path(run).glob('gaps/*/')):
        gap = core.load(gap_folder / 'gap.json') or {}
        if not (core.load(gap_folder / 'result.json') or {}).get('ok') or not (gap_folder / 'recipes.txt').is_file():
            continue
        if not allowed_scene(scene_spec(gap_folder)) or not allowed_scene(gap_folder / 'scene.spec.ts'):
            continue  # a later rejected edit cannot contribute recipes via an earlier passed result
        for line in (gap_folder / 'recipes.txt').read_text(encoding='utf-8').splitlines():
            text = ' '.join(line.split())[:300]
            if text and allowed_data_note(text):
                known = [k for k in known if k['text'] != text] + [{
                    'text': text, 'words': sorted(words(text, gap.get('title'), gap.get('show'))), 'tag': tag,
                    'scene': gap_folder.name}]
    return known[-RECIPES:]


def limits(repo):
    """What earlier runs found the project's test stack cannot show (a service it does not run, such as an AI
    provider): one line each, for the scene choice."""
    return [item['text'] for item in core.load(folder(repo) / 'limits.json', []) or []]


def found_limits(run, known):
    """``known`` (limits.json entries) with the limits this run's scene writers gave up on: a ``failed: …`` answer
    that names a service the test stack lacks."""
    tag = (core.load(Path(run) / 'meta.json') or {}).get('tag')
    for log in sorted(Path(run).glob('gaps/*/worker.log')):
        match = re.match(r'\s*failed\s*:?\s*(.+)', core.worker_result(log).get('result') or '', re.I | re.S)
        if match and LIMIT.search(match.group(1)):
            text = ' '.join(match.group(1).split())[:160]
            known = [k for k in known if k['text'] != text] + [{'text': text, 'tag': tag, 'scene': log.parent.name}]
    return known[-LIMITS:]


def earlier(repo, pr, limit=2):
    """Earlier chapters of the project nearest to a pull request (shared words of their titles): which base test showed
    them, for the scene choice."""
    wanted = words(pr.get('title'))
    ranked = []
    for feature in core.load(folder(repo) / 'features.json', []) or []:
        shared = len(wanted & words(feature.get('title'), feature.get('chapter')))
        if shared >= 2:
            ranked.append((shared, feature.get('tag') or '', feature))
    ranked.sort(key=lambda r: (r[0], r[1]), reverse=True)
    return [r[2] for r in ranked[:limit]]


def features(run, story, index, tag):
    """The chapters of a finished run as features: the change, how it was filmed (a test, or a scene on a base test)."""
    films = {f.get('key'): f for f in index.get('films') or []}
    found = []
    titles = {pr['number']: pr['title'] for pr in (core.load(Path(run) / 'sources.json', {}) or {}).get('prs') or []}
    for chapter in story.get('chapters') or []:
        film = films.get(chapter.get('film')) or {}
        gap = core.load(Path(run) / 'gaps' / str(film.get('gap')) / 'gap.json') if film.get('gap') else None
        for number in chapter.get('prs') or []:
            found.append({'pr': number, 'title': titles.get(number, ''), 'chapter': chapter.get('title'), 'tag': tag,
                          'by': 'scene' if gap else 'test', 'spec': (gap or {}).get('base') or film.get('spec'),
                          'test': film.get('title'), 'proofs': chapter.get('proofs') or []})
    return found


NARRATION = """The narration of a demo film of the release {repo} {tag} was checked against the film's pictures. Below:
each sentence the check rewrote (what it said, what the pictures did not show, the rewrite) and each chapter it dropped.
Write what the writers of this project's next films should know so the check has nothing to rewrite while every
chapter still says plainly what the release changed: kinds of claims to avoid on these screens (a message that shows
only briefly, a state a test sets up off screen, a value not on screen), names and words to use for its features in
{language}, and what to say instead. A lesson never tells the writers to leave a chapter's change unnamed or to read labels
aloud instead: it says how to state the change where the pictures show its effect. A lesson never teaches describing an
empty screen (an empty list, zeros, a "No … yet" page): it says to end the chapter on its result before such a screen,
or to show the data that fills it. General and short: no values, names or labels quoted from this film (they change
with every release). Merge them with the lessons from earlier runs below:
keep what still holds and agrees with this, drop the rest, keep the list short.
{brief}

Answer with at most {limit} bullets ("- …"), one line each, nothing else.

Lessons from earlier runs:
{lessons}

Rewrites and drops:
{items}
"""


def narration_file(repo, code='pl'):
    """Where the project's narration lessons in a language are kept: wording learned in one language does not carry to
    another (narration.md: Polish, the skill's first; narration-<code>.md: another)."""
    return folder(repo) / ('narration.md' if code == 'pl' else f'narration-{code}.md')


def narration(repo, code='pl'):
    """The project's narration lessons for films in ``code`` ('' when none yet)."""
    path = narration_file(repo, code)
    return path.read_text(encoding='utf-8').strip() if path.is_file() else ''


def distill_narration(run, repo, tag, provider=None, limit=10):
    """The narration lessons in the film's language merged with what this run's review rewrote and dropped; returns the
    bullets ([] without either)."""
    import editor
    import llm
    found = core.load(Path(run) / 'review' / 'claims.json', {}) or {}
    items = [f"- said: {c.get('before', '')} | not shown: {c.get('problem', '')} | rewrite: {c.get('fix', '')}"
             for c in found.get('applied') or []]
    items += [f"- dropped chapter \"{d.get('title')}\": {d.get('reason', '')}" for d in found.get('drops') or []]
    if not items:
        return []
    import language
    said = language.texts(core.load(Path(run) / 'sources.json') or {})
    prompt = NARRATION.format(repo=repo, tag=tag, brief=editor.BRIEF, limit=limit,
                              lessons=narration(repo, said['code']) or '(none yet)', items='\n'.join(items[:40]),
                              language=said['name'])
    text, usage = llm.complete(prompt, 'You keep the notes the writers of this project\'s demo films read.', provider,
                               effort='medium')
    if usage.get('provider') == 'agent':
        return []
    bullets = [line.strip() for line in text.splitlines() if line.strip().startswith('- ')][:limit]
    if bullets:
        folder(repo).mkdir(parents=True, exist_ok=True)
        narration_file(repo, said['code']).write_text('\n'.join(bullets) + '\n', encoding='utf-8')
    return bullets


def learn(run, provider=None):
    """Fold one finished run into the project's knowledge; returns what changed. One run at a time per project (two
    runs finishing together would each rewrite the other's lessons)."""
    import fcntl
    run = Path(run)
    repo = core.load(run / 'meta.json')['repo']
    folder(repo).mkdir(parents=True, exist_ok=True)
    with open(folder(repo) / '.learn.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        return _learn(run, provider)


def _learn(run, provider=None):
    info = core.load(run / 'meta.json')
    repo, tag = info['repo'], info['tag']
    home = folder(repo)
    (home / 'scenes').mkdir(parents=True, exist_ok=True)
    index = core.load(run / 'captures.json', {}) or {}
    story = core.load(run / 'story.json', {}) or {}

    tries = scene_tries(index)
    # Check legacy recipe provenance before a same-tag scene is replaced or aged out.
    # Otherwise replacing an SQL-written scene could make its old recipe look safe.
    recipes = [r for r in core.load(home / 'recipes.json', []) or [] if allowed_recipe(repo, r)]
    library, kept = core.load(home / 'scenes.json', []) or [], []
    for gap_folder in sorted((run / 'gaps').glob('*/')):
        gap, result = core.load(gap_folder / 'gap.json') or {}, core.load(gap_folder / 'result.json') or {}
        spec = scene_spec(gap_folder)  # the spec of the take that passed (the writer may edit on)
        gave_up = core.gave_up(core.worker_result(gap_folder / 'worker.log').get('result'))
        if not gap or not result.get('ok') or not allowed_scene(spec) or gave_up:  # never a scene its writer gave up on
            continue
        name = f"{gap_folder.name}--{re.sub(r'[^A-Za-z0-9.-]+', '-', tag)}.spec.ts"
        shutil.copy2(spec, home / 'scenes' / name)
        library = [s for s in library if s['file'] != name]
        library.append({'file': name, 'id': gap.get('id'), 'prs': gap.get('prs'), 'title': gap.get('title'),
                        'show': gap.get('show'), 'base': gap.get('base'), 'proofs': gap.get('proofs'), 'tag': tag,
                        'run': run.name, 'actions': result.get('actions'), 'tries': len(tries.get(gap_folder.name) or [])})
        kept.append(name)
    for old in library[:-LIBRARY]:
        (home / 'scenes' / old['file']).unlink(missing_ok=True)
    core.save(home / 'scenes.json', library[-LIBRARY:])

    core.save(home / 'limits.json', found_limits(run, core.load(home / 'limits.json', []) or []))
    core.save(home / 'recipes.json', found_recipes(run, recipes))
    mapped = [f for f in core.load(home / 'features.json', []) or [] if f.get('tag') != tag] + features(run, story, index, tag)
    core.save(home / 'features.json', mapped[-400:])
    lessons = distill(run, repo, tag, tries, provider)
    told = distill_narration(run, repo, tag, provider)
    stages = core.timings(run)
    line = {'tag': tag, 'run': run.name, 'at': core.now(), 'minutes': round(stages.get('total', 0) / 60, 1),
            'chapters': len(story.get('chapters') or []), 'scenes': {s['id']: bool(s.get('ok')) for s in story.get('scenes') or []},
            'tries': {k: len(v) for k, v in tries.items()}, 'lessons': len(lessons), 'narration': len(told)}
    with (home / 'history.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(line, ensure_ascii=False) + '\n')
    return {'knowledge': str(home), 'scenes_kept': kept, 'lessons': len(lessons), 'narration_lessons': len(told),
            'features': len(mapped)}
