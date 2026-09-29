"""Shared helpers: run folders, JSON, timing marks, tools and a project's optional add-on."""
import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time

SKILL = Path(__file__).resolve().parents[1]
REPO = SKILL.parents[2]  # the repository that carries the skill
# resolved: on macOS /tmp and /var are links to /private/…, and a run's paths must compare equal however they are reached
HOME = Path(os.environ.get('RELEASE_FILM_HOME') or REPO / '.local' / 'release-film').resolve()
CADDY_VERSION = '2.11.4'
# an FFmpeg with drawtext, before the one on PATH (Homebrew's plain `ffmpeg` has none): a build put in the film home's
# tools (a static one where Homebrew has no bottle, macOS on Intel), then Homebrew's keg-only ffmpeg-full (Linux, macOS
# on Apple silicon, macOS on Intel)
FFMPEG_CANDIDATES = [HOME / 'tools' / 'bin' / 'ffmpeg', '/home/linuxbrew/.linuxbrew/opt/ffmpeg-full/bin/ffmpeg',
                     '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg', '/usr/local/opt/ffmpeg-full/bin/ffmpeg']
TTS_PYTHON = HOME / 'tools' / 'venv' / 'bin' / 'python'  # the skill's tools Python (edge-tts), made on first use


def load(path, default=None):
    path = Path(path)
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def save(path, value, mode=None):
    """``value`` as JSON at ``path``, whole or not at all (``write``)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    write(path, json.dumps(value, ensure_ascii=False, indent=1) + '\n', mode=mode)
    return path


def write(path, text, changed_only=False, mode=None):
    """``text`` at ``path`` through a temporary file of its own renamed over it: a reader never sees half a file, two
    writers never share a temporary file. ``changed_only``: nothing is written when the file holds it already (a file
    another process may be loading, such as the camera's scripts). ``mode``: its permissions (0o600 for secrets; else
    those it had, 0o644 for a new one). Whether it wrote."""
    path = Path(path)
    if changed_only:
        try:
            if path.read_text(encoding='utf-8') == text:
                return False
        except (OSError, UnicodeDecodeError):
            pass
    if mode is None:
        mode = path.stat().st_mode & 0o777 if path.exists() else 0o644
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, tmp = tempfile.mkstemp(dir=path.parent, prefix=f'.{path.name}.', suffix='.tmp')
    try:
        os.fchmod(handle, mode)
        with os.fdopen(handle, 'w', encoding='utf-8') as stream:
            stream.write(text)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    return True


PROC = Path('/proc/self/stat').exists()  # Linux; macOS asks its kernel, other systems `ps`
DARWIN = sys.platform == 'darwin'
_SYSCTL = []  # macOS: libc's sysctl, typed once


def process_state(pid):
    """(when the process started, whether it is a zombie), or (None, None) when there is no such process: field 22 of
    /proc/<pid>/stat on Linux (clock ticks after boot), elsewhere its start in whole seconds since the epoch: from the
    kernel's process table on macOS (no process to start, so a caller's mock of subprocess never meets it), else `ps`."""
    try:
        pid = int(pid)
    except (TypeError, ValueError):
        return None, None
    if PROC:
        try:
            fields = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
            return int(fields[19]), fields[0] == 'Z'
        except (OSError, IndexError, ValueError):
            return None, None
    if DARWIN:
        found = _darwin_state(pid)
        if found is not None:
            return found
    return _ps_state(pid)


def _darwin_state(pid):
    """(start, zombie) of a macOS process from sysctl KERN_PROC_PID, as `ps` and psutil read it: a struct kinfo_proc
    whose kp_proc begins with p_starttime (a timeval), with p_stat at byte 36 and p_pid at 40 (64-bit layout, Intel and
    Apple silicon alike). (None, None) when there is no such process; None when the answer is not that layout (`ps`
    then answers)."""
    import ctypes
    import ctypes.util
    import struct
    if not _SYSCTL:
        libc = ctypes.CDLL(ctypes.util.find_library('c'), use_errno=True)
        libc.sysctl.argtypes = [ctypes.POINTER(ctypes.c_int), ctypes.c_uint, ctypes.c_void_p,
                                ctypes.POINTER(ctypes.c_size_t), ctypes.c_void_p, ctypes.c_size_t]
        libc.sysctl.restype = ctypes.c_int
        _SYSCTL.append(libc.sysctl)
    buffer = ctypes.create_string_buffer(648)  # sizeof(struct kinfo_proc)
    size = ctypes.c_size_t(len(buffer))
    name = (ctypes.c_int * 4)(1, 14, 1, pid)  # CTL_KERN, KERN_PROC, KERN_PROC_PID
    if _SYSCTL[0](name, 4, buffer, ctypes.byref(size), None, 0) != 0:
        return None
    if size.value == 0:  # no such process
        return None, None
    seconds, = struct.unpack_from('=q', buffer, 0)
    status, found = struct.unpack_from('=b3xi', buffer, 36)
    if found != pid:
        return None
    return seconds, status == 5  # SZOMB


def _ps_state(pid):
    """(start, zombie) from `ps`, in the C locale and UTC: a Polish locale writes "pon. 28 wrz", another time zone
    another hour, and a state saved by one process is checked by others."""
    import calendar
    try:
        done = subprocess.run(['ps', '-o', 'lstart=', '-o', 'stat=', '-p', str(pid)], capture_output=True, text=True,
                              timeout=10, env=dict(os.environ, LC_ALL='C', TZ='UTC0'))
    except (OSError, subprocess.TimeoutExpired):
        return None, None
    line = (done.stdout or '').strip()
    if done.returncode or not line:
        return None, None
    since, _, status = line.rpartition(' ')  # "Mon Sep 28 07:03:27 2026 S"
    try:
        return calendar.timegm(time.strptime(' '.join(since.split()), '%a %b %d %H:%M:%S %Y')), status.startswith('Z')
    except ValueError:
        return None, None


def started_at(pid):
    """When a process started, None when there is no such process: with its pid, who it is (a pid is given again to a
    new process once its own ended)."""
    return process_state(pid)[0]


def still_running(state):
    """Whether the process a saved state names (``pid``, ``since``: its start) is still that process, alive and not a
    zombie. A legacy state without ``since`` cannot identify its process safely."""
    pid = (state or {}).get('pid')
    if not pid or state.get('since') is None:
        return False
    since, zombie = process_state(pid)
    return since is not None and not zombie and str(state['since']) == str(since)


def timeout_command(seconds):
    """The prefix that stops a command after ``seconds`` (and kills it 15 s later): GNU `timeout`, Homebrew's
    `gtimeout` on macOS, or none (the callers also stop what outlives its limit themselves)."""
    for name in ('timeout', 'gtimeout'):
        if shutil.which(name):
            return [name, '-k', '15', str(int(seconds))]
    return []


def keep_awake():
    """macOS: no idle sleep while this process runs (`caffeinate -i -w`): a sleeping Mac pauses the Docker VM and
    wakes with every scene worker past its deadline. Nothing elsewhere."""
    if DARWIN and shutil.which('caffeinate'):
        subprocess.Popen(['caffeinate', '-i', '-w', str(os.getpid())], stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


STAMP = ('import sys, time\n'  # a scene worker's log: each line of its `claude -p` stream after the time it arrived
         'for line in sys.stdin:\n    sys.stdout.write(f"{time.time():.1f} {line}")\n    sys.stdout.flush()\n')


def worker_events(path):
    """The events of a scene worker's log as [(arrival time or None, event)]: stream-json lines, each after its time
    (an older log holds one JSON answer, or a list of every message)."""
    try:
        text = Path(path).read_text(encoding='utf-8', errors='replace')
    except OSError:
        return []
    events = []
    for line in text.splitlines():
        stamp, _, rest = line.partition(' ')
        try:
            moment, value = float(stamp), json.loads(rest)
        except ValueError:
            try:
                moment, value = None, json.loads(line)
            except ValueError:
                continue
        events += [(moment, e) for e in (value if isinstance(value, list) else [value]) if isinstance(e, dict)]
    if not events and text.strip():
        try:
            value = json.loads(text)
            events = [(None, e) for e in (value if isinstance(value, list) else [value]) if isinstance(e, dict)]
        except ValueError:
            pass
    return events


TIME_UP = 'failed: time is up'  # a worker's answer when `try` refused a try past its time: not a verdict on the take


def gave_up(answer):
    """Whether a scene's worker gave up on it ("failed: …": it shows nothing, or its take is wrong), never when only its
    time ran out: a take that passed before then stays (one run lost a passed, narrated scene whose writer
    was still polishing it at its limit)."""
    answer = (answer or '').strip()
    return bool(re.match(r'failed\b', answer, re.I)) and not answer.lower().startswith(TIME_UP)


def worker_result(path):
    """The `result` event a scene worker's log ends with ({} when it was stopped before its answer)."""
    events = [e for _, e in worker_events(path)]
    return next((e for e in reversed(events) if e.get('type') == 'result'), None) or {}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def mark(run, stage, event, note=''):
    """One timing line (monotonic seconds) in <run>/timing.jsonl."""
    with (Path(run) / 'timing.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps({'utc': now(), 'mono': round(time.monotonic(), 3), 'wall': round(time.time(), 3),
                                 'stage': stage, 'event': event, 'note': note}) + '\n')


