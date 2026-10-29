"""Strict parsing of model JSON with optional Markdown presentation fences."""
import json
import re


FENCED_JSON = re.compile(r'```(?:json)?[ \t]*\r?\n(.*?)\r?\n```', re.DOTALL | re.IGNORECASE)


def json_object(text, label):
    """Accept one object, optionally fenced; never guess at JSON embedded in prose."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError(f'{label} returned an empty response')
    content = text.strip().removeprefix('\ufeff').strip()
    fenced = FENCED_JSON.fullmatch(content)
    if fenced:
        content = fenced.group(1).strip()
    try:
        value = json.loads(content)
    except json.JSONDecodeError as error:
        # Report format/location, never echo model output or provider credentials.
        raise ValueError(f'{label} returned invalid JSON at line {error.lineno}, column {error.colno}; '
                         'expected one JSON object, optionally in a json code block') from None
    if not isinstance(value, dict):
        raise ValueError(f'{label} must return a JSON object')
    return value
