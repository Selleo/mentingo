"""The project's own end-to-end harness as the film set: its setup starts the app with data, its tests act.

A recipe (the project add-on's ``harness`` key) says how to run the project's Playwright tests on this machine:

    {"config": "e2e/playwright.config.ts",   Playwright config, relative to the checkout
     "node": "22.15.0", "pnpm": "10.22.0",   toolchain (asdf / npx); default: what is installed
     "install": ["npm ci"],                  commands in the config's folder (``cd ..`` works)
     "services": [{"name": "postgres", "image": "pgvector/pgvector:pg16", "ports": ["54321:5432"],
                   "env": {...}, "health": "pg_isready"}],
     "setup": ["..."],                       more commands before the tests (a bucket, a build)
     "images": [{"tag": "app-factories:{tag}", "dockerfile": "Dockerfile.dev", "files": ["Gemfile", "Gemfile.lock"]}],
                                             images built from the release's own files when missing ({tag}: its tag)
     "env": {"VITE_TEST": "true"},           environment of every command and of the test run
     "env_passthrough": ["E2E_IMAGE_TAG"],   variables taken from ours when set (images a CI job built already)
     "args": ["--project", "chromium"]}      extra ``playwright test`` arguments

Every test that runs is filmed by ``capture/capture.ts`` (its import of ``test`` is swapped for a copy of the spec
next to the original); each filmed test becomes a take (``takes.py``).

The film set is set up once per run: a keeper run of the config does the one-off work (its servers, its globalSetup,
its setup projects) and waits, and every capture and scene try reuses it instead of setting up and tearing down again.
"""
import base64
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import secrets
import shlex
import signal
import subprocess
import tempfile
import time

import core
import takes

DEMO_CONFIG = 'playwright.release-film.config'
SERIAL_LONG = 5  # a serial spec (it runs whole) with more tests is filmed only when the release changed it
PREFIX = 'demo--'
IMPORT = re.compile(r'import\s*\{([^}]*)\}\s*from\s*([\'"])([^\'"]+)\2\s*;?')


def checkout(repo_dir, tag, run):
    target = Path(run) / 'checkout'
    if not target.exists():
        core.sh(['git', '-C', str(repo_dir), 'worktree', 'add', '--detach', str(target), tag])
    return target


def discover(checkout_dir):
    """Facts for a recipe: Playwright configs, lockfiles, Node versions, CI workflows that run Playwright."""
    root = Path(checkout_dir)
    files = core.sh(['git', '-C', str(root), 'ls-files']).stdout.splitlines()
    configs = [f for f in files if re.search(r'(^|/)playwright[^/]*\.config\.[cm]?[jt]s$', f)]
    locks = [f for f in files if Path(f).name in ('package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb')]
    versions = {f: (root / f).read_text(errors='ignore')[:200] for f in files if Path(f).name in ('.nvmrc', '.node-version', '.tool-versions')}
    workflows = []
    for f in files:
        if f.startswith('.github/workflows/') and 'playwright' in (root / f).read_text(errors='ignore'):
            workflows.append(f)
    return {'configs': configs, 'lockfiles': locks, 'node_versions': versions, 'ci_workflows': workflows}


def ci_node(checkout_dir):
    """The Node version the project's CI runs Playwright with: the ``node-version`` (or ``node-version-file``) of the
    workflows that mention Playwright, when they name exactly one full version; else None."""
    root, found = Path(checkout_dir), set()
    for workflow in sorted((root / '.github' / 'workflows').glob('*.y*ml')):
        text = workflow.read_text(errors='ignore')
        if 'playwright' not in text.lower():
            continue
        found.update(re.findall(r'node-version\s*:\s*["\']?v?(\d+\.\d+\.\d+)\b', text))
        for name in re.findall(r'node-version-file\s*:\s*["\']?([^"\'\s#]+)', text):
            pinned = root / name
            version = re.search(r'(?<![\d.])v?(\d+\.\d+\.\d+)\b', pinned.read_text(errors='ignore')) if pinned.is_file() else None
            if version:
                found.add(version.group(1))
    return found.pop() if len(found) == 1 else None


def node_home(version):
    """The bin folder of Node ``version`` installed by asdf, mise or nvm; None when none has it."""
    for folder in (Path(os.environ.get('ASDF_DATA_DIR') or Path.home() / '.asdf') / 'installs' / 'nodejs' / version,
                   Path(os.environ.get('MISE_DATA_DIR') or Path.home() / '.local' / 'share' / 'mise') / 'installs' / 'node' / version,
                   Path(os.environ.get('NVM_DIR') or Path.home() / '.nvm') / 'versions' / 'node' / f'v{version}'):
        if (folder / 'bin' / 'node').exists():
            return folder / 'bin'
    return None


def toolchain(run, recipe, log):
    """PATH entries for the recipe's Node (else the one the project's CI runs Playwright with) and pnpm. A version
    manager's default Node may be years older than the project's (macOS: asdf's global 17 for a Playwright needing 18+);
    one that is not installed is installed with asdf when there is asdf, else the Node on PATH runs."""
    paths = []
    node = recipe.get('node') or ci_node(Path(run) / 'checkout')
    if node:
        home = node_home(node)
        if not home and shutil.which('asdf'):  # a recipe's own version must install; CI's is a preference
            core.sh(['asdf', 'install', 'nodejs', node], log=log, timeout=900, check=bool(recipe.get('node')))
            home = node_home(node)
        if home:
            paths.append(str(home))
    search = os.pathsep.join(paths + [os.environ.get('PATH', '')])
    if shutil.which('node', path=search):  # the Node the project's commands get, in env.log
        core.sh(['node', '--version'], env={'PATH': search}, log=log, check=False)
    if recipe.get('pnpm'):
        # installed once into the run (not `npx pnpm@…` per call: servers starting together race on npx's cache)
        shims = Path(run).resolve() / 'toolchain'
        package = shims / 'pnpm-package'
        binary = package / 'node_modules' / 'pnpm' / 'bin' / 'pnpm.cjs'
        if not binary.exists():
            core.sh(['npm', 'install', '--silent', '--no-audit', '--no-fund', '--prefix', str(package), f'pnpm@{recipe["pnpm"]}'],
                    env={'PATH': os.pathsep.join(paths + [os.environ.get('PATH', '')])}, log=log, timeout=600)
        shim = shims / 'pnpm'
        shim.write_text(f'#!/bin/sh\nexec node "{binary}" "$@"\n')
        shim.chmod(0o755)
        paths.append(str(shims))
    caddy = core.ensure_caddy()
    if caddy:
        paths.append(str(Path(caddy).parent))
    return paths