REPEATED = ('try', 'takes')  # stages that run once per scene try or capture batch: their times add up


def timings(run):
    """Seconds per stage from the marks: its latest start to the end that follows it (reruns replace attempts); the
    stages in REPEATED add up over their runs."""
    rows = [json.loads(line) for line in (Path(run) / 'timing.jsonl').read_text().splitlines() if line.strip()] \
        if (Path(run) / 'timing.jsonl').exists() else []
    # the wall clock where every mark has it: the monotonic clock of a WSL2 machine ran about 9% slow
    clock = 'wall' if rows and all('wall' in row for row in rows) else 'mono'
    stages, summed = {}, {}
    for row in rows:
        if row['event'] == 'start':
            stages[row['stage']] = [row[clock], None]
        elif row['event'] == 'end' and row['stage'] in stages and stages[row['stage']][1] is None:
            stages[row['stage']][1] = row[clock]
            if row['stage'] in REPEATED:
                summed[row['stage']] = summed.get(row['stage'], 0.0) + row[clock] - stages[row['stage']][0]
    found = {k: round(b - a, 1) for k, (a, b) in stages.items() if b is not None}
    return dict(found, **{k: round(v, 1) for k, v in summed.items()})


# Project commands inherit runtime basics and public CI metadata only. Everything else must be explicit in the
# trusted recipe's env: secrets with unexpected names and ambient execution hooks are not inherited.
PROJECT_ENV = frozenset(('HOME', 'PATH', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LANGUAGE', 'TZ', 'TERM', 'COLORTERM',
                         'NO_COLOR', 'FORCE_COLOR', 'TMPDIR', 'TMP', 'TEMP', 'XDG_RUNTIME_DIR', 'DISPLAY', 'WAYLAND_DISPLAY',
                         'ASDF_DIR', 'ASDF_DATA_DIR', 'PLAYWRIGHT_BROWSERS_PATH', 'DOCKER_HOST', 'CI', 'GITHUB_ACTIONS', 'GITHUB_WORKSPACE',
                         'GITHUB_JOB', 'GITHUB_RUN_ID', 'GITHUB_RUN_NUMBER', 'GITHUB_RUN_ATTEMPT', 'GITHUB_SHA', 'GITHUB_REF',
                         'GITHUB_REF_NAME', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF', 'GITHUB_REPOSITORY', 'RUNNER_TEMP',
                         'RUNNER_OS', 'RUNNER_ARCH', 'RUNNER_TOOL_CACHE'))


