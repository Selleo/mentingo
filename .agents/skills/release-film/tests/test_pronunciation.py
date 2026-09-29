import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import pronunciation  # noqa: E402

LEXICON = {'PDF': 'pe de ef', 'Flex Friday': 'Fleks Frajdej', 'Word': 'Łord', 'CRM': 'ce er em'}


def events_for(spoken):
    words = [w for w in spoken.split() if any(c.isalnum() for c in w)]
    return [{'type': 'WordBoundary', 'offset': i * 5_000_000, 'duration': 4_000_000, 'text': w.strip('.,')}
            for i, w in enumerate(words)]


class Pronunciation(unittest.TestCase):
    def test_voice_gets_respelling_and_keeps_polish_endings(self):
        spoken, units = pronunciation.speakable('Eksport do PDF, dni Flex Friday i plik Worda w CRM.', LEXICON)
        self.assertEqual(spoken, 'Eksport do pe de ef, dni Fleks Frajdej i plik Łorda w ce er em.')
        self.assertEqual(pronunciation.used_terms(units), ['CRM', 'Flex Friday', 'PDF', 'Word'])
        untouched, _ = pronunciation.speakable('Wordpress i PDFy zostają.', LEXICON)
        self.assertEqual(untouched, 'Wordpress i pe de efy zostają.')  # Polish endings follow; longer words stay

    def test_captions_keep_written_words_with_spoken_timing(self):
        text = 'Eksport do PDF, dni Flex Friday – gotowe.'
        spoken, units = pronunciation.speakable(text, LEXICON)
        written = pronunciation.written_events(units, events_for(spoken))
        self.assertEqual([e['text'] for e in written], ['Eksport', 'do', 'PDF,', 'dni', 'Flex', 'Friday –', 'gotowe.'])
        pdf = written[2]
        self.assertEqual(pdf['offset'], 10_000_000)  # starts with "pe"
        self.assertEqual(pdf['offset'] + pdf['duration'], 24_000_000)  # ends with "ef"
        self.assertEqual(written[4]['offset'], 30_000_000)  # "Flex" takes the timing of "Fleks"

    def test_mismatch_and_identity(self):
        spoken, units = pronunciation.speakable('Zwykłe zdanie bez nazw.', {})
        self.assertEqual(spoken, 'Zwykłe zdanie bez nazw.')
        self.assertEqual(len(pronunciation.written_events(units, events_for(spoken))), 4)
        differently = []
        written = pronunciation.written_events(units, events_for('Inne zdanie bez nazw.'), differently)
        self.assertEqual([e['text'] for e in written], ['Zwykłe', 'zdanie', 'bez', 'nazw.'])  # captions keep the text
        self.assertEqual(written[0]['offset'], 0)  # and the timing of what the voice said there
        self.assertEqual(differently, ['Zwykłe'])  # the word the voice read differently is named

    def test_a_symbol_the_voice_reads_as_two_words(self):
        spoken, units = pronunciation.speakable('Dajemy 5x więcej.', {})
        events = events_for('Dajemy pięć razy więcej.')
        differently = []
        written = pronunciation.written_events(units, events, differently)
        self.assertEqual([e['text'] for e in written], ['Dajemy', '5x', 'więcej.'])
        self.assertEqual((written[1]['offset'], written[1]['offset'] + written[1]['duration']), (5_000_000, 14_000_000))
        self.assertEqual(differently, ['5x'])

    def test_a_quoted_term_is_respelled_from_its_first_word(self):  # „Flex… used to reach the voice as written
        spoken, units = pronunciation.speakable('Lista „Flex Friday days” i „PDF”.', LEXICON)
        self.assertEqual(spoken, 'Lista „Fleks Frajdej days” i „pe de ef”.')
        self.assertEqual(pronunciation.used_terms(units), ['Flex Friday', 'PDF'])


def said(text, lexicon=None):
    return pronunciation.speakable(text, lexicon or {})[0]


class English(unittest.TestCase):  # VoxCPM2 once said "20 October" as "27": an English voice gets words too
    def test_numbers_dates_amounts_and_versions_are_said_in_english_words(self):
        said = lambda text: pronunciation.speakable(text, {}, 'en')[0]
        self.assertEqual(said('Choosing 14 to 20 October lists the days; the bar for 25 September.'),
                         'Choosing the fourteenth to the twentieth of October lists the days; the bar for the '
                         'twenty-fifth of September.')
        self.assertEqual(said('On October 23, on 3, 5 and 7 May, and on 14–20 June.'),
                         'On October twenty-third, on the third, the fifth and the seventh of May, and on the fourteenth '
                         'to the twentieth of June.')
        self.assertEqual(said('Tiles show “187h / 400h”, 7.5h and 12,5h; Lindqvist shows 213 of 400, up 23.'),
                         'Tiles show “one hundred eighty-seven hours of four hundred hours”, seven point five hours and '
                         'twelve point five hours; Lindqvist shows two hundred thirteen of four hundred, up twenty-three.')
        self.assertEqual(said('Invoices worth 94 600 zł and $94,600 are 74% paid, +5 pp in 1 h.'),
                         'Invoices worth ninety-four thousand six hundred złoty and ninety-four thousand six hundred '
                         'dollars are seventy-four percent paid, plus five percentage points in one hour.')
        self.assertEqual(said('Version 4.20.1 of Acme ships at 8:00 or 17:05 in 2026, in 3–4 minutes.'),
                         'Version four point twenty point one of Acme ships at eight o\'clock or seventeen oh five in '
                         'twenty twenty-six, in three to four minutes.')

    def test_captions_keep_a_dates_written_words(self):
        spoken, units = pronunciation.speakable('The bar for 25 September.', {}, 'en')
        written = pronunciation.written_events(units, events_for(spoken))
        self.assertEqual([e['text'] for e in written], ['The', 'bar', 'for', '25', 'September.'])


