"""What changed in a release: the pull requests merged between two tags and a map of what each one touched."""
from concurrent.futures import ThreadPoolExecutor
import json
import re
import subprocess
import time

import core

PR_SUBJECT = [re.compile(r'\(#(\d+)\)\s*$'), re.compile(r'^Merge pull request #(\d+)'), re.compile(r'\(#(\d+)\)')]
SPEC = re.compile(r'\.(spec|test|e2e)\.[cm]?[jt]sx?$')
# what a user sees: screen files by their kind, and the folders of a front end (a Rails app's app/ holds models and
# controllers too: only its views, scripts, styles and components count)
FRONTEND = re.compile(r'\.(tsx|jsx|vue|svelte|html|css|scss|erb|hbs|haml|slim)$|\.component\.ts$|(^|/)(frontend|web|client|ui)/'
                      r'|(^|/)app/(views|javascript|assets|components|frontend)/')
I18N = re.compile(r'(locales?|i18n|translations?|lang)/.*\.(json|ya?ml|po|ts|js)$', re.I)
CLOSES = re.compile(r'\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*#(\d+)', re.I)
NOISE = re.compile(r'^(\.github/|docs?/|.*\.md$|.*(package-lock|pnpm-lock|yarn\.lock|Gemfile\.lock)|.*CHANGELOG)', re.I)
# what a changed screen says to its user: attribute texts, text between tags, translations, addresses
UI_ATTR = re.compile(r'''(?:aria-label|placeholder|title|label|alt|tooltip|data-testid|data-test-id)\s*=\s*["']([^"'{}<>]{2,80})["']''')
JSX_TEXT = re.compile(r'>\s*([^<>{}\n=;]{3,80}?)\s*(?:<|$)')
I18N_VALUE = re.compile(r'''^\s*["']?[\w.\-]+["']?\s*:\s*["']([^"']{3,120})["']\s*,?\s*$''')
ROUTE = re.compile(r'''\b(?:path|to|href)\s*[:=]\s*\{?\s*["'`](/[\w/\-:.]*)["'`]''')
MARKUP = re.compile(r'\.(tsx|jsx|vue|svelte|html|erb|hbs)$')
LOCALE = re.compile(r'(?:^|[/_.-])([a-z]{2})(?:[-_][A-Za-z]{2})?(?=[/._]|$)(?!.*/(?:[a-z]{2})(?:[-_][A-Za-z]{2})?/)')
KEYWORD = re.compile(r'^(type|interface|export|const|let|var|return|case|if|else|function|async|await|import|from|as|'
                     r'default|enum|class|new|throw)\b')
TEMPLATE_ATTR = re.compile(r'''(?:aria-label|placeholder|title|label|alt)\s*=\s*\{\s*`([^`]{3,80})`''')
NOTICE = re.compile(r'''\b(?:toast|notify|notification|message|alert|snackbar)\w*(?:\.\w+)?\(\s*["'`]([^"'`]{3,80})["'`]''')
OBJECT_TEXT = re.compile(r'''\b(label|title|placeholder|tooltip|description|heading|text)\s*:\s*["'`]([^"'`{}$]{3,80})["'`]''')
CODE_LIKE = re.compile(r'^(undefined|null|true|false|Promise|none)$|^#[0-9a-f]{3,8}$|::|[(){};=]|=>|&&|^[\'"`.]|\.freeze', re.I)


def commits(repo_dir, base, tag):
    out = core.sh(['git', '-C', str(repo_dir), 'log', '--first-parent', '--format=%H%x09%s', f'{base}..{tag}']).stdout
    rows = []
    for line in out.splitlines():
        sha, _, subject = line.partition('\t')
        number = next((int(m.group(1)) for p in PR_SUBJECT for m in [p.search(subject)] if m), None)
        rows.append({'sha': sha, 'subject': subject, 'pr': number})
    return rows


