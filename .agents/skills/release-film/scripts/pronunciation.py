#!/usr/bin/env python3
"""What the voice says for the written narration; captions keep the written words.

Every voice gets the same text, so none reads digits or abbreviations its own way (VoxCPM2, a language model of
speech, now and then says a digit wrong: "20 October" came out as "27"). In an English film numbers, dates, hours,
amounts, units and versions are said in English words ("14 to 20 October" -> "fourteenth to twentieth October",
"187h / 400h" -> "one hundred eighty-seven hours of four hundred hours"); abbreviations and names stay as written. In a
Polish film:
- a lexicon (the common one's abbreviations, an add-on's ``pronunciation``) maps written terms to how the voice
  should say them (``"PDF": "pe de ef"``), keeping Polish endings on a single-word term (``PDF-a`` -> ``pe de efa``);
- numbers are said in Polish words with the grammar around them: the case a preposition asks for, the gender of what
  they count, days and years as ordinals ("72 godziny" -> "siedemdziesiąt dwie godziny", "wobec 59" -> "wobec
  pięćdziesięciu dziewięciu", "od 27 do 28 września" -> "od dwudziestego siódmego do dwudziestego ósmego września");
- so are units, hours and versions ("187h / 400h" -> "… godzin na … godzin", "o 17:30" -> "o siedemnastej
  trzydzieści", "SCORM 1.2" -> "… jeden kropka dwa");
- an abbreviation no lexicon has is spelled in Polish letter names ("NPS" -> "en pe es", "CRM" -> "ce er em"), or
  said as a word when it reads as one ("VAT", "SCORM").

``speakable`` returns the text sent to the voice plus units linking written and spoken words; ``written_events`` maps
the voice's word timings back to the written words for captions and beats.
"""
import difflib
import re

ENDING = re.compile(r'-?[a-ząćęłńóśźż]{1,4}')
LEADING = re.compile(r'^([„"“(«]*)(.*)$')

# whole numbers: ones, teens, tens and hundreds in the nominative (also the accusative of things), the genitive (also
# the locative) and the instrumental
WORDS = {
    'nom': (('zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'),
            ('dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście',
             'siedemnaście', 'osiemnaście', 'dziewiętnaście'),
            ('', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt',
             'osiemdziesiąt', 'dziewięćdziesiąt'),
            ('', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset',
             'dziewięćset')),
    'gen': (('zera', 'jednego', 'dwóch', 'trzech', 'czterech', 'pięciu', 'sześciu', 'siedmiu', 'ośmiu', 'dziewięciu'),
            ('dziesięciu', 'jedenastu', 'dwunastu', 'trzynastu', 'czternastu', 'piętnastu', 'szesnastu', 'siedemnastu',
             'osiemnastu', 'dziewiętnastu'),
            ('', '', 'dwudziestu', 'trzydziestu', 'czterdziestu', 'pięćdziesięciu', 'sześćdziesięciu',
             'siedemdziesięciu', 'osiemdziesięciu', 'dziewięćdziesięciu'),
            ('', 'stu', 'dwustu', 'trzystu', 'czterystu', 'pięciuset', 'sześciuset', 'siedmiuset', 'ośmiuset',
             'dziewięciuset')),
    'inst': (('zerem', 'jednym', 'dwoma', 'trzema', 'czterema', 'pięcioma', 'sześcioma', 'siedmioma', 'ośmioma',
              'dziewięcioma'),
             ('dziesięcioma', 'jedenastoma', 'dwunastoma', 'trzynastoma', 'czternastoma', 'piętnastoma', 'szesnastoma',
              'siedemnastoma', 'osiemnastoma', 'dziewiętnastoma'),
             ('', '', 'dwudziestoma', 'trzydziestoma', 'czterdziestoma', 'pięćdziesięcioma', 'sześćdziesięcioma',
              'siedemdziesięcioma', 'osiemdziesięcioma', 'dziewięćdziesięcioma'),
             ('', 'stoma', 'dwustoma', 'trzystoma', 'czterystoma', 'pięciuset', 'sześciuset', 'siedmiuset', 'ośmiuset',
              'dziewięciuset')),
}
WORDS['loc'] = WORDS['gen']
# one alone, where its gender changes it
ONE = {'nom': {'f': 'jedna', 'n': 'jedno'}, 'gen': {'f': 'jednej'}, 'loc': {'m': 'jednym', 'n': 'jednym', 'f': 'jednej'},
       'inst': {'f': 'jedną'}}
# thousands and up: the nominative after one, two to four, five and more; the other cases after one, after more
SCALES = ((10 ** 9, {'nom': ('miliard', 'miliardy', 'miliardów'), 'gen': ('miliarda', 'miliardów'),
                     'loc': ('miliardzie', 'miliardach'), 'inst': ('miliardem', 'miliardami')}),
          (10 ** 6, {'nom': ('milion', 'miliony', 'milionów'), 'gen': ('miliona', 'milionów'),
                     'loc': ('milionie', 'milionach'), 'inst': ('milionem', 'milionami')}),
          (10 ** 3, {'nom': ('tysiąc', 'tysiące', 'tysięcy'), 'gen': ('tysiąca', 'tysięcy'),
                     'loc': ('tysiącu', 'tysiącach'), 'inst': ('tysiącem', 'tysiącami')}))
