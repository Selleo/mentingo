#!/usr/bin/env python3
"""A recorded film's release assets: staged after the recording (release-film.yml), published by another,
separately started workflow (release-film-publish.yml).

  release_assets.py stage   --run <run dir> --tag <tag> --commit <sha> --out <dir>
  release_assets.py earlier --tag <tag> [--base-url <site url>]
  release_assets.py publish --dir <staged dir> --target draft|release [--base-url <site url>] [--replace]
  release_assets.py site    --out <dir> [--film <staged dir>] [--base-url <site url>] [--replace]

stage checks the film the run made (a plain file of video and audio that decodes to the end, of a plausible length)
and copies it, its captions, its poster and its page (a ZIP) under release asset names, with release.json naming the
release and each file's SHA-256. publish checks those files against release.json and attaches them to the tag's
release (target release) or to a test draft release made for it (target draft), with a section of links in its
notes. A re-run adds what is missing; a tag that already has another film (on its release, or on the site at
--base-url) stops the publication, and nothing changes, unless --replace removes that film's assets first (no other
asset is ever touched). earlier makes the same check before a recording spends the seat's limits. site builds the
GitHub Pages site of the films: each published release's page (its ZIP asset) at /<tag>/, a recording's page for the
site alone (--film: its staged files, no release touched; a tag the site already shows needs --replace) and every
film the live site already shows (--base-url: read back from its films.json), with an index of them, newest first.
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import core  # noqa: E402
from page import head  # noqa: E402  the film page's own look, in the project's brand

FILM_SECONDS = (10, 600)  # a film outside this is broken, not merely long or short (one scene lasts 20-30 s)
MARK_START, MARK_END = '<!-- release-film -->', '<!-- /release-film -->'
PAGE_FILES = ('index.html', 'demo.mp4', 'poster.jpg')  # with the captions: the page's own files
SITE_MANIFEST = 'films.json'  # the site's own list of its films: the next rebuild keeps the ones nothing else gives
PLAIN_NAME = re.compile(r'[A-Za-z0-9._-]+')  # a tag or a file name that stays in its own folder


def asset_names(tag, code):
    """Release asset name of each staged file (``code``: the film's language)."""
    return {'film': f'release-film-{tag}.mp4', 'captions_vtt': f'release-film-{tag}.{code}.vtt',
            'captions_srt': f'release-film-{tag}.{code}.srt', 'poster': f'release-film-{tag}-poster.jpg',
            'page': f'release-film-{tag}-page.zip'}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def check(condition, message):
    if not condition:
        raise SystemExit(f'::error::{message}')


def plain_file(path, inside):
    path = Path(path)
    return path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(inside) and path.stat().st_size > 0


def stage(run, tag, commit, out):
    run = Path(run).resolve()
    meta = json.loads((run / 'meta.json').read_text(encoding='utf-8'))
    check(meta.get('tag') == tag, f'the run recorded {meta.get("tag")}, not {tag}')
    check((run / 'story.json').is_file() and (run / 'film.json').is_file(), 'the run made no film')
    public = (run / 'public').resolve()
    captions = sorted(public.glob('captions-*.vtt'))
    check(len(captions) == 1, 'the page has no single captions file')
    code = re.fullmatch(r'captions-([a-z]{2})\.vtt', captions[0].name)
    check(code, f'unexpected captions file {captions[0].name}')
    code = code.group(1)
    files = {'film': public / 'demo.mp4', 'captions_vtt': captions[0], 'captions_srt': public / f'captions-{code}.srt',
             'poster': public / 'poster.jpg', 'index': public / 'index.html'}
    for key, path in files.items():
        check(plain_file(path, public), f'{key} ({path.name}) is missing or not a plain file of the page')
    probed = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(files['film'])],
                            capture_output=True, text=True, errors='replace')
    check(probed.returncode == 0, f'the film cannot be read: {probed.stderr.strip()[-300:]}')
    probe = json.loads(probed.stdout)
    seconds = float(probe['format']['duration'])
    check(FILM_SECONDS[0] <= seconds <= FILM_SECONDS[1], f'the film lasts {seconds:.0f} s')
    check({'audio', 'video'} <= {s.get('codec_type') for s in probe['streams']}, 'the film needs audio and video')
    # decodes to the end: -xerror stops at the first error (a cut or damaged file), which ffmpeg would otherwise skip
    decoded = subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(files['film']), '-f', 'null', '-'],
                             capture_output=True, text=True, errors='replace')
    check(decoded.returncode == 0, f'the film does not decode to its end: {decoded.stderr.strip()[-300:]}')
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    names = asset_names(tag, code)
    for key in ('film', 'captions_vtt', 'captions_srt', 'poster'):
        shutil.copyfile(files[key], out / names[key])
    with zipfile.ZipFile(out / names['page'], 'w', zipfile.ZIP_STORED) as page:  # the film is compressed already
        for name in (*PAGE_FILES, files['captions_vtt'].name, files['captions_srt'].name):
            page.write(public / name, f'release-film-{tag}/{name}')
    with zipfile.ZipFile(out / names['page']) as page:
        check(page.testzip() is None, 'the page ZIP does not read back')
    manifest = {'tag': tag, 'commit': commit, 'language': code, 'film_seconds': round(seconds, 1),
                'assets': {name: sha256(out / name) for name in names.values()}}
    (out / 'release.json').write_text(json.dumps(manifest, indent=1) + '\n', encoding='utf-8')
    return manifest


