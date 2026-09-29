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
            with mock.patch.object(release_assets, 'gh', gh), self.assertRaisesRegex(SystemExit, 'nothing was replaced'):
                release_assets.publish(folder, 'release', repo='o/r')
            self.assertFalse([c for c in calls if c[:2] == ('release', 'upload')])

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

    def test_a_page_zip_reaching_outside_its_folder_is_refused(self):
        releases = [{'name': 'v1', 'tag_name': 'v1', 'draft': False, 'assets': ['release-film-v1-page.zip']}]
        members = lambda tag: [f'release-film-{tag}/../../escape.html']
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(release_assets, 'gh', self.fake_gh(releases, members)):
            with self.assertRaisesRegex(SystemExit, 'holds'):
                release_assets.site(Path(folder) / 'site', repo='o/r')
            self.assertFalse((Path(folder) / 'escape.html').exists())


if __name__ == '__main__':
    unittest.main()