# CI credentials besides the seat's token, which only the film's own steps use (GitHub's API): a scene worker and the
# scene code it runs get none of them (gaps.worker_environ); ci/redact.py hides any that reached a run's files
CI_SECRETS = ('GH_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'ACTIONS_RUNTIME_URL', 'ACTIONS_CACHE_URL',
              'ACTIONS_RESULTS_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_URL')


def project_environ():
    """The allowlisted base of project commands; trusted recipe env values are added explicitly by the caller."""
    return {k: v for k, v in os.environ.items() if k in PROJECT_ENV or re.fullmatch(r'LC_[A-Z_]+', k)}


JOBS_MOST = 8  # render_demo.render_segments' most parallel encodes


def ci_profile():
    """Runner resources: locally the defaults. CI mode (RELEASE_FILM_CI=1) sizes for a 2-core, 8 GB runner (the film
    rendered on 2 jobs, at most 3 scenes checked at once) and its settings override that. ``workers`` is a cap, never
    extra parallelism; ``time_scale`` lengthens the scene workers' time on a slower runner."""
    profile = {'device_scale': 1.5, 'workers': None, 'jobs': 8, 'checks': 12, 'time_scale': 1.0}
    if os.environ.get('RELEASE_FILM_CI') != '1':
        return profile
    profile.update(jobs=2, checks=3)
    for key, suffix, convert in (('device_scale', 'DEVICE_SCALE', float), ('workers', 'WORKERS', int), ('jobs', 'JOBS', int),
                                 ('checks', 'CHECKS', int), ('time_scale', 'TIME_SCALE', float)):
        name = f'RELEASE_FILM_CI_{suffix}'
        if name not in os.environ:
            continue
        try:
            value = convert(os.environ[name])
            if not math.isfinite(value) or value <= 0:
                raise ValueError
        except ValueError:
            raise ValueError(f'{name} must be a positive {"number" if convert is float else "integer"}') from None
        if key == 'jobs' and value > JOBS_MOST:  # found out now, not when the film is rendered at the end of the run
            raise ValueError(f'{name} must be at most {JOBS_MOST} (render_demo renders on 1 to {JOBS_MOST} jobs)')
        profile[key] = value
    return profile


