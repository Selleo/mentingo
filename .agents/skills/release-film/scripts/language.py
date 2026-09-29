"""The film's language: Polish or English.

The project's add-on names it (``"language": "pl"`` or ``"en"``); without it, the release's own texts decide (its
pull requests and notes: Polish when they are written in Polish, else English). `start` keeps it in the run's
sources.json (``language``), so every step tells the film in it: the narration the models write (the prompts take the
fragments below), the lines the film adds, the page, the captions and the voice. A run from before has none: Polish.
"""
import re

LANGUAGES = ('pl', 'en')
DEFAULT = 'pl'
TEXTS = {
    'pl': {
        'name': 'Polish',
        'code': 'pl',
        'edge_voice': 'pl-PL-MarekNeural',  # Microsoft's free neural narrator (edge-tts)
        # the lines the film adds and the reasons it gives for what it leaves out
        'intro': 'W tym wydaniu {name} pokazujemy najważniejsze nowości.',
        'opener': 'W tym wydaniu',  # only the film's first sentence starts so
        'reopened': 'Teraz',  # what a later sentence starting so starts with instead
        'closing': 'Tyle najważniejszych nowości tego wydania.',
        'label_words': r'nowość|nowe|nowa funkcja|zmiana',  # a sentence opening on a label: "Nowość: …"
        'quotes': ('„', '”'),
        'reloaded': 'Po odświeżeniu strony',
        'another_window': 'Inne konto',
        'keys': {'ArrowDown': 'Strzałka w dół', 'ArrowUp': 'Strzałka w górę', 'ArrowLeft': 'Strzałka w lewo',
                 'ArrowRight': 'Strzałka w prawo', 'Space': 'Spacja', ' ': 'Spacja'},  # a pressed key's badge
        'technical': 'Zmiany techniczne, niewidoczne w interfejsie.',
        'rest': 'Pozostałe zmiany: żaden test ich nie pokazuje.',
        'unreadable': 'Na nagraniu ta zmiana nie była czytelna.',
        'unfilmed': 'Nie udało się nagrać sceny, która pokazuje tę zmianę.',
        'unshown_part': 'Scena tej grupy nie zdołała pokazać tej zmiany.',
        'spare': 'Nie zmieściło się w filmie.',
        # the preview page and the player's subtitles
        'page': {'demo': 'demo wydania', 'summary': 'Zmiany od {base}: {prs} pull requestów, film {seconds:.0f} s.',
                 'chapters': 'Rozdziały',
                 'all': 'Wszystkie zmiany', 'title': 'Tytuł', 'in_film': 'W filmie', 'shown': 'W filmie: ',
                 'not_shown': 'Poza filmem', 'track': 'Polski'},
        # the line VoxCPM2's narrator says once in this language (voice-setup): the reference its films are spoken from
        'narrator': ('W tym wydaniu pokazujemy najważniejsze nowości. Każda zmiana ma swoją krótką scenę, a narrator '
                     'mówi, co się na niej dzieje.'),
        # prompt fragments: the scene brief (gaps.BRIEF)
        'step_title': 'Widok kursanta',
        'first_example': '„Kalendarz pozwala teraz…”',
        'label_example': '„Nowość:”',
        'variety': 'at most one „widać” or „widzimy”, no „od razu”, never „W tym wydaniu”',
        'screen_words': (
            'Say what is on screen in Polish, as a Polish presenter would: a button, field, tab, status or column by what '
            'it is or does („przycisk zapisu”, „kolumna statusu”), a unit in words („godzin”, not „h”); the film\'s '
            'bottom bar shows the exact label. Quote an English label only for a name the viewer must recognise (a '
            'product, a feature or a role with no natural Polish name), at most one short one per sentence, exactly as '
            'shown (a longer message, or a text in a third language, in natural Polish); never a list of labels or '
            'values; no English word outside such a quote and no word-for-word Polish for a label: say what it means (a '
            'counter such as „Done: 3, Pending: 1” is said as what it counts, „trzy gotowe, jedno czeka”; „Spanish” is '
            '„hiszpański”; never copy these examples)'),
        # the chapter writer (editor.CHAPTER)
        'chapter_first': '„Lista zamówień da się teraz filtrować po statusie”',
        'chapter_voice': (
            'plain spoken Polish, present tense, "we" form ("otwieramy", "wybieramy", "zapisujemy"). No test names, ids '
            'or selectors. Say what is on screen in Polish, as a Polish presenter would: a button, field, status or '
            'column by what it is or does („przycisk zapisu”), a unit in words („godzin”, not „h”); the film\'s bottom '
            'bar shows the exact label. Quote an English label only for a name the viewer must recognise (a product, a '
            'feature or a role with no natural Polish name), at most one short one per sentence, exactly as shown; never '
            'list labels or values one after another. Call test data by its role ("kursant", "projekt klienta"), not by '
            'names like „Worker 2 Student E2E”.'),
        'chapter_variety': (
            'at most one „widać” or „widzimy” in the chapter and no „od razu”; say what happens or what the user gets '
            '("lista pokazuje…", "system odrzuca…", "pojawia się…")'),
        'click_examples': '("klikamy „Cancel”", "logujemy się jako administrator")',
        'chapter_quotes': (
            'A quoted name stays short (a few words) in its on-screen language; say a longer message, and any text in a '
            'third language, in natural Polish ("ostrzeżenie o niezapisanych zmianach", "interfejs po francusku"). No '
            'English word outside a quoted name, no calques or false friends ("Expertise" is "specjalizacja", not '
            '"ekspertyza"; a counter such as "Done: 3, Pending: 1" is said as what it counts, "trzy gotowe, jedno '
            'czeka"; never copy these examples).'),
        # the left-out grouping and the labels (editor.LEFT_OUT, editor.LABELS)
        'reason_examples': '„poprawki wyglądu, trudne do pokazania w krótkim filmie”, „zmiany w panelu administracyjnym”',
        'label_examples': ('"Filtrujemy zamówienia po statusie „Wysłane”", "Zapisana faktura pokazuje teraz termin płatności", '
                           '"Po ponownym otwarciu notatka nadal jest na liście"'),
        'label_quotes': ('Keep product names as the sentence writes them; an interface label the sentence says in Polish '
                         'may be quoted exactly as the screen shows it (its "on screen" text), so the viewer finds it.'),
        # the claim check (review.CHECK)
        'result_examples': '"znika" or "zapisuje się"',
        'change_example': '„listę da się teraz filtrować po statusie”',
        'no_fillers': 'never starts with „Widać” or „Widzimy” and has no „od razu”',
        'review_language': (
            'when a sentence\'s Polish is unnatural (a calque such as „jedno ukończone” for "Done: 1", an English word '
            'outside a quoted name, an English button, field or status label quoted where plain Polish says it: the '
            'film\'s bottom bar shows the label; a grammar slip), add a line for it: the problem „Polish” and the sentence '
            'in natural Polish.'),
    },
    'en': {
        'name': 'English',
        'code': 'en',
        'edge_voice': 'en-US-GuyNeural',  # Marek's English counterpart: the same generation, no word misheard
        'intro': 'In this release of {name}, we show the key new features.',
        'opener': 'In this release',
        'reopened': 'Now',
        'closing': 'That is all for the key new features of this release.',
        'label_words': r'new|new feature|change|update',
        'quotes': ('“', '”'),
        'reloaded': 'After a page reload',
        'another_window': 'Another account',
        'keys': {'ArrowDown': 'Down arrow', 'ArrowUp': 'Up arrow', 'ArrowLeft': 'Left arrow', 'ArrowRight': 'Right arrow',
                 ' ': 'Space'},
        'technical': 'Technical changes, not visible in the interface.',
        'rest': 'Other changes: no test shows them.',
        'unreadable': 'This change was not readable in the recording.',
        'unfilmed': 'The scene that shows this change could not be recorded.',
        'unshown_part': "This group's scene could not show this change.",
        'spare': 'There was no room for it in the film.',
        'page': {'demo': 'release demo', 'summary': 'Changes since {base}: {prs} pull requests, a {seconds:.0f}-second film.',
                 'chapters': 'Chapters', 'all': 'All changes', 'title': 'Title', 'in_film': 'In the film',
                 'shown': 'In the film: ', 'not_shown': 'Not in the film', 'track': 'English'},
        'narrator': ('This release brings the key new features. Each change gets a short scene of its own, and the '
                     'narrator says what happens on screen.'),
        'step_title': 'Learner view',
        'first_example': '"The calendar now lets you…"',
        'label_example': '"New:"',
        'variety': 'at most one "we can see" or "you can see", no "right away", never "In this release"',
        'screen_words': (
            'Quote at most one short visible label per sentence, exactly as shown (a longer message, or a text in '
            'another language, in plain English), never a list of labels or values; say what a label means rather '
            'than reading it out (a counter such as "Done: 3, Pending: 1" is said as what it counts, "three done, one '
            'pending"; never copy these examples)'),
        'chapter_first': '"The order list can now be filtered by status"',
        'chapter_voice': (
            'plain spoken English, present tense, "we" form ("we open", "we choose", "we save"). No test names, ids or '
            'selectors. Quote at most one short on-screen label per sentence, exactly as shown ("Save"), and say the '
            'rest in plain words: never list labels or values one after another. Call test data by its role ("a '
            'learner", "a client project"), not by names like "Worker 2 Student E2E".'),
        'chapter_variety': (
            'at most one "we can see" or "you can see" in the chapter and no "right away"; say what happens or what the '
            'user gets ("the list shows…", "the system rejects…", "… appears")'),
        'click_examples': '("we click Cancel", "we log in as an administrator")',
        'chapter_quotes': (
            'A quoted label stays short (a few words); say a longer message, and any text in another language, in plain '
            'English ("a warning about unsaved changes", "the interface in French"). Say what a label means rather '
            'than reading it out (a counter such as "Done: 3, Pending: 1" is said as what it counts, "three done, one '
            'pending"; never copy these examples).'),
        'reason_examples': '"layout fixes, hard to show in a short film", "changes in the admin panel"',
        'label_examples': ('"We filter the orders by the status “Shipped”", "The saved invoice now shows its due date", '
                           '"After reopening, the note is still on the list"'),
        'label_quotes': ('Keep product names as the sentence writes them; quote an interface label exactly as the '
                         'screen shows it (its "on screen" text) when that helps the viewer find it.'),
        'result_examples': '"disappears" or "is saved"',
        'change_example': '"the list can now be filtered by status"',
        'no_fillers': 'never starts with "We can see" or "You can see" and has no "right away"',
        'review_language': (
            'when a sentence\'s English is unnatural (a label read out word for word, a grammar slip), add a line for it: '
            'the problem "language" and the sentence in natural English.'),
    },
}
# the release's own texts: words only one of the two languages writes this often
POLISH = re.compile(r'\b(się|nie|jest|oraz|dla|przez|który|która|które|tylko|teraz|dodaj|dodanie|popraw|poprawka|'
                    r'zmiana|zmiany|użytkownik|użytkownika|widok|ekran|przycisk)\b|[ąćęłńśźż]', re.I)
