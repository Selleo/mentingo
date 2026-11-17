"""Publish a checked PR flow video as a native GitHub attachment.

The publishing job supplies trusted repository/PR/head/run identity separately
from the untrusted recording bundle. Only the managed section is replaced, at
the end of the latest PR body. GitHub's REST body update has no compare-and-swap:
a fresh read immediately before PATCH narrows, but cannot eliminate, that race.
No release, Pages site, help catalog, or artifact-player fallback is created.
"""
import argparse
import hashlib
import json
import os
import re
import stat
import string
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

import release_assets

MARK_START = '<!-- pr-flow-video:start -->'
MARK_END = '<!-- pr-flow-video:end -->'
MAX_VIDEO_BYTES = 100 * 1024 * 1024
MAX_MANIFEST_BYTES = 128 * 1024
MAX_BODY_CHARS = 65_536
SHA = re.compile(r'[a-fA-F0-9]{40}')
CHECKSUM = re.compile(r'[a-f0-9]{64}')
REPOSITORY = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,99}/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}')
RUN_ID = re.compile(r'[1-9][0-9]{0,19}')
FLOW_ID = re.compile(r'[a-z0-9][a-z0-9_-]{0,79}')
ATTACHMENT = re.compile(r'https://github\.com/user-attachments/assets/[a-fA-F0-9-]+')


class PublicationError(ValueError):
    """A safe diagnostic suitable for CI, without provider bodies or credentials."""


@dataclass(frozen=True)
class Flow:
    identifier: str
    title: str


@dataclass(frozen=True)
class Bundle:
    video: Path
    checksum: str
    flows: tuple[Flow, ...]


def _require(condition: object, message: str) -> None:
    if not condition:
        raise PublicationError(message)


def _matches(pattern: re.Pattern[str], value: object) -> bool:
    return isinstance(value, str) and pattern.fullmatch(value) is not None


def _open_regular(path: Path, maximum: int) -> BinaryIO:
    """Refuse links/special files before opening, and verify the opened descriptor too."""
    try:
        before = path.lstat()
        _require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1,
                 'Bundle files must be plain regular files, without links')
        descriptor = os.open(path, os.O_RDONLY | os.O_NONBLOCK | getattr(os, 'O_NOFOLLOW', 0))
        opened = os.fdopen(descriptor, 'rb')
        details = os.fstat(opened.fileno())
        if not (stat.S_ISREG(details.st_mode) and details.st_nlink == 1
                and 0 < details.st_size <= maximum
                and (before.st_dev, before.st_ino) == (details.st_dev, details.st_ino)):
            opened.close()
            raise PublicationError('Bundle file is missing, changed, empty, or exceeds its size limit')
        return opened
    except OSError:
        raise PublicationError('Bundle file could not be opened safely') from None


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        _require(key not in result, 'Bundle manifest has duplicate fields')
        result[key] = value
    return result


def _manifest(path: Path) -> dict[str, object]:
    try:
        with _open_regular(path, MAX_MANIFEST_BYTES) as stream:
            raw = stream.read(MAX_MANIFEST_BYTES + 1)
        _require(len(raw) <= MAX_MANIFEST_BYTES, 'Bundle manifest exceeds its size limit')
        manifest = json.loads(raw, object_pairs_hook=_unique_object,
                              parse_constant=_invalid_constant)
    except (UnicodeError, json.JSONDecodeError, RecursionError):
        raise PublicationError('Bundle manifest is not valid bounded JSON') from None
    _require(isinstance(manifest, dict), 'Bundle manifest must be an object')
    return manifest


def _invalid_constant(_value: str) -> None:
    raise PublicationError('Bundle manifest contains a non-JSON number')


