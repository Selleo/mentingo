"""Shared helpers: files written whole, processes known by their start and not by their pid alone."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import unittest.mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import core  # noqa: E402


class Writes(unittest.TestCase):
    def test_writers_at_once_never_share_a_temporary_file_and_leave_none(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'state.json'
            failures = []

            def writer(n):
                try:
                    for i in range(40):
                        core.save(target, {'writer': n, 'i': i, 'pad': 'x' * 2000})
                        core.load(target)  # a reader never sees half a file
                except Exception as error:  # noqa: BLE001
                    failures.append(error)
            threads = [threading.Thread(target=writer, args=(n,)) for n in range(6)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
            self.assertEqual(failures, [])
            self.assertEqual([p.name for p in Path(folder).iterdir()], ['state.json'])

    def test_a_file_unchanged_is_not_written_again_and_modes_hold(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'demo.config.ts'
            self.assertTrue(core.write(target, 'one', changed_only=True))
            self.assertEqual(oct(target.stat().st_mode & 0o777), '0o644')
            before = target.stat().st_ino
            self.assertFalse(core.write(target, 'one', changed_only=True))
            self.assertEqual(target.stat().st_ino, before)  # not replaced: a process loading it reads it whole
            secret = Path(folder) / 'secrets.json'
            core.save(secret, {'k': 'v'}, mode=0o600)
            core.save(secret, {'k': 'w'})
            self.assertEqual(oct(secret.stat().st_mode & 0o777), '0o600')  # a rewrite keeps the file's mode


class Secrets(unittest.TestCase):
    def test_the_projects_commands_never_get_our_secrets(self):
        from unittest import mock
        with mock.patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'k', 'GITHUB_TOKEN': 't', 'NPM_TOKEN': 'n', 'PATH': '/bin',
                                          'GITHUB_ACTIONS': 'true', 'CI': 'true', 'PGPASSWORD': 'p', 'HOME': '/home/x'}):
            passed = core.project_environ()
            self.assertEqual({k for k in ('ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'NPM_TOKEN', 'PGPASSWORD') if k in passed}, set())
            self.assertEqual((passed['GITHUB_ACTIONS'], passed['CI'], passed['PATH']), ('true', 'true', '/bin'))
            out = core.sh([sys.executable, '-c', 'import os; print("ANTHROPIC_API_KEY" in os.environ, os.environ["DB_PASSWORD"])'],
                          env={'DB_PASSWORD': 'from the recipe'}, project=True).stdout
            self.assertEqual(out.strip(), 'False from the recipe')  # a recipe's own values still pass


class Processes(unittest.TestCase):
    def test_a_process_is_known_by_its_pid_and_start(self):
        process = subprocess.Popen(['sleep', '30'])
        try:
            state = {'pid': process.pid, 'since': core.started_at(process.pid)}
            self.assertIsNotNone(state['since'])
            self.assertTrue(core.still_running(state))
            self.assertFalse(core.still_running(dict(state, since=state['since'] - 1)))  # its pid, another process
            self.assertFalse(core.still_running({'pid': process.pid}))  # legacy states cannot identify the process
        finally:
            process.kill()
            process.wait()
        self.assertFalse(core.still_running(state))
        self.assertIsNone(core.started_at(process.pid))
        self.assertFalse(core.still_running({}))

    def test_without_proc_a_process_is_known_by_its_start_from_ps(self):  # other systems without /proc
        with unittest.mock.patch.object(core, 'PROC', False), unittest.mock.patch.object(core, 'DARWIN', False), \
                unittest.mock.patch.dict(os.environ, {'LC_ALL': 'pl_PL.UTF-8', 'TZ': 'Europe/Warsaw'}):
            process = subprocess.Popen(['sleep', '30'])
            try:
                state = {'pid': process.pid, 'since': core.started_at(process.pid)}
                self.assertIsInstance(state['since'], int)  # seconds since the epoch, whatever the locale or zone
                self.assertLess(abs(state['since'] - time.time()), 60)
                self.assertTrue(core.still_running(state))
                self.assertFalse(core.still_running(dict(state, since=state['since'] - 1)))
            finally:
                process.kill()
                process.wait()
            self.assertFalse(core.still_running(state))
            self.assertIsNone(core.started_at(process.pid))

    @unittest.skipUnless(sys.platform == 'darwin', 'the kernel process table of macOS')
    def test_on_macos_the_kernel_tells_the_start_and_a_zombie(self):
        process = subprocess.Popen(['sleep', '30'])
        try:
            since, zombie = core._darwin_state(process.pid)
            self.assertEqual((since, zombie), core._ps_state(process.pid))  # the same second as `ps` reads
            with unittest.mock.patch.object(core.subprocess, 'run', side_effect=AssertionError('no process started')):
                self.assertTrue(core.still_running({'pid': process.pid, 'since': since}))
        finally:
            process.kill()
        until = time.time() + 5  # killed, not reaped yet: a zombie, which is not running
        while core.process_state(process.pid) != (since, True) and time.time() < until:
            time.sleep(0.05)
        self.assertEqual(core.process_state(process.pid), (since, True))
        self.assertFalse(core.still_running({'pid': process.pid, 'since': since}))
        process.wait()
        self.assertEqual(core.process_state(process.pid), (None, None))

    def test_a_mac_stays_awake_while_a_long_command_runs(self):
        with unittest.mock.patch.object(core.subprocess, 'Popen') as popen, \
                unittest.mock.patch.object(core.shutil, 'which', return_value='/usr/bin/caffeinate'):
            with unittest.mock.patch.object(core, 'DARWIN', True):
                core.keep_awake()
            popen.assert_called_once()
            self.assertEqual(popen.call_args.args[0], ['caffeinate', '-i', '-w', str(os.getpid())])
            with unittest.mock.patch.object(core, 'DARWIN', False):
                core.keep_awake()
            popen.assert_called_once()  # elsewhere nothing

    def test_a_command_is_limited_by_timeout_or_gtimeout_or_by_its_caller(self):
        found = {'timeout': None, 'gtimeout': '/opt/homebrew/bin/gtimeout'}
        with unittest.mock.patch.object(core.shutil, 'which', side_effect=lambda name: found.get(name)):
            self.assertEqual(core.timeout_command(900), ['gtimeout', '-k', '15', '900'])
            found['gtimeout'] = None
            self.assertEqual(core.timeout_command(900), [])  # the callers stop what outlives its limit themselves


class Tools(unittest.TestCase):
    def test_ffprobe_is_the_one_beside_the_ffmpeg_in_use(self):  # a keg-only or static FFmpeg is not on PATH
        with tempfile.TemporaryDirectory() as folder:
            ffmpeg, ffprobe = Path(folder) / 'ffmpeg', Path(folder) / 'ffprobe'
            ffmpeg.touch()
            with unittest.mock.patch.object(core, 'FFMPEG_CANDIDATES', ['/nowhere/ffmpeg', ffmpeg]), \
                    unittest.mock.patch.object(core.shutil, 'which', return_value='/usr/bin/ffprobe'):
                self.assertEqual(core.tool('ffmpeg'), str(ffmpeg))
                self.assertEqual(core.tool('ffprobe'), '/usr/bin/ffprobe')  # none beside it: PATH's
                ffprobe.touch()
                self.assertEqual(core.tool('ffprobe'), str(ffprobe))
        self.assertIn('/usr/local/opt/ffmpeg-full/bin/ffmpeg', core.FFMPEG_CANDIDATES)  # Homebrew on an Intel Mac
        self.assertEqual(core.FFMPEG_CANDIDATES[0], core.HOME / 'tools' / 'bin' / 'ffmpeg')

    def test_the_docker_daemon_is_the_users_current_context_unless_it_is_the_default(self):
        def answer(host):
            return unittest.mock.patch.object(core.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, host + '\n'))
        cases = [({}, 'unix:///Users/x/.docker/run/docker.sock', 'unix:///Users/x/.docker/run/docker.sock'),
                 ({}, 'unix:///var/run/docker.sock', None),
                 ({'DOCKER_HOST': 'tcp://127.0.0.1:2375'}, 'unix:///ignored.sock', 'tcp://127.0.0.1:2375')]
        for environ, context, expected in cases:
            with self.subTest(context=context), unittest.mock.patch.object(core, '_DOCKER_HOST', []), \
                    unittest.mock.patch.dict(os.environ, environ), answer(context), \
                    unittest.mock.patch.object(core.shutil, 'which', return_value='/usr/local/bin/docker'):
                if not environ:
                    os.environ.pop('DOCKER_HOST', None)
                self.assertEqual(core.docker_host(), expected)
        with unittest.mock.patch.dict(os.environ, {'DOCKER_HOST': 'unix:///x.sock', 'DOCKER_CONTEXT': 'colima'}):
            self.assertEqual(core.project_environ().get('DOCKER_HOST'), 'unix:///x.sock')
            self.assertNotIn('DOCKER_CONTEXT', core.project_environ())  # a context name means nothing to another config


class EnvironmentPolicy(unittest.TestCase):
    def test_only_runtime_basics_and_public_ci_metadata_are_inherited(self):
        from unittest import mock
        with mock.patch.dict(os.environ, {'HOME': '/home/user', 'PATH': '/bin', 'CI': 'true', 'LC_ALL': 'C.UTF-8',
                                          'CUSTOM_CREDENTIAL': 'private', 'SENTRY_DSN': 'private', 'NODE_OPTIONS': '--require evil',
                                          'PYTHONPATH': '/untrusted', 'BASH_ENV': '/untrusted', 'GITHUB_ENV': '/ci/env'}, clear=True):
            self.assertEqual(core.project_environ(), {'HOME': '/home/user', 'PATH': '/bin', 'CI': 'true', 'LC_ALL': 'C.UTF-8'})
            result = core.sh([sys.executable, '-c', 'import os; print(os.getenv("DB_PASSWORD"), os.getenv("NODE_OPTIONS"))'],
                             env={'DB_PASSWORD': 'recipe-value'}, project=True)
            self.assertEqual(result.stdout.strip(), 'recipe-value None')

    def test_ci_resources_are_optional_validated_and_disabled_by_default(self):
        from unittest import mock
        local = {'device_scale': 1.5, 'workers': None, 'jobs': 8, 'checks': 12, 'time_scale': 1.0}
        with mock.patch.dict(os.environ, {'RELEASE_FILM_CI_WORKERS': 'bad', 'RELEASE_FILM_CI_JOBS': '2'}, clear=True):
            self.assertEqual(core.ci_profile(), local)  # CI settings count only in CI mode: nothing changes locally
        with mock.patch.dict(os.environ, {'RELEASE_FILM_CI': '1'}, clear=True):
            self.assertEqual(core.ci_profile(), dict(local, jobs=2, checks=3))  # a 2-core, 8 GB runner
            for name, value in (('DEVICE_SCALE', 'nan'), ('WORKERS', '1.5'), ('JOBS', '0'), ('CHECKS', '-1'),
                                ('TIME_SCALE', '0')):
                with self.subTest(name=name), mock.patch.dict(os.environ, {f'RELEASE_FILM_CI_{name}': value}):
                    with self.assertRaisesRegex(ValueError, f'RELEASE_FILM_CI_{name}'):
                        core.ci_profile()
            with mock.patch.dict(os.environ, {'RELEASE_FILM_CI_DEVICE_SCALE': '1', 'RELEASE_FILM_CI_WORKERS': '2',
                                              'RELEASE_FILM_CI_JOBS': '3', 'RELEASE_FILM_CI_CHECKS': '5',
                                              'RELEASE_FILM_CI_TIME_SCALE': '1.5'}):
                self.assertEqual(core.ci_profile(), {'device_scale': 1.0, 'workers': 2, 'jobs': 3, 'checks': 5,
                                                     'time_scale': 1.5})

    def test_a_slower_runner_gives_the_scene_workers_more_time_and_none_locally(self):
        import subprocess
        scripts = Path(core.__file__).resolve().parent
        asked = 'import gaps; print(gaps.SCENE_TRIES, gaps.SCENE_LIMIT, gaps.TRY_WINDOW, gaps.CAMERA_CREDIT)'
        base = {k: v for k, v in os.environ.items() if not k.startswith('RELEASE_FILM_CI')}
        for extra, expected in (({}, '420 480 300 300'), ({'RELEASE_FILM_CI_TIME_SCALE': '1.5'}, '420 480 300 300'),
                                ({'RELEASE_FILM_CI': '1', 'RELEASE_FILM_CI_TIME_SCALE': '1.5'}, '630 720 450 450')):
            with self.subTest(extra=extra):
                done = subprocess.run([sys.executable, '-B', '-c', asked], cwd=scripts, env=dict(base, **extra),
                                      capture_output=True, text=True, timeout=60, check=True)
                self.assertEqual(done.stdout.strip(), expected)

    def test_a_tag_cannot_trust_its_own_executable_recipe(self):
        from unittest import mock
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            skill, home, checkout = root / 'skill', root / 'home', root / 'checkout'
            tag = {'trust_tag_harness': True, 'brand': {'font': {'family': 'Demo'}}, 'pronunciation': {'Demo': 'Demo'},
                   'harness': {'config': 'unsafe.config.ts', 'isolate': {'image': 'untrusted:latest'}, 'args': ['--config=other.ts'],
                               'node': '0.1.0', 'install': ['unsafe'], 'env': {'NODE_OPTIONS': 'unsafe'},
                               'new_executable_key': 'unsafe', 'unavailable': ['payments']}}
            core.save(skill / 'projects' / 'owner__project.json', {'harness': {'config': 'e2e/playwright.config.ts', 'install': ['safe']}})
            core.save(checkout / '.release-film.json', tag)
            with mock.patch.object(core, 'SKILL', skill), mock.patch.object(core, 'HOME', home), mock.patch.dict(os.environ, {}, clear=True):
                found = core.addon('Owner/project', checkout)
                self.assertEqual(found['harness'], {'config': 'e2e/playwright.config.ts', 'install': ['safe'], 'unavailable': ['payments']})
                self.assertEqual(found['brand'], tag['brand'])
                self.assertEqual(found['pronunciation'], tag['pronunciation'])
                self.assertIn('isolate', found['untrusted'])
                self.assertIn('new_executable_key', found['untrusted'])
                self.assertNotIn('trust_tag_harness', found)
                core.save(home / 'projects' / 'owner__project.json', {'trust_tag_harness': True, 'harness': {'install': ['local']}})
                trusted = core.addon('Owner/project', checkout)
                self.assertEqual(trusted['harness']['config'], 'unsafe.config.ts')
                self.assertEqual(trusted['harness']['install'], ['local'])
                self.assertNotIn('untrusted', trusted)
                core.save(home / 'projects' / 'owner__project.json', {})
                with mock.patch.dict(os.environ, {'RELEASE_FILM_TRUST_TAG': '1'}):
                    self.assertEqual(core.addon('Owner/project', checkout)['harness']['config'], 'unsafe.config.ts')


class Timeouts(unittest.TestCase):
    def test_a_command_out_of_time_is_killed_with_everything_it_started(self):
        with tempfile.TemporaryDirectory() as folder:
            pids = Path(folder) / 'pids'
            script = f'sleep 41 & echo $! >> {pids}; sh -c "sleep 42 & echo \\$! >> {pids}; wait" & wait'
            for run in (lambda: core.sh(['sh', '-c', script], timeout=1),
                        lambda: core.sh(['sh', '-c', script], timeout=1, log=Path(folder) / 'log'),
                        lambda: core.sh_watching(['sh', '-c', script], lambda: None, timeout=1, log=Path(folder) / 'log')):
                pids.write_text('')
                with self.assertRaises(subprocess.TimeoutExpired):
                    run()
                time.sleep(0.2)
                started = [int(p) for p in pids.read_text().split()]
                self.assertEqual(len(started), 2)
                self.assertFalse([p for p in started if core.process_state(p)[0] is not None and not core.process_state(p)[1]])

    def test_a_command_in_time_behaves_as_before(self):
        done = core.sh(['sh', '-c', 'cat; echo err >&2; exit 3'], input_text='in', check=False)
        self.assertEqual((done.stdout, done.stderr, done.returncode), ('in', 'err\n', 3))


class Voice(unittest.TestCase):
    def test_a_tools_venv_left_without_edge_tts_is_finished(self):
        with unittest.mock.patch.object(core, 'tool', return_value='/venv/bin/python'), \
                unittest.mock.patch.object(core, 'sh', return_value=subprocess.CompletedProcess([], 1, '', 'No module')), \
                unittest.mock.patch.object(core, 'ensure_python', return_value='/venv/bin/python') as ensured:
            self.assertEqual(core.ensure_tts(), '/venv/bin/python')
        ensured.assert_called_once_with(['edge-tts==7.2.8'])
        with unittest.mock.patch.object(core, 'tool', return_value='/venv/bin/python'), \
                unittest.mock.patch.object(core, 'sh', return_value=subprocess.CompletedProcess([], 0, '', '')), \
                unittest.mock.patch.object(core, 'ensure_python') as ensured:
            self.assertEqual(core.ensure_tts(), '/venv/bin/python')
        ensured.assert_not_called()


class Profile(unittest.TestCase):
    def test_more_jobs_than_the_render_takes_are_refused_at_once(self):
        with unittest.mock.patch.dict(os.environ, {'RELEASE_FILM_CI': '1', 'RELEASE_FILM_CI_JOBS': '12'}):
            with self.assertRaisesRegex(ValueError, 'at most 8'):
                core.ci_profile()
        with unittest.mock.patch.dict(os.environ, {'RELEASE_FILM_CI': '1', 'RELEASE_FILM_CI_JOBS': '8'}):
            self.assertEqual(core.ci_profile()['jobs'], 8)


if __name__ == '__main__':
    unittest.main()