def shown(cmd):
    """The command as logged: values of ``-e NAME=value`` pairs are masked (they can hold per-run secrets)."""
    if isinstance(cmd, str):
        return re.sub(r'(-e\s+[A-Za-z_][A-Za-z0-9_]*=)(\S+)', r'\1***', cmd)
    parts, hide = [], False
    for part in map(str, cmd):
        parts.append(part.split('=', 1)[0] + '=***' if hide and '=' in part else part)
        hide = part in ('-e', '--env')
    return ' '.join(parts)


def environ(env=None, project=False):
    """The environment of a command: ours (or the project's allowlist) with ``env`` added, None values left out."""
    merged = dict(project_environ() if project else os.environ, **(env or {}))
    return {key: value for key, value in merged.items() if value is not None}


def descendants(pid):
    """The processes ``pid`` started and theirs, all the way down (their pids): from /proc on Linux, else `ps`."""
    children = {}
    if PROC:
        for entry in Path('/proc').iterdir():
            if entry.name.isdigit():
                try:
                    parent = int((entry / 'stat').read_text().rsplit(')', 1)[1].split()[1])
                except (OSError, IndexError, ValueError):
                    continue
                children.setdefault(parent, []).append(int(entry.name))
    else:
        try:
            listed = subprocess.run(['ps', '-A', '-o', 'pid=', '-o', 'ppid='], capture_output=True, text=True,
                                    timeout=30).stdout
        except (OSError, subprocess.TimeoutExpired):
            listed = ''
        for line in listed.splitlines():
            fields = line.split()
            if len(fields) == 2 and fields[0].isdigit() and fields[1].isdigit():
                children.setdefault(int(fields[1]), []).append(int(fields[0]))
    found, todo = [], [pid]
    while todo:
        for child in children.get(todo.pop(), []):
            if child not in found:
                found.append(child)
                todo.append(child)
    return found


def kill_tree(process):
    """A command out of time killed with everything it started: `npx playwright test` killed alone leaves the test
    run going (a new try would then start a second one on the same film set). Twice: a process started while the
    first ones were killed goes too."""
    for _ in range(2):
        for pid in descendants(process.pid):
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass
    process.kill()
    process.wait()


def run_command(cmd, timeout=None, input_text=None, **options):
    """subprocess.run, whose timeout ends the command with its whole tree (kill_tree)."""
    with subprocess.Popen(cmd, stdin=subprocess.PIPE if input_text is not None else None, **options) as process:
        try:
            out, err = process.communicate(input_text, timeout=timeout)
        except subprocess.TimeoutExpired:
            kill_tree(process)
            raise
        except BaseException:
            process.kill()
            raise
    return subprocess.CompletedProcess(process.args, process.returncode, out, err)


