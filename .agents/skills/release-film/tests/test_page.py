"""The preview server: a port this process can bind, and a server that really answers before its address is kept."""
from pathlib import Path
import socket
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import page  # noqa: E402


class Serve(unittest.TestCase):
    def test_a_port_held_without_listening_is_not_free(self):
        with socket.socket() as held:
            held.bind(('127.0.0.1', 0))  # bound, not listening: a connection to it is refused, a bind fails
            port = held.getsockname()[1]
            self.assertNotEqual(page.free_port(start=port), port)
            self.assertNotEqual(page.free_port(start=port, taken=[port + 1]), port + 1)

    def test_a_server_that_dies_is_never_kept(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'public').mkdir()
            dead = mock.Mock(pid=4242, poll=mock.Mock(return_value=1))  # exits at once (its port was taken)
            with mock.patch.object(page.core, 'ensure_caddy', side_effect=RuntimeError), \
                    mock.patch.object(page.subprocess, 'Popen', return_value=dead) as started:
                with self.assertRaises(SystemExit):
                    page.serve(run, run / 'public')
            self.assertEqual(started.call_count, 3)  # three ports tried, each a different one
            self.assertEqual(len({call.args[0][3] for call in started.call_args_list}), 3)
            self.assertFalse((run / 'server.json').exists())

    def test_a_live_server_answers_before_its_address_is_kept(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'public').mkdir()
            (run / 'public' / 'index.html').write_text('ok')
            with mock.patch.object(page.core, 'ensure_caddy', side_effect=RuntimeError):
                url = page.serve(run, run / 'public')
            state = page.core.load(run / 'server.json')
            try:
                self.assertEqual(state['url'], url)
                import urllib.request
                with urllib.request.urlopen(url, timeout=2) as response:
                    self.assertEqual(response.status, 200)
            finally:
                import os
                os.killpg(state['pid'], 15)



class Page(unittest.TestCase):
    def test_the_narration_subtitles_are_offered_not_shown_by_default(self):  # the picture carries its own labels
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'film').mkdir()
            (run / 'film' / 'captions-pl.vtt').write_text('WEBVTT\n')
            sources = {'repo': 'Acme/shop', 'tag': 'v2', 'base': 'v1', 'prs': []}
            page.build(run, sources, {'chapters': []}, {'seconds': 200})
            html = (run / 'public' / 'index.html').read_text()
            self.assertIn('<track kind="subtitles" srclang="pl" label="Polski" src="captions-pl.vtt">', html)
            self.assertNotIn('default>', html)

    def test_an_english_film_has_an_english_page_and_subtitles(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'film').mkdir()
            (run / 'film' / 'captions-en.vtt').write_text('WEBVTT\n')
            sources = {'repo': 'Acme/shop', 'tag': 'v2', 'base': 'v1', 'language': 'en',
                       'prs': [{'number': 7, 'url': 'https://github.com/Acme/shop/pull/7', 'title': 'Add notes'}]}
            page.build(run, sources, {'chapters': [], 'not_shown': []}, {'seconds': 200})
            html = (run / 'public' / 'index.html').read_text()
            self.assertIn('<html lang="en">', html)
            self.assertIn('<track kind="subtitles" srclang="en" label="English" src="captions-en.vtt">', html)
            self.assertIn('Changes since v1: 1 pull requests', html)
            self.assertIn('<td>Not in the film</td>', html)
            self.assertTrue((run / 'public' / 'captions-en.vtt').is_file())



BRAND = {'font': {'family': 'all-round-gothic', 'kit': 'https://use.typekit.net/abc1234.css'},
         'body_font': {'family': 'Open Sans', 'css': 'https://fonts.googleapis.com/css2?family=Open+Sans&display=swap'},
         'colors': {'accent': '#3f58b6', 'frame': '#222949'}}


class Brand(unittest.TestCase):
    def test_the_page_takes_the_projects_fonts_and_accent(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'film').mkdir()
            sources = {'repo': 'Acme/shop', 'tag': 'v2', 'base': 'v1', 'language': 'en', 'prs': []}
            page.build(run, sources, {'chapters': [], 'not_shown': []}, {'seconds': 200}, BRAND)
            html = (run / 'public' / 'index.html').read_text()
        self.assertIn('<link rel="stylesheet" href="https://use.typekit.net/abc1234.css">', html)
        self.assertIn('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans&amp;display=swap">', html)
        self.assertIn(':root{--accent:#3f58b6}', html)
        self.assertIn('body{font-family:"Open Sans"', html)
        self.assertIn('h1,h2{font-family:"all-round-gothic"', html)

    def test_without_a_brand_the_page_keeps_its_own_look_and_odd_values_are_left_out(self):
        self.assertEqual(page.head(None), ('', page.STYLE))
        odd = {'font': {'family': 'x"}body{display:none', 'kit': 'http://example.com/a.css'},
               'body_font': {'family': 'Sans', 'css': 'https://example.com/a.css" onload="x'},
               'colors': {'accent': 'red;background:url(x)'}}
        links, css = page.head(odd)
        self.assertEqual(links, '')  # only an https stylesheet without quotes
        self.assertEqual(css, page.STYLE + 'body{font-family:"Sans",system-ui,-apple-system,Segoe UI,Roboto,sans-serif}')


if __name__ == '__main__':
    unittest.main()
