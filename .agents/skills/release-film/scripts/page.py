"""The preview page: the film with captions, its chapters and every pull request of the release, served on this
machine (127.0.0.1, no password)."""
import html
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

import core
import language

STYLE = '''
:root{--paper:#f3f4f4;--ink:#2f3033;--muted:#626469;--line:#dedfe1;--accent:#ff6d2a;--card:#fff}
@media (prefers-color-scheme:dark){:root{--paper:#17181a;--ink:#eceef1;--muted:#a3a8b1;--line:#34363b;--card:#202124}}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 56px;display:grid;gap:24px}
h1{font-size:28px;margin:0}h2{font-size:20px;margin:0 0 8px}.muted{color:var(--muted)}
video{width:100%;border-radius:8px;background:#000}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
ol.chapters{margin:0;padding-left:20px;display:grid;gap:6px}
table{width:100%;border-collapse:collapse;font-size:15px}td,th{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}a{color:var(--accent)}
.wrap{overflow-x:auto}button.time{font:inherit;color:var(--accent);background:none;border:0;padding:0;cursor:pointer}
'''
FAMILY = re.compile(r'[A-Za-z0-9 -]{1,60}')  # a font family's name, as a CSS string may hold it
STYLESHEET = re.compile(r'https://[^\s"\'<>]+')  # a font service's stylesheet (Adobe Fonts, Google Fonts)


def head(brand=None):
    """(the <link> tags, the CSS) of a page in the project's brand (the add-on's ``brand``): the stylesheets of its
    fonts (``font.kit``, ``body_font.css``: https only), its headings' and its text's families (``font.family``,
    ``body_font.family``) and its ``colors.accent`` (#rrggbb); the page's own look where the brand sets none."""
    brand = brand if isinstance(brand, dict) else {}
    part = lambda key: brand.get(key) if isinstance(brand.get(key), dict) else {}
    font, body, colors = part('font'), part('body_font'), part('colors')
    links = ''.join(f'<link rel="stylesheet" href="{html.escape(url)}">' for url in (font.get('kit'), body.get('css'))
                    if isinstance(url, str) and STYLESHEET.fullmatch(url))
    named = lambda value: value if isinstance(value, str) and FAMILY.fullmatch(value) else None
    heading, text = named(font.get('family')), named(body.get('family'))
    accent = colors.get('accent') if isinstance(colors.get('accent'), str) \
        and re.fullmatch(r'#[0-9a-fA-F]{6}', colors['accent']) else None
    css = STYLE + (f':root{{--accent:{accent}}}' if accent else '') \
        + (f'body{{font-family:"{text}",system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}' if text else '') \
        + (f'h1,h2{{font-family:"{heading}",system-ui,sans-serif}}' if heading else '')
    return links, css


def free_port(start=59600, taken=()):
    """The first local port from ``start`` this process can bind: a port that merely does not answer can still be held
    (a server of another run starting at the same moment, a socket bound without listening)."""
    for port in range(start, start + 200):
        if port in taken:
            continue
        with socket.socket() as probe:
            try:
                probe.bind(('127.0.0.1', port))
            except OSError:
                continue
            return port
    raise SystemExit('no free port for the preview')


def answers(url, process, seconds=5.0):
    """True once the server answers ``url``; False when it exits first (its port was taken) or stays silent."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return True
        except OSError:
            time.sleep(0.1)
    return False


def build(run, sources, story, film, brand=None):
    run = Path(run)
    public = run / 'public'
    shutil.rmtree(public, ignore_errors=True)
    public.mkdir(parents=True)
    film_dir = run / 'film'
    said = language.texts(sources)
    words, code = said['page'], said['code']
    for name in ('demo.mp4', 'poster.jpg', f'captions-{code}.vtt', f'captions-{code}.srt'):
        if (film_dir / name).exists():
            os.link(film_dir / name, public / name) if not (public / name).exists() else None
    timeline = core.load(film_dir / 'timeline.json', {})
    starts = [s['start'] for s in timeline.get('segments') or [] if s.get('kind') == 'card']
    shown, reasons = {}, {}
    for index, chapter in enumerate(story['chapters']):
        for number in chapter['prs']:
            shown[number] = chapter['title']
    for group in story.get('not_shown') or []:
        for number in group.get('prs') or []:
            reasons.setdefault(number, group.get('reason', ''))
    esc = html.escape
    chapters = ''.join(
        f'<li><button class="time" data-t="{starts[i] if i < len(starts) else 0}">{int((starts[i] if i < len(starts) else 0) // 60)}:'
        f'{int((starts[i] if i < len(starts) else 0) % 60):02d}</button> {esc(c["title"])}</li>' for i, c in enumerate(story['chapters']))
    rows = ''.join(
        f'<tr><td><a href="{esc(pr["url"])}">#{pr["number"]}</a></td><td>{esc(pr["title"])}</td>'
        f'<td>{esc(words["shown"] + shown[pr["number"]]) if pr["number"] in shown else esc(reasons.get(pr["number"], words["not_shown"]))}</td></tr>'
        for pr in sources['prs'])
    title = f'{sources["repo"].split("/")[-1]} {sources["tag"]}'
    links, css = head(brand)  # the project's fonts and accent (brand.font, brand.body_font, brand.colors)
    summary = words['summary'].format(base=esc(sources['base']), prs=len(sources['prs']), seconds=film['seconds'])
    page = f'''<!doctype html><html lang="{code}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}: {words["demo"]}</title>{links}<style>{css}</style></head><body><main>
<header><h1>{esc(title)}</h1><p class="muted">{summary}</p></header>
<video id="film" controls preload="metadata" poster="poster.jpg"><source src="demo.mp4" type="video/mp4">
<track kind="subtitles" srclang="{code}" label="{words["track"]}" src="captions-{code}.vtt"></video>
<section class="card"><h2>{words["chapters"]}</h2><ol class="chapters">{chapters}</ol></section>
<section class="card"><h2>{words["all"]}</h2><div class="wrap"><table><thead><tr><th>PR</th><th>{words["title"]}</th><th>{words["in_film"]}</th></tr></thead>
<tbody>{rows}</tbody></table></div></section>
</main><script>for(const b of document.querySelectorAll("button.time"))b.onclick=()=>{{const v=document.getElementById("film");v.currentTime=+b.dataset.t;v.play()}}</script>
</body></html>'''
    (public / 'index.html').write_text(page, encoding='utf-8')
    return public


def serve(run, public):
    """Caddy (range requests for seeking) on a free local port; python's server when Caddy is missing."""
    run = Path(run)
    state = core.load(run / 'server.json')
    if state and core.still_running(state):  # never a process that got its pid later
        try:
            os.kill(state['pid'], 15)
        except OSError:
            pass
    try:
        caddy = core.ensure_caddy()
    except RuntimeError:
        caddy = None
    tried = []
    for _ in range(3):  # a run finishing at the same moment can take the port first: the next free one then
        port = free_port(taken=tried)
        tried.append(port)
        cmd = [caddy, 'file-server', '--listen', f'127.0.0.1:{port}', '--root', str(public)] if caddy else \
            [sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(public)]
        process = subprocess.Popen(cmd, stdout=open(run / 'server.log', 'a'), stderr=subprocess.STDOUT, start_new_session=True)
        url = f'http://127.0.0.1:{port}/'
        if answers(url, process):
            core.save(run / 'server.json', {'pid': process.pid, 'since': core.started_at(process.pid), 'url': url})
            return url
        process.kill()
    raise SystemExit(f'the preview server did not start on ports {tried}: see {run / "server.log"}')
