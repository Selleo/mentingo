"""What this machine lacks for a release film, and how to install it here.

`start` (and so `run`) checks first and stops while something required is missing; `film.py doctor` checks alone.
Nothing is installed here: the agent shows the user what is missing with these commands and runs them once the user
approves (SKILL.md). What only the user can do (install Homebrew, start Docker Desktop, sign in) is listed apart."""
from concurrent.futures import ThreadPoolExecutor
import os
import platform
import re
import shutil
import subprocess
import sys

import core
import cut
import harness
import llm
import render_demo

MIN_PYTHON = (3, 9)  # the unit tests pass on 3.9 (macOS's own python3) up to 3.14
DOCKER_MEMORY_GB = 8  # a project's test stack beside the browsers (with a factory runner of its own)
COMPOSE = (2, 24)  # env_file entries with path/required in a project's compose files; Docker Desktop 4.3 had Compose 2.2
FREE_DISK_GB = 20  # test images, the release checkout, the takes and the film
CLI_FLAGS = ('--effort', '--max-budget-usd', '--permission-prompts', '--setting-sources', '--strict-mcp-config',
             '--no-session-persistence', '--tools', '--allowedTools')  # the scene workers' command line (gaps.py)
CLAUDE_CODE = 'npm install -g @anthropic-ai/claude-code@latest'
VOICE_SETUP = f"python3 {core.SKILL / 'scripts' / 'film.py'} voice-setup"
SIGN_IN = ('Sign in to Claude Code with a Claude subscription: run claude and /login on your machine; in CI set '
           'CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token` on the company Claude for Teams plan')
# what installs a need: (Homebrew formula, Homebrew cask, Debian/Ubuntu package); None where there is none
PACKAGES = {'python': ('python', None, 'python3'), 'git': ('git', None, 'git'), 'gh': ('gh', None, 'gh'),
            'node': ('node', None, None), 'ffmpeg': ('ffmpeg-full', None, 'ffmpeg'),
            'font': (None, 'font-dejavu', 'fonts-dejavu-core'), 'docker': (None, 'docker-desktop', None),
            'timeout': ('coreutils', None, 'coreutils'), 'pdf': ('poppler', None, 'poppler-utils'),
            'asdf': ('asdf', None, None)}
BY_HAND = {'docker': 'Install Docker: https://docs.docker.com/engine/install/',
           'node': "Install Node (the version of the project's E2E job), e.g. with nvm: https://github.com/nvm-sh/nvm",
           'asdf': 'Install asdf: https://asdf-vm.com/guide/getting-started.html'}


def probe(cmd, timeout=30):
    """(exit code, standard output) of a quick command; (None, '') when it cannot run."""
    try:
        done = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, stdin=subprocess.DEVNULL)
    except (OSError, subprocess.TimeoutExpired):
        return None, ''
    return done.returncode, done.stdout


def facts(recipe=None):
    """What this machine has, as plain values: judge() decides what it lacks."""
    which = shutil.which
    found = {'system': platform.system(), 'machine': platform.machine(), 'python': tuple(sys.version_info[:3]),
             'root': hasattr(os, 'geteuid') and os.geteuid() == 0, 'brew': bool(which('brew')),
             'apt': bool(which('apt-get')), 'git': bool(which('git')), 'gh': bool(which('gh')),
             'docker': bool(which('docker')), 'npx': bool(which('npx')), 'claude': bool(which('claude')),
             'timeout': bool(which('timeout') or which('gtimeout')),
             'pdf': bool(which('pdftoppm') and which('pdftotext') or sys.platform == 'darwin' and which('qlmanage')
                         and which('osascript')),  # macOS draws and reads a PDF itself (cut, takes)
             'asdf': bool(which('asdf')),
             'provider': llm.choose(), 'provider_chosen': os.environ.get('RELEASE_FILM_LLM', 'auto') != 'auto',
             'api_key': bool(os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('ANTHROPIC_AUTH_TOKEN'))}
    found['version'] = platform.mac_ver()[0] if found['system'] == 'Darwin' else platform.release()
    pool = ThreadPoolExecutor(max_workers=3)  # the slow answers at once: `claude auth status` alone takes seconds
    signed_in = pool.submit(llm.signed_in) if found['claude'] else None
    gh = pool.submit(probe, ['gh', 'auth', 'status']) if found['gh'] else None
    docker = pool.submit(probe, ['docker', 'info', '--format', '{{.MemTotal}}']) if found['docker'] else None
    compose = pool.submit(probe, ['docker', 'compose', 'version', '--short']) if found['docker'] else None
    pool.shutdown(wait=False)
    found['gh_signed_in'] = bool(gh) and gh.result()[0] == 0
    code, out = docker.result() if docker else (None, '')
    found['docker_running'] = code == 0
    found['docker_memory_gb'] = round(int(out.strip()) / 2 ** 30, 1) if code == 0 and out.strip().isdigit() else None
    code, out = compose.result() if compose else (None, '')
    version = re.search(r'(\d+)\.(\d+)', out) if code == 0 else None
    found['compose'] = tuple(map(int, version.groups())) if version else None
    code, out = probe(['node', '--version']) if which('node') else (None, '')
    found['node'] = out.strip() if code == 0 else None
    found['ffmpeg'] = core.tool('ffmpeg')
    found['ffmpeg_lacks'] = render_demo.lacks(found['ffmpeg']) if found['ffmpeg'] else []
    found['ffprobe'] = core.tool('ffprobe')
    try:
        found['font'] = cut.font_path()
    except SystemExit:
        found['font'] = None
    found['claude_flags_missing'], found['claude_signed_in'] = [], None
    if found['claude']:
        shown = probe(['claude', '--help'])[1]  # empty when it cannot answer: then its calls find out
        found['claude_flags_missing'] = [flag for flag in CLI_FLAGS if shown and flag not in shown]
        found['claude_signed_in'] = signed_in.result()
    found['disk_free_gb'] = round(shutil.disk_usage(core.HOME if core.HOME.exists() else core.REPO).free / 2 ** 30, 1)
    found['voice'] = os.environ.get('RELEASE_FILM_VOICE') or None  # a narrator chosen (cut.engine)
    found['voice_ready'] = cut.voice_ready()
    found['ci'] = os.environ.get('RELEASE_FILM_CI') == '1'
    node = (recipe or {}).get('node')
    if node:  # harness.toolchain puts asdf's install of it first on PATH, installing it with asdf when missing
        found['recipe_node'] = str(node)
        found['recipe_node_ready'] = bool(harness.node_home(str(node))) \
            or found['node'] == f'v{node}'
        found['asdf_nodejs'] = found['asdf'] and 'nodejs' in probe(['asdf', 'plugin', 'list'])[1].split()
    return found