ENGLISH = re.compile(r'\b(the|and|to|of|for|is|with|on|add|adds|fix|fixes|now|when|from|this|that|are|be|an|it)\b', re.I)


def texts(sources_or_code=None):
    """The table of the film's language: a code, or the run's sources (their ``language``; Polish without one)."""
    code = sources_or_code.get('language') if isinstance(sources_or_code, dict) else sources_or_code
    return TEXTS[code if code in TEXTS else DEFAULT]


def detect(sources):
    """'pl' when the release's texts (its notes, its pull requests' titles and bodies) are Polish, else 'en';
    None without any text."""
    release = sources.get('release') or {}
    text = ' '.join([release.get('name') or '', release.get('body') or ''] +
                    [f"{pr.get('title') or ''} {(pr.get('body') or '')[:1500]}" for pr in sources.get('prs') or []])
    polish, english = len(POLISH.findall(text)), len(ENGLISH.findall(text))
    if not polish and not english:
        return None
    return 'pl' if polish > english else 'en'


def choose(addon, sources):
    """The film's language: the add-on's ``language`` when it names one, else what the release's texts are written in
    (Polish without any)."""
    named = (addon or {}).get('language')
    if named is not None and named not in LANGUAGES:
        raise SystemExit(f'the add-on\'s "language" must be one of {", ".join(LANGUAGES)}, not {named!r}')
    return named or detect(sources) or DEFAULT