def environment(run, recipe, paths):
    """The recipe's variables for every command, and those of ours it passes through (``env_passthrough``, when set);
    ``<random>`` values (local-only secrets such as an encryption key) are drawn once per run and kept in secrets.json
    (0600)."""
    env = {k: str(v) for k, v in (recipe.get('env') or {}).items()}
    env.update({name: os.environ[name] for name in recipe.get('env_passthrough') or [] if name in os.environ})
    store = Path(run) / 'secrets.json'
    kept, drawn = core.load(store, {}), False
    for key, value in list(env.items()):
        if value in ('<random>', '<random-base64>'):  # 16 hex bytes, or 32 bytes in base64 (an encryption key)
            if key not in kept:
                kept[key] = secrets.token_hex(16) if value == '<random>' else base64.b64encode(secrets.token_bytes(32)).decode()
                drawn = True
            env[key] = kept[key]
    if drawn:  # written only when a value was drawn: every try reads it
        core.save(store, kept, mode=0o600)
    env['PATH'] = os.pathsep.join(paths + [os.environ.get('PATH', '')])
    if core.docker_host():  # the project's own Docker client config (a test setup's DOCKER_CONFIG) keeps the daemon
        env.setdefault('DOCKER_HOST', core.docker_host())
    profile = core.ci_profile()
    env['DEMO_DEVICE_SCALE'] = str(profile['device_scale'])
    if profile['workers'] is not None:
        env['DEMO_WORKER_LIMIT'] = str(profile['workers'])
    return env


def test_env(run, recipe):
    """The environment of the test run for a later step (toolchain paths recorded by setup)."""
    state = core.load(Path(run) / 'env.json', {})
    return environment(run, recipe, state.get('paths') or [])


def container_prefix(run):
    return f"rf-{Path(run).parents[1].name}-{Path(run).name}".lower()


def docker_env(run):
    """A Docker client config without a credential helper: public images pull even where the desktop helper fails.
    The daemon stays the user's (their context's endpoint: core.docker_host) and so do their CLI plugins (a compose
    installed only in ~/.docker/cli-plugins, as Docker Desktop's per-user install does)."""
    folder = Path(run) / 'docker-config'
    folder.mkdir(parents=True, exist_ok=True)
    plugins = Path.home() / '.docker' / 'cli-plugins'
    core.write(folder / 'config.json', json.dumps({'cliPluginsExtraDirs': [str(plugins)]} if plugins.is_dir() else {}),
               changed_only=True)
    host = core.docker_host()
    return dict({'DOCKER_CONFIG': str(folder)}, **({'DOCKER_HOST': host} if host else {}))


def playwright_version(checkout_dir, recipe):
    config_dir = Path(checkout_dir) / Path(recipe['config']).parent
    for base in (config_dir, Path(checkout_dir)):
        package = base / 'node_modules' / '@playwright' / 'test' / 'package.json'
        if package.exists():
            return json.loads(package.read_text())['version']
    return None


def runner_name(run):
    return container_prefix(run) + '-runner'


RUNNER_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
FORWARD = ("const n=require('net');n.createServer(c=>{{const s=n.connect({target},'127.0.0.1');c.pipe(s).pipe(c);"
           "s.on('error',()=>c.destroy());c.on('error',()=>s.destroy())}}).listen({port})")


def start_runner(run, recipe, log):
    """Isolated mode: the tests run in a container of the project's Playwright image, and the services join its
    network, as in a CI job: fixed ports of the test setup never meet the machine's own services."""
    isolate = recipe.get('isolate')
    image = isolate.get('image') if isinstance(isolate, dict) and isolate.get('image') else \
        f"mcr.microsoft.com/playwright:v{playwright_version(Path(run) / 'checkout', recipe)}-jammy"
    denv, name = docker_env(run), runner_name(run)
    core.sh(['docker', 'rm', '-f', name], check=False, env=denv, log=log)
    mounts = ['-v', f'{Path(run).resolve()}:{Path(run).resolve()}']
    caddy = core.ensure_caddy()
    if caddy:
        mounts += ['-v', f'{caddy}:/usr/local/bin/caddy:ro']
    core.sh(['docker', 'run', '-d', '--name', name, '--ipc=host', '--user', f'{os.getuid()}:{os.getgid()}',
             '-e', 'HOME=/tmp/home', *mounts, image, 'sleep', 'infinity'], env=denv, log=log, timeout=3600)
    return name