def film_assets(tag, assets):
    """The tag's film among a release's assets {name: asset}: the files stage names, in whichever language."""
    pattern = re.compile(rf'release-film-{re.escape(tag)}(?:\.mp4|-poster\.jpg|-page\.zip|\.[a-z]{{2}}\.(?:vtt|srt))')
    return {name: asset for name, asset in assets.items() if pattern.fullmatch(name)}


def plan_uploads(staged, existing):
    """Which staged assets to upload given the release's assets ``{name: digest}``: identical ones are kept (a re-run
    resumes), missing ones uploaded, and a different asset of the same name is a conflict."""
    conflicts = [name for name, digest in staged.items() if name in existing and existing[name] != f'sha256:{digest}']
    return [name for name in staged if name not in existing], conflicts


def notes_section(tag, code, links):
    """The notes section linking the film's assets the release has."""
    labels = (('film', 'film (MP4)'), ('page', 'page with the film and every pull request (ZIP)'),
              ('captions_vtt', 'narration subtitles (VTT)'))
    names = asset_names(tag, code)
    parts = [f'[{label}]({links[names[key]]})' for key, label in labels if names[key] in links]
    return f'{MARK_START}\n## 🎬 Release film\n\nA narrated demo of this release: {" · ".join(parts)}\n{MARK_END}'


def with_section(body, section):
    """The notes with the film's section replaced, or added once at the end."""
    body = body or ''
    pattern = re.compile(re.escape(MARK_START) + r'.*?' + re.escape(MARK_END), re.S)
    if pattern.search(body):
        return pattern.sub(lambda _: section, body, count=1)
    return body.rstrip() + '\n\n' + section + '\n'


def gh(*args, input_text=None):
    done = subprocess.run(['gh', *args], capture_output=True, text=True, input=input_text)
    check(done.returncode == 0, f'gh {" ".join(args[:3])} failed: {done.stderr.strip()[:300]}')
    return done.stdout


def draft_tag(tag):
    return f'release-film-test-{tag}'


def draft_name(tag):
    return f'Release film test: {tag}'


def find_release(repo, tag, target, commit):
    """The release to publish to: the tag's published release, or the test draft release made for it (made now when
    missing; a draft has no tag until it is published, so nothing else sees it). A draft is found by its name: GitHub
    lists it under a tag of its own (untagged-…), not the one it was made with."""
    if target == 'release':
        data = json.loads(gh('api', f'repos/{repo}/releases/tags/{tag}'))
        check(not data.get('draft'), f'{tag} is a draft release')
        return data
    for release in json.loads(gh('api', f'repos/{repo}/releases?per_page=100')):  # newest first: a draft made today
        if release.get('draft') and release.get('name') == draft_name(tag):
            return release
    return json.loads(gh('api', '-X', 'POST', f'repos/{repo}/releases', '-f', f'tag_name={draft_tag(tag)}',
                         '-f', f'target_commitish={commit}', '-f', f'name={draft_name(tag)}', '-F', 'draft=true',
                         '-f', 'body=A test of the release film publication: delete this draft after checking it.'))