def judge(found):
    """(missing, advised): what a film cannot be made without, and what makes it slower or poorer to be without."""
    missing, advised = [], []
    mac = found['system'] == 'Darwin'

    def need(name, why, required=True, **how):  # how: detail, package (PACKAGES), command (requires), manual
        (missing if required else advised).append(dict(name=name, why=why, **{k: v for k, v in how.items() if v}))

    if tuple(found['python']) < MIN_PYTHON:
        need('python', 'the scripts need Python %d.%d or newer' % MIN_PYTHON,
             detail='this is ' + '.'.join(map(str, found['python'])), package='python')
    if not found['git']:
        need('git', 'the release is checked out from Git', package='git')
    if not found['gh']:
        need('gh', "the release's pull requests come from GitHub", package='gh', manual='Sign in to GitHub: gh auth login')
    elif not found['gh_signed_in']:
        need('gh sign-in', "the release's pull requests come from GitHub", manual='Sign in to GitHub: gh auth login')
    start_docker = ('Open Docker Desktop once and give it at least %d GB of memory (Settings → Resources)'
                    % DOCKER_MEMORY_GB) if mac else 'Start Docker: sudo systemctl start docker'
    if not found['docker']:
        need('docker', "the project's test services run in containers", package='docker',
             manual=start_docker if mac else None)
    elif not found['docker_running']:
        need('docker running', "the project's test services run in containers", manual=start_docker)
    # a VM reports a little less than its setting: Docker Desktop set to 8 GB says 7.7 GB
    elif (found['docker_memory_gb'] or DOCKER_MEMORY_GB) < DOCKER_MEMORY_GB * 0.9:
        need('docker memory', "the project's test stack and the browsers need about %d GB" % DOCKER_MEMORY_GB,
             required=False, detail='%s GB' % found['docker_memory_gb'],
             manual='Give Docker at least %d GB of memory (Docker Desktop → Settings → Resources)' % DOCKER_MEMORY_GB)
    if found['docker'] and 'compose' in found and (found['compose'] is None or tuple(found['compose']) < COMPOSE):
        need('docker compose', "a project's test stack in Compose files of newer syntax does not load (they need "
             "%d.%d)" % COMPOSE, required=False, detail='%d.%d' % found['compose'] if found['compose'] else 'none',
             manual=('Update Docker Desktop (Check for updates in its menu, or brew install --cask docker-desktop)'
                     if mac else 'Update Docker Compose to %d.%d or newer (the docker-compose-plugin package)' % COMPOSE))
    if not found['node'] or not found['npx']:
        need('node', "the project's Playwright tests run on Node", package='node')
    if found.get('recipe_node') and not found.get('recipe_node_ready') and not found.get('asdf_nodejs'):
        why = "the project's recipe runs its tests on Node %s (installed with asdf)" % found['recipe_node']
        need('asdf' if not found['asdf'] else 'asdf nodejs', why, package=None if found['asdf'] else 'asdf',
             command='asdf plugin add nodejs')
    if not found['ffmpeg'] or found['ffmpeg_lacks']:
        # an Intel Mac gets no Homebrew bottle of ffmpeg-full: it builds 47 formulae from source, with current Command
        # Line Tools; a static build in the film home's tools is found first (core.FFMPEG_CANDIDATES)
        static = ("Or, on an Intel Mac, where Homebrew builds ffmpeg-full from source: put a static FFmpeg with drawtext "
                  f"and its ffprobe (evermeet.cx, linked from ffmpeg.org) in {core.HOME / 'tools' / 'bin'}")
        need('ffmpeg', 'the film is cut, captioned and encoded with FFmpeg', package='ffmpeg',
             detail=('lacks ' + ', '.join(found['ffmpeg_lacks'])) if found['ffmpeg_lacks'] else None,
             manual=static if mac and found['machine'] == 'x86_64' else None)
    elif not found['ffprobe']:
        need('ffprobe', 'takes and voice are measured with ffprobe', package='ffmpeg')
    if not found['font']:
        need('font', 'captions and titles need a font with Polish letters', package='font')
    sign_in = SIGN_IN
    if found['provider'] == 'cli' or not found['provider_chosen']:  # the Claude Code CLI, the default
        if not found['claude']:
            need('claude', 'the scene workers and the picture review run in the Claude Code CLI', command=CLAUDE_CODE,
                 requires='node', manual=sign_in)
        else:
            if found['claude_flags_missing']:
                need('claude update', 'the scene workers use options this Claude Code lacks', command=CLAUDE_CODE,
                     detail=', '.join(found['claude_flags_missing']))
            if found['claude_signed_in'] is False:
                need('claude sign-in', 'the scenes, the narration and the review call Claude Opus 5.5 on a Claude '
                     'subscription', manual=sign_in)
    if found.get('api_key'):
        need('api key', 'ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is set: the film leaves it out and runs on the '
             'Claude subscription', required=False)
    if not found['timeout']:
        need('timeout', 'a hard time limit for each scene worker (without it the run stops them itself)',
             required=False, package='timeout')
    if not found['pdf']:
        need('pdf tools', "a downloaded PDF's first page is shown and read", required=False, package='pdf')
    if found['disk_free_gb'] < FREE_DISK_GB:
        need('disk space', 'test images, the checkout, the takes and the film take about %d GB' % FREE_DISK_GB,
             required=False, detail='%s GB free' % found['disk_free_gb'], manual='Free some disk space')
    if found.get('voice') not in (None, 'edge', 'voxcpm'):
        need('voice', 'RELEASE_FILM_VOICE chooses the narrator: edge or voxcpm', detail=found['voice'])
    elif found.get('voice') == 'voxcpm' and not found.get('voice_ready'):
        need('voxcpm', 'RELEASE_FILM_VOICE=voxcpm asks for the VoxCPM2 narrator', command=VOICE_SETUP)
    return missing, advised