def sh(cmd, cwd=None, env=None, timeout=None, check=True, log=None, input_text=None, project=False):
    """Run a command; its output goes to ``log`` when given (appended), else it is captured and returned.
    ``input_text`` goes to its standard input. ``project``: one of the project's own commands (no secrets of ours).
    ``env`` adds to the environment; a value of None leaves that variable out. A command out of its ``timeout`` is
    killed with everything it started."""
    full_env = environ(env, project)
    if log:
        with open(log, 'a', encoding='utf-8') as stream:
            stream.write(f'\n$ {shown(cmd)}\n')
            stream.flush()
            completed = run_command(cmd, cwd=cwd, env=full_env, timeout=timeout, stdout=stream, stderr=subprocess.STDOUT,
                                    shell=isinstance(cmd, str), text=True, errors='replace', input_text=input_text)
    else:  # a diff or a log may hold bytes that are not UTF-8 (0x93 from a pasted Windows quote)
        completed = run_command(cmd, cwd=cwd, env=full_env, timeout=timeout, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True, errors='replace', shell=isinstance(cmd, str),
                                input_text=input_text)
    if check and completed.returncode != 0:
        tail = '' if log else (completed.stderr or completed.stdout or '')[-1500:]
        raise RuntimeError(f'command failed ({completed.returncode}): {shown(cmd)}'
                           f'\n{tail}' + (f'\nsee {log}' if log else ''))
    return completed


def sh_watching(cmd, tick, cwd=None, env=None, timeout=None, log=None, every=1.0, project=False):
    """``sh`` with the output going to ``log``, calling ``tick()`` every ``every`` seconds while the command runs and
    once after it ended."""
    full_env = environ(env, project)
    until = time.time() + timeout if timeout else None
    with open(log, 'a', encoding='utf-8') as stream:
        stream.write(f'\n$ {shown(cmd)}\n')
        stream.flush()
        process = subprocess.Popen(cmd, cwd=cwd, env=full_env, stdout=stream, stderr=subprocess.STDOUT, text=True)
        while True:
            try:
                process.wait(timeout=every)
                break
            except subprocess.TimeoutExpired:
                if until and time.time() > until:
                    kill_tree(process)
                    raise
                tick()
    tick()
    return subprocess.CompletedProcess(cmd, process.returncode)


def tool(name, home=True):
    """Path of a tool this skill needs, or None. ``home=False``: never one in the film home (the tests: nothing in a
    developer's .local is read)."""
    if name == 'ffmpeg':
        for candidate in FFMPEG_CANDIDATES if home else FFMPEG_CANDIDATES[1:]:
            if Path(candidate).exists():
                return str(candidate)
        return shutil.which('ffmpeg')
    if name == 'ffprobe':  # the one beside the FFmpeg in use: a keg-only or static build is not on PATH
        ffmpeg = tool('ffmpeg', home)
        beside = Path(ffmpeg).with_name('ffprobe') if ffmpeg else None
        return str(beside) if beside and beside.exists() else shutil.which('ffprobe')
    if name == 'tts-python':
        return str(TTS_PYTHON) if TTS_PYTHON.exists() else None
    if name == 'caddy':
        return str(HOME / 'tools' / 'bin' / 'caddy') if (HOME / 'tools' / 'bin' / 'caddy').exists() else shutil.which('caddy')
    return shutil.which(name)


def ensure_python(packages):
    """The skill's tools Python (a venv in HOME/tools, made on first use) with ``packages`` installed."""
    venv = HOME / 'tools' / 'venv'
    python = venv / 'bin' / 'python'
    if not python.exists():  # this Python, not PATH's python3 (macOS: Xcode's or a version manager's older one)
        sh([sys.executable, '-m', 'venv', str(venv)])
    missing = [p for p in packages if sh([str(python), '-m', 'pip', 'show', '-q', p.split('==')[0]], check=False).returncode]
    if missing:
        sh([str(python), '-m', 'pip', 'install', '-q', *missing], timeout=600)
    return str(python)


_DOCKER_HOST = []


def docker_host():
    """The Docker daemon the user's client reaches, for commands given a client config of their own (a DOCKER_CONFIG
    without the user's current context): DOCKER_HOST as set, else the current context's endpoint when it is not the
    default socket (Docker Desktop without its /var/run/docker.sock link, colima). None when the default is right."""
    if not _DOCKER_HOST:
        host = os.environ.get('DOCKER_HOST')
        if not host and shutil.which('docker'):
            try:
                host = subprocess.run(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
                                      capture_output=True, text=True, timeout=30, stdin=subprocess.DEVNULL).stdout.strip()
            except (OSError, subprocess.TimeoutExpired):
                host = None
        _DOCKER_HOST.append(host if host and host != 'unix:///var/run/docker.sock' else None)
    return _DOCKER_HOST[0]