def release_of(repo, tag):
    """The tag's published release, or {} when it has none."""
    done = subprocess.run(['gh', 'api', f'repos/{repo}/releases/tags/{tag}'], capture_output=True, text=True)
    return json.loads(done.stdout) if done.returncode == 0 else {}


def shown_apart(tag, base_url):
    """Whether the live site shows a film of the tag that no release gives (a recording put on the site alone). A
    release's own film there is the release's, and the release's assets already say which film that is."""
    film = live_films(base_url).get(tag)
    return film is not None and film.get('source') != 'release'


def earlier(tag, repo=None, base_url=None):
    """Stops when the tag already has a published film: its assets on the tag's release, or its page on the site at
    ``base_url``. A recording that would publish over it finds out before it spends the seat's limits."""
    repo = repo or os.environ['GITHUB_REPOSITORY']
    release = release_of(repo, tag)
    on_release = sorted(film_assets(tag, {a['name']: a for a in release.get('assets') or []}))
    on_site = shown_apart(tag, base_url)
    where = ' and '.join(w for w, found in (("its release's assets", on_release), ('the Pages site', on_site)) if found)
    check(not where, f'{tag} already has a film ({where}): record with replace to swap it, or with publish off to watch '
                     'the new film first')
    return {'tag': tag, 'release': on_release, 'site': on_site}


def publish(folder, target, repo=None, replace=False, base_url=None):
    """The staged film on the release. A tag that already has another film (its assets on this release, in any
    language, or, for the tag's release, its page on the site at ``base_url``) stops the publication; with ``replace``
    those assets are deleted first and the notes section rewritten, and the site's next rebuild shows this film."""
    folder = Path(folder)
    repo = repo or os.environ['GITHUB_REPOSITORY']
    manifest = json.loads((folder / 'release.json').read_text(encoding='utf-8'))
    tag, code = manifest['tag'], manifest['language']
    check(set(manifest['assets']) == set(asset_names(tag, code).values()), 'release.json names other assets')
    for name, digest in manifest['assets'].items():
        check(plain_file(folder / name, folder.resolve()) and sha256(folder / name) == digest, f'{name} is not the file staged')
    release = find_release(repo, tag, target, manifest['commit'])
    assets = {a['name']: a for a in release.get('assets') or []}
    stale = [name for name, asset in film_assets(tag, assets).items()
             if asset.get('digest') != f'sha256:{manifest["assets"].get(name)}']
    on_site = target == 'release' and shown_apart(tag, base_url)  # a publication of the release's own film resumes
    where = ' and '.join(w for w, found in (('the release: ' + ', '.join(stale), stale), ('the Pages site', on_site)) if found)
    check(replace or not where, f'{tag} already has another film ({where}); nothing was changed: publish with replace '
                                'to remove it and publish this one')
    for name in stale:
        gh('api', '-X', 'DELETE', f'repos/{repo}/releases/assets/{assets[name]["id"]}')
    existing = {name: asset.get('digest') for name, asset in assets.items() if name not in stale}
    uploads, conflicts = plan_uploads(manifest['assets'], existing)
    check(not conflicts, f'the release already has other assets named {conflicts}; nothing was replaced')
    if uploads:
        gh('release', 'upload', release['tag_name'], '--repo', repo, *[str(folder / name) for name in uploads])
    release = json.loads(gh('api', f'repos/{repo}/releases/{release["id"]}'))
    links = {a['name']: a['browser_download_url'] for a in release.get('assets') or []}
    body = with_section(release.get('body'), notes_section(tag, code, links))
    if body != (release.get('body') or ''):
        gh('api', '-X', 'PATCH', f'repos/{repo}/releases/{release["id"]}', '-F', 'body=@-', input_text=body)
    return {'target': target, 'release': release.get('html_url'), 'removed': stale, 'site_film_replaced': on_site,
            'uploaded': uploads,
            'kept': [name for name in manifest['assets'] if name not in uploads],
            'notes': 'updated' if body != (release.get('body') or '') else 'unchanged'}