def plan(found, needs):
    """(install commands, manual steps) for these needs on this system: Homebrew on macOS; Homebrew, then apt, on
    Linux. Package installs come before the commands that use them (npm needs Node, asdf's plugin needs asdf)."""
    mac, linux = found['system'] == 'Darwin', found['system'] == 'Linux'
    formulae, casks, debs, commands, installs, then, steps, by_hand = [], [], [], [], [], [], [], set()
    for item in needs:
        formula, cask, deb = PACKAGES.get(item.get('package'), (None, None, None))
        if not item.get('package'):
            pass
        elif mac and (formula or cask):
            (formulae if formula else casks).append(formula or cask)
        elif linux and found['brew'] and formula:
            formulae.append(formula)
        elif linux and found['apt'] and deb:
            debs.append(deb)
        else:
            installs.append(BY_HAND.get(item['package'], 'Install ' + item['name']))
            by_hand.add(item['package'])
        if item.get('manual'):
            steps.append(item['manual'])
    for item in needs:  # a command that needs what the user installs by hand waits for it
        if item.get('command') and {item.get('package'), item.get('requires')} & by_hand:
            then.append('Then: ' + item['command'])
        elif item.get('command'):
            commands.append(item['command'])
    manual = installs + then + steps  # what to install by hand, what runs after it, then signing in and starting
    install = []
    if formulae:
        install.append('brew install ' + ' '.join(dict.fromkeys(formulae)))
    if casks:
        install.append('brew install --cask ' + ' '.join(dict.fromkeys(casks)))
    if debs:
        sudo = '' if found['root'] else 'sudo '
        install.append(f'{sudo}apt-get update && {sudo}apt-get install -y ' + ' '.join(dict.fromkeys(debs)))
    install += list(dict.fromkeys(commands))
    if (formulae or casks) and not found['brew']:
        manual.insert(0, 'Install Homebrew first: https://brew.sh (it asks for your password)')
    return install, list(dict.fromkeys(manual))


def check(repo=None):
    """The machine check: ok only when nothing required is missing. With ``repo`` its recipe's needs count too."""
    recipe = (core.addon(repo).get('harness') or {}) if repo else {}
    found = facts(recipe)
    missing, advised = judge(found)
    system = {'Darwin': 'macOS ' + found['version']}.get(found['system'], found['system'])
    result = {'ok': not missing, 'system': f"{system} {found['machine']}".strip()}
    if missing or advised:
        install, manual = plan(found, missing + advised)
        result.update(missing=missing, advised=advised, install=install, manual=manual,
                      next=('show the user what is missing and why, with the install commands; run them only once '
                            'the user approves, leave the manual steps to the user, then run film.py doctor again'))
    return result