def _bundle(folder: Path, repository: str, number: int, head_sha: str,
            run_id: str, snapshot: Path) -> Bundle:
    _require(folder.is_dir() and not folder.is_symlink(), 'Bundle must be a plain directory')
    manifest = _manifest(folder / 'pr-video.json')
    _require(set(manifest) == {'schemaVersion', 'repository', 'number', 'headSha', 'baseSha',
                               'workflowRunId', 'video', 'flows'}, 'Unexpected bundle manifest fields')
    _require(type(manifest['schemaVersion']) is int and manifest['schemaVersion'] == 1,
             'Unsupported bundle schema version')
    _require(manifest['repository'] == repository and type(manifest['number']) is int
             and manifest['number'] == number and manifest['headSha'] == head_sha
             and manifest['workflowRunId'] == run_id, 'Bundle identity does not match the publishing job')
    _require(_matches(SHA, manifest['baseSha']), 'Bundle base SHA must be a full commit SHA')

    video = manifest['video']
    _require(isinstance(video, dict) and set(video) == {'path', 'sha256', 'sizeBytes'},
             'Malformed video metadata')
    _require(video['path'] == 'video.mp4', 'Bundle video path must be video.mp4')
    _require(_matches(CHECKSUM, video['sha256']), 'Video checksum must be SHA256')
    _require(type(video['sizeBytes']) is int and 16 <= video['sizeBytes'] <= MAX_VIDEO_BYTES,
             'Video size must be between 16 bytes and 100 MiB')

    rows = manifest['flows']
    _require(isinstance(rows, list) and 1 <= len(rows) <= 4, 'Provide between one and four flows')
    flows = []
    for row in rows:
        _require(isinstance(row, dict) and _matches(FLOW_ID, row.get('id')), 'Invalid flow ID')
        title = row.get('title')
        _require(isinstance(title, str) and 0 < len(title) <= 200 and title.strip()
                 and not any(ord(character) < 32 or ord(character) == 127 for character in title),
                 'Flow title must be bounded single-line text')
        flows.append(Flow(row['id'], title))
    _require(len({flow.identifier for flow in flows}) == len(flows), 'Duplicate flow IDs')

    # A private snapshot pins the actual uploaded bytes, even if an artifact file
    # changes after validation. Only this checked MP4 reaches the upload helper.
    digest = hashlib.sha256()
    size = 0
    with _open_regular(folder / 'video.mp4', MAX_VIDEO_BYTES) as source, snapshot.open('xb') as target:
        header = source.read(16)
        _require(len(header) == 16 and header[4:8] == b'ftyp'
                 and 16 <= int.from_bytes(header[:4], 'big') <= video['sizeBytes'],
                 'Bundle video does not have an MP4 file-type header')
        for chunk in _chunks(source, header):
            size += len(chunk)
            _require(size <= MAX_VIDEO_BYTES, 'Video exceeds 100 MiB')
            digest.update(chunk)
            target.write(chunk)
    _require(size == video['sizeBytes'] and digest.hexdigest() == video['sha256'],
             'Video size or checksum does not match its manifest')
    return Bundle(snapshot, digest.hexdigest(), tuple(flows))


def _chunks(source: BinaryIO, header: bytes):
    yield header
    while chunk := source.read(1 << 20):
        yield chunk


def managed_section(body: str) -> str:
    """Reject ambiguous markers rather than risk replacing a person's unrelated text."""
    starts, ends = body.count(MARK_START), body.count(MARK_END)
    _require(starts == ends and starts <= 1, 'PR video section markers are ambiguous')
    if not starts:
        return ''
    start, end = body.index(MARK_START), body.index(MARK_END)
    _require(start < end, 'PR video section markers are out of order')
    return body[start:end + len(MARK_END)]


def _escaped_title(title: str) -> str:
    # Numeric entities keep model-authored punctuation literal, including HTML,
    # Markdown links/images, mentions, and raw URLs. No other model prose is used.
    return ''.join(f'&#{ord(character)};' if character in string.punctuation else character
                   for character in title)


def video_section(head_sha: str, bundle: Bundle, attachment: str) -> str:
    _require(_matches(ATTACHMENT, attachment), 'GitHub returned no valid native video attachment')
    titles = '\n'.join(f'- {_escaped_title(flow.title)}' for flow in bundle.flows)
    return (f'{MARK_START}\n## PR flow video\n\nRecorded at `{head_sha[:12]}`.\n\n{titles}\n\n'
            f'<!-- release-film-video sha256={bundle.checksum} url={attachment} -->\n\n'
            f'{attachment}\n{MARK_END}')


def with_section(body: str, section: str) -> str:
    """Move the owned span to the end without stripping or rewriting outside characters."""
    previous = managed_section(body)
    outside = body.replace(previous, '', 1) if previous else body
    separator = ''
    if outside and not outside.endswith('\n\n'):
        separator = '\n' if outside.endswith('\n') else '\n\n'
    answer = outside + separator + section
    _require(len(answer) <= MAX_BODY_CHARS, 'PR body has no room for the video section')
    return answer