def index_page(repo, releases, brand=None):
    """The site's front page: each release's film (its poster, name and date), newest first, in the project's brand
    (the skill's project add-on: its fonts and accent)."""
    links, css = head(brand)
    esc = html.escape
    name = repo.split('/')[-1]
    items = ''.join(
        f'<li class="card"><a href="{esc(r["tag_name"])}/"><img src="{esc(r["tag_name"])}/poster.jpg" alt=""></a>'
        f'<div><a href="{esc(r["tag_name"])}/"><b>{esc(r.get("name") or r["tag_name"])}</b></a><br>'
        f'<span class="muted">{esc((r.get("published_at") or "")[:10])}</span></div></li>' for r in releases)
    extra = ('.films{list-style:none;margin:0;padding:0;display:grid;gap:16px}'
             '.films li{display:flex;gap:16px;align-items:center;flex-wrap:wrap}'
             '.films img{width:240px;max-width:100%;border-radius:6px;display:block}')
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{esc(name)}: release films</title>{links}<style>{css}{extra}</style></head><body><main>'
            f'<header><h1>{esc(name)}: release films</h1><p class="muted">A narrated demo film of each release, newest '
            f'first.</p></header><ul class="films">{items or "<li>No film yet.</li>"}</ul></main></body></html>')


def page_files(page, tag):
    """The files of a film's page ZIP as (name, bytes), each checked to stay inside its folder."""
    prefix = f'release-film-{tag}/'
    with zipfile.ZipFile(page) as zipped:
        for member in zipped.infolist():
            inner = member.filename[len(prefix):]
            check(member.filename.startswith(prefix) and inner and '..' not in Path(inner).parts
                  and not Path(inner).is_absolute(), f'{Path(page).name} holds {member.filename!r}')
            if not member.is_dir():
                yield inner, zipped.read(member)


def written(folder, files):
    """``files`` (name, bytes) written into ``folder``: the names written."""
    names = []
    for name, data in files:
        target = folder / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        names.append(name)
    return sorted(names)


def recorded_film(folder):
    """A recording's staged film (its release-film artifact): (tag, page ZIP), the ZIP checked against release.json."""
    folder = Path(folder)
    manifest = json.loads((folder / 'release.json').read_text(encoding='utf-8'))
    tag = manifest.get('tag') or ''
    check(PLAIN_NAME.fullmatch(tag), f'unexpected tag name {tag!r}')
    name = asset_names(tag, manifest.get('language') or 'en')['page']
    digest = (manifest.get('assets') or {}).get(name)
    check(digest and plain_file(folder / name, folder.resolve()) and sha256(folder / name) == digest,
          f'{name} is not the file staged')
    return tag, folder / name


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as reply:  # noqa: S310 the site's own https address
        return reply.read()


def live_films(base_url):
    """The films the live site shows (its films.json): {tag: film}; none when there is no site or no list yet (its
    first rebuild: a 404). Any other failure stops the caller, and nothing is deployed or changed: a timeout, a server
    error or a list that does not read would otherwise make the next rebuild drop the films only the site keeps."""
    if not base_url:
        return {}
    kept = 'stopped so that no film only the site keeps is lost'
    try:
        data = fetch(f'{base_url.rstrip("/")}/{SITE_MANIFEST}')
    except urllib.error.HTTPError as failed:
        check(failed.code == 404, f'the live site answered {failed.code} for its {SITE_MANIFEST}: {kept}')
        return {}
    except OSError as failed:  # a timeout or a connection that fails
        check(False, f'the live site did not answer for its {SITE_MANIFEST} ({failed}): {kept}')
    try:
        listed = json.loads(data.decode('utf-8'))
    except ValueError:
        listed = None
    check(isinstance(listed, dict) and isinstance(listed.get('films'), list),
          f"the live site's {SITE_MANIFEST} does not read as a list of films: {kept}")
    films = {}
    for film in listed['films']:
        check(isinstance(film, dict) and PLAIN_NAME.fullmatch(str(film.get('tag') or '')) and isinstance(film.get('files'), list),
              f"the live site's {SITE_MANIFEST} lists a film it does not describe ({str(film)[:80]}): {kept}")
        films[film['tag']] = film
    return films