def start_services(run, recipe, log):
    started = []
    name = container_prefix(run)
    denv = docker_env(run)
    runner = start_runner(run, recipe, log) if recipe.get('isolate') else None
    for service in recipe.get('services') or []:
        container = f"{name}-{service['name']}"
        cmd = ['docker', 'run', '-d', '--name', container]
        if runner:
            cmd += ['--network', f'container:{runner}']
        else:
            for port in service.get('ports') or []:
                cmd += ['-p', port if ':' in str(port) else f'{port}:{port}']
        for key, value in (service.get('env') or {}).items():
            cmd += ['-e', f'{key}={value}']
        if service.get('health'):
            cmd += ['--health-cmd', service['health'], '--health-interval', '2s', '--health-retries', '60']
        cmd += [service['image'], *(service.get('args') or [])]
        core.sh(['docker', 'rm', '-f', container], check=False, log=log, env=denv)
        core.sh(cmd, log=log, timeout=600, env=denv)
        started.append(container)
    for service in recipe.get('services') or [] if runner else []:  # CI published 54321:5432: listen on 54321 too
        for port in service.get('ports') or []:
            outer, _, inner = str(port).partition(':')
            if inner and inner != outer:
                core.sh(['docker', 'exec', '-d', runner, 'node', '-e', FORWARD.format(target=inner, port=outer)], env=denv, log=log)
    deadline = time.monotonic() + 180
    for container, service in zip(started, recipe.get('services') or []):
        while service.get('health') and time.monotonic() < deadline:
            status = core.sh(['docker', 'inspect', '--format', '{{.State.Health.Status}}', container], check=False).stdout.strip()
            if status == 'healthy':
                break
            time.sleep(1)
    return started


def stop_services(run, log=None):
    name = container_prefix(run) + '-'
    ids = core.sh(['docker', 'ps', '-aq', '--filter', f'name={name}'], check=False).stdout.split()
    if ids:
        core.sh(['docker', 'rm', '-f', *ids], check=False, log=log)
    return len(ids)


def image_tag(tag):
    """A release tag as it may stand in a Docker image tag (letters, digits, "_", ".", "-")."""
    return re.sub(r'[^A-Za-z0-9_.-]+', '-', tag).strip('.-')[:128] or 'latest'


def build_images(run, recipe, log):
    """The recipe's images that are missing, each built from its Dockerfile and files at the release (a folder of
    just those files: the checkout, node_modules and all, never goes to Docker); ``{tag}`` in a name is the release's
    tag. Buildx is told to load each image into Docker: a builder of its own (a CI job's) would keep it in its cache.
    Returns the names built."""
    run, built = Path(run), []
    tag = image_tag((core.load(run / 'meta.json') or {}).get('tag') or '')
    buildx = core.sh(['docker', 'buildx', 'version'], env=docker_env(run), check=False).returncode == 0 \
        if recipe.get('images') else False
    for image in recipe.get('images') or []:
        name = image['tag'].replace('{tag}', tag)
        if core.sh(['docker', 'image', 'inspect', name], env=docker_env(run), check=False).returncode == 0:
            continue
        with tempfile.TemporaryDirectory(prefix='rf-image-') as context:
            for file in [image['dockerfile'], *image.get('files', [])]:
                target = Path(context) / file
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(run / 'checkout' / file, target)
            core.sh(['docker', *(['buildx', 'build', '--load'] if buildx else ['build']), '-q',
                     '-f', str(Path(context) / image['dockerfile']), '-t', name, context],
                    env=docker_env(run), log=log, timeout=3600)
        built.append(name)
    return built


def setup(run, recipe):
    """Toolchain, dependencies, images, services and the recipe's setup commands; returns the test environment."""
    run = Path(run)
    (run / 'keeper.stopped').unlink(missing_ok=True)  # explicit env/start permits a new runtime
    log = run / 'env.log'
    cwd = run / 'checkout' / Path(recipe['config']).parent
    core.mark(run, 'env', 'start')
    paths = toolchain(run, recipe, log)
    env = environment(run, recipe, paths)
    build_images(run, recipe, log)
    for command in recipe.get('install') or []:
        core.sh(command, cwd=cwd, env=env, log=log, timeout=1800, project=True)
    start_services(run, recipe, log)
    for command in recipe.get('setup') or []:  # {service:<name>} is that service's container in this run
        command = re.sub(r'\{service:([\w-]+)\}', lambda m: f'{container_prefix(run)}-{m.group(1)}', command)
        core.sh(command, cwd=cwd, env=dict(docker_env(run), **env), log=log, timeout=1800, project=True)
    core.mark(run, 'env', 'end')
    core.save(run / 'env.json', {'cwd': str(cwd), 'paths': paths, 'keys': sorted(env)})
    return env


def test_roots(checkout_dir, recipe):
    """Where the Playwright specs live: the recipe's ``tests`` or every ``testDir`` of the config (the config's
    folder when it names none), relative to the checkout."""
    if recipe.get('tests'):
        return [recipe['tests']] if isinstance(recipe['tests'], str) else list(recipe['tests'])
    config = Path(checkout_dir) / recipe['config']
    found = re.findall(r'testDir\s*:\s*[\'"]([^\'"]+)[\'"]', config.read_text(errors='ignore'))
    roots = sorted({os.path.normpath(os.path.join(os.path.dirname(recipe['config']), d)) for d in found})
    deepest = [r for r in roots if not any(o != r and o.startswith(r + '/') for o in roots)]  # the most specific dirs
    return deepest or [os.path.dirname(recipe['config'])]


def serial(run, recipe):
    """Whether the project runs one test at a time (its tests share state): all its runs then share one camera. The
    recipe's ``workers`` decides, else a ``workers`` setting of the config that can be 1 (``1``, ``CI ? 1 : …``)."""
    if core.ci_profile()['workers'] == 1:
        return True
    if recipe.get('workers'):
        return int(recipe['workers']) == 1
    config = Path(run) / 'checkout' / recipe.get('config', '')
    text = config.read_text(errors='ignore') if config.is_file() else ''
    return bool(re.search(r'\bworkers\s*:[^,\n}]*\b1\b', text))