def pull(slug, number, attempts=3):
    """A pull request's facts; None when #number is an issue (a commit subject may name one): a failure that passes
    (the network, GitHub's API) is tried again."""
    fields = 'number,title,body,labels,url,files,author,mergedAt'
    for attempt in range(attempts):
        try:
            done = core.sh(['gh', 'pr', 'view', str(number), '-R', slug, '--json', fields], timeout=120, check=False)
            error = '' if done.returncode == 0 else (done.stderr or done.stdout or '').strip()
        except subprocess.TimeoutExpired:
            done, error = None, f'gh pr view {number} gave no answer within 120 s'
        if not error:
            break
        if 'Could not resolve to a PullRequest' in error:
            return None
        if attempt + 1 == attempts:
            raise RuntimeError(f'gh pr view {number} -R {slug} failed: {error[-500:]}')
        time.sleep(5 * (attempt + 1))
    data = json.loads(done.stdout)
    return {'number': data['number'], 'title': data['title'], 'url': data['url'],
            'body': (data.get('body') or '').strip()[:2500], 'labels': [label['name'] for label in data.get('labels') or []],
            'author': (data.get('author') or {}).get('login'), 'merged_at': data.get('mergedAt'),
            'issues': sorted({int(n) for n in CLOSES.findall(data.get('body') or '')}),
            'files': [f['path'] for f in data.get('files') or []]}


def touched(files):
    """What a PR's files say about it: tests, screens, texts, the rest."""
    real = [f for f in files if not NOISE.match(f)]
    return {'specs': sorted(f for f in real if SPEC.search(f)),
            'frontend': sorted(f for f in real if FRONTEND.search(f) and not SPEC.search(f)),
            'texts': sorted(f for f in real if I18N.search(f)),
            'other': len(real) - len([f for f in real if SPEC.search(f) or FRONTEND.search(f)]),
            'noise': len(files) - len(real)}


def added_lines(repo_dir, sha, paths):
    """{path: [added lines]} of a merge against its first parent, for the given paths (from git, no API)."""
    if not paths:
        return {}
    # the prefixes named: a user's diff.noprefix (or dstPrefix) would leave no "+++ b/" header to read
    out = core.sh(['git', '-C', str(repo_dir), 'diff', '-U0', '--no-color', '--no-ext-diff', '--src-prefix=a/',
                   '--dst-prefix=b/', f'{sha}^1', sha, '--', *paths], check=False, timeout=180).stdout
    added, current = {}, None
    for line in out.splitlines():
        if line.startswith('+++ '):
            current = line[6:] if line.startswith('+++ b/') else None
        elif line.startswith('+') and current:
            added.setdefault(current, []).append(line[1:])
    return added


def locale(path):
    """The language of a translation file from its path (locales/en/…, pl.json, messages_de.yml), or None."""
    match = LOCALE.search(path)
    return match.group(1).lower() if match else None


def looks_like_text(line):
    """A line of words a person reads (a label between tags), not code."""
    if not line or KEYWORD.match(line) or re.search(r'[<>{}()=;:"\'`\[\]?|&!]|^//|^\*|\.\w', line):
        return False
    words = line.split()
    if len(words) == 1:  # a one-word label: "Stats", "Edit"
        return bool(re.fullmatch(r'[A-ZÀ-Ž][a-zà-ž]{2,}', line))
    return sum(bool(re.fullmatch(r"[A-Za-zÀ-ž'’-]+[.,:!?]?", w)) for w in words) >= max(2, 0.6 * len(words))