def _gh(*arguments: str, input_text: str | None = None) -> str:
    try:
        return release_assets.gh(*arguments, input_text=input_text)
    except (SystemExit, OSError, subprocess.SubprocessError):
        raise PublicationError('GitHub request failed; the PR video section was not confirmed updated') from None


def _pull(repository: str, number: int) -> dict[str, object]:
    try:
        raw = _gh('api', f'repos/{repository}/pulls/{number}')
        _require(len(raw) <= 2 * 1024 * 1024, 'GitHub returned an oversized PR response')
        pull = json.loads(raw)
    except (json.JSONDecodeError, RecursionError):
        raise PublicationError('GitHub returned an invalid PR response') from None
    _require(isinstance(pull, dict) and type(pull.get('number')) is int and pull['number'] == number,
             'GitHub returned a different PR')
    _require(pull.get('state') in ('open', 'closed') and type(pull.get('draft')) is bool,
             'GitHub returned invalid PR state')
    body = pull.get('body')
    _require(body is None or isinstance(body, str) and len(body) <= MAX_BODY_CHARS,
             'GitHub returned an invalid PR body')
    head = pull.get('head')
    _require(isinstance(head, dict) and _matches(SHA, head.get('sha')), 'GitHub returned an invalid PR head')
    return pull


def _skip_reason(pull: dict[str, object], repository: str, head_sha: str) -> str | None:
    if pull['state'] != 'open':
        return 'closed'
    if pull['draft']:
        return 'draft'
    head = pull['head']
    head_repository = head.get('repo')
    if not isinstance(head_repository, dict) or not isinstance(head_repository.get('full_name'), str) \
            or head_repository['full_name'].casefold() != repository.casefold():
        return 'fork'
    if head['sha'].lower() != head_sha.lower():
        return 'stale'
    return None


def publish(folder: str | Path, repository: str, number: int, head_sha: str, run_id: str) -> dict[str, object]:
    """Validate immutable bundle identity, upload/reuse once, then update a fresh eligible PR body."""
    _require(_matches(REPOSITORY, repository) and type(number) is int and number > 0
             and _matches(SHA, head_sha) and _matches(RUN_ID, run_id), 'Invalid publishing job identity')
    identity = {'repository': repository, 'number': number, 'headSha': head_sha}
    with tempfile.TemporaryDirectory(prefix='pr-video-publish-') as temporary:
        bundle = _bundle(Path(folder), repository, number, head_sha, run_id, Path(temporary) / 'video.mp4')
        current = _pull(repository, number)
        reason = _skip_reason(current, repository, head_sha)
        if reason:
            return {**identity, 'status': 'skipped', 'reason': reason}
        previous = managed_section(current.get('body') or '')
        try:
            attachment = release_assets.upload_video(bundle.video, repository, previous, bundle.checksum)
        except (OSError, ValueError, TypeError, KeyError, RuntimeError, subprocess.SubprocessError, SystemExit) as error:
            # Retain only the status, never gh stderr or a provider response body.
            # This distinguishes rejected credentials from network/format failures.
            status = re.search(r'\bHTTP ([1-5][0-9]{2})\b', str(error))
            suffix = f' (HTTP {status[1]})' if status else ''
            raise PublicationError(
                'Native GitHub video upload failed' + suffix + '; the existing PR section was preserved'
            ) from None
        section = video_section(head_sha, bundle, attachment)

        latest = _pull(repository, number)
        reason = _skip_reason(latest, repository, head_sha)
        if reason:
            return {**identity, 'status': 'skipped', 'reason': reason}
        body = latest.get('body') or ''
        updated = with_section(body, section)
        if updated == body:
            return {**identity, 'status': 'unchanged'}
        _gh('api', '--method', 'PATCH', f'repos/{repository}/pulls/{number}', '--input', '-',
            input_text=json.dumps({'body': updated}, ensure_ascii=False))
        return {**identity, 'status': 'published'}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--repository', required=True)
    parser.add_argument('--number', type=int, required=True)
    parser.add_argument('--head-sha', required=True)
    parser.add_argument('--run-id', required=True)
    arguments = parser.parse_args()
    try:
        result = publish(arguments.bundle, arguments.repository, arguments.number,
                         arguments.head_sha, arguments.run_id)
    except PublicationError as failed:
        # Every PublicationError is fixed diagnostic text, never provider/artifact values.
        raise SystemExit(f'::error::{failed}') from None
    except OSError:
        raise SystemExit('::error::PR video bundle could not be read or staged') from None
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