class Numbers(unittest.TestCase):  # every voice gets words: none reads digits its own way
    def test_numbers_agree_with_what_they_count_and_the_word_before_them(self):
        self.assertEqual(said('Dymek podaje 72 godziny celu wobec 59 przepracowanych.'),
                         'Dymek podaje siedemdziesiąt dwie godziny celu wobec pięćdziesięciu dziewięciu przepracowanych.')
        self.assertEqual(said('Mamy 1 godzinę, 2 osoby, 3 aktywnych użytkowników i 1 zadanie.'),
                         'Mamy jedną godzinę, dwie osoby, trzech aktywnych użytkowników i jedno zadanie.')
        self.assertEqual(said('Amber Health: 120 ze 160 godzin.'), 'Amber Health: sto dwadzieścia ze stu sześćdziesięciu godzin.')
        self.assertEqual(said('Z 3 osobami w 2 krokach, przy 1 godzinie i w 3 dni.'),
                         'Z trzema osobami w dwóch krokach, przy jednej godzinie i w trzy dni.')
        self.assertEqual(said('Wpisujemy 87,5, potem 1,5 godziny i 3,05.'),
                         'Wpisujemy osiemdziesiąt siedem i pół, potem półtorej godziny i trzy przecinek zero pięć.')

    def test_thousands_written_apart_and_units_after_a_number(self):
        self.assertEqual(said('Faktura na 94 600 zł, suma 106 000 zł.'),
                         'Faktura na dziewięćdziesiąt cztery tysiące sześćset złotych, suma sto sześć tysięcy złotych.')
        self.assertEqual(said('Opłacono 51% faktur, w sumie w 74%.'),
                         'Opłacono pięćdziesiąt jeden procent faktur, w sumie w siedemdziesięciu czterech procentach.')
        self.assertEqual(said('Na przykład „+12,5h · +5 pp” i „187h / 400h”.'),
                         'Na przykład „plus dwanaście i pół godziny · plus pięć punktów procentowych” i '
                         '„sto osiemdziesiąt siedem godzin na czterysta godzin”.')
        self.assertEqual(said('Od 1 000 do 2 000 zł, 2h, 22 h i 12h.'),
                         'Od tysiąca do dwóch tysięcy złotych, dwie godziny, dwadzieścia dwie godziny i dwanaście godzin.')

    def test_days_years_hours_and_versions(self):
        self.assertEqual(said('Dymek oznacza 23 i 26 października, zmiana od 27 do 28 września.'),
                         'Dymek oznacza dwudziestego trzeciego i dwudziestego szóstego października, zmiana od '
                         'dwudziestego siódmego do dwudziestego ósmego września.')
        self.assertEqual(said('Zakres 21–30 września z 19 sierpnia.'),
                         'Zakres od dwudziestego pierwszego do trzydziestego września z dziewiętnastego sierpnia.')
        self.assertEqual(said('Otwarty wrzesień 2026 roku, w 2025 roku.'),
                         'Otwarty wrzesień dwa tysiące dwudziestego szóstego roku, w dwa tysiące dwudziestym piątym roku.')
        self.assertEqual(said('Start o 17:30, zapis na 8:05, biuro 8:00–18:00.'),
                         'Start o siedemnastej trzydzieści, zapis na ósmą zero pięć, biuro od ósmej do osiemnastej.')
        self.assertEqual(said('Paczka SCORM 1.2, wersja v3.9.0 i 4.20.1.'),
                         'Paczka skorm jeden kropka dwa, wersja trzy kropka dziewięć kropka zero i cztery kropka '
                         'dwadzieścia kropka jeden.')

    def test_abbreviations_are_spelled_or_said_as_words(self):
        self.assertEqual(said('W CRM wynik NPS, kwota bez VAT, plik PDF-a i HTML.'),
                         'W ce er em wynik en pe es, kwota bez wat, plik pe de efa i ha te em el.')
        self.assertEqual(said('Rozdział IV i USA.'), 'Rozdział IV i u es a.')  # a Roman numeral stays
        self.assertEqual(said('Pole CEO.', {'CEO': 'si i oł'}), 'Pole si i oł.')  # the lexicon comes first

    def test_captions_keep_every_written_word_of_a_number(self):
        spoken, units = pronunciation.speakable('Razem 27 500 zł.', {})
        written = pronunciation.written_events(units, events_for(spoken))
        self.assertEqual([e['text'] for e in written], ['Razem', '27', '500', 'zł.'])
        self.assertEqual(written[1]['offset'], 5_000_000)  # the number starts with "dwadzieścia"
        self.assertEqual(written[3]['offset'] + written[3]['duration'], 29_000_000)  # and ends with "złotych"
        self.assertEqual(pronunciation.used_terms(units), [])


if __name__ == '__main__':
    unittest.main()