# ordinals in the masculine nominative: ones, teens, tens, hundreds
ORDINAL = (('', 'pierwszy', 'drugi', 'trzeci', 'czwarty', 'piąty', 'szósty', 'siódmy', 'ósmy', 'dziewiąty'),
           ('dziesiąty', 'jedenasty', 'dwunasty', 'trzynasty', 'czternasty', 'piętnasty', 'szesnasty', 'siedemnasty',
            'osiemnasty', 'dziewiętnasty'),
           ('', '', 'dwudziesty', 'trzydziesty', 'czterdziesty', 'pięćdziesiąty', 'sześćdziesiąty', 'siedemdziesiąty',
            'osiemdziesiąty', 'dziewięćdziesiąty'),
           ('', 'setny', 'dwusetny', 'trzechsetny', 'czterechsetny', 'pięćsetny', 'sześćsetny', 'siedemsetny',
            'osiemsetny', 'dziewięćsetny'))
MONTHS = ('stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października',
          'listopada', 'grudnia')  # the month of a date ("28 września")
JOINS = ('i', 'oraz', 'lub', 'albo', 'do', 'a', '–', '-', '—')  # between days of one month ("23 i 26 października")
# a unit after a number: its forms (the nominative after one, two to four, five and more; the genitive and the
# locative after one, after more; after a fraction) and its gender
UNITS = {
    'h': {'nom': ('godzina', 'godziny', 'godzin'), 'gen': ('godziny', 'godzin'), 'loc': ('godzinie', 'godzinach'),
          'fraction': 'godziny', 'gender': 'f'},
    'min': {'nom': ('minuta', 'minuty', 'minut'), 'gen': ('minuty', 'minut'), 'loc': ('minucie', 'minutach'),
            'fraction': 'minuty', 'gender': 'f'},
    'zł': {'nom': ('złoty', 'złote', 'złotych'), 'gen': ('złotego', 'złotych'), 'loc': ('złotym', 'złotych'),
           'fraction': 'złotego', 'gender': 'm'},
    'pp': {'nom': ('punkt procentowy', 'punkty procentowe', 'punktów procentowych'),
           'gen': ('punktu procentowego', 'punktów procentowych'),
           'loc': ('punkcie procentowym', 'punktach procentowych'), 'fraction': 'punktu procentowego', 'gender': 'm'},
    'pkt': {'nom': ('punkt', 'punkty', 'punktów'), 'gen': ('punktu', 'punktów'), 'loc': ('punkcie', 'punktach'),
            'fraction': 'punktu', 'gender': 'm'},
    '%': {'nom': ('procent', 'procent', 'procent'), 'gen': ('procenta', 'procent'), 'loc': ('procencie', 'procentach'),
          'fraction': 'procent', 'gender': 'm'},
    '€': {'nom': ('euro', 'euro', 'euro'), 'gen': ('euro', 'euro'), 'loc': ('euro', 'euro'), 'fraction': 'euro',
          'gender': 'n'},
}
UNITS['PLN'], UNITS['EUR'] = UNITS['zł'], UNITS['€']
UNIT = '(' + '|'.join(map(re.escape, UNITS)) + ')'
AMOUNT = re.compile(r'([+\-−]?)(\d+(?:[.,]\d+)?)' + UNIT + '?')
GENITIVE = {'do', 'od', 'z', 'ze', 'bez', 'dla', 'około', 'u', 'wobec', 'według', 'spośród', 'wśród', 'zamiast',
            'oprócz', 'prócz', 'powyżej', 'poniżej', 'sprzed', 'spoza', 'koło', 'blisko', 'podczas', 'wokół',
            'naprzeciw', 'spod', 'znad', 'zza', 'obok', 'mimo', 'pomimo', 'wzdłuż'}
# what a number counts, by the start of its word: feminine (two is "dwie") and men (two to four are "dwóch, trzech,
# czterech")
FEMININE = ('godzin', 'minut', 'sekund', 'osob', 'osób', 'lekcj', 'sesj', 'kart', 'faktur', 'zmian', 'stron', 'pozycj',
            'wiadomoś', 'grup', 'notat', 'opcj', 'kolumn', 'kategori', 'rola', 'role', 'ról', 'roli', 'kwot', 'stawk',
            'doby', 'dób', 'noc', 'wersj', 'ocen', 'zgod', 'uwag', 'liczb', 'data', 'daty', 'dat', 'tabel', 'zakład',
            'sekcj', 'firm', 'organizacj', 'umow', 'umów', 'płatnoś', 'wartoś', 'aktywnoś', 'funkcj', 'reguł', 'zasad',
            'prób', 'ankiet', 'rozmow', 'wzmian', 'ofert', 'transakcj', 'rezerwacj', 'aplikacj', 'wizyt', 'nieobecnoś',
            'niedostępnoś', 'faz', 'odpowiedz', 'odpowiedź', 'ścieżk', 'ścieżek')