def cli_args(recipe):
    """The recipe's extra arguments with option values joined (``--project=x``): Playwright's variadic options would
    swallow the spec files that follow them."""
    args, out, skip = list(recipe.get('args') or []), [], False
    for index, arg in enumerate(args):
        if skip:
            skip = False
            continue
        if arg in ('--project', '--grep', '-g', '--grep-invert') and index + 1 < len(args):
            out.append(f'{arg}={args[index + 1]}')
            skip = True
        else:
            out.append(arg)
    return out


def json_report(out):
    """The JSON reporter's report in a run's output: the first object starting a line that reads as one (the config
    may print before it: dotenv's tips hold braces, `{ quiet: true }`), None when there is none."""
    decoder = json.JSONDecoder()
    for start in re.finditer(r'(?m)^\{', out):
        try:
            report, _ = decoder.raw_decode(out, start.start())
        except ValueError:
            continue
        if isinstance(report, dict) and ('suites' in report or 'config' in report):
            return report
    return None


def list_tests(run, recipe, env, specs):
    """Tests of the given spec files: [{file, title, line}] from ``playwright test --list``."""
    run = Path(run)
    cwd = run / 'checkout' / Path(recipe['config']).parent
    config = Path(recipe['config']).name
    files = [os.path.relpath(run / 'checkout' / s, cwd) for s in specs]
    out = core.sh(['npx', 'playwright', 'test', '-c', config, '--list', '--reporter=json', *cli_args(recipe), *files],
                  cwd=cwd, env=env, timeout=600, check=False, project=True).stdout
    report = json_report(out)
    if report is None:
        return []
    tests = []
    root_dir = (report.get('config') or {}).get('rootDir') or str(cwd)  # report paths are relative to the test root

    def walk(suite, trail):
        for spec in suite.get('specs') or []:
            tests.append({'file': os.path.relpath(os.path.join(root_dir, spec['file']), run / 'checkout'),
                          'title': ' › '.join(trail + [spec['title']]), 'line': spec.get('line'), 'id': spec.get('id')})
        for child in suite.get('suites') or []:
            walk(child, trail + ([child['title']] if child.get('title') and not child['title'].endswith(('.ts', '.js')) else []))
    for suite in report.get('suites') or []:
        walk(suite, [])
    return tests


def wrap_spec(source_text, capture_import):
    """The spec with its ``test`` import swapped for the filmed one; None when it imports ``test`` differently."""
    for match in IMPORT.finditer(source_text):
        names = [n.strip() for n in match.group(1).split(',') if n.strip()]
        if 'test' not in names:
            continue
        renamed = ', '.join('test as __rfProjectTest' if n == 'test' else n for n in names)
        statement = (f'import {{ {renamed} }} from {match.group(2)}{match.group(3)}{match.group(2)}; '
                     f'import {{ withCapture as __rfWithCapture }} from "{capture_import}"; '
                     'const test = __rfWithCapture(__rfProjectTest);')
        # as many lines as the import it replaces: every test keeps the line `--list` reported for the original
        statement += '\n' * match.group(0).count('\n')
        return source_text[:match.start()] + statement + source_text[match.end():]
    return None


WARM = '''// Written by release-film: an empty test run before the filmed ones, with the project's own fixtures
import {{ test }} from "{module}";

test("release film: a fresh start for the filmed tests", async () => {{}});
'''


def warm_up(root, specs):
    """An empty test that runs before a batch's filmed tests in a project that runs one test at a time. Such a project
    may skip its per-test reset for the first test of a run (its setup has just made the data fresh), but a film set kept
    up skips that setup: the first filmed test would see the data the previous batch left (a dialog another scene
    created). Written in ``!rf/`` under the specs' common folder, so it sorts first, importing ``test`` from where the
    first spec does. None when that import cannot be followed."""
    if not specs:
        return None
    source = root / specs[0]
    match = next((m for m in IMPORT.finditer(source.read_text(encoding='utf-8', errors='ignore'))
                  if 'test' in [n.strip() for n in m.group(1).split(',')]), None)
    if not match:
        return None
    folder = root / os.path.commonpath([os.path.dirname(s) or '.' for s in specs]) / '!rf'
    module = match.group(3)
    if module.startswith('.'):
        module = os.path.relpath(os.path.normpath(source.parent / module), folder)
        module = module if module.startswith('.') else './' + module
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f'{PREFIX}rf-warm.spec.ts'
    core.write(target, WARM.format(module=module), changed_only=True)
    return target


