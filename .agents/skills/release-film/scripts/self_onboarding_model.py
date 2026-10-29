"""Strict parsing of model JSON with optional Markdown presentation fences."""
import json
import os
import re


FENCED_JSON = re.compile(r'```(?:json)?[ \t]*\r?\n(.*?)\r?\n```', re.DOTALL | re.IGNORECASE)


def provider_failure(usage):
    """A bounded provider error, with configured credentials removed before logging."""
    reason = usage.get('fallback') or 'The model returned no text response'
    reason = str(reason)
    values = {value for name, value in os.environ.items() if len(value) >= 8 and
              any(marker in name.upper() for marker in ('TOKEN', 'SECRET', 'PASSWORD', 'API_KEY'))}
    for secret in sorted(values, key=len, reverse=True):
        reason = reason.replace(secret, '***')
    reason = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', reason)
    return ' '.join(reason.split())[:700]


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
