#!/usr/bin/env python3
"""Private durable build snapshots through the runner's existing AWS CLI.

The configured S3-compatible prefix is exclusive to this workflow. Whole-workflow
concurrency serializes its writers. Immutable checksum-addressed archives are put
before their pointer; a failed upload leaves the previous snapshot readable.
Only generated media, captions and state are archived, never checkouts or logs.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import tempfile
from urllib.parse import urlsplit

import core

MAX_BYTES = 30 * 1024**3
EXTENSIONS = {'.mp4', '.mp3', '.srt', '.vtt', '.json', '.jpg', '.txt'}
CAPTURE_ENTRY = re.compile(r'captures/[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*/[a-f0-9]{64}/'
                          r'(?:capture-bundle\.json|take\.mp4|capture\.json|actions\.json|page-log\.json|story-en\.json|'
                          r'stills/\d+\.(?:jpg|jpeg|png)|documents/\d+\.(?:pdf|page1\.png)|specs/\d+\.md)\Z')


def allowed_artifact(name):
    path = PurePosixPath(name)
    if name == 'state.json':
        return True
    if not path.parts:
        return False
    if path.parts[0] == 'captures':
        return bool(CAPTURE_ENTRY.fullmatch(name))
    return path.parts[0] in ('segments', 'bundles') and path.suffix in EXTENSIONS


def location(value):
    """Validate an object prefix, rejecting ambiguous paths and URL credentials."""
    parts = urlsplit(value)
    if (parts.scheme != 's3' or not parts.netloc or parts.username or parts.password or
            parts.query or parts.fragment or not parts.path.strip('/') or
            any(v in ('', '.', '..') for v in parts.path.strip('/').split('/'))):
        raise ValueError('HELPDESK_BUILD_S3_URI must be an s3://bucket/private-prefix URL')
    return parts.netloc, parts.path.strip('/')


def aws(arguments, missing_ok=False, namespace='s3api'):
    """Run storage control commands without exposing provider responses or credentials."""
    environment = dict(os.environ)
    if not environment.get('AWS_ENDPOINT_URL'):
        environment.pop('AWS_ENDPOINT_URL', None)
    result = subprocess.run(['aws', namespace, *arguments], capture_output=True, text=True, timeout=3600, env=environment)
    if result.returncode:
        if missing_ok and ('NoSuchKey' in result.stderr or '(404)' in result.stderr):
            return False
        raise RuntimeError('Private build storage request failed; check access and endpoint configuration')
    return True


def file_hash(path):
    value = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def extract(archive, out):
    """Extract a bounded plain-file snapshot without links, traversal or overwrite."""
    out = Path(out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if any(out.iterdir()):
        raise ValueError('Restore requires an empty build-cache directory')
    with tarfile.open(archive, 'r:') as source:
        members = source.getmembers()
        total = 0
        seen = set()
        for member in members:
            path = PurePosixPath(member.name)
            if (path.is_absolute() or '..' in path.parts or member.name in seen or
                    not member.isfile() or not path.parts or
                    not allowed_artifact(member.name) or '\\' in member.name):
                raise ValueError('Invalid private build archive entry')
            total += member.size
            seen.add(member.name)
            if member.size < 0 or total > MAX_BYTES:
                raise ValueError('Private build snapshot exceeds its size limit')
        for member in members:
            target = out / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            stream = source.extractfile(member)
            if stream is None:
                raise ValueError('Unreadable private archive entry')
            with target.open('xb') as destination:
                import shutil
                shutil.copyfileobj(stream, destination, 1024 * 1024)
            target.chmod(0o600)
    if not (out / 'state.json').is_file():
        raise ValueError('Snapshot has no build state')
    snapshot_files(out)


def snapshot_files(cache):
    """Only current reusable segments and a pending publication bundle are retained."""
    cache = Path(cache).resolve()
    state = core.load(cache / 'state.json')
    if not state or state.get('schemaVersion') != 1:
        raise ValueError('No valid build checkpoint to retain')
    parents = set()
    for language in state.get('languages', {}).values():
        for domain in language.get('domains', {}).values():
            for flow in domain.get('flows', {}).values():
                parents.add(Path(flow['segment']['path']).parent)
    pending = state.get('pendingBundle')
    if pending:
        parents.add(Path(pending))
    files = {cache / 'state.json'}
    # Captures have an exact immutable manifest allowlist. Never recursively copy
    # their worker folders, logs, checkouts or unreferenced raw recordings.
    for domain in state.get('captures', {}).get('domains', {}).values():
        for flow in domain.get('flows', {}).values():
            reference = flow.get('capture')
            if not reference:
                continue
            path = cache / reference['path']
            if (not allowed_artifact(reference['path']) or path.is_symlink() or not path.is_file()
                    or not path.resolve().is_relative_to(cache) or file_hash(path) != reference['sha256']):
                raise ValueError('Invalid or damaged shared raw capture reference')
            manifest = core.load(path)
            identity = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
            if manifest.get('schemaVersion') != 1 or reference.get('id') != identity or not isinstance(manifest.get('files'), dict):
                raise ValueError('Invalid shared raw capture manifest')
            files.add(path)
            for relative, checksum in manifest['files'].items():
                artifact = path.parent / relative
                name = str(artifact.relative_to(cache))
                if (not allowed_artifact(name) or artifact.is_symlink() or not artifact.is_file()
                        or not artifact.resolve().is_relative_to(path.parent) or file_hash(artifact) != checksum):
                    raise ValueError('Missing or damaged portable capture dependency')
                files.add(artifact)
    for parent in parents:
        target = cache / parent
        if parent.is_absolute() or not target.resolve().is_relative_to(cache) or target.is_symlink() or not target.is_dir():
            raise ValueError('Unsafe artifact path in build state')
        files.update(target.rglob('*'))
    checked = []
    for path in sorted(files):
        if path.is_symlink():
            raise ValueError('Build artifacts cannot contain symbolic links')
        if path.is_file():
            rel = path.relative_to(cache)
            if not allowed_artifact(str(rel)):
                raise ValueError('Unexpected file in private build artifacts')
            checked.append(path)
    if sum(p.stat().st_size for p in checked) > MAX_BYTES:
        raise ValueError('Private build snapshot exceeds its size limit')
    return checked


def pull(uri, cache):
    bucket, prefix = location(uri)
    with tempfile.TemporaryDirectory() as scratch:
        pointer = Path(scratch) / 'pointer.json'
        if not aws(['get-object', '--bucket', bucket, '--key', prefix + '/latest.json', str(pointer)], missing_ok=True):
            Path(cache).mkdir(parents=True, exist_ok=True)
            core.save(Path(cache) / 'state.json', {'schemaVersion': 1, 'languages': {}, 'published': {}, 'publications': {}}, mode=0o600)
            return {'restored': False}
        data = json.loads(pointer.read_text())
        if (data.get('schemaVersion') != 1 or not re.fullmatch(r'snapshots/[a-f0-9]{64}\.tar', data.get('object', '')) or
                not re.fullmatch(r'[a-f0-9]{64}', data.get('sha256', ''))):
            raise ValueError('Invalid build snapshot pointer')
        archive = Path(scratch) / 'snapshot.tar'
        aws(['get-object', '--bucket', bucket, '--key', prefix + '/' + data['object'], str(archive)])
        if file_hash(archive) != data['sha256']:
            raise ValueError('Private build archive checksum mismatch')
        extract(archive, cache)
        return {'restored': True}


def push(uri, cache):
    bucket, prefix = location(uri)
    cache = Path(cache).resolve()
    files = snapshot_files(cache)
    with tempfile.TemporaryDirectory() as scratch:
        archive = Path(scratch) / 'snapshot.tar'
        with tarfile.open(archive, 'w:') as target:
            for path in files:
                target.add(path, arcname=str(path.relative_to(cache)), recursive=False)
        checksum = file_hash(archive)
        name = 'snapshots/' + checksum + '.tar'
        # aws s3 cp uses multipart upload for archives above the single-PUT limit.
        aws(['cp', str(archive), f's3://{bucket}/{prefix}/{name}', '--only-show-errors'], namespace='s3')
        pointer = Path(scratch) / 'pointer.json'
        pointer.write_text(json.dumps({'schemaVersion': 1, 'object': name, 'sha256': checksum}))
        aws(['put-object', '--bucket', bucket, '--key', prefix + '/latest.json', '--body', str(pointer), '--content-type', 'application/json'])
    return {'saved': True, 'files': len(files)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('pull', 'push'))
    parser.add_argument('--uri', required=True)
    parser.add_argument('--cache', required=True)
    args = parser.parse_args()
    try:
        result = pull(args.uri, args.cache) if args.command == 'pull' else push(args.uri, args.cache)
        print(json.dumps(result))
    except (ValueError, RuntimeError) as error:
        print(json.dumps({'ok': False, 'error': str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