def ensure_tts():
    """The Python that has edge-tts (free Microsoft voices): the tools venv, finished when an earlier install into it
    was cut short (no network, Ctrl+C: a venv without the package would fail every narration)."""
    found = tool('tts-python')
    if found and sh([found, '-c', 'import edge_tts'], check=False, timeout=120).returncode == 0:
        return found
    return ensure_python(['edge-tts==7.2.8'])


def ensure_caddy():
    """Caddy (the page server, with range requests for seeking; some projects' tests start it too), downloaded once
    from its GitHub release and checked against the release's checksums when it is missing. None when unavailable."""
    found = tool('caddy')
    if found:
        return found
    import hashlib
    import io
    import platform
    import tarfile
    import urllib.request
    system = {'Linux': 'linux', 'Darwin': 'mac'}.get(platform.system())
    arch = {'x86_64': 'amd64', 'amd64': 'amd64', 'aarch64': 'arm64', 'arm64': 'arm64'}.get(platform.machine().lower())
    if not system or not arch:
        return None
    base = f'https://github.com/caddyserver/caddy/releases/download/v{CADDY_VERSION}/'
    archive = f'caddy_{CADDY_VERSION}_{system}_{arch}.tar.gz'
    try:
        with urllib.request.urlopen(base + f'caddy_{CADDY_VERSION}_checksums.txt', timeout=60) as response:
            sums = dict(reversed(line.split()) for line in response.read().decode().splitlines() if len(line.split()) == 2)
        with urllib.request.urlopen(base + archive, timeout=300) as response:
            data = response.read()
    except OSError:
        return None
    if hashlib.sha512(data).hexdigest() != sums.get(archive):
        raise RuntimeError(f'the Caddy download does not match its published checksum ({archive})')
    target = HOME / 'tools' / 'bin' / 'caddy'
    target.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data)) as bundle:
        target.write_bytes(bundle.extractfile(bundle.getmember('caddy')).read())
    target.chmod(0o755)
    return str(target)


def project_key(repo):
    return repo.replace('/', '__').lower()


TAG_HARNESS_SAFE = frozenset(('unavailable',))  # every other recipe key can select or steer executed project code


def addon(repo, checkout=None):
    """The project's optional add-on, merged in rising precedence: ``projects/<owner>__<name>.json`` shipped with the
    skill, ``.release-film.json`` in the project's repository, the local ``.local/release-film/projects/`` file.
    Everything in it is optional (brand font, voice, editor notes, test preferences, environment recipe). The tag's
    own harness contributes only ``unavailable`` unless the local project file explicitly sets
    ``trust_tag_harness: true`` or RELEASE_FILM_TRUST_TAG=1. A tag cannot grant itself trust; blocked keys are listed
    in ``untrusted``. Brand, voice and other non-harness add-ons remain available."""
    merged, untrusted = {}, []
    local = HOME / 'projects' / f'{project_key(repo)}.json'
    local_data = load(local, {})
    trusted = (isinstance(local_data, dict) and local_data.get('trust_tag_harness') is True) \
        or os.environ.get('RELEASE_FILM_TRUST_TAG') == '1'
    sources = [SKILL / 'projects' / f'{project_key(repo)}.json'] + ([Path(checkout) / '.release-film.json'] if checkout else []) \
        + [local]
    for path in sources:
        data = load(path)
        if not isinstance(data, dict):
            continue
        recipe = data.get('harness')
        if path.name == '.release-film.json':
            data = {k: v for k, v in data.items() if k != 'trust_tag_harness'}
            if isinstance(recipe, dict) and not trusted:
                untrusted = sorted(k for k in recipe if k not in TAG_HARNESS_SAFE)
                data = dict(data, harness={k: v for k, v in recipe.items() if k in TAG_HARNESS_SAFE})
        for key, value in data.items():
            merged[key] = dict(merged[key], **value) if isinstance(value, dict) and isinstance(merged.get(key), dict) else value
    if untrusted:
        merged['untrusted'] = untrusted
    return merged


def run_dir(repo, tag, run_id=None):
    name = run_id or dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    return HOME / 'runs' / project_key(repo) / tag / name
