"""Resolve cached role labels from the recording checkout's own UI translations."""
import json
from pathlib import Path
import re

import knowledge


def _strings(value, prefix=''):
    if not isinstance(value, dict):
        return
    for key, child in value.items():
        path = f'{prefix}.{key}' if prefix else key
        if isinstance(child, str):
            yield path, child
        else:
            yield from _strings(child, path)


def localized_role_labels(source, checkout, code):
    """Translate only literal getByRole names with unambiguous, existing UI keys.

    Dynamic expressions, fuzzy regexes, test data and unknown labels stay intact.
    The real localized browser replay still verifies every action and its result.
    No model call or inferred translation is involved.
    """
    if code == 'en':
        return source
    locales = Path(checkout) / 'apps/web/app/locales'
    paths = [locales / language / 'translation.json' for language in ('en', code)]
    if not all(path.is_file() for path in paths):
        return source
    english, translated = [dict(_strings(json.loads(path.read_text(encoding='utf-8')))) for path in paths]
    candidates = {}
    for key, label in english.items():
        # A duplicated English label must resolve identically at every key.
        candidates.setdefault(label, set()).add(translated.get(key))
    labels = {label: next(iter(values)) for label, values in candidates.items() if len(values) == 1}
    # Mask comments and strings to locate calls in executable code only. The role
    # argument is masked too; offsets still refer to the original source.
    masked = knowledge._JS_LITERALS.sub(lambda m: re.sub(r'[^\n]', ' ', m.group()), source)
    edits = []
    for call in re.finditer(r'\.\s*getByRole\s*\(\s*[^,(){}]*,\s*\{([^{}]*)\}\s*\)', masked):
        name = re.search(r'\bname\s*:\s*', call.group(1))
        if not name:
            continue
        # Whitespace masking consumed a string literal; locate the original value.
        colon = call.start(1) + name.start() + name.group().index(':') + 1
        start = colon + len(source[colon:]) - len(source[colon:].lstrip())
        token = re.match(r'/([\w ,:\-–—…^$]+)/([i]*)\s*(?=[,}])', source[start:])
        if token:
            pattern, flags = token.group(1, 2)
            left, right = pattern.startswith('^'), pattern.endswith('$')
            label = pattern.removeprefix('^').removesuffix('$')
            if '^' in label or '$' in label:
                continue
        else:
            token = re.match(r'([\'"])([^\\\n]*?)\1(?=\s*[,}])', source[start:])
            if not token:
                continue
            label = token.group(2)
        target = labels.get(label)
        if not target or '{{' in target or '$t(' in target:
            continue
        if token.group()[0] == '/':
            escaped = re.sub(r'([.*+?^${}()|\[\]\\])', r'\\\1', target)
            pattern = ('^' if left else '') + escaped + ('$' if right else '')
            replacement = f'new RegExp({json.dumps(pattern, ensure_ascii=False)}, {json.dumps(flags)})'
            end = start + token.end(2)  # flags end; leave original whitespace intact
        else:
            replacement = json.dumps(target, ensure_ascii=False)
            end = start + token.end()
        edits.append((start, end, replacement))
    for start, end, replacement in reversed(edits):
        source = source[:start] + replacement + source[end:]
    return source
