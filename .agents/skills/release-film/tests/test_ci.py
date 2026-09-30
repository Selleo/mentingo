"""The CI helpers (ci/): the scripts parse, the job summary reads a run, the run's files lose the CI's secrets before
they leave the runner, and a film's release assets are staged from a checked film and published without replacing
anything."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
CI = Path(__file__).resolve().parents[1] / 'ci'
sys.path.insert(0, str(CI))

import redact  # noqa: E402
import release_assets  # noqa: E402
import summary  # noqa: E402

TOKEN = 'fake-seat-token-for-the-tests'  # never a real token's format: secret scanning would flag it


class Scripts(unittest.TestCase):
    def test_every_script_parses(self):
        for script in sorted(CI.glob('*.sh')):
            with self.subTest(script=script.name):
                subprocess.run(['bash', '-n', str(script)], check=True)


class Summary(unittest.TestCase):
    def test_the_summary_tells_the_film_the_seat_and_the_time_and_survives_a_stopped_run(self):
        run = Path('/runs/acme__shop/v2.4.0/ci-1-1')
        report = {'seat': {'five_hour': {'from': 0.01, 'to': 0.03}, 'seven_day': {'from': 0.22, 'to': 0.23}},
                  'cost': {'usd_known': 18.48, 'usd_scenes': 15.16, 'usd_calls': 3.31},
                  'stages': {'total': 1659.9, 'scenes': 751.8, 'review': 329.5, 'render': 50.1}}
        measured = {'film': {'seconds': 167.3}, 'chapters': [{}] * 7,
                    'scenes': {'in_film': 7, 'chosen': 8, 'first_try': 4, 'tries': 14}}
        text = '\n'.join(summary.lines(run, report, measured))
        self.assertIn('## Release film v2.4.0', text)
        self.assertIn('| Film | 167.3 s, 7 chapters |', text)
        self.assertIn('7 of 8 in the film', text)
        self.assertIn('5-hour window 1% → 3%, week 22% → 23%', text)
        self.assertIn('$18.48', text)
        self.assertIn('27.7 min: scenes 12.5 min, review 5.5 min, render 0.8 min', text)
        stopped = '\n'.join(summary.lines(run, {'stages': {'total': 60.0}}, {}))
        self.assertIn('| Film | none: see the run log |', stopped)
        with mock.patch.object(summary, 'ERRORS', ['film.py report: TypeError: a | b']):  # a failure is shown, not hidden
            self.assertIn('| Error | film.py report: TypeError: a \\| b |', '\n'.join(summary.lines(run, {}, {})))



def make_run(folder, tag='v1.2.0', audio=True):
    """A finished run whose page holds a 2 s film (with or without sound), its captions, poster and page."""
    run = Path(folder) / 'run'
    public = run / 'public'
    public.mkdir(parents=True)
    (run / 'meta.json').write_text(json.dumps({'tag': tag}))
    (run / 'story.json').write_text('{}')
    (run / 'film.json').write_text('{}')
    inputs = ['-f', 'lavfi', '-i', 'color=c=black:s=320x180:d=2'] + (['-f', 'lavfi', '-i', 'sine=d=2'] if audio else [])
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                    *(['-c:a', 'aac'] if audio else []), str(public / 'demo.mp4')], check=True)
    for name, text in (('captions-en.vtt', 'WEBVTT\n'), ('captions-en.srt', '1\n'), ('poster.jpg', 'jpg'),
                       ('index.html', '<video src="demo.mp4">')):
        (public / name).write_text(text)
    return run


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'the film is checked with FFmpeg')
class Stage(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch.object(release_assets, 'FILM_SECONDS', (1, 10))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_a_checked_film_is_staged_under_release_names_with_its_page_and_digests(self):
        import zipfile
        with tempfile.TemporaryDirectory() as folder:
            run, out = make_run(folder), Path(folder) / 'out'
            manifest = release_assets.stage(run, 'v1.2.0', 'abc123', out)
            names = release_assets.asset_names('v1.2.0', 'en')
            self.assertEqual(set(manifest['assets']), set(names.values()))
            self.assertEqual((manifest['tag'], manifest['commit'], manifest['language']), ('v1.2.0', 'abc123', 'en'))
            for name, digest in manifest['assets'].items():
                self.assertEqual(release_assets.sha256(out / name), digest)
            with zipfile.ZipFile(out / names['page']) as page:
                self.assertEqual(sorted(page.namelist()), sorted(f'release-film-v1.2.0/{n}' for n in (
                    'index.html', 'demo.mp4', 'poster.jpg', 'captions-en.vtt', 'captions-en.srt')))
            self.assertEqual(json.loads((out / 'release.json').read_text()), manifest)

    def test_a_film_cut_short_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            run = make_run(folder)
            film = run / 'public' / 'demo.mp4'
            whole = film.with_name('whole.mp4')  # its index first, as the render writes it: the length still reads 2 s
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(film), '-c', 'copy', '-movflags', '+faststart',
                            str(whole)], check=True)
            data = whole.read_bytes()
            film.write_bytes(data[:len(data) * 2 // 3])  # the recording's end is lost
            whole.unlink()
            with self.assertRaisesRegex(SystemExit, 'does not decode to its end'):
                release_assets.stage(run, 'v1.2.0', 'abc', Path(folder) / 'out')
            film.write_bytes(b'not a film')
            with self.assertRaisesRegex(SystemExit, 'cannot be read'):
                release_assets.stage(run, 'v1.2.0', 'abc', Path(folder) / 'out')

    def test_another_releases_run_or_a_film_without_sound_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(SystemExit, 'recorded v1.2.0, not v9.9.9'):
                release_assets.stage(make_run(folder), 'v9.9.9', 'abc', Path(folder) / 'out')
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(SystemExit, 'audio and video'):
                release_assets.stage(make_run(folder, audio=False), 'v1.2.0', 'abc', Path(folder) / 'out')


class FilmLength(unittest.TestCase):
    def test_a_film_of_one_scene_is_long_enough(self):
        self.assertLessEqual(release_assets.FILM_SECONDS[0], 20)  # one scene's film lasted 26 s


class Redact(unittest.TestCase):
    def test_the_ci_secrets_are_hidden_in_the_runs_files_and_nowhere_else(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder) / 'run'
            (run / 'gaps' / 'pr1').mkdir(parents=True)
            (run / 'checkout' / 'e2e').mkdir(parents=True)
            (run / 'gaps' / 'pr1' / 'worker.log').write_text(f'1.0 {{"error": "CLAUDE_CODE_OAUTH_TOKEN={TOKEN}"}}\n')
            (run / 'gaps' / 'pr1' / 'try.json').write_text(json.dumps({'error': f'gh {"ghs_" + "x" * 36}'}))
            (run / 'story.txt').write_text('# chapter F1 | 1 | Nothing secret\n')
            (run / 'checkout' / 'e2e' / 'fixture.ts').write_text(TOKEN)  # the release's own files are never uploaded
            (run / 'frame.jpg').write_bytes(b'\xff\xd8' + TOKEN.encode())
            environ = {'CLAUDE_CODE_OAUTH_TOKEN': TOKEN, 'GH_TOKEN': 'ghs_' + 'x' * 36, 'GITHUB_TOKEN': 'short'}
            changed = redact.redact([run], redact.values(environ))
            self.assertEqual(sorted(Path(p).name for p in changed), ['try.json', 'worker.log'])
            self.assertEqual((run / 'gaps' / 'pr1' / 'worker.log').read_text(), '1.0 {"error": "CLAUDE_CODE_OAUTH_TOKEN=***"}\n')
            self.assertNotIn('ghs_', (run / 'gaps' / 'pr1' / 'try.json').read_text())
            self.assertEqual((run / 'checkout' / 'e2e' / 'fixture.ts').read_text(), TOKEN)
            self.assertEqual(redact.redact([run], []), [])  # no secret set: nothing read or changed
        self.assertEqual(redact.values({'GH_TOKEN': 'short'}), [])


class Publish(unittest.TestCase):
    TAG = 'v1.2.0'

    def staged(self, folder):
        folder = Path(folder)
        assets = {}
        for name in release_assets.asset_names(self.TAG, 'en').values():
            (folder / name).write_text(name)
            assets[name] = release_assets.sha256(folder / name)
        (folder / 'release.json').write_text(json.dumps({'tag': self.TAG, 'commit': 'abc', 'language': 'en',
                                                          'assets': assets}))
        return assets

    def fake_gh(self, release, drafts=()):
        """A stand-in for gh: the release API of one release (and the drafts listed), recording every call."""
        calls = []

        def gh(*args, input_text=None):
            calls.append(args)
            if args[:2] == ('release', 'upload'):
                for path in args[5:]:  # release upload <tag> --repo <repo> <files>
                    name = Path(path).name
                    release['assets'].append({'name': name, 'digest': f'sha256:{release_assets.sha256(path)}',
                                              'browser_download_url': f'https://example.test/{name}'})
                return ''
            if args[:3] == ('api', '-X', 'PATCH'):
                release['body'] = input_text
                return '{}'
            if args[:3] == ('api', '-X', 'DELETE'):  # api -X DELETE repos/<repo>/releases/assets/<id>
                gone = int(args[3].rsplit('/', 1)[1])
                release['assets'] = [a for a in release['assets'] if a.get('id') != gone]
                return ''
            if args[:3] == ('api', '-X', 'POST'):
                name = next(a for a in args if a.startswith('name=')).split('=', 1)[1]
                # as GitHub does: a draft is listed under a tag of its own, not the one it was made with
                release.update(id=7, draft=True, tag_name='untagged-7caf002d52a29530f066', name=name, body='', assets=[])
                return json.dumps(release)
            if args[1].endswith('/releases?per_page=100'):
                return json.dumps(list(drafts))
            return json.dumps(release)
        return gh, calls

    def test_the_tags_release_gets_the_missing_assets_and_one_section_of_links(self):
        with tempfile.TemporaryDirectory() as folder:
            assets = self.staged(folder)
            film = release_assets.asset_names(self.TAG, 'en')['film']
            release = {'id': 5, 'tag_name': self.TAG, 'draft': False, 'html_url': 'https://example.test/r',
                       'body': '# Release Summary\n\nNotes.', 'assets': [
                           {'name': film, 'digest': f'sha256:{assets[film]}', 'browser_download_url': 'https://x/f'}]}
            gh, calls = self.fake_gh(release)
            with mock.patch.object(release_assets, 'gh', gh):
                result = release_assets.publish(folder, 'release', repo='o/r')
                self.assertNotIn(film, result['uploaded'])  # an interrupted publish resumes
                self.assertEqual(len(result['uploaded']), 4)
                self.assertTrue(release['body'].startswith('# Release Summary\n\nNotes.'))
                self.assertIn('film (MP4)', release['body'])
                self.assertIn('page with the film and every pull request (ZIP)', release['body'])
                again = release_assets.publish(folder, 'release', repo='o/r')  # a second publish changes nothing
            self.assertEqual((again['uploaded'], again['notes']), ([], 'unchanged'))
            self.assertEqual(release['body'].count(release_assets.MARK_START), 1)
            self.assertFalse([c for c in calls if 'delete' in c or '-X' in c and 'DELETE' in c])

    def test_an_asset_of_the_same_name_and_other_content_stops_the_publish(self):
        with tempfile.TemporaryDirectory() as folder:
            self.staged(folder)
            film = release_assets.asset_names(self.TAG, 'en')['film']
            release = {'id': 5, 'tag_name': self.TAG, 'draft': False, 'body': '', 'assets': [
                {'name': film, 'digest': 'sha256:other', 'browser_download_url': 'https://x/f'}]}
            gh, calls = self.fake_gh(release)
            with mock.patch.object(release_assets, 'gh', gh), \
                    self.assertRaisesRegex(SystemExit, 'v1.2.0 already has another film .*nothing was changed: publish with replace'):
                release_assets.publish(folder, 'release', repo='o/r')
            self.assertFalse([c for c in calls if c[:2] == ('release', 'upload') or 'DELETE' in c])

    def test_replace_removes_the_tags_other_film_and_nothing_else(self):
        with tempfile.TemporaryDirectory() as folder:
            staged = self.staged(folder)
            names = release_assets.asset_names(self.TAG, 'en')
            earlier = [names['film'], names['poster'], names['page'], f'release-film-{self.TAG}.pl.vtt',
                       f'release-film-{self.TAG}.pl.srt']  # an earlier film, narrated in Polish
            others = ['app.zip', 'release-film-v1.2.1.mp4', 'release-film-v1.2.0-notes.txt']
            release = {'id': 5, 'tag_name': self.TAG, 'draft': False, 'html_url': 'https://example.test/r',
                       'body': f'Notes.\n\n{release_assets.MARK_START}\nold links\n{release_assets.MARK_END}\n',
                       'assets': [{'id': i, 'name': name, 'digest': 'sha256:old', 'browser_download_url': f'https://x/{name}'}
                                  for i, name in enumerate(earlier + others)]}
            gh, calls = self.fake_gh(release)
            with mock.patch.object(release_assets, 'gh', gh):
                result = release_assets.publish(folder, 'release', repo='o/r', replace=True)
            self.assertEqual(sorted(result['removed']), sorted(earlier))
            self.assertEqual(sorted(result['uploaded']), sorted(staged))
            left = sorted(a['name'] for a in release['assets'])
            self.assertEqual(left, sorted(others + list(staged)))  # no other asset was touched
            self.assertEqual(release['body'].count(release_assets.MARK_START), 1)
            self.assertNotIn('old links', release['body'])
            self.assertTrue(release['body'].startswith('Notes.'))

    def test_a_film_the_site_shows_for_the_tag_stops_the_release_publish_unless_replaced(self):
        with tempfile.TemporaryDirectory() as folder:
            self.staged(folder)
            release = {'id': 5, 'tag_name': self.TAG, 'draft': False, 'body': '', 'assets': []}
            shown = {self.TAG: {'tag': self.TAG, 'source': 'recording', 'files': ['index.html']}}
            gh, calls = self.fake_gh(release)
            with mock.patch.object(release_assets, 'gh', gh), mock.patch.object(release_assets, 'live_films', return_value=shown):
                with self.assertRaisesRegex(SystemExit, r'\(the Pages site\); nothing was changed'):
                    release_assets.publish(folder, 'release', repo='o/r', base_url='https://o.github.io/r/')
                self.assertFalse([c for c in calls if c[:2] == ('release', 'upload')])
                result = release_assets.publish(folder, 'release', repo='o/r', base_url='https://o.github.io/r/', replace=True)
                draft = release_assets.publish(folder, 'draft', repo='o/r', base_url='https://o.github.io/r/')
            self.assertTrue(result['site_film_replaced'])  # the next rebuild shows the release's film instead
            self.assertEqual(len(result['uploaded']), 5)
            self.assertFalse(draft['site_film_replaced'])  # a test draft never reaches the site

    def test_the_release_film_the_site_shows_does_not_stop_its_own_publication(self):
        # a publication run again (the notes were written anew and lost their section): same assets, same film
        with tempfile.TemporaryDirectory() as folder:
            assets = self.staged(folder)
            release = {'id': 5, 'tag_name': self.TAG, 'draft': False, 'body': 'Notes written anew.', 'assets': [
                {'id': i, 'name': name, 'digest': f'sha256:{digest}', 'browser_download_url': f'https://x/{name}'}
                for i, (name, digest) in enumerate(assets.items())]}
            shown = {self.TAG: {'tag': self.TAG, 'source': 'release', 'files': ['index.html']}}
            gh, calls = self.fake_gh(release)
            with mock.patch.object(release_assets, 'gh', gh), mock.patch.object(release_assets, 'live_films', return_value=shown):
                result = release_assets.publish(folder, 'release', repo='o/r', base_url='https://o.github.io/r/')
            self.assertEqual((result['uploaded'], result['removed'], result['notes']), ([], [], 'updated'))
            self.assertIn(release_assets.MARK_START, release['body'])
            self.assertFalse([c for c in calls if 'DELETE' in c])

    def test_earlier_stops_a_recording_whose_tag_already_has_a_film(self):
        names = release_assets.asset_names(self.TAG, 'en')
        with_film = {'assets': [{'name': names['film']}, {'name': 'app.zip'}]}
        cases = [({'assets': [{'name': 'app.zip'}]}, {}, None),
                 (with_film, {}, "its release's assets"),
                 ({}, {self.TAG: {}}, 'the Pages site'),
                 (with_film, {self.TAG: {}}, "its release's assets and the Pages site")]
        for release, site, where in cases:
            with mock.patch.object(release_assets, 'release_of', return_value=release), \
                    mock.patch.object(release_assets, 'live_films', return_value=site):
                if where is None:
                    self.assertEqual(release_assets.earlier(self.TAG, repo='o/r'), {'tag': self.TAG, 'release': [], 'site': False})
                else:
                    with self.assertRaisesRegex(SystemExit, rf'already has a film \({where}\): record with replace'):
                        release_assets.earlier(self.TAG, repo='o/r', base_url='https://o.github.io/r/')

    def test_a_draft_target_makes_a_test_draft_release_once(self):
        with tempfile.TemporaryDirectory() as folder:
            self.staged(folder)
            release = {}
            gh, calls = self.fake_gh(release)
            with mock.patch.object(release_assets, 'gh', gh):
                result = release_assets.publish(folder, 'draft', repo='o/r')
            [created] = [c for c in calls if c[:3] == ('api', '-X', 'POST')]
            self.assertIn('tag_name=release-film-test-v1.2.0', created)
            self.assertIn('name=Release film test: v1.2.0', created)
            self.assertIn('draft=true', created)
            self.assertEqual(len(result['uploaded']), 5)
            gh, calls = self.fake_gh(release, drafts=[release])  # the next publish finds the same draft
            with mock.patch.object(release_assets, 'gh', gh):
                release_assets.publish(folder, 'draft', repo='o/r')
            self.assertFalse([c for c in calls if c[:3] == ('api', '-X', 'POST')])

    def test_a_file_changed_after_staging_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            self.staged(folder)
            (Path(folder) / release_assets.asset_names(self.TAG, 'en')['poster']).write_text('changed')
            with mock.patch.object(release_assets, 'gh') as gh, self.assertRaisesRegex(SystemExit, 'not the file staged'):
                release_assets.publish(folder, 'release', repo='o/r')
            gh.assert_not_called()



class Site(unittest.TestCase):
    def fake_gh(self, releases, members):
        """gh answering the release list (as --paginate --jq prints it) and downloading each tag's page ZIP."""
        import zipfile

        def gh(*args, input_text=None):
            if args[0] == 'api':
                return ''.join(json.dumps(r) + '\n' for r in releases)
            tag, folder = args[2], Path(args[args.index('--dir') + 1])
            folder.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(folder / f'release-film-{tag}-page.zip', 'w') as page:
                for name in members(tag):
                    page.writestr(name, name)
            return ''
        return gh

    def test_the_site_holds_each_published_releases_page_and_an_index_newest_first(self):
        zipped = lambda tag, day: {'name': tag, 'tag_name': tag, 'draft': False, 'published_at': f'{day}T09:00:00Z',
                                   'assets': [f'release-film-{tag}-page.zip', f'release-film-{tag}.mp4']}
        releases = [zipped('v3.8.0', '2026-08-06'), zipped('v3.9.0', '2026-09-04'),
                    dict(zipped('v4.0.0', '2026-09-28'), draft=True),
                    {'name': 'v3.7.0', 'tag_name': 'v3.7.0', 'draft': False, 'assets': []}]
        members = lambda tag: [f'release-film-{tag}/{n}' for n in ('index.html', 'demo.mp4', 'poster.jpg')]
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh(releases, members)):
            out = Path(folder) / 'site'
            result = release_assets.site(out, repo='Acme/shop')
            self.assertEqual(result['films'], ['v3.9.0', 'v3.8.0'])  # no draft, no release without a film
            self.assertEqual((out / 'v3.9.0' / 'index.html').read_text(), 'release-film-v3.9.0/index.html')
            index = (out / 'index.html').read_text()
            self.assertLess(index.index('v3.9.0/'), index.index('v3.8.0/'))
            self.assertIn('shop: release films', index)
            self.assertTrue((out / '.nojekyll').exists())
            self.assertFalse((out / 'v4.0.0').exists())

    def test_the_index_page_takes_the_projects_brand(self):
        brand = {'font': {'family': 'all-round-gothic', 'kit': 'https://use.typekit.net/abc1234.css'},
                 'colors': {'accent': '#3f58b6'}}
        index = release_assets.index_page('Acme/shop', [], brand)
        self.assertIn('<link rel="stylesheet" href="https://use.typekit.net/abc1234.css">', index)
        self.assertIn(':root{--accent:#3f58b6}', index)
        self.assertNotIn('<link', release_assets.index_page('Acme/shop', []))  # without one, the page's own look

    def staged(self, folder, tag, digest=None):
        """A recording's staged files (its release-film artifact): the page ZIP and release.json naming its digest."""
        import zipfile
        folder = Path(folder)
        folder.mkdir(parents=True, exist_ok=True)
        page = folder / f'release-film-{tag}-page.zip'
        with zipfile.ZipFile(page, 'w') as zipped:
            for name in ('index.html', 'demo.mp4', 'poster.jpg'):
                zipped.writestr(f'release-film-{tag}/{name}', f'recorded {name}')
        (folder / 'release.json').write_text(json.dumps({'tag': tag, 'commit': 'abc', 'language': 'en', 'assets': {
            page.name: digest or release_assets.sha256(page)}}))
        return folder

    def serving(self, folder):
        """The live site: ``folder`` served on 127.0.0.1 until the test ends; its address."""
        import functools
        import http.server
        import threading

        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *args):
                pass
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(folder)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return f'http://127.0.0.1:{server.server_address[1]}/'

    def live(self, folder, films):
        """A live site holding ``films`` {tag: {file: text}} and their films.json."""
        folder = Path(folder)
        for tag, files in films.items():
            for name, text in files.items():
                (folder / tag).mkdir(parents=True, exist_ok=True)
                (folder / tag / name).write_text(text)
        (folder / 'films.json').write_text(json.dumps({'films': [
            {'tag': tag, 'name': tag, 'date': '2026-07-01', 'source': 'recording', 'files': sorted(files)}
            for tag, files in films.items()]}))
        return self.serving(folder)

    def test_a_recordings_film_goes_on_the_site_alone_and_no_release_changes(self):
        releases = [{'name': 'v1', 'tag_name': 'v1', 'draft': False, 'published_at': '2026-08-01T09:00:00Z',
                     'assets': ['release-film-v1-page.zip']},
                    {'name': 'v2', 'tag_name': 'v2', 'draft': False, 'published_at': '2026-09-01T09:00:00Z', 'assets': []}]
        members = lambda tag: [f'release-film-{tag}/{n}' for n in ('index.html', 'demo.mp4', 'poster.jpg')]
        asked = []
        gh = self.fake_gh(releases, members)
        with tempfile.TemporaryDirectory() as folder, \
                mock.patch.object(release_assets, 'gh', lambda *a, **k: asked.append(a[:2]) or gh(*a, **k)):
            out = Path(folder) / 'site'
            result = release_assets.site(out, repo='Acme/shop', film=self.staged(Path(folder) / 'film', 'v2'))
            self.assertEqual(result['films'], ['v2', 'v1'])  # the release's date orders the recording's film
            self.assertEqual((out / 'v2' / 'index.html').read_text(), 'recorded index.html')
            listed = {f['tag']: f for f in json.loads((out / 'films.json').read_text())['films']}
            self.assertEqual((listed['v2']['source'], listed['v2']['date']), ('recording', '2026-09-01'))
            self.assertEqual(listed['v1']['files'], ['demo.mp4', 'index.html', 'poster.jpg'])
        self.assertEqual({a for a in asked if a[0] != 'api'}, {('release', 'download')})  # nothing uploaded or edited

    def test_the_site_keeps_the_films_it_already_shows(self):
        releases = [{'name': 'v1', 'tag_name': 'v1', 'draft': False, 'published_at': '2026-08-01T09:00:00Z',
                     'assets': ['release-film-v1-page.zip']}]
        members = lambda tag: [f'release-film-{tag}/index.html']
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh(releases, members)):
            base = self.live(Path(folder) / 'live', {'v0': {'index.html': 'page v0', 'poster.jpg': 'poster v0'}})
            out = Path(folder) / 'site'
            result = release_assets.site(out, repo='Acme/shop', base_url=base)
            self.assertEqual(result['films'], ['v1', 'v0'])
            self.assertEqual((out / 'v0' / 'poster.jpg').read_text(), 'poster v0')
            again = release_assets.site(Path(folder) / 'again', repo='Acme/shop', base_url=self.serving(out))
            self.assertEqual(again['films'], ['v1', 'v0'])  # and the next rebuild keeps it again

    def test_a_releases_film_replaces_a_recordings_of_its_tag(self):
        releases = [{'name': 'v1', 'tag_name': 'v1', 'draft': False, 'published_at': '2026-08-01T09:00:00Z',
                     'assets': ['release-film-v1-page.zip']}]
        members = lambda tag: [f'release-film-{tag}/index.html']
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh(releases, members)):
            base = self.live(Path(folder) / 'live', {'v1': {'index.html': 'recorded page'}})
            out = Path(folder) / 'site'
            release_assets.site(out, repo='Acme/shop', base_url=base)
            self.assertEqual((out / 'v1' / 'index.html').read_text(), 'release-film-v1/index.html')
            self.assertEqual(json.loads((out / 'films.json').read_text())['films'][0]['source'], 'release')

    def test_a_recording_of_a_tag_whose_release_has_a_film_is_refused(self):
        releases = [{'name': 'v1', 'tag_name': 'v1', 'draft': False, 'published_at': '2026-08-01T09:00:00Z',
                     'assets': ['release-film-v1-page.zip']}]
        members = lambda tag: [f'release-film-{tag}/index.html']
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh(releases, members)):
            for replace in (False, True):  # the release decides: its film changes only by publishing to it
                with self.assertRaisesRegex(SystemExit, "v1's release has a film"):
                    release_assets.site(Path(folder) / 'site', repo='o/r', film=self.staged(Path(folder) / 'film', 'v1'),
                                        replace=replace)

    def test_a_recording_of_a_tag_the_site_shows_needs_replace(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh([], list)):
            base = self.live(Path(folder) / 'live', {'v2': {'index.html': 'the first recording'}})
            film = self.staged(Path(folder) / 'film', 'v2')
            with self.assertRaisesRegex(SystemExit, 'already shows a film of v2; nothing was deployed'):
                release_assets.site(Path(folder) / 'site', repo='o/r', film=film, base_url=base)
            out = Path(folder) / 'replaced'
            result = release_assets.site(out, repo='o/r', film=film, base_url=base, replace=True)
            self.assertEqual(result['films'], ['v2'])
            self.assertEqual((out / 'v2' / 'index.html').read_text(), 'recorded index.html')

    def test_a_recording_whose_page_is_not_the_one_staged_is_refused(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh([], list)):
            film = self.staged(Path(folder) / 'film', 'v2', digest='0' * 64)
            with self.assertRaisesRegex(SystemExit, 'is not the file staged'):
                release_assets.site(Path(folder) / 'site', repo='o/r', film=film)

    def answering(self, status, body=b''):
        """A live site whose films.json gets ``status`` (and ``body``); its address."""
        import http.server
        import threading

        class Answer(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(status)
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Answer)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return f'http://127.0.0.1:{server.server_address[1]}/'

    def test_a_films_list_the_live_site_cannot_give_stops_the_rebuild(self):
        import socket
        with socket.socket() as probe:  # a port nothing listens on: the site does not answer
            probe.bind(('127.0.0.1', 0))
            silent = f'http://127.0.0.1:{probe.getsockname()[1]}/'
        failures = [(self.answering(500), 'answered 500'), (silent, 'did not answer'),
                    (self.answering(200, b'<html>not a list</html>'), 'does not read as a list of films'),
                    (self.answering(200, b'{"films": [{"tag": "../v1", "files": []}]}'), 'lists a film it does not describe')]
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh([], list)):
            for base, said in failures:
                with self.subTest(said), self.assertRaisesRegex(SystemExit, f'{said}.*no film only the site keeps is lost'):
                    release_assets.site(Path(folder) / 'site', repo='o/r', base_url=base)
            with mock.patch.object(release_assets, 'release_of', return_value={}), \
                    self.assertRaisesRegex(SystemExit, 'answered 500'):  # a recording that checks the site stops too
                release_assets.earlier('v1', repo='o/r', base_url=failures[0][0])
            empty = Path(folder) / 'empty'
            empty.mkdir()
            result = release_assets.site(Path(folder) / 'first', repo='o/r', base_url=self.serving(empty))
            self.assertEqual(result['films'], [])  # no films.json yet (a 404): the site's first rebuild

    def test_a_film_the_live_site_lists_but_does_not_serve_stops_the_rebuild(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh([], list)):
            base = self.live(Path(folder) / 'live', {'v0': {'index.html': 'page v0'}})
            (Path(folder) / 'live' / 'v0' / 'index.html').unlink()
            with self.assertRaisesRegex(SystemExit, 'does not serve it'):
                release_assets.site(Path(folder) / 'site', repo='o/r', base_url=base)

    def test_a_page_zip_reaching_outside_its_folder_is_refused(self):
        releases = [{'name': 'v1', 'tag_name': 'v1', 'draft': False, 'assets': ['release-film-v1-page.zip']}]
        members = lambda tag: [f'release-film-{tag}/../../escape.html']
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh(releases, members)):
            with self.assertRaisesRegex(SystemExit, 'holds'):
                release_assets.site(Path(folder) / 'site', repo='o/r')
            self.assertFalse((Path(folder) / 'escape.html').exists())


if __name__ == '__main__':
    unittest.main()