def demo_config(config_path):
    base = Path(config_path).name
    stem = base.rsplit('.', 1)[0]
    text = f'''// Written by release-film: the project's config, filmed (1600x900 at 1.5x, one report, no retries).
import fs from "node:fs";
import os from "node:os";

import {{ defineConfig }} from "@playwright/test";

import base from "./{stem}";

const film = {{ viewport: {{ width: 1600, height: 900 }}, deviceScaleFactor: Number(process.env.DEMO_DEVICE_SCALE || 1.5), video: "off" as const,
  trace: "off" as const, screenshot: "off" as const }};
const requestedWorkers = process.env.DEMO_WORKERS ? Number(process.env.DEMO_WORKERS) : base.workers;
const workerLimit = process.env.DEMO_WORKER_LIMIT ? Number(process.env.DEMO_WORKER_LIMIT) : undefined;
const workerCount = typeof requestedWorkers === "string" && requestedWorkers.endsWith("%")
  ? Math.max(1, Math.floor(Number(requestedWorkers.slice(0, -1)) * os.cpus().length / 100))
  : requestedWorkers ?? Math.max(1, Math.floor(os.cpus().length / 2));
const workers = workerLimit ? Math.min(workerCount, workerLimit) : requestedWorkers;
// a filmed run may share the machine with other work: the app's own servers get at least 10 minutes to start;
// when release-film keeps the film set up for the whole run (DEMO_REUSE_SERVERS), its keeper run did the one-off work
// (servers, globalSetup, setup projects): servers are reused, the setup skipped, the variables it added taken over
const reuse = process.env.DEMO_REUSE_SERVERS === "1";
const kept = reuse && process.env.DEMO_KEEPER_ENV && fs.existsSync(process.env.DEMO_KEEPER_ENV)
  ? JSON.parse(fs.readFileSync(process.env.DEMO_KEEPER_ENV, "utf8")) : {{}};
for (const [key, value] of Object.entries(kept)) if (process.env[key] === undefined) process.env[key] = String(value);
const patient = (server: any) => ({{ ...server, timeout: Math.max(server.timeout ?? 60_000, 600_000),
  ...(reuse ? {{ reuseExistingServer: true }} : {{}}) }});
const servers = (Array.isArray(base.webServer) ? base.webServer : base.webServer ? [base.webServer] : [])
  .filter((server: any) => !reuse || server.url || server.port).map(patient);
// a scene being tried (DEMO_TRY) fails fast: a click on a wrong locator gives up after 15 s, not at the test timeout
const quick = (use: any) => process.env.DEMO_TRY === "1"
  ? {{ actionTimeout: Math.min(use?.actionTimeout || 15_000, 15_000) }} : {{}};

export default defineConfig({{
  ...base,
  ...(reuse ? {{ globalSetup: undefined, globalTeardown: undefined }} : {{}}),
  testMatch: /{PREFIX}.*\\.(spec|test|e2e)\\.[cm]?[jt]sx?$/,
  testIgnore: [],
  retries: 0,
  forbidOnly: false,
  workers,
  reporter: [["line"], ["json", {{ outputFile: process.env.DEMO_REPORT }}]],
  use: {{ ...(base.use || {{}}), ...film, ...quick(base.use) }},
  projects: base.projects ? base.projects.map((p) => ({{ ...p, use: {{ ...(p.use || {{}}), ...film,
    ...quick({{ ...(base.use || {{}}), ...(p.use || {{}}) }}) }} }})) : undefined,
  webServer: servers.length ? servers : undefined,
}});
'''
    target = Path(config_path).with_name(f'{DEMO_CONFIG}.ts')
    core.write(target, text, changed_only=True)  # a try may be loading it right now
    return target


def capture(run, recipe, env, targets, workers=None, reasons=None, batch=None, gaps=None, on_film=None):
    """Film ``targets`` ([(checkout-relative spec, test line or None for all its tests)]) in one Playwright run, into
    captures/<batch>/; the films join the run's index captures.json, keyed by test id (a test filmed again replaces
    its earlier film) with stable film keys F1, F2…. Returns the films of this batch. ``on_film(film)`` gets each
    test's film as soon as its test ended (a scene's writer then goes on while the batch's other tests run)."""
    run = Path(run)
    root = run / 'checkout'
    config = root / recipe['config']
    # next to the config, so the camera is loaded as the project's own modules are (ESM or CommonJS)
    assets = config.parent / '.release-film' / 'capture'
    assets.mkdir(parents=True, exist_ok=True)
    for name in ('capture.ts', 'init.js', 'probe.js', 'ambient.js', 'text.js', 'localhost-dns.cjs'):
        core.write(assets / name, (core.SKILL / 'scripts' / 'capture' / name).read_text(encoding='utf-8'), changed_only=True)
    demo_config(config)
    captures = run / 'captures'
    batch = batch or f'b{len([p for p in captures.glob("b*") if p.is_dir()]) + 1:02d}'
    out = captures / batch
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    wrapped, skipped, args = {}, [], []
    for spec, line in targets:
        source = root / spec
        if spec not in wrapped and spec not in skipped:
            target = source.with_name(PREFIX + source.name)
            relative = os.path.relpath(assets / 'capture', source.parent)
            text = wrap_spec(source.read_text(encoding='utf-8'), relative if relative.startswith('.') else './' + relative)
            if text is None:
                skipped.append(spec)
                continue
            core.write(target, text, changed_only=True)
            wrapped[spec] = os.path.relpath(target, config.parent)
        if spec in wrapped:
            args.append(wrapped[spec] + (f':{line}' if line else ''))
    opener = warm_up(root, [spec for spec, _ in targets if spec in wrapped]) if args and serial(run, recipe) else None
    if opener:  # runs first (Playwright runs the files in path order): the project's "first test" shortcut is spent on it
        args.insert(0, os.path.relpath(opener, config.parent))
    report = out / 'report.json'
    film_env = dict(env, DEMO_CAPTURE_DIR=str(out), DEMO_SCRIPTS=str(assets), DEMO_REPORT=str(report),
                    NODE_OPTIONS=f"{env.get('NODE_OPTIONS', '')} --require \"{assets / 'localhost-dns.cjs'}\"".strip())
    workers = workers or recipe.get('workers')
    if workers:  # otherwise the project's own setting (a shared stack may allow one test at a time)
        film_env['DEMO_WORKERS'] = str(workers)
    warm = keeper_state(run)  # the film set is kept up for the whole run: reuse it, set nothing up again
    cmd = ['npx', 'playwright', 'test', '-c', f'{DEMO_CONFIG}.ts', *cli_args(recipe), *(['--no-deps'] if warm else []), *args]
    stage = 'try' if gaps else 'capture'
    core.mark(run, stage, 'start', f'{batch}: {len(args)} tests of {len(wrapped)} specs')
    if warm:
        film_env.update(DEMO_REUSE_SERVERS='1', DEMO_KEEPER_ENV=str(run.resolve() / KEEPER_ENV))
    if gaps:
        film_env['DEMO_TRY'] = '1'
    cmd = inside(run, recipe, film_env, config.parent, cmd)
    ffmpeg = core.tool('ffmpeg')
    summaries, handed = {}, set()

    def film_of(folder, results):
        if folder not in summaries:
            try:
                summaries[folder] = takes.convert(folder, ffmpeg, video=False)  # the video only for the tests the film uses
            except Exception as error:  # noqa: BLE001 a broken capture must not stop the others
                summaries[folder] = {'error': str(error)[-300:]}
        summary = summaries[folder]
        log = core.load(folder / 'page-log.json', {})
        spec = os.path.relpath(log['file'], root) if log.get('file') else None
        if spec:
            spec = os.path.join(os.path.dirname(spec), os.path.basename(spec).replace(PREFIX, '', 1))
        outcome = results.get(log.get('testId')) or {'status': log.get('status'), 'error': log.get('error') or ''}
        return dict(summary, capture=str(folder), title=log.get('title'), status=outcome.get('status') or log.get('status'),
                    error=summary.get('error') or outcome.get('error') or '', seconds_run=outcome.get('seconds'),
                    test_id=log.get('testId'), spec=spec, line=log.get('line'), batch=batch,
                    prs=list(((gaps or {}).get(spec) or {}).get('prs') or (reasons or {}).get(spec, [])),
                    **({'gap': gaps[spec]['id']} if spec in (gaps or {}) else {}))

    def tick():  # a test's folder is complete once its page log is written (the camera writes it last)
        for folder in sorted(p for p in out.iterdir() if p.is_dir() and (p / 'page-log.json').is_file()):
            if folder not in handed:
                handed.add(folder)
                try:
                    film = film_of(folder, {})
                    on_film(dict(film, key=key_for(run, film.get('test_id'))))
                except Exception:  # noqa: BLE001 the batch goes on; its end hands every film over again
                    pass
    try:
        if not args:
            completed = None
        elif on_film:
            completed = core.sh_watching(cmd, tick, cwd=config.parent, env=film_env, log=out / 'capture.log', timeout=3600,
                                         project=True)
        else:
            completed = core.sh(cmd, cwd=config.parent, env=film_env, log=out / 'capture.log', timeout=3600, check=False,
                                project=True)
    finally:
        for path in wrapped.values():
            (config.parent / path).unlink(missing_ok=True)
        if opener:
            shutil.rmtree(opener.parent, ignore_errors=True)
    code = completed.returncode if completed else None
    core.mark(run, stage, 'end', f'{batch}: exit {code}')
    results = {r['id']: r for r in outcomes(report)}
    core.mark(run, 'takes', 'start', batch)
    films = [film_of(folder, results) for folder in sorted(p for p in out.iterdir() if p.is_dir())]
    core.mark(run, 'takes', 'end', batch)
    with index_lock(run):
        index = core.load(run / 'captures.json', {}) or {}
        batches = dict(index.get('batches') or {}, **{batch: {'exit': code, 'skipped_specs': skipped, 'tests': len(args),
                                                              'results': list(results.values())}})
        core.save(run / 'captures.json', dict(index, films=merge_films(index.get('films') or [], films, index.get('reserved')),
                                              batches=batches))
    return films