PERSONAL = ('użytkowni', 'kursant', 'klient', 'pracowni', 'menedżer', 'menadżer', 'administrator', 'konsultant',
            'zleceniobiorc', 'kontrahent', 'uczni', 'student', 'autor', 'twórc', 'mentor', 'trener', 'uczestni',
            'członk', 'odbiorc', 'sprzedawc', 'kierowni', 'specjalist', 'programist', 'tester', 'lider', 'właściciel',
            'opiekun', 'recenzent', 'lekarz', 'pacjent', 'nauczyciel', 'instruktor', 'moderator', 'kandydat',
            'wykonawc', 'podwykonawc', 'przedstawiciel', 'gości')
TIME = re.compile(r'([01]?\d|2[0-4]):([0-5]\d)')
HOUR = {'o': 'fgen', 'po': 'fgen', 'od': 'fgen', 'do': 'fgen', 'około': 'fgen', 'koło': 'fgen', 'sprzed': 'fgen',
        'na': 'facc', 'przed': 'facc', 'za': 'facc', 'między': 'facc', 'pomiędzy': 'facc'}  # the form of an hour
NUMERIC_DATE = re.compile(r'(\d{1,2})\.(\d{1,2})\.(\d{4})|(\d{4})-(\d{2})-(\d{2})')
VERSION = re.compile(r'v?\d+(?:\.\d+){2,}|v\d+(?:\.\d+)*')
LETTERS = dict(zip('ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                   'a be ce de e ef gie ha i jot ka el em en o pe ku er es te u fau wu iks igrek zet'.split()))
ABBREVIATION = re.compile(r'([A-Z]{2,5})(\d*)(?:-([a-ząćęłńóśźż]{1,4}))?')
ENGLISH_UNITS = {'h': ('hour', 'hours'), 'min': ('minute', 'minutes'), 'pp': ('percentage point', 'percentage points'),
                 'pkt': ('point', 'points'), 'zł': ('złoty', 'złoty'), 'PLN': ('złoty', 'złoty'), '€': ('euro', 'euros'),
                 'EUR': ('euro', 'euros'), '%': ('percent', 'percent')}
ENGLISH_ONES = ('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen '
                'seventeen eighteen nineteen').split()
ENGLISH_TENS = ('', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety')
ENGLISH_MONTHS = ('january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
                  'november', 'december')
ENGLISH_JOINS = ('and', 'to', 'or', 'through', '–', '-', '—')  # between days of one month ("14 to 20 October")
CURRENCY = {'$': ('dollar', 'dollars'), '€': ('euro', 'euros'), '£': ('pound', 'pounds')}


def grade(count):
    """0 after one, 1 after two to four (not 12–14), 2 after the rest: the form of what a number counts."""
    if count == 1:
        return 0
    return 1 if count % 10 in (2, 3, 4) and not 12 <= count % 100 <= 14 else 2


def cardinal(value, case='nom', gender='m'):
    """A whole number in words: ``case`` 'nom' (also the accusative of things), 'gen', 'loc' or 'inst'; ``gender`` of
    what it counts: 'm', 'f', 'n', or 'p' for men, who are counted in the genitive ("dwóch użytkowników")."""
    if value >= 10 ** 12:
        return [str(value)]
    if gender == 'p' and case == 'nom' and value != 1:
        case = 'gen'
    if value == 0:
        return [WORDS[case][0][0]]
    said, rest = [], value
    for size, forms in SCALES:
        count, rest = divmod(rest, size)
        if count == 1:
            said.append(forms[case][0])
        elif count:
            said += hundreds(count, case, 'm', False) + [forms[case][grade(count) if case == 'nom' else 1]]
    return said + (hundreds(rest, case, gender, value == 1) if rest else [])


def hundreds(value, case, gender, alone):
    """1–999 in words (``alone``: the whole number is one, which takes the gender of what it counts)."""
    ones, teens, tens, hundred = WORDS[case]
    said = [hundred[value // 100]] if value >= 100 else []
    rest = value % 100
    if 10 <= rest < 20:
        return said + [teens[rest - 10]]
    if rest >= 20:
        said.append(tens[rest // 10])
    unit = rest % 10
    if unit == 1:
        said.append(ONE[case].get(gender, ones[1]) if alone else 'jeden')
    elif unit == 2 and gender == 'f' and case in ('nom', 'inst'):
        said.append('dwie' if case == 'nom' else 'dwiema')
    elif unit:
        said.append(ones[unit])
    return said


def decimal(text, case='nom', gender='m'):
    """A written number with a fraction ("87,5", "7.5") in words: a half as "i pół" (0,5 "pół", 1,5 "półtora" or
    "półtorej"), another fraction after "przecinek"."""
    whole, fraction = re.split(r'[.,]', text)
    whole = int(whole)
    if fraction.rstrip('0') == '5':
        if whole < 2:
            return [('pół', 'półtorej' if gender == 'f' else 'półtora')[whole]]
        return cardinal(whole, case, gender) + ['i', 'pół']
    digits = fraction.lstrip('0')
    return (cardinal(whole, case, gender) + ['przecinek'] + ['zero'] * (len(fraction) - len(digits))
            + (cardinal(int(digits)) if digits else []))


def ordinal(value, form='m'):
    """An ordinal (1–2999) in words: ``form`` 'm' (masculine nominative), 'gen' (its genitive: a date's day, "28
    września"), 'loc' (its locative: "w 2026 roku"), 'f' (feminine: an hour, "ósma"), 'fgen' (its genitive and
    locative: "o ósmej"), 'facc' (its accusative and instrumental: "na ósmą")."""
    ones, teens, tens, hundred = ORDINAL
    thousands, rest = divmod(value, 1000)
    if thousands and not rest:
        return [inflect(('', 'tysięczny', 'dwutysięczny')[thousands], form)]
    said = cardinal(thousands * 1000) if thousands else []
    if rest % 100 == 0:
        return said + [inflect(hundred[rest // 100], form)]
    if rest >= 100:
        said.append(WORDS['nom'][3][rest // 100])
    rest %= 100
    if 10 <= rest < 20:
        return said + [inflect(teens[rest - 10], form)]
    if rest >= 20:
        said.append(inflect(tens[rest // 10], form))
    if rest % 10:
        said.append(inflect(ones[rest % 10], form))
    return said


def inflect(word, form):
    """A masculine nominative ordinal ("pierwszy", "trzeci") in another ``form`` (see ordinal)."""
    stem, soft = word[:-1], word.endswith('i')
    return {'m': word, 'gen': stem + ('iego' if soft else 'ego'), 'loc': stem + ('im' if soft else 'ym'),
            'f': stem + ('ia' if word == 'trzeci' else 'a'), 'fgen': stem + ('iej' if soft else 'ej'),
            'facc': stem + ('ią' if word == 'trzeci' else 'ą')}[form]


def number_words(sign, digits, unit=None, case='nom', gender='m'):
    """A written number (its sign, digits and unit) in words."""
    fraction = bool(re.search('[.,]', digits))
    if unit:
        gender = UNITS[unit]['gender']
    said = {'+': ['plus'], '-': ['minus'], '−': ['minus']}.get(sign, [])
    said += decimal(digits, case, gender) if fraction else cardinal(int(digits), case, gender)
    if unit:
        forms = UNITS[unit]
        if fraction:
            word = forms['fraction']
        elif case in ('gen', 'loc'):
            word = forms[case][0 if int(digits) == 1 else 1]
        else:
            word = forms['nom'][grade(int(digits))]
        said += word.split()
    return said


def case_of(before, after, unit):
    """The case of a number from the word before it and the word after it (``unit``: a unit follows it)."""
    if before in ('z', 'ze') and after.endswith(('mi', 'em', 'ą')) and not unit:
        return 'inst'
    if before in GENITIVE:
        return 'gen'
    if before in ('w', 'we', 'przy') and unit or before in ('w', 'we', 'przy', 'o', 'po', 'na') and after.endswith('ach'):
        return 'loc'
    if after.endswith('ami') and not unit:
        return 'inst'
    return 'nom'


def gender_of(after, one=False):
    """The gender of what a number counts, from the next two words (``one``: the number is one, in the nominative,
    and the ending of the next word tells)."""
    for word in after[:2]:
        if word.startswith(FEMININE):
            return 'f'
        if word.startswith(PERSONAL) and word.endswith(('ów', 'i')):
            return 'p'
    if one and after and after[0].endswith(('a', 'ść')):
        return 'f'
    if one and after and after[0].endswith(('o', 'e', 'ę', 'um')):
        return 'n'
    return 'm'


def is_day(marks, index):
    """Whether the number at ``index`` is a day of a date: a month follows, at once or after other days of it ("23 i 26
    października", "od 27 do 28 września")."""
    for _, core, trailing in marks[index + 1:]:
        if core.lower() in MONTHS:
            return True
        if trailing.strip(',') or not (core.lower() in JOINS or re.fullmatch(r'\d{1,2}', core)):
            return False
    return False


def year_form(marks, index, before):
    """The ordinal form of a year ("w 2026 roku", "z 2026 roku", "15 lipca 2025"), or None: said as a number."""
    after = marks[index + 1][1].lower() if index + 1 < len(marks) else ''
    if after in ('roku', 'r'):
        return 'loc' if before in ('w', 'we') else 'gen'
    if after == 'rok':
        return 'm'
    return 'gen' if before in MONTHS else None


def hour(match, before):
    """An hour ("17:30") in words, in the form the word before it asks for ("o siedemnastej trzydzieści")."""
    value, minutes = int(match.group(1)), match.group(2)
    said = ordinal(value, HOUR.get(before, 'f')) if value else ['zero']
    if minutes != '00':
        said += (['zero'] if minutes[0] == '0' else []) + cardinal(int(minutes))
    return said


def abbreviation(core):
    """An abbreviation in words: spelled in Polish letter names ("NPS" -> "en pe es", "CRM" -> "ce er em"), or said as
    a word when it reads as one (a vowel and no three consonants in a row, from 4 letters or after a first consonant:
    "VAT", "SCORM"), a Polish ending kept ("PR-y" -> "pe ery"). None for anything else, Roman numerals included."""
    match = ABBREVIATION.fullmatch(core)
    if not match:
        return None
    letters, digits, ending = match.groups()
    if not digits and set(letters) <= set('IVX'):
        return None
    word = (not digits and (len(letters) >= 4 or len(letters) == 3 and letters[0] not in 'AEIOUY')
            and re.search('[AEIOUY]', letters) and not re.search('[^AEIOUY]{3}', letters))
    if word:  # in Polish spelling: "SCORM" -> "skorm", "VAT" -> "wat"
        said = [re.sub(r'c(?![eiy])', 'k', letters.lower()).replace('v', 'w').replace('x', 'ks').replace('q', 'k')]
    else:
        said = [LETTERS[c] for c in letters]
    said += cardinal(int(digits)) if digits else []
    if ending:
        said[-1] += ending
    return said


def pair(left, sign, right, marks, index, before):
    """Two numbers in one token: a ratio or a size ("187h/400h", "3×2"), a range of days ("21–30 września"), of hours
    ("8:00–18:00") or of numbers ("3–4 minuty"). None for anything else."""
    if sign in '/×':
        amounts = AMOUNT.fullmatch(left), AMOUNT.fullmatch(right)
        return number_words(*amounts[0].groups()) + ['na'] + number_words(*amounts[1].groups()) if all(amounts) else None
    hours = TIME.fullmatch(left), TIME.fullmatch(right)
    if all(hours):
        return (['od'] if before != 'od' else []) + hour(hours[0], 'od') + ['do'] + hour(hours[1], 'do')
    if not (left.isdigit() and right.isdigit()):
        return None
    after = [m[1].lower() for m in marks[index + 1:index + 3]]
    if after and after[0] in MONTHS and 1 <= int(left) <= 31 and 1 <= int(right) <= 31:
        return (['od'] if before != 'od' else []) + ordinal(int(left), 'gen') + ['do'] + ordinal(int(right), 'gen')
    case, gender = case_of(before, after[0] if after else '', False), gender_of(after)
    return cardinal(int(left), case, gender) + cardinal(int(right), case, gender)


def amount(marks, index, before):
    """(tokens used, words) of a number at ``index``: a day or a year as an ordinal, else with its thousands written
    apart ("94 600") and a unit after it ("187 h") in the case and gender its neighbours ask for. None: no number."""
    _, core, trailing = marks[index]
    match = AMOUNT.fullmatch(core)
    if not match:
        return None
    sign, digits, unit = match.groups()
    if not sign and not unit and digits.isdigit():
        value = int(digits)
        if 1 <= value <= 31 and trailing in ('', ',') and is_day(marks, index):
            return 1, ordinal(value, 'gen')
        form = year_form(marks, index, before) if len(digits) == 4 and 1000 <= value <= 2999 else None
        if form:
            return 1, ordinal(value, form)
    size = 1
    if not unit and re.fullmatch(r'\d{1,3}', digits):  # "94 600"
        while not trailing and index + size < len(marks) and not marks[index + size][0]:
            group = re.fullmatch(r'(\d{3}(?:[.,]\d+)?)' + UNIT + '?', marks[index + size][1])
            if not group:
                break
            digits, unit, trailing = digits + group.group(1), group.group(2), marks[index + size][2]
            size += 1
            if unit or not digits.isdigit():
                break
    if not unit and not trailing and index + size < len(marks) and not marks[index + size][0] \
            and marks[index + size][1] in UNITS:  # "187 h"
        unit = marks[index + size][1]
        size += 1
    after = [m[1].lower() for m in marks[index + size:index + size + 2]]
    case = case_of(before, after[0] if after else '', bool(unit))
    gender = gender_of(after, digits == '1' and case == 'nom')
    if digits == '1' and not (sign or unit) and case == 'nom' and after:  # one agrees with its noun's case
        if after[0].endswith(('ę', 'ą')) and gender == 'f' or after[0].endswith('em'):
            return size, ['jedną' if gender == 'f' else 'jednym']  # "1 godzinę", "z 1 plikiem"
        if before in ('w', 'we', 'przy', 'o', 'po', 'na') and after[0].endswith(('ie', 'u')):
            case, gender = 'loc', gender_of(after)  # "przy 1 godzinie", "w 1 kroku"
    return size, number_words(sign, digits, unit, case, gender)


def said_for(marks, index):
    """(tokens used, words, None) for what the voice is told how to say at ``index``: a number with what it counts, a
    date, an hour, a version or an abbreviation. None for any other word."""
    _, core, _ = marks[index]
    before = marks[index - 1][1].lower() if index else ''
    said = abbreviation(core)
    if said:
        return 1, said, None
    if not re.search(r'\d', core):
        if core == '/' and 0 < index < len(marks) - 1 and all(AMOUNT.fullmatch(marks[i][1]) for i in (index - 1, index + 1)):
            return 1, ['na'], None  # "187h / 400h": one amount of the other
        return None
    match = TIME.fullmatch(core)
    if match:
        return 1, hour(match, before), None
    match = NUMERIC_DATE.fullmatch(core)
    if match:
        day, month, year = (int(n) for n in (match.group(1, 2, 3) if match.group(1) else match.group(6, 5, 4)))
        if 1 <= day <= 31 and 1 <= month <= 12 and 1000 <= year <= 2999:
            return 1, ordinal(day, 'gen') + [MONTHS[month - 1]] + ordinal(year, 'gen'), None
    if VERSION.fullmatch(core) or re.fullmatch(r'\d+\.\d+', core) and index and (
            before.startswith('wersj') or marks[index - 1][1].isupper()):
        said = ['wersja'] if core.startswith('v') and not before.startswith('wersj') else []
        for n, part in enumerate(core.lstrip('v').split('.')):
            said += (['kropka'] if n else []) + cardinal(int(part))
        return 1, said, None
    parts = re.split(r'([/×–—-])', core)
    if len(parts) == 3 and parts[0] and parts[2]:
        said = pair(parts[0], parts[1], parts[2], marks, index, before)
        return (1, said, None) if said else None
    found = amount(marks, index, before)
    return (found[0], found[1], None) if found else None


def english_cardinal(value):
    """A whole number in English words ("one hundred eighty-seven")."""
    if value >= 10 ** 12:
        return [str(value)]
    if value < 20:
        return [ENGLISH_ONES[value]]
    said = []
    for size, name in ((10 ** 9, 'billion'), (10 ** 6, 'million'), (1000, 'thousand')):
        count, value = divmod(value, size)
        if count:
            said += english_cardinal(count) + [name]
    if value >= 100:
        said += [ENGLISH_ONES[value // 100], 'hundred']
        value %= 100
    if value >= 20:
        said.append(ENGLISH_TENS[value // 10] + (f'-{ENGLISH_ONES[value % 10]}' if value % 10 else ''))
    elif value:
        said.append(ENGLISH_ONES[value])
    return said


def english_ordinal(value):
    """An ordinal in English words ("twentieth", "twenty-first")."""
    said = english_cardinal(value)
    head, _, last = said[-1].rpartition('-')
    last = {'one': 'first', 'two': 'second', 'three': 'third', 'five': 'fifth', 'eight': 'eighth', 'nine': 'ninth',
            'twelve': 'twelfth'}.get(last) or (last[:-1] + 'ieth' if last.endswith('y') else last + 'th')
    return said[:-1] + [(head + '-' if head else '') + last]


def english_number(text):
    """A written number ("187", "94,600", "86.5", "12,5") in English words."""
    text = text.replace(',', '') if re.fullmatch(r'\d{1,3}(,\d{3})+(\.\d+)?', text) else text.replace(',', '.')
    whole, _, fraction = text.partition('.')
    return english_cardinal(int(whole)) + (['point'] + [ENGLISH_ONES[int(d)] for d in fraction] if fraction else [])


def english_year(value):
    """A year in English words ("twenty twenty-six", "two thousand five")."""
    if value % 100 == 0 or 2000 <= value < 2010:
        return english_cardinal(value)
    return english_cardinal(value // 100) + (['oh'] if value % 100 < 10 else []) + english_cardinal(value % 100)


def english_month(marks, index, step):
    """Where the month is that the day at ``index`` belongs to, after it (``step`` 1: "14 to 20 October") or before it
    (-1: "October 14 to 20"), at once or across other days of it; None."""
    at = index + step
    while 0 <= at < len(marks):
        if (marks[at - 1] if step == 1 else marks[at])[2].strip(',') or (step == 1 and marks[at][0]):
            return None  # a clause or a quote ends between them
        word = marks[at][1].lower()
        if word in ENGLISH_MONTHS:
            return at
        if word not in ENGLISH_JOINS and not re.fullmatch(r'\d{1,2}', marks[at][1]):
            return None
        at += step
    return None


def english_date(marks, index):
    """(tokens used, words) of days written before their month, said as a British date: "14 to 20 October" -> "the
    fourteenth to the twentieth of October"; None when no month follows."""
    month = english_month(marks, index, 1)
    if month is None:
        return None
    said = []
    for _, core, trailing in marks[index:month]:
        days = [int(n) for n in re.findall(r'\d+', core)]
        if days and not all(1 <= d <= 31 for d in days):
            return None
        if days:
            for n, day in enumerate(days):
                said += (['to'] if n else []) + ['the'] + english_ordinal(day)
        else:
            said.append('to' if core in ('–', '-', '—', 'through') else core)
        said[-1] += trailing  # "3, 5 and 7 May": the pause stays
    return month - index + 1, said + ['of', marks[month][1]]


def english(marks, index):
    """(tokens used, words, None) of what an English voice is told at ``index``: a number, a date, an hour, an amount
    with its unit or currency, a version in English words; thousands written apart ("94 600") joined; "/" between
    amounts "of". None for any other word."""
    _, core, trailing = marks[index]
    before = marks[index - 1][1].lower() if index else ''
    if core == '/' and 0 < index < len(marks) - 1 and all(AMOUNT.fullmatch(marks[i][1]) for i in (index - 1, index + 1)):
        return 1, ['of'], None
    if not re.search(r'\d', core):
        return None
    money = re.fullmatch(r'([$€£])(\d[\d,]*(?:\.\d+)?)', core)
    if money:
        said = english_number(money.group(2))
        return 1, said + [CURRENCY[money.group(1)][0 if said == ['one'] else 1]], None
    match = TIME.fullmatch(core)
    if match:
        hour, minutes = int(match.group(1)), match.group(2)
        tail = ["o'clock"] if minutes == '00' else (['oh'] if minutes[0] == '0' else []) + english_cardinal(int(minutes))
        return 1, english_cardinal(hour) + tail, None
    if VERSION.fullmatch(core) or re.fullmatch(r'\d+\.\d+', core) and index and (
            before in ('version', 'v') or marks[index - 1][1].isupper()):
        said = ['version'] if core.startswith('v') and before != 'version' else []
        for n, part in enumerate(core.lstrip('v').split('.')):
            said += (['point'] if n else []) + english_cardinal(int(part))
        return 1, said, None
    parts = re.split(r'([/×–—-])', core)
    if len(parts) == 3 and parts[0] and parts[2]:
        left, sign, right = parts
        if sign in '/×' and all(AMOUNT.fullmatch(p) for p in (left, right)):
            words = [english_amount(*AMOUNT.fullmatch(p).groups()) for p in (left, right)]
            return 1, words[0] + ['of' if sign == '/' else 'by'] + words[1], None
        if sign in '–—-' and left.isdigit() and right.isdigit():
            if english_month(marks, index, -1) is not None:  # "October 14–20"
                return 1, english_ordinal(int(left)) + ['to'] + english_ordinal(int(right)), None
            dated = english_date(marks, index)
            if dated:
                return dated[0], dated[1], None
            return 1, english_cardinal(int(left)) + ['to'] + english_cardinal(int(right)), None
        return None
    match = AMOUNT.fullmatch(core)
    if not match:
        return None
    sign, digits, unit = match.groups()
    size = 1
    if not unit and re.fullmatch(r'\d{1,3}', digits):  # "94 600"
        while not trailing and index + size < len(marks) and not marks[index + size][0]:
            group = re.fullmatch(r'(\d{3})' + UNIT + '?', marks[index + size][1])
            if not group:
                break
            digits, unit, trailing = digits + ',' + group.group(1), group.group(2), marks[index + size][2]
            size += 1
            if unit:
                break
    if not unit and not trailing and index + size < len(marks) and not marks[index + size][0] \
            and marks[index + size][1] in ENGLISH_UNITS:
        unit = marks[index + size][1]
        size += 1
    if size == 1 and not sign and not unit and digits.isdigit():
        value = int(digits)
        if 1 <= value <= 31 and english_month(marks, index, -1) is not None:
            return 1, english_ordinal(value), None  # "October 14"
        dated = english_date(marks, index) if 1 <= value <= 31 else None
        if dated:
            return dated[0], dated[1], None
        if len(digits) == 4 and 1900 <= value <= 2099:
            return 1, english_year(value), None
    return size, english_amount(sign, digits, unit), None


def english_amount(sign, digits, unit=None):
    """A written number with its sign and unit in English words ("+5 pp" -> "plus five percentage points")."""
    said = {'+': ['plus'], '-': ['minus'], '−': ['minus']}.get(sign, []) + english_number(digits)
    if unit in ENGLISH_UNITS:
        said += ENGLISH_UNITS[unit][0 if said[-1:] == ['one'] and not sign else 1].split()
    elif unit:
        said.append(unit)
    return said


def split_token(token):
    """(core, trailing punctuation) of a whitespace token."""
    match = re.match(r'^(.*?)([.,;:!?…"”»)]*)$', token)
    return match.group(1), match.group(2)


def marks_of(token):
    """(leading quotes, core, trailing punctuation) of a whitespace token."""
    lead, rest = LEADING.match(token).groups()
    return (lead,) + split_token(rest)


def term(marks, index, entries):
    """(tokens used, spoken words, key) of the longest lexicon term at ``index``, or None."""
    for key_words, spoken_words, key in entries:
        size = len(key_words)
        window = marks[index:index + size]
        if len(window) < size or any(m[2] for m in window[:-1]) or any(m[0] for m in window[1:]):
            continue  # punctuation inside a multi-word term: not this term
        cores = [m[1] for m in window]
        if cores[:-1] != key_words[:-1]:
            continue
        last, ending = cores[-1], ''
        if last != key_words[-1]:
            if size == 1 and last.startswith(key_words[-1]) and ENDING.fullmatch(last[len(key_words[-1]):]):
                ending = last[len(key_words[-1]):].lstrip('-')
            else:
                continue
        return size, spoken_words[:-1] + [spoken_words[-1] + ending], key
    return None


def speakable(text, lexicon, language='pl'):
    """Spoken text and units ``(written tokens, spoken tokens, lexicon key or None)`` for ``text``: lexicon terms
    respelled, then (``language`` 'pl') numbers, units, dates, hours, versions and abbreviations said in Polish words,
    or ('en') units written onto numbers said in English words.

    Whitespace between untouched words is kept, so a text with nothing to say differently is sent unchanged.
    """
    parts = re.split(r'(\s+)', text)
    lead = parts[0] if parts and not parts[0].strip() else ''
    parts = parts[1:] if lead else parts
    tokens = parts[0::2]
    gaps = parts[1::2] + [''] * (len(tokens) - len(parts[1::2]))
    if tokens and tokens[-1] == '':
        tokens, gaps = tokens[:-1], gaps[:-1]
        gaps[-1:] = [gaps[-1] if gaps else '']
    entries = sorted(((key.split(), value.split(), key) for key, value in lexicon.items()),
                     key=lambda entry: -len(entry[0]))
    marks = [marks_of(token) for token in tokens]
    units, out, index = [], [lead], 0
    while index < len(tokens):
        found = term(marks, index, entries) or (english if language == 'en' else said_for)(marks, index)
        if found:  # the written token's quotes and punctuation stay around the words said for it
            size, spoken, key = found
            spoken = [marks[index][0] + spoken[0]] + spoken[1:]
            spoken[-1] += marks[index + size - 1][2]
        else:
            size, spoken, key = 1, [tokens[index]], None
        units.append((tokens[index:index + size], spoken, key))
        out += [' '.join(spoken), gaps[index + size - 1]]
        index += size
    return ''.join(out), units


def align(words, events, mismatches=None):
    """One timing per spoken word. Where the voice read a stretch differently from the text (a number, a symbol, an
    abbreviation), that stretch's timings are spread evenly over its words and the words go to ``mismatches``."""
    lexical = lambda value: ''.join(c for c in value if c.isalnum()).casefold()
    if words and not events:
        raise ValueError('provider_returned_no_word_timings')
    timed = [None] * len(words)
    opcodes = difflib.SequenceMatcher(a=[lexical(w) for w in words], b=[lexical(e['text']) for e in events],
                                      autojunk=False).get_opcodes()
    for tag, i1, i2, j1, j2 in opcodes:
        if tag == 'equal':
            timed[i1:i2] = events[j1:j2]
            continue
        if i2 == i1:
            continue  # the voice said something the text does not have: its time stays between the neighbours
        if mismatches is not None:
            mismatches.append(' '.join(words[i1:i2]))
        if j2 > j1:
            start, end = events[j1]['offset'], events[j2 - 1]['offset'] + events[j2 - 1]['duration']
        else:  # words the voice merged into a neighbour: a short slot where the previous word ends
            before = timed[i1 - 1] if i1 else None
            start = end = before['offset'] + before['duration'] if before else events[min(j1, len(events) - 1)]['offset']
        share = (end - start) / (i2 - i1)
        timed[i1:i2] = [{'type': 'WordBoundary', 'offset': int(start + k * share), 'duration': int(share), 'text': words[i1 + k]}
                        for k in range(i2 - i1)]
    return timed


def written_events(units, events, mismatches=None):
    """Word events for the written words: spoken timings, written text (terms spread over their span)."""
    spoken_words = [(w, i) for i, (_, spoken, _) in enumerate(units) for w in spoken if any(c.isalnum() for c in w)]
    by_unit = {}
    for (_, unit), event in zip(spoken_words, align([w for w, _ in spoken_words], events, mismatches)):
        by_unit.setdefault(unit, []).append(event)
    out = []
    for index, (written, _, _) in enumerate(units):
        group = by_unit.get(index, [])
        words = [w for w in written if any(c.isalnum() for c in w)]
        if not words:  # a standalone dash or quote stays with the previous caption word
            if not out:
                raise ValueError('unsupported_leading_punctuation')
            out[-1]['text'] += ' ' + ' '.join(written)
            continue
        if not group:
            continue
        if len(words) == len(group):
            out += [dict(event, text=word) for word, event in zip(words, group)]
            continue
        start = group[0]['offset']
        end = group[-1]['offset'] + group[-1]['duration']
        share = (end - start) / len(words)
        out += [dict(group[0], text=word, offset=int(start + k * share), duration=int(share)) for k, word in enumerate(words)]
    return out


def used_terms(units):
    """The lexicon terms a text used."""
    return sorted({key for _, _, key in units if key})
