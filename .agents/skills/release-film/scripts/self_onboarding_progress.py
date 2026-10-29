"""Export partial Self-onboarding media for review without private build or browser state."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

import self_onboarding_diagnostics


MEDIA = {'.mp4', '.mp3', '.wav', '.png', '.jpg', '.jpeg'}
TEXT = {'.srt', '.vtt'}
RUN_FOLDERS = ('captures', 'gaps', 'rendered', 'voice', 'localized', 'review')
CACHE_FOLDERS = ('captures', 'segments', 'bundles')
EXCLUDED = {'checkout', 'node_modules', '.git', 'toolchain', 'fixtures', 'fixture', '.release-film'}
SECRET_NAMES = ('CLAUDE_CODE_OAUTH_TOKEN', 'ELEVENLABS_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN',
                'GUIDE_PUBLISH_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
                'ACTIONS_RUNTIME_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN')
MAX_TEXT_BYTES = 4 * 1024 * 1024


def _plain(path, root):
    """Only files under a real source directory; never follow any nested symlink."""
    if not path.is_file() or not path.resolve().is_relative_to(root):
        return False
    return not any(parent.is_symlink() for parent in (path, *path.parents) if parent != root.parent)


def _walk(folder, root):
    if not folder.is_dir() or folder.is_symlink() or not folder.resolve().is_relative_to(root):
        return
    for directory, names, files in os.walk(folder, followlinks=False):
        names[:] = sorted(name for name in names if name not in EXCLUDED and not (Path(directory)/name).is_symlink())
        for name in sorted(files):
            path = Path(directory)/name
            if _plain(path, root):
                yield path


def _secrets(run):
    values = {os.environ.get(name) for name in SECRET_NAMES}
    generated = run/'secrets.json'
    if _plain(generated, run):
        data = json.loads(generated.read_text())
        if isinstance(data, dict):
            values.update(value for value in data.values() if isinstance(value, str))
    return sorted((value for value in values if isinstance(value, str) and value), key=len, reverse=True)


def _scrub(value, secrets):
    if isinstance(value, str):
        for secret in secrets:
            value = value.replace(secret, '***')
        return value
    if isinstance(value, list):
        return [_scrub(item, secrets) for item in value]
    if isinstance(value, dict):
        return {_scrub(key, secrets): _scrub(item, secrets) for key, item in value.items()}
    return value


def _digest(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def collect(run, cache, out):
    """Copy generated review media, deduplicating equal content while retaining source aliases."""
    run, cache, out = Path(run), Path(cache), Path(out)
    if any(path.is_symlink() for path in (run, cache, out)):
        raise ValueError('Progress roots must not be symlinks')
    run, cache, out = run.resolve(), cache.resolve(), out.resolve()
    if any(out.is_relative_to(source) or source.is_relative_to(out) for source in (run, cache)):
        raise ValueError('Progress output must be separate from the run and private cache')
    if out.exists() and any(out.iterdir()):
        raise ValueError('Progress output must be empty')
    out.mkdir(parents=True, exist_ok=True)
    secrets = _secrets(run)
    files, by_digest, skipped = [], {}, []

    def export(path, root, scope, *, failure=False):
        suffix = path.suffix.lower()
        timeline = path.name in ('timeline.json', 'claim-review.json', 'flow-failure.json') and not failure
        text = suffix in TEXT or timeline or failure and path.name == 'error-context.md'
        if suffix not in MEDIA and not text:
            return
        # Failure screenshots are the sole exception to excluding checkout data.
        if failure and suffix != '.png' and path.name != 'error-context.md':
            return
        alias = _scrub({'scope': scope, 'path': str(path.relative_to(root))}, secrets)
        relative = Path(scope)/alias['path']
        if text:
            if path.stat().st_size > MAX_TEXT_BYTES:
                skipped.append({'source': alias, 'reason': 'Text exceeds review artifact limit'})
                return
            content = path.read_text(encoding='utf-8', errors='replace')
            if timeline:
                try:
                    value = json.loads(content)
                    if not isinstance(value, dict):
                        raise ValueError('Timeline must be an object')
                    content = json.dumps(_scrub(value, secrets), ensure_ascii=False, indent=2) + '\n'
                except ValueError:
                    skipped.append({'source': alias, 'reason': 'Incomplete timeline JSON'})
                    return
            else:
                content = _scrub(content, secrets)
            encoded = content.encode('utf-8')
            digest, size = hashlib.sha256(encoded).hexdigest(), len(encoded)
        else:
            digest, size = _digest(path), path.stat().st_size
        identity = (suffix, digest)
        if identity in by_digest:
            by_digest[identity]['sources'].append(alias)
            return
        destination = out/relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if text:
            destination.write_bytes(encoded)
        else:
            shutil.copyfile(path, destination)
        entry = {'path': str(relative), 'bytes': size, 'sha256': digest,
                 'kind': 'review-text' if text else 'unreviewed-media', 'sources': [alias]}
        files.append(entry)
        by_digest[identity] = entry

    for scope, root, folders in (('cache', cache, CACHE_FOLDERS), ('run', run, RUN_FOLDERS)):
        for name in folders:
            for path in _walk(root/name, root):
                export(path, root, scope)
    results = run/'checkout/apps/web/test-results'
    for path in _walk(results, run):
        export(path, run, 'run', failure=True)
    # Only startup logs and page error snapshots are included, never model/worker
    # transcripts, cookie jars, traces, prompts, source files, or resumable state.
    startup = _scrub([entry for entry in self_onboarding_diagnostics.startup_report(run)
                      if _plain(run/entry['file'], run)], secrets)
    (out/'startup-diagnostics.json').write_text(json.dumps(startup, ensure_ascii=False, indent=2) + '\n')
    manifest = {'schemaVersion': 1, 'kind': 'self-onboarding-progress', 'complete': False, 'publishable': False,
                'notice': 'Partial progress for inspection. Media may be raw, incomplete or unreviewed. This is not a publishable guide or resumable build checkpoint.',
                'files': files, 'skipped': skipped, 'uniqueMediaAndTextFiles': len(files),
                'sourceFiles': sum(len(entry['sources']) for entry in files)}
    (out/'progress.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (out/'README.txt').write_text(
        'Self-onboarding progress preview\n\n' + manifest['notice'] + '\n\n'
        'Open MP4 clips, screenshots and captions inside cache/ and run/.\n'
        'progress.json lists copied files and all source aliases; duplicate media is stored once.\n'
        'startup-diagnostics.json contains redacted startup log tails.\n'
        'Missing files mean that stage did not produce them before the run stopped.\n')
    return {'ok': True, 'out': str(out), 'files': len(files), 'sourceFiles': manifest['sourceFiles']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', required=True)
    parser.add_argument('--cache', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    print(json.dumps(collect(args.run, args.cache, args.out)))


if __name__ == '__main__':
    main()