def index_lock(run):
    """The lock over captures.json (batches filmed at once add to it, films get their keys from it)."""
    handle = open(Path(run) / 'captures.lock', 'a')
    fcntl.flock(handle, fcntl.LOCK_EX)
    return handle


def key_for(run, test_id):
    """The film key of a test before its batch ends (its film handed over early): its key when it was filmed before,
    else the next free one, kept for it in captures.json (``reserved``) so the batch's end gives it the same."""
    if not test_id:
        return None
    with index_lock(run):
        index = core.load(Path(run) / 'captures.json', {}) or {}
        known = dict({f.get('test_id'): f.get('key') for f in index.get('films') or []}, **(index.get('reserved') or {}))
        if test_id not in known:
            serial = max([int(k[1:]) for k in known.values() if re.fullmatch(r'F\d+', k or '')] + [0])
            index['reserved'] = dict(index.get('reserved') or {})
            index['reserved'][test_id] = f'F{serial + 1}'
            core.save(Path(run) / 'captures.json', index)
            known[test_id] = f'F{serial + 1}'
        return known[test_id]


def leftover_stacks(run):
    """Docker Compose projects the project's own test setup started from this run's checkout and left behind (a scene
    worker stopped in the middle of a test skips the teardown): their names."""
    checkout = str((Path(run) / 'checkout').resolve())
    out = core.sh(['docker', 'ps', '-a', '--format',
                   '{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.project.working_dir"}}'],
                  env=docker_env(run), check=False).stdout
    return sorted({name for name, _, workdir in (line.partition('\t') for line in out.splitlines())
                   if name and workdir.startswith(checkout)})


def stop_stacks(run):
    """Take down the stacks of leftover_stacks (with their volumes): nothing else is touched."""
    names = leftover_stacks(run)
    for name in names:
        core.sh(['docker', 'compose', '-p', name, 'down', '-v', '--remove-orphans'], env=docker_env(run), check=False,
                timeout=240)
    return names


def inside(run, recipe, env, cwd, cmd, detach=False):
    """The command as it runs for this recipe: in the runner container for an isolated one (its variables from a
    private env file, so the per-run secrets stay out of command lines and logs), else as is."""
    if not recipe.get('isolate'):
        return cmd
    run = Path(run)
    paths = [p for p in core.load(run / 'env.json', {}).get('paths', []) if p.startswith(str(run.resolve()))]
    passed = set(recipe.get('env') or {}) | set(recipe.get('env_passthrough') or [])  # environment() gives both
    inner = dict({k: v for k, v in env.items() if k in passed or k.startswith('DEMO_') or k == 'NODE_OPTIONS'},
                 PATH=os.pathsep.join(paths + [RUNNER_PATH]), HOME='/tmp/home')
    variables = run / 'runner.env'  # read by every command in the runner: written whole, only when it changed
    core.write(variables, ''.join(f'{k}={v}\n' for k, v in inner.items() if '\n' not in str(v)), changed_only=True,
               mode=0o600)
    return ['docker', 'exec', *(['-d'] if detach else []), '-w', str(Path(cwd).resolve()), '--env-file', str(variables),
            runner_name(run), *cmd]