def ui_strings(added, limit=15):
    """Texts a user would read on the changed screens: attribute texts, text between tags, translation values and
    addresses from the added lines (spec files excluded), human text first."""
    found = []
    # the tests' screens speak English: of a text's translations keep the English one where the pull request has it
    english = any(locale(path) == 'en' for path in added if I18N.search(path))
    for path, lines in added.items():
        if SPEC.search(path) or (english and I18N.search(path) and locale(path) not in (None, 'en')):
            continue
        for line in lines:
            if I18N.search(path):
                match = I18N_VALUE.match(line)
                if match:
                    found.append(match.group(1))
            if MARKUP.search(path):
                found += UI_ATTR.findall(line) + ROUTE.findall(line)
                found += [t for t in JSX_TEXT.findall(line) if re.search(r'[A-Za-zÀ-ž]{3}', t)]
                found += [re.sub(r'\$\{[^}]*\}', '…', t) for t in TEMPLATE_ATTR.findall(line)]
                bare = line.strip()
                if looks_like_text(bare):
                    found.append(bare)  # text between tags on its own line
            if FRONTEND.search(path) and re.search(r'\.[cm]?[jt]sx?$', path):
                found += NOTICE.findall(line) + [t for _, t in OBJECT_TEXT.findall(line)]
    unique = []
    for text in (t.strip().rstrip(',') for t in found):
        if text and text not in unique and not CODE_LIKE.search(text):
            unique.append(text)
    human = [t for t in unique if ' ' in t or not re.fullmatch(r'[\w.\-/:]+', t)]
    return (human + [t for t in unique if t not in human])[:limit]


def release_notes(slug, tag, limit=2500):
    """The release's own title and notes on GitHub (what its authors put first), without links, images and markup;
    None when the tag has no published release."""
    out = core.sh(['gh', 'release', 'view', tag, '-R', slug, '--json', 'name,body'], check=False, timeout=60)
    try:
        data = json.loads(out.stdout or 'null') or {}
    except ValueError:
        return None
    body = re.sub(r'<[^>]+>|!\[[^\]]*\]\([^)]*\)|https?://\S+|[*#`>|]+', ' ', data.get('body') or '')
    body = re.sub(r'[ \t]+', ' ', re.sub(r'\n\s*\n+', '\n', body)).strip()
    return {'name': data.get('name') or tag, 'body': body[:limit]} if data else None


def collect(slug, repo_dir, base, tag, workers=8):
    rows = commits(repo_dir, base, tag)
    numbers = sorted({r['pr'] for r in rows if r['pr']})
    with ThreadPoolExecutor(max_workers=workers) as pool:
        prs = [pr for pr in pool.map(lambda n: pull(slug, n), numbers) if pr]
    shas = {r['pr']: r['sha'] for r in rows if r['pr']}
    for pr in prs:
        if len(pr['files']) >= 100 and pr['number'] in shas:  # GitHub lists at most 100 files: take the merge from git
            sha = shas[pr['number']]
            changed = core.sh(['git', '-C', str(repo_dir), 'diff', '--name-only', f'{sha}^1', sha], check=False).stdout.split()
            pr['files'] = changed or pr['files']
        pr['touched'] = touched(pr['files'])

    def diff(pr):
        paths = (pr['touched']['specs'] + pr['touched']['frontend'] + pr['touched']['texts'])[:80]
        return added_lines(repo_dir, shas[pr['number']], paths) if pr['number'] in shas else {}
    with ThreadPoolExecutor(max_workers=workers) as pool:  # the added lines say which tests and texts changed
        for pr, added in zip(prs, pool.map(diff, prs)):
            pr['spec_added'] = {path: lines[:200] for path, lines in added.items() if SPEC.search(path)}
            pr['ui'] = ui_strings(added)
            screens = {path: [l for l in lines if re.search(r'aria-label|data-testid|placeholder|label=|title=|role=|>[^<>{}]*[A-Za-z]{3}', l)]
                       for path, lines in added.items() if MARKUP.search(path) and not SPEC.search(path)}
            pr['markup'] = {path: lines[:20] for path, lines in screens.items() if lines}  # for locators in extra scenes
    found = {pr['number'] for pr in prs}  # a subject's number may name an issue: its commit is a direct one
    return {'repo': slug, 'base': base, 'tag': tag, 'prs': prs, 'release': release_notes(slug, tag),
            'direct_commits': [{'sha': r['sha'][:12], 'subject': r['subject']} for r in rows if r['pr'] not in found]}
