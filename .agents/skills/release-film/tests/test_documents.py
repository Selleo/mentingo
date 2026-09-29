"""A downloaded PDF: recorded with the action that downloaded it, named in the film lines, its first page shown."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import cut  # noqa: E402
import takes  # noqa: E402


def pdf(path, text):
    """A one-page PDF saying ``text`` (built by hand: no PDF library needed)."""
    stream = f'BT /F1 24 Tf 72 720 Td ({text}) Tj ET'.encode()
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
               b'<< /Length %d >>\nstream\n' % len(stream) + stream + b'\nendstream',
               b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    out, offsets = b'%PDF-1.4\n', []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += b'%d 0 obj\n' % number + body + b'\nendobj\n'
    xref = len(out)
    out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objects) + 1) + b''.join(b'%010d 00000 n \n' % o for o in offsets)
    out += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objects) + 1, xref)
    Path(path).write_bytes(out)


class Documents(unittest.TestCase):
    def test_a_downloaded_pdf_is_named_on_the_line_of_the_action_that_downloaded_it(self):
        with tempfile.TemporaryDirectory() as folder:
            capture = Path(folder)
            (capture / 'downloads').mkdir()
            pdf(capture / 'downloads' / '0-protokol.pdf', 'PROTOKOL ODBIORU')
            log = {'downloads': [{'name': 'protokol.pdf', 'file': 'downloads/0-protokol.pdf', 'after': 1},
                                 {'name': 'x.docx', 'file': 'downloads/1-x.docx', 'after': 1}]}
            docs = takes.documents(capture, log, 2)
            self.assertEqual([(d['name'], d['step']) for d in docs], [('protokol.pdf', 1)])  # PDFs only
            if shutil.which('pdftotext'):
                self.assertIn('PROTOKOL ODBIORU', docs[0]['text'])
            self.assertEqual(takes.documents(capture, log, 1), [])  # the film ended before the download

    def test_the_first_page_covers_the_chapter_from_the_sentence_on_the_download(self):
        capture = {'documents': [{'name': 'p.pdf', 'file': '/x/p.pdf', 'step': 4}]}
        chapter = {'sentences': [{'action': 1}, {'action': 3}, {'action': None}, {'action': 5}]}
        self.assertEqual(cut.document(chapter, capture), (capture['documents'][0], 4))
        early = {'sentences': [{'action': 1}, {'action': 3}]}  # the sentence about it pinned to the click before it
        self.assertEqual(cut.document(early, capture), (capture['documents'][0], 2))
        far = {'sentences': [{'action': 0}]}  # the chapter ends long before the download
        self.assertEqual(cut.document(far, capture), (None, None))

    @unittest.skipUnless(shutil.which('pdftoppm') or sys.platform == 'darwin' and shutil.which('qlmanage'),
                         'pdftoppm (poppler) is not installed')
    def test_the_page_is_rendered_once(self):
        with tempfile.TemporaryDirectory() as folder:
            doc = {'file': str(Path(folder) / 'p.pdf'), 'name': 'p.pdf'}
            pdf(doc['file'], 'Statement')
            first = cut.document_still(doc)
            self.assertTrue(first and first.is_file())
            self.assertEqual(cut.document_still(doc), first)
            self.assertEqual(sorted(p.name for p in Path(folder).iterdir()), ['p.page1.png', 'p.pdf'])


class Beats(unittest.TestCase):
    def test_checked_results_keep_their_pins_and_click_narration_stays_explicit(self):
        steps = [{'step': 0, 'cmd': ['goto', '/'], 'navigate': True, 'a': 0.2, 'b': 1.0},
                 {'step': 1, 'cmd': ['hover', '#bar'], 'acting': True, 'a': 1.2, 'b': 2.0},
                 {'step': 2, 'cmd': ['click', '#info'], 'acting': True, 'a': 2.2, 'b': 3.0},
                 {'step': 3, 'cmd': ['look', 'dialog'], 'look': True, 'a': 3.1, 'b': 3.5},
                 {'step': 4, 'cmd': ['look', 'text'], 'look': True, 'a': 3.6, 'b': 4.0}]
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'capture.json').write_text(json.dumps({'steps': steps, 'end': 5.0, 'active': [], 'stills': []}))
            chapter = {'sentences': [{'action': 1, 'text': 'Dymek.'}, {'action': 3, 'text': 'Ikona otwiera okno.'}]}
            spec, _ = cut.chapter_setup(chapter, folder)
            self.assertEqual([s.get('beat') for s in spec['steps']], [None, 1, None, 2])
            chapter['sentences'][1]['action'] = 4  # a later check remains the proof, not the preceding click
            spec, _ = cut.chapter_setup(chapter, folder)
            self.assertEqual([s.get('beat') for s in spec['steps']], [None, 1, None, None, 2])
            chapter['sentences'] = [{'action': 2, 'text': 'Klikamy.'}, {'action': 4, 'text': 'Tekst.'}]  # its own sentence
            spec, _ = cut.chapter_setup(chapter, folder)
            self.assertEqual([s.get('beat') for s in spec['steps']], [None, None, 1, None, 2])
            chapter['sentences'] = [{'action': 1, 'text': 'Najeżdżamy.'}, {'action': 2, 'text': 'Klikamy.'},
                                    {'action': 3, 'text': 'Okno.'}]  # the click has a sentence of its own
            spec, _ = cut.chapter_setup(chapter, folder)
            self.assertEqual([s.get('beat') for s in spec['steps']], [None, 1, 2, 3])
        back = [{'step': 0, 'cmd': ['click', '#a'], 'acting': True, 'a': 0.2, 'b': 1.0},
                {'step': 1, 'cmd': ['goto', '/calendar'], 'navigate': True, 'a': 1.2, 'b': 2.0},
                {'step': 2, 'cmd': ['look', 'calendar'], 'look': True, 'a': 2.1, 'b': 2.5},
                {'step': 3, 'cmd': ['look', 'dialog'], 'look': True, 'a': 2.6, 'b': 3.0}]
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'capture.json').write_text(json.dumps({'steps': back, 'end': 4.0, 'active': [], 'stills': []}))
            chapter = {'sentences': [{'action': 0, 'text': 'Klikamy.'}, {'action': 3, 'text': 'Wracamy do kalendarza.'}]}
            spec, _ = cut.chapter_setup(chapter, folder)
            self.assertEqual([s.get('beat') for s in spec['steps']], [1, None, None, 2])

    def test_opening_on_a_loaded_result_keeps_blank_navigation_off_film(self):
        steps = [{'step': 0, 'cmd': ['goto', '/teams'], 'navigate': True, 'a': 0.2, 'b': 3.0},
                 {'step': 1, 'cmd': ['look', 'team heading'], 'look': True, 'a': 3.1, 'b': 3.5}]
        for step in steps:
            step.update(w=step['a'] - 0.1, m=step['a'] - 0.05)
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'capture.json').write_text(json.dumps({
                'steps': steps, 'end': 4, 'active': [], 'blank': [[0, 3]], 'stills': [3.2]}))
            chapter = {'sentences': [{'action': 1, 'text': 'Zespół ma nazwę i zdjęcia członków.'}]}
            spec, capture = cut.chapter_setup(chapter, folder)
            self.assertEqual(spec['steps'][0]['at'], -1)
            self.assertNotIn('beat', spec['steps'][0])
            self.assertEqual(spec['steps'][1]['beat'], 1)
            film = cut.montage.cut(spec, capture, cut.montage.estimated_words(spec['narration']))
            self.assertGreaterEqual(film['pieces'][0][0], 3.1)  # the viewer starts on the proved screen
            self.assertEqual([anchor['step'] for anchor in film['anchors']], [1])



class Colors(unittest.TestCase):
    def test_the_films_colours_come_from_the_brand_and_odd_ones_leave_the_film_in_its_own(self):
        self.assertEqual(cut.film_colors({}), (None, None))
        brand = {'brand': {'colors': {'frame': '#222949', 'accent': '#3f58b6'}}}
        self.assertEqual(cut.film_colors(brand), ({'frame': '#222949', 'accent': '#3f58b6'}, None))
        colors, warning = cut.film_colors({'brand': {'colors': {'accent': 'blue'}}})
        self.assertIsNone(colors)
        self.assertIn('brand colours not used', warning)


class Fonts(unittest.TestCase):
    def test_without_fontconfig_the_font_comes_from_known_places(self):  # macOS without Homebrew's fontconfig
        with tempfile.TemporaryDirectory() as folder:
            font = Path(folder) / 'Arial.ttf'
            font.write_bytes(b'')
            with mock.patch.object(cut.shutil, 'which', return_value=None), \
                    mock.patch.object(cut, 'FONT_CANDIDATES', ('/nowhere/DejaVuSans.ttf', str(font))):
                self.assertEqual(cut.font_path(), str(font))
                self.assertEqual(cut.font_family(font), 'Arial')  # the summary names the font the film has
                self.assertIsNone(cut.covers(font, 'ąę'))  # no fc-query: unknown, and a brand font is not kept unchecked
                brand = {'brand': {'font': {'family': 'Brand', 'source': 'https://example.com/brand.otf'}}}
                cached = Path(folder) / 'fonts' / (hashlib.sha256(b'https://example.com/brand.otf').hexdigest()[:16] + '.otf')
                cached.parent.mkdir()
                cached.write_bytes(b'')  # downloaded by an earlier run
                with mock.patch.object(cut.core, 'HOME', Path(folder)):
                    path, family, warning = cut.film_font(brand, 'Zażółć')
                self.assertEqual((path, family), (str(font), 'Arial'))
                self.assertIn('not checked for Polish letters (no fc-query', warning)
            with mock.patch.object(cut.shutil, 'which', return_value=None), \
                    mock.patch.object(cut, 'FONT_CANDIDATES', ('/nowhere/DejaVuSans.ttf',)):
                with self.assertRaises(SystemExit):
                    cut.font_path()

    UBUNTU = Path('/usr/share/fonts/truetype/ubuntu/Ubuntu[wdth,wght].ttf')

    @unittest.skipUnless(UBUNTU.is_file() and shutil.which('fc-query'), 'the Ubuntu variable font and fontconfig')
    def test_a_variable_brand_font_is_checked_across_its_instances(self):  # its charsets ran together: ValueError
        self.assertTrue(cut.covers(self.UBUNTU, cut.POLISH + 'Zażółć'))
        self.assertFalse(cut.covers(self.UBUNTU, '中'))
        with tempfile.TemporaryDirectory() as folder:
            brand = {'brand': {'font': {'family': 'Ubuntu', 'source': 'https://example.com/ubuntu.ttf'}}}
            cached = Path(folder) / 'fonts' / (hashlib.sha256(b'https://example.com/ubuntu.ttf').hexdigest()[:16] + '.otf')
            cached.parent.mkdir()
            shutil.copyfile(self.UBUNTU, cached)  # downloaded by an earlier run
            with mock.patch.object(cut.core, 'HOME', Path(folder)):
                self.assertEqual(cut.film_font(brand, 'Zażółć gęślą jaźń'), (str(cached), 'Ubuntu', None))

    def test_a_font_fontconfig_cannot_read_leaves_the_default_font(self):  # the brand font's check stopped the film
        instances = mock.Mock(returncode=0, stdout='20-7e a0-24f fb01-fb02\n20-7e a0-24f fb01-fb02\n')
        odd = mock.Mock(returncode=0, stdout='20-7e fb01-fb0220-7e a0-24f zz')  # ranges run together, a stray word
        with mock.patch.object(cut.shutil, 'which', return_value='/usr/bin/fc-query'):
            with mock.patch.object(cut.subprocess, 'run', return_value=instances):
                self.assertTrue(cut.covers('brand.otf', 'Zażółć'))
            with mock.patch.object(cut.subprocess, 'run', return_value=odd):
                self.assertTrue(cut.covers('brand.otf', 'Zażółć'))
                self.assertFalse(cut.covers('brand.otf', '\ufb02'))  # in no range read: missing
        with tempfile.TemporaryDirectory() as folder:
            brand = {'brand': {'font': {'family': 'Brand', 'source': 'https://example.com/brand.otf'}}}
            cached = Path(folder) / 'fonts' / (hashlib.sha256(b'https://example.com/brand.otf').hexdigest()[:16] + '.otf')
            cached.parent.mkdir()
            cached.write_bytes(b'')
            for failure in (ValueError('invalid literal for int() with base 16'),
                            cut.subprocess.TimeoutExpired('fc-query', 60)):
                with self.subTest(failure=failure), mock.patch.object(cut.core, 'HOME', Path(folder)), \
                        mock.patch.object(cut, 'font_path', return_value='/fonts/DejaVuSans.ttf'), \
                        mock.patch.object(cut, 'covers', side_effect=failure):
                    path, family, warning = cut.film_font(brand, 'Zażółć')
                self.assertEqual((path, family), ('/fonts/DejaVuSans.ttf', 'DejaVu Sans'))
                self.assertIn('Brand not checked', warning)



@unittest.skipUnless(sys.platform == 'darwin', "macOS's own Quick Look and PDFKit")
class MacDocuments(unittest.TestCase):
    def test_without_poppler_a_mac_reads_and_draws_a_downloaded_pdf(self):  # no bottle of it for an Intel Mac
        real = shutil.which
        hidden = lambda name, *args, **kwargs: None if name in ('pdftotext', 'pdftoppm') else real(name, *args, **kwargs)
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(shutil, 'which', side_effect=hidden):
            document = Path(folder) / 'protocol.pdf'
            pdf(document, 'Protocol of acceptance')
            self.assertEqual(takes.pdf_text(document), 'Protocol of acceptance')
            still = cut.document_still({'file': str(document)})
            self.assertEqual(Path(still).name, 'protocol.page1.png')
            self.assertEqual(sorted(p.name for p in Path(folder).iterdir()), ['protocol.page1.png', 'protocol.pdf'])
            with mock.patch.object(cut.core, 'DARWIN', False), mock.patch.object(takes.core, 'DARWIN', False):
                self.assertEqual(takes.pdf_text(document), '')  # elsewhere without poppler: nothing


if __name__ == '__main__':
    unittest.main()