def site(out, repo=None, film=None, base_url=None, replace=False):
    """The Pages site: each published release's film page (its ZIP asset) at /<tag>/; ``film``, a recording's staged
    files, for a tag whose release has no film (the site alone: no release changes); and every film the live site at
    ``base_url`` already shows that neither gives now, its files taken from there (the site keeps what it showed). A
    release's film replaces a recording's of its tag. A recording of a tag whose release has a film, or of a tag the
    live site already shows without ``replace``, stops the rebuild. An index of them, newest first, and films.json,
    the list the next rebuild reads. A film the live site lists but cannot serve stops the rebuild: nothing is
    deployed then. Returns the tags shown."""
    repo = repo or os.environ['GITHUB_REPOSITORY']
    out = Path(out)
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    listed = gh('api', '--paginate', f'repos/{repo}/releases?per_page=100', '--jq',
                '.[] | {tag_name, name, published_at, draft, assets: [.assets[].name]}')
    published = {r['tag_name']: r for r in (json.loads(line) for line in listed.splitlines() if line.strip())
                 if not r.get('draft')}
    films = {}

    def shown(tag, source, files):
        release = published.get(tag) or {}
        date = (release.get('published_at') or dt.datetime.now(dt.timezone.utc).isoformat())[:10]
        films[tag] = {'tag': tag, 'name': release.get('name') or tag, 'date': date, 'source': source,
                      'files': written(out / tag, files)}

    with tempfile.TemporaryDirectory() as folder:
        for tag, release in published.items():
            name = asset_names(tag, 'en')['page']
            if name not in release['assets']:
                continue
            check(PLAIN_NAME.fullmatch(tag), f'unexpected tag name {tag!r}')
            gh('release', 'download', tag, '--repo', repo, '--pattern', name, '--dir', str(Path(folder) / tag))
            shown(tag, 'release', page_files(Path(folder) / tag / name, tag))
    live = live_films(base_url)
    if film:
        tag, page = recorded_film(film)
        check(tag not in films, f"{tag}'s release has a film, which the site shows; nothing was deployed: publish this "
                                'recording to the release, with replace, to change it')
        check(replace or tag not in live, f'the site already shows a film of {tag}; nothing was deployed: publish with '
                                          'replace to remove it and show this one')
        shown(tag, 'recording', page_files(page, tag))
    for tag, kept in live.items():
        if tag in films:
            continue
        names = [str(name) for name in kept['files']]
        check(all(PLAIN_NAME.fullmatch(name) for name in names), f'the live site lists odd files for {tag}')
        try:
            files = [(name, fetch(f'{base_url.rstrip("/")}/{tag}/{name}')) for name in names]
        except OSError as failed:
            check(False, f'the live site lists {tag} but does not serve it ({failed}); nothing was deployed')
        films[tag] = dict(kept, files=written(out / tag, files))
    ordered = sorted(films.values(), key=lambda f: (f.get('date') or '', f['tag']), reverse=True)
    releases = [{'tag_name': f['tag'], 'name': f.get('name'), 'published_at': f.get('date')} for f in ordered]
    (out / 'index.html').write_text(index_page(repo, releases, core.addon(repo).get('brand')), encoding='utf-8')
    (out / SITE_MANIFEST).write_text(json.dumps({'films': ordered}, indent=1) + '\n', encoding='utf-8')
    (out / '.nojekyll').touch()  # served as they are
    return {'films': [f['tag'] for f in ordered], 'out': str(out)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('command', choices=['stage', 'earlier', 'publish', 'site'])
    parser.add_argument('--run')
    parser.add_argument('--tag')
    parser.add_argument('--commit')
    parser.add_argument('--out')
    parser.add_argument('--dir')
    parser.add_argument('--target', choices=['draft', 'release'])
    parser.add_argument('--film', help='site: a recording\'s staged files (its release-film artifact)')
    parser.add_argument('--base-url', help='the live films site: site keeps its films, earlier and publish check it')
    parser.add_argument('--replace', action='store_true',
                        help="remove the tag's earlier film (its release assets, or its page on the site) for this one")
    args = parser.parse_args()
    if args.command == 'stage':
        result = stage(args.run, args.tag, args.commit, args.out)
    elif args.command == 'earlier':
        check(args.tag, 'earlier needs --tag')
        result = earlier(args.tag, base_url=args.base_url)
    elif args.command == 'site':
        result = site(args.out, film=args.film, base_url=args.base_url, replace=args.replace)
    else:
        check(args.target, 'publish needs --target draft or release')
        result = publish(args.dir, args.target, replace=args.replace, base_url=args.base_url)
    print(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