KEEPER = '''import fs from "node:fs";
import os from "node:os";
import { test } from "@playwright/test";

// Written by release-film: holds the film set up for the whole film run. The config's one-off work runs once, here:
// its servers (webServer), its globalSetup and its setup projects. Once its test starts (after all of them) it leaves
// the variables the setup added for the later runs and says it is ready; its teardown runs when it is stopped.
test("release film keeps the film set up", async () => {
  test.setTimeout(0);
  const passed = new Set((process.env.DEMO_PASSED_KEYS || "").split(","));
  const own = /^(TEST_|PW_|PLAYWRIGHT_|npm_|DEMO_)|^(FORCE_COLOR|DEBUG_COLORS|NO_COLOR|INIT_CWD|NODE|_)$/;
  if (process.env.DEMO_KEEPER_ENV) {
    const added = Object.fromEntries(Object.entries(process.env).filter(([key]) => !passed.has(key) && !own.test(key)));
    fs.writeFileSync(process.env.DEMO_KEEPER_ENV, JSON.stringify(added), { mode: 0o600 });
  }
  if (process.env.DEMO_KEEPER_READY) fs.writeFileSync(process.env.DEMO_KEEPER_READY, String(Date.now()));
  await new Promise(() => undefined);
});
'''
KEEPER_ENV = 'keeper.env.json'  # the variables the project's setup added, for the runs after the keeper's


def appending(log, cmd):
    """``cmd`` with its output appended to ``log`` by a shell (a detached command in the runner has no other way to
    log): the path quoted, a run folder with a space in it included."""
    return ['sh', '-c', f'exec "$@" >> {shlex.quote(str(log))} 2>&1', 'keeper', *cmd]


def server_urls(config_path):
    """The addresses of the servers a Playwright config starts itself (``webServer`` entries with a url)."""
    text = Path(config_path).read_text(errors='ignore')
    return re.findall(r'url\s*:\s*[`"\']((?:https?)://[^`"\']+)[`"\']', text) if 'webServer' in text else []


def servers_up(run, recipe, urls):
    check = ('Promise.all(process.argv.slice(1).map(u=>fetch(u).then(r=>r.status<500).catch(()=>false)))'
             '.then(a=>process.exit(a.every(Boolean)?0:1))')
    if recipe.get('isolate'):
        return core.sh(['docker', 'exec', runner_name(run), 'node', '-e', check, *urls], env=docker_env(run),
                       check=False, timeout=30).returncode == 0
    # the recipe's Node (fetch needs 18+), not the one first on this process's PATH
    return core.sh(['node', '-e', check, *urls], env={'PATH': test_env(run, recipe)['PATH']}, check=False,
                   timeout=30).returncode == 0


def keeper_state(run):
    return core.load(Path(run) / 'keeper.json')


def one_off(config_path):
    """Whether a Playwright run of the config does one-off work before its tests: starts servers (webServer), runs a
    globalSetup, or runs setup projects (project dependencies)."""
    text = Path(config_path).read_text(errors='ignore')
    return bool(re.search(r'\b(webServer|globalSetup|dependencies)\s*:', text))


def keeper_alive(run, recipe, state):
    if state.get('pid'):
        return core.still_running(state)
    if recipe.get('isolate'):  # it runs in the runner container: look for it there ([r]: not the grep's own command)
        return core.sh(['docker', 'exec', runner_name(run), 'sh', '-c', "grep -qs '[r]f-keep' /proc/[0-9]*/cmdline"],
                       env=docker_env(run), check=False, timeout=30).returncode == 0
    return False


KEEPER_STARTS = 2  # the film set is started again once when it ends before it came up
KEEPER_WAIT = 1200  # seconds a start of the film set may take to come up


def check_keeper_start(run):
    if (Path(run) / 'keeper.stopped').exists():
        raise RuntimeError('film set startup cancelled; run env explicitly before starting it again')


def keep_set(run, recipe, env):
    """For a project whose Playwright runs do one-off work (servers, a globalSetup, setup projects), one Playwright
    run that does it and then waits, for the whole film run: every capture and scene try reuses the set (without its
    setup, teardown or setup projects) instead of building it again, so a try costs its test alone. Returns the
    keeper's state, None when there is nothing to keep. Runs once at a time (set.lock): the others wait for the set."""
    run = Path(run)
    root = run / 'checkout'
    config = root / recipe['config']
    if not one_off(config):
        return None
    urls = server_urls(config)
    with open(run / 'set.lock', 'w') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        check_keeper_start(run)
        state = keeper_state(run)
        if state and keeper_alive(run, recipe, state) and (not urls or servers_up(run, recipe, urls)):
            return state
        if state and state.get('pid'):
            _stop_keeper(run)  # stop an unhealthy process without cancelling its intentional replacement
        spec = root / test_roots(root, recipe)[0] / f'{PREFIX}rf-keep.spec.ts'
        spec.write_text(KEEPER, encoding='utf-8')
        demo_config(config)
        ready = run.resolve() / 'keeper.ready'
        ready.unlink(missing_ok=True)
        cmd = ['npx', 'playwright', 'test', '-c', f'{DEMO_CONFIG}.ts', *cli_args(recipe), '--reporter=line',
               os.path.relpath(spec, config.parent)]
        keep_env = dict(env, DEMO_KEEPER_READY=str(ready), DEMO_KEEPER_ENV=str(run.resolve() / KEEPER_ENV),
                        DEMO_PASSED_KEYS=','.join(sorted(set(core.project_environ()) | set(env))))
        core.mark(run, 'servers', 'start')
        try:
            for attempt in range(KEEPER_STARTS):  # a project's servers may fail to start at random (two builds racing)
                check_keeper_start(run)
                ready.unlink(missing_ok=True)
                if recipe.get('isolate'):  # detached in the runner: its output goes to keeper.log from there
                    logged = appending(run.resolve() / 'keeper.log', cmd)
                    core.sh(inside(run, recipe, keep_env, config.parent, logged, detach=True), env=docker_env(run),
                            log=run / 'keeper.log')
                    state = {'isolate': True}
                else:
                    with open(run / 'keeper.log', 'a') as log:
                        process = subprocess.Popen(cmd, cwd=config.parent, env=dict(core.project_environ(), **keep_env), stdout=log,
                                                   stderr=subprocess.STDOUT, start_new_session=True)
                    state = {'pid': process.pid, 'since': core.started_at(process.pid)}
                state = dict(state, urls=urls, spec=str(spec))
                core.save(run / 'keeper.json', state)  # cleanup knows it even if startup times out or is interrupted
                started, gone = time.monotonic(), False
                while not (ready.exists() and keeper_alive(run, recipe, state) and (not urls or servers_up(run, recipe, urls))):
                    check_keeper_start(run)
                    elapsed = time.monotonic() - started
                    gone = elapsed > 15 and not keeper_alive(run, recipe, state)
                    if gone or elapsed > KEEPER_WAIT:
                        break
                    time.sleep(3)
                else:
                    check_keeper_start(run)
                    break
                if not gone or attempt == KEEPER_STARTS - 1:
                    tail = (run / 'keeper.log').read_text(errors='ignore')[-1500:] if (run / 'keeper.log').exists() else ''
                    raise RuntimeError(f'the film set did not come up (see {run / "keeper.log"}):\n{tail}')
                with open(run / 'keeper.log', 'a') as log:
                    log.write('\n[release-film] the film set ended before it came up: starting it again\n')
        except BaseException:
            _stop_keeper(run, wait=15)
            raise
        core.mark(run, 'servers', 'end')
        return state


def stop_keeper(run, wait=120):
    """Cancel pending and future startup, wait for its owner, then stop the owned keeper.

    The persistent marker also covers callers waiting on set.lock and a detached
    `keep` command that has not entered keep_set yet. Only explicit setup clears it.
    """
    run = Path(run)
    (run / 'keeper.stopped').touch()
    until = time.monotonic() + wait
    with open(run / 'set.lock', 'a') as handle:
        while True:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= until:
                    raise RuntimeError('film set startup did not stop before the cleanup deadline')
                time.sleep(0.1)
        _stop_keeper(run, wait=max(0, until - time.monotonic()))


def _stop_keeper(run, wait=120):
    """Stop the keeper as Ctrl+C would: the project's teardown runs (its globalTeardown, its servers stopped); killed
    when it takes longer than ``wait`` seconds. An isolated keeper ends with its runner container."""
    state = keeper_state(run)
    if state and state.get('pid') and core.still_running(state):  # never a process that got its pid later
        try:
            os.killpg(state['pid'], signal.SIGINT)
            until = time.time() + wait
            while core.still_running(state) and time.time() < until:
                time.sleep(1)
            if core.still_running(state):
                os.killpg(state['pid'], signal.SIGKILL)
        except OSError:
            pass
    if state:
        if state.get('spec'):
            Path(state['spec']).unlink(missing_ok=True)
        (Path(run) / 'keeper.json').unlink(missing_ok=True)


def merge_films(earlier, films, reserved=None):
    """The index after a batch: a test filmed again replaces its earlier film and keeps its key; new tests get the
    key kept for them while the batch ran (``reserved``: a film handed over early), else the next free one (F1, F2…),
    so a story written against earlier keys stays valid. A scene that passed before keeps that film when it fails
    again (the film uses its last take that passed)."""
    good = lambda f: f.get('status') == 'passed' and not f.get('error')
    kept = {f.get('test_id') for f in earlier if f.get('gap') and good(f)}
    fresh = [f for f in films if not (f.get('gap') and f.get('test_id') in kept and not good(f))]
    again = {f['test_id'] for f in fresh if f.get('test_id')}
    keys = dict(reserved or {})
    keys.update({f.get('test_id'): f.get('key') for f in earlier})
    serial = max([int(k[1:]) for k in keys.values() if re.fullmatch(r'F\d+', k or '')] + [0])
    for film in films:
        film['key'] = keys.get(film.get('test_id'))
        if not film['key']:
            serial += 1
            film['key'] = f'F{serial}'
    return [f for f in earlier if f.get('test_id') not in again] + fresh


ANSI = re.compile(r'\x1b\[[0-9;]*m')


def outcomes(report_path):
    report = core.load(report_path, {})
    rows = []

    def walk(suite, trail):
        for spec in suite.get('specs') or []:
            for test in spec.get('tests') or []:
                last = (test.get('results') or [{}])[-1]
                rows.append({'id': spec.get('id'), 'file': spec.get('file'), 'line': spec.get('line'),
                             'title': ' › '.join(trail + [spec['title']]), 'status': last.get('status'),
                             'seconds': round((last.get('duration') or 0) / 1000, 1),
                             'error': ANSI.sub('', (last.get('error') or {}).get('message') or '')[:1500]})
        for child in suite.get('suites') or []:
            walk(child, trail + ([child['title']] if child.get('title') and not re.search(r'\.[cm]?[jt]sx?$', child['title']) else []))
    for suite in report.get('suites') or []:
        walk(suite, [])
    return rows
