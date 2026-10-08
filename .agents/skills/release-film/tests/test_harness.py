"""The harness: specs filmed through their own imports, the demo config and the recipe's secrets."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import harness  # noqa: E402


class Specs(unittest.TestCase):
    def test_the_test_import_is_swapped_for_the_filmed_one(self):
        source = 'import { expect, test } from "../fixtures/test";\nimport { x } from "./x";\n\ntest("a", async () => {});\n'
        wrapped = harness.wrap_spec(source, '../../.release-film/capture/capture')
        self.assertIn('import { expect, test as __rfProjectTest } from "../fixtures/test";', wrapped)
        self.assertIn('import { withCapture as __rfWithCapture } from "../../.release-film/capture/capture";', wrapped)
        self.assertIn('const test = __rfWithCapture(__rfProjectTest);', wrapped)
        self.assertTrue(wrapped.rstrip().endswith('test("a", async () => {});'))

    def test_specs_that_import_test_otherwise_are_left_alone(self):
        self.assertIsNone(harness.wrap_spec('import { test as base } from "@playwright/test";\n', './capture'))

    def test_the_demo_config_films_the_project_config(self):
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / 'playwright.config.ts'
            config.write_text('export default {}')
            target = harness.demo_config(config).read_text()
            self.assertIn('import base from "./playwright.config";', target)
            self.assertIn('deviceScaleFactor: Number(process.env.DEMO_DEVICE_SCALE || 1.5)', target)
            self.assertIn('demo--', target)
            self.assertIn('600_000', target)  # the app's web servers get time to start on a busy machine
            self.assertIn('process.env.DEMO_TRY === "1"', target)  # a tried scene fails fast on a wrong locator
            self.assertIn('actionTimeout: Math.min(use?.actionTimeout || 15_000, 15_000)', target)

    def test_with_the_set_kept_up_the_demo_config_sets_nothing_up_again(self):
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / 'playwright.config.ts'
            config.write_text('export default {}')
            target = harness.demo_config(config).read_text()
            self.assertIn('...(reuse ? { globalSetup: undefined, globalTeardown: undefined } : {})', target)
            self.assertIn('reuseExistingServer: true', target)
            self.assertIn('process.env.DEMO_KEEPER_ENV', target)  # the variables the keeper's setup added

    def test_only_a_config_with_one_off_work_needs_a_keeper(self):
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / 'playwright.config.ts'
            for text, expected in (('export default { globalSetup: "./global-setup.ts" }', True),
                                   ('export default { webServer: { command: "npm start", port: 3000 } }', True),
                                   ('export default { projects: [{ name: "a", dependencies: ["setup"] }] }', True),
                                   ('export default { testDir: "./specs", workers: 2 }', False)):
                config.write_text(text)
                self.assertEqual(harness.one_off(config), expected, text)
            run = Path(folder) / 'run'
            (run / 'checkout').mkdir(parents=True)
            (run / 'checkout' / 'playwright.config.ts').write_text('export default { testDir: "./specs" }')
            self.assertIsNone(harness.keep_set(run, {'config': 'playwright.config.ts'}, {}))

    def test_a_run_with_the_set_kept_up_skips_the_setup_projects(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'checkout' / 'e2e').mkdir(parents=True)
            (run / 'checkout' / 'e2e' / 'playwright.config.ts').write_text('export default { globalSetup: "./g.ts" }')
            (run / 'checkout' / 'e2e' / 'a.spec.ts').write_text('import { test } from "@playwright/test";\ntest("a", async () => {});\n')
            (run / 'keeper.json').write_text(json.dumps({'pid': 1}))
            with mock.patch.object(harness.core, 'sh', return_value=subprocess.CompletedProcess([], 0, '', '')) as sh, \
                    mock.patch.object(harness.core, 'mark'), mock.patch.object(harness.core, 'tool', return_value='ffmpeg'):
                harness.capture(run, {'config': 'e2e/playwright.config.ts'}, {'PATH': '/bin'}, [('e2e/a.spec.ts', 2)])
            cmd, env = sh.call_args.args[0], sh.call_args.kwargs['env']
            self.assertIn('--no-deps', cmd)
            self.assertEqual(cmd[-1], 'demo--a.spec.ts:2')
            self.assertEqual(env['DEMO_REUSE_SERVERS'], '1')
            self.assertEqual(env['DEMO_KEEPER_ENV'], str(run.resolve() / harness.KEEPER_ENV))
            self.assertFalse((run / 'checkout' / 'e2e' / 'demo--a.spec.ts').exists())  # the filmed copy is removed


class Serial(unittest.TestCase):
    def test_a_project_that_runs_one_test_at_a_time(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'checkout').mkdir()
            config = run / 'checkout' / 'playwright.config.ts'
            for text, expected in (('workers: 1,', True), ('workers: process.env.CI ? 1 : undefined,', True),
                                   ('workers: WORKER_COUNT,', False), ('fullyParallel: true,', False)):
                config.write_text(f'export default {{ {text} }}')
                self.assertEqual(harness.serial(run, {'config': 'playwright.config.ts'}), expected, text)
            self.assertFalse(harness.serial(run, {'config': 'playwright.config.ts', 'workers': 4}))
            self.assertTrue(harness.serial(run, {'config': 'playwright.config.ts', 'workers': 1}))


class Keepers(unittest.TestCase):
    def test_cleanup_during_start_cancels_retry_and_delayed_callers(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'checkout').mkdir()
            (run / 'checkout/playwright.config.ts').write_text('export default { globalSetup: "./setup.ts" };')
            child = subprocess.Popen(['sleep', '30'], start_new_session=True)
            launched = threading.Event()

            def launch(*args, **kwargs):
                launched.set()
                return child

            try:
                with mock.patch.object(harness.subprocess, 'Popen', side_effect=launch) as popen, \
                        mock.patch.object(harness.core, 'mark'), ThreadPoolExecutor(max_workers=1) as pool:
                    starting = pool.submit(harness.keep_set, run, {'config': 'playwright.config.ts'}, {})
                    self.assertTrue(launched.wait(5))
                    harness.stop_keeper(run, wait=10)
                    with self.assertRaisesRegex(RuntimeError, 'startup cancelled'):
                        starting.result(timeout=5)
                    with self.assertRaisesRegex(RuntimeError, 'startup cancelled'):
                        harness.keep_set(run, {'config': 'playwright.config.ts'}, {})
                    self.assertEqual(popen.call_count, 1)
                self.assertFalse((run / 'keeper.json').exists())
                self.assertIsNotNone(child.wait(timeout=5))
            finally:
                child.kill()
                child.wait()

    def test_failed_startup_records_and_stops_its_process(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'checkout').mkdir()
            (run / 'checkout' / 'playwright.config.ts').write_text('export default { globalSetup: "./setup.ts" };')
            process = subprocess.Popen(['sleep', '60'], start_new_session=True)
            seen = []

            def alive(_run, _recipe, state):
                seen.append(harness.core.load(run / 'keeper.json'))
                return harness.core.still_running(state)

            try:
                with mock.patch.object(harness.subprocess, 'Popen', return_value=process), \
                        mock.patch.object(harness.core, 'mark'), \
                        mock.patch.object(harness.time, 'monotonic', side_effect=[0, 1201]), \
                        mock.patch.object(harness, 'keeper_alive', side_effect=alive):
                    with self.assertRaisesRegex(RuntimeError, 'film set did not come up'):
                        harness.keep_set(run, {'config': 'playwright.config.ts'}, {})
                self.assertEqual(seen[0]['pid'], process.pid)  # persisted before readiness/timeout checks
                self.assertIsNotNone(seen[0]['since'])
                self.assertIsNotNone(process.wait(timeout=5))
                self.assertFalse((run / 'keeper.json').exists())
            finally:
                process.kill()
                process.wait()

    def test_a_dead_keeper_restarts_and_keeps_the_new_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'checkout').mkdir()
            (run / 'checkout' / 'playwright.config.ts').write_text('export default { globalSetup: "./setup.ts" };')
            first = subprocess.Popen(['true'], start_new_session=True)
            first.wait()
            second = subprocess.Popen(['sleep', '60'], start_new_session=True)
            launches = []

            def launch(*args, **kwargs):
                process = first if not launches else second
                launches.append(process.pid)
                if process is second:
                    (run / 'keeper.ready').touch()
                return process

            try:
                with mock.patch.object(harness.subprocess, 'Popen', side_effect=launch), \
                        mock.patch.object(harness.core, 'mark'), \
                        mock.patch.object(harness.time, 'monotonic', side_effect=[0, 16, 20]):
                    state = harness.keep_set(run, {'config': 'playwright.config.ts'}, {})
                self.assertEqual(launches, [first.pid, second.pid])
                self.assertEqual(state['pid'], second.pid)
                self.assertTrue(harness.core.still_running(state))
                harness.stop_keeper(run, wait=5)
                self.assertIsNotNone(second.wait(timeout=5))
            finally:
                second.kill()
                second.wait()

    def test_cleanup_rechecks_identity_before_the_final_kill(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            harness.core.save(run / 'keeper.json', {'pid': 123, 'since': 50})
            with mock.patch.object(harness.core, 'still_running', side_effect=[True, False, False]), \
                    mock.patch.object(harness.os, 'killpg') as kill:
                harness.stop_keeper(run, wait=0)
            kill.assert_called_once_with(123, harness.signal.SIGINT)


class Toolchain(unittest.TestCase):
    def test_without_a_recipe_version_node_is_the_one_ci_runs_playwright_with(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.github' / 'workflows').mkdir(parents=True)
            (root / '.github' / 'workflows' / 'e2e.yml').write_text(
                'steps:\n  - uses: actions/setup-node@v7\n    with:\n      node-version: 24.18.0\n  - run: npx playwright test\n')
            (root / '.github' / 'workflows' / 'docs.yml').write_text('node-version: "22.1.0"\n')  # no Playwright there
            self.assertEqual(harness.ci_node(root), '24.18.0')
            (root / '.nvmrc').write_text('v24.19.1\n')
            (root / '.github' / 'workflows' / 'audit.yml').write_text('node-version-file: .nvmrc\nplaywright\n')
            self.assertIsNone(harness.ci_node(root))  # two versions: none chosen

    def test_an_installed_node_is_found_where_asdf_mise_or_nvm_put_it(self):
        with tempfile.TemporaryDirectory() as folder:
            nvm = Path(folder) / 'nvm' / 'versions' / 'node' / 'v24.18.0' / 'bin'
            nvm.mkdir(parents=True)
            (nvm / 'node').touch()
            with mock.patch.dict(harness.os.environ, {'ASDF_DATA_DIR': str(Path(folder) / 'asdf'), 'NVM_DIR': str(Path(folder) / 'nvm'),
                                                      'MISE_DATA_DIR': str(Path(folder) / 'mise')}):
                self.assertEqual(harness.node_home('24.18.0'), nvm)
                self.assertIsNone(harness.node_home('22.0.0'))
                asdf = Path(folder) / 'asdf' / 'installs' / 'nodejs' / '24.18.0' / 'bin'
                asdf.mkdir(parents=True)
                (asdf / 'node').touch()
                self.assertEqual(harness.node_home('24.18.0'), asdf)

    def test_the_run_docker_config_keeps_the_users_daemon_and_plugins(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(harness.core, 'docker_host', return_value='unix:///u/docker.sock'), \
                mock.patch.object(harness.Path, 'home', return_value=Path(folder) / 'home'):
            (Path(folder) / 'home' / '.docker' / 'cli-plugins').mkdir(parents=True)
            env = harness.docker_env(Path(folder) / 'run')
            self.assertEqual(env['DOCKER_HOST'], 'unix:///u/docker.sock')
            config = json.loads((Path(env['DOCKER_CONFIG']) / 'config.json').read_text())
            self.assertEqual(config, {'cliPluginsExtraDirs': [str(Path(folder) / 'home' / '.docker' / 'cli-plugins')]})
            self.assertEqual(harness.environment(Path(folder) / 'run', {}, [])['DOCKER_HOST'], 'unix:///u/docker.sock')


class Recipe(unittest.TestCase):
    def test_random_values_are_drawn_once_per_run_and_kept_private(self):
        with tempfile.TemporaryDirectory() as run:
            recipe = {'env': {'MASTER_KEY': '<random>', 'NODE_ENV': 'test'}}
            first = harness.environment(run, recipe, ['/opt/node/bin'])
            second = harness.environment(run, recipe, [])
            self.assertEqual(first['MASTER_KEY'], second['MASTER_KEY'])
            self.assertEqual(len(first['MASTER_KEY']), 32)
            self.assertTrue(first['PATH'].startswith('/opt/node/bin'))
            self.assertEqual(oct((Path(run) / 'secrets.json').stat().st_mode & 0o777), '0o600')
            written = (Path(run) / 'secrets.json').stat().st_ino
            harness.environment(run, recipe, [])  # nothing drawn: every try reads the file, none rewrites it
            self.assertEqual((Path(run) / 'secrets.json').stat().st_ino, written)


    def test_only_the_named_variables_of_ours_pass_through_and_only_when_set(self):
        import os
        with tempfile.TemporaryDirectory() as run, mock.patch.dict(os.environ, {'E2E_IMAGE_TAG': 'e2e-ci', 'SECRET': 'x'}):
            env = harness.environment(run, {'env_passthrough': ['E2E_IMAGE_TAG', 'UNSET_NAME']}, [])
            self.assertEqual(env['E2E_IMAGE_TAG'], 'e2e-ci')  # images a CI job built from its cache
            self.assertNotIn('UNSET_NAME', env)
            self.assertNotIn('SECRET', env)
            self.assertNotIn('E2E_IMAGE_TAG', harness.environment(run, {}, []))

    def test_a_release_tag_becomes_a_docker_image_tag(self):
        self.assertEqual(harness.image_tag('v2.4.0-beta.1'), 'v2.4.0-beta.1')
        self.assertEqual(harness.image_tag('release/2026 09'), 'release-2026-09')
        self.assertEqual(harness.image_tag(''), 'latest')

    def test_a_missing_image_is_built_from_the_releases_own_files_only(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            harness.core.save(run / 'meta.json', {'tag': 'v1.2.0'})
            for name in ('Dockerfile.dev', 'Gemfile', 'Gemfile.lock', 'secret.env'):
                harness.core.write(run / 'checkout' / name, name)
            (run / 'checkout' / 'node_modules').mkdir()
            recipe = {'images': [{'tag': 'app-factories:{tag}', 'dockerfile': 'Dockerfile.dev', 'files': ['Gemfile', 'Gemfile.lock']},
                                 {'tag': 'kept:{tag}', 'dockerfile': 'Dockerfile.dev'}]}
            for buildx, command in ((True, ['docker', 'buildx', 'build', '--load', '-q']), (False, ['docker', 'build', '-q'])):
                contexts = []

                def sh(cmd, **kwargs):
                    if cmd[:3] == ['docker', 'buildx', 'version']:
                        return mock.Mock(returncode=0 if buildx else 1)
                    if cmd[:3] == ['docker', 'image', 'inspect']:
                        return mock.Mock(returncode=0 if cmd[3] == 'kept:v1.2.0' else 1)
                    contexts.append((cmd, sorted(p.name for p in Path(cmd[-1]).iterdir())))
                    return mock.Mock(returncode=0)
                with self.subTest(buildx=buildx), mock.patch.object(harness.core, 'sh', side_effect=sh):
                    self.assertEqual(harness.build_images(run, recipe, run / 'env.log'), ['app-factories:v1.2.0'])
                    [(cmd, files)] = contexts
                    # a CI job's own Buildx builder would keep the image in its cache: it is loaded into Docker
                    self.assertEqual(cmd[:len(command)], command)
                    self.assertEqual(cmd[cmd.index('-t') + 1], 'app-factories:v1.2.0')
                    self.assertEqual(files, ['Dockerfile.dev', 'Gemfile', 'Gemfile.lock'])  # never the checkout's other files


class Outcomes(unittest.TestCase):
    def test_the_json_report_lists_every_test(self):
        with tempfile.TemporaryDirectory() as folder:
            report = Path(folder) / 'report.json'
            report.write_text(json.dumps({'suites': [{'title': 'demo--a.spec.ts', 'suites': [{'title': 'Team', 'specs': [
                {'title': 'adds', 'file': 'demo--a.spec.ts', 'tests': [{'results': [{'status': 'passed', 'duration': 2500}]}]}]}]}]}))
            self.assertEqual(harness.outcomes(report), [{'id': None, 'file': 'demo--a.spec.ts', 'line': None,
                                                        'title': 'Team › adds', 'status': 'passed', 'seconds': 2.5,
                                                        'error': ''}])


class Choosing(unittest.TestCase):
    SPEC = 'test("lists", async () => {\n  await a();\n});\n\ntest("saves a note", async () => {\n' \
           '  await page.getByLabel("Note").fill("Hello there");\n  await expect(saved).toBeVisible();\n});\n'

    def test_spec_copies_keep_their_line_numbers(self):
        source = 'import {\n  expect,\n  test,\n} from "../fixtures/test";\n\ntest("a", async () => {});\n'
        wrapped = harness.wrap_spec(source, './capture')
        self.assertEqual(wrapped.count('\n'), source.count('\n'))
        self.assertEqual(wrapped.splitlines()[5], 'test("a", async () => {});')

    def test_films_keep_their_keys_across_batches(self):
        first = harness.merge_films([], [{'test_id': 'a'}, {'test_id': 'b'}])
        self.assertEqual([f['key'] for f in first], ['F1', 'F2'])
        second = harness.merge_films(first, [{'test_id': 'b', 'status': 'passed'}, {'test_id': 'c'}])
        self.assertEqual([(f['test_id'], f['key']) for f in second], [('a', 'F1'), ('b', 'F2'), ('c', 'F3')])
        self.assertEqual(second[1]['status'], 'passed')  # filmed again: the new film replaces the old one

    def test_a_film_handed_over_early_keeps_its_key_at_the_batch_end(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'captures.json').write_text(json.dumps({'films': [{'test_id': 'a', 'key': 'F1'}]}))
            self.assertEqual(harness.key_for(run, 'a'), 'F1')  # filmed before
            self.assertEqual(harness.key_for(run, 'b'), 'F2')
            self.assertEqual(harness.key_for(run, 'c'), 'F3')
            self.assertEqual(harness.key_for(run, 'b'), 'F2')  # kept
            reserved = json.loads((run / 'captures.json').read_text())['reserved']
            merged = harness.merge_films([{'test_id': 'a', 'key': 'F1'}], [{'test_id': 'c'}, {'test_id': 'd'}], reserved)
            self.assertEqual([(f['test_id'], f['key']) for f in merged], [('a', 'F1'), ('c', 'F3'), ('d', 'F4')])

    def test_a_batch_hands_each_film_over_as_its_test_ends(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / 'checkout' / 'e2e').mkdir(parents=True)
            (run / 'checkout' / 'playwright.config.ts').write_text('export default { workers: 1 };\n')
            for name in ('rf-pr1', 'rf-pr2'):
                (run / 'checkout' / 'e2e' / f'{name}.spec.ts').write_text('import { test } from "@playwright/test";\ntest("a", async () => {});\n')
            out = run / 'captures' / 'g01'
            page_log = lambda spec, test_id: json.dumps({'file': str(run / 'checkout' / 'e2e' / f'demo--{spec}.spec.ts'),
                                                          'testId': test_id, 'status': 'passed', 'title': spec})
            script = (f"mkdir -p {out}/one && echo '{page_log('rf-pr1', 't1')}' > {out}/one/page-log.json; sleep 1.5; "
                      f"mkdir -p {out}/two && echo '{page_log('rf-pr2', 't2')}' > {out}/two/page-log.json; sleep 0.5")
            handed = []

            def on_film(film):
                handed.append((film['gap'], film['key'], (run / 'captures' / 'g01' / 'two').exists()))
            with mock.patch.object(harness, 'inside', return_value=['sh', '-c', script]), \
                    mock.patch.object(harness.takes, 'convert', return_value={}), mock.patch.object(harness, 'keeper_state', return_value=None):
                films = harness.capture(run, {'config': 'playwright.config.ts'}, {}, [('e2e/rf-pr1.spec.ts', None), ('e2e/rf-pr2.spec.ts', None)],
                                        gaps={'e2e/rf-pr1.spec.ts': {'id': 'pr1', 'prs': [1]}, 'e2e/rf-pr2.spec.ts': {'id': 'pr2', 'prs': [2]}},
                                        batch='g01', on_film=on_film)
            self.assertEqual(handed[0], ('pr1', 'F1', False))  # before the second test had even started
            self.assertEqual([h[:2] for h in handed], [('pr1', 'F1'), ('pr2', 'F2')])
            self.assertEqual(sorted((f['gap'], f['key']) for f in films), [('pr1', 'F1'), ('pr2', 'F2')])
            index = json.loads((run / 'captures.json').read_text())
            self.assertEqual(sorted(f['key'] for f in index['films']), ['F1', 'F2'])

    def test_a_serial_batch_opens_with_an_empty_test_of_the_project(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'e2e' / 'specs' / 'teams').mkdir(parents=True)
            (root / 'e2e' / 'specs' / 'rf-pr1.spec.ts').write_text('import { expect, test } from "../fixtures/test";\n')
            (root / 'e2e' / 'specs' / 'teams' / 'rf-pr2.spec.ts').write_text('import { test } from "../../fixtures/test";\n')
            warm = harness.warm_up(root, ['e2e/specs/teams/rf-pr2.spec.ts', 'e2e/specs/rf-pr1.spec.ts'])
            self.assertEqual(warm, root / 'e2e' / 'specs' / '!rf' / 'demo--rf-warm.spec.ts')
            self.assertIn('import { test } from "../../fixtures/test";', warm.read_text())
            self.assertLess(str(warm), str(root / 'e2e' / 'specs' / 'demo--rf-pr1.spec.ts'))  # it sorts first
            (root / 'e2e' / 'specs' / 'rf-pr3.spec.ts').write_text('import { test } from "@playwright/test";\n')
            self.assertIn('from "@playwright/test"', harness.warm_up(root, ['e2e/specs/rf-pr3.spec.ts']).read_text())
            (root / 'e2e' / 'specs' / 'rf-pr4.spec.ts').write_text('import base from "./fixtures";\n')
            self.assertIsNone(harness.warm_up(root, ['e2e/specs/rf-pr4.spec.ts']))

    def test_a_scene_that_passed_keeps_its_film_when_it_fails_again(self):
        first = harness.merge_films([], [{'test_id': 's', 'gap': 'pr1', 'status': 'passed', 'capture': 'g02/s'}])
        again = [{'test_id': 's', 'gap': 'pr1', 'status': 'failed', 'capture': 'g04/s'}]
        second = harness.merge_films(first, again)
        self.assertEqual([(f['key'], f['capture']) for f in second], [('F1', 'g02/s')])
        self.assertEqual(again[0]['key'], 'F1')  # the try still reports its failed film
        third = harness.merge_films(second, [{'test_id': 's', 'gap': 'pr1', 'status': 'passed', 'capture': 'g05/s'}])
        self.assertEqual([f['capture'] for f in third], ['g05/s'])


class CiResources(unittest.TestCase):
    def test_the_profile_does_not_parallelize_a_serial_project(self):
        import os
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            core = harness.core
            core.write(run / 'checkout' / 'playwright.config.ts', 'export default {workers: 1};')
            recipe = {'config': 'playwright.config.ts'}
            with mock.patch.dict(os.environ, {'RELEASE_FILM_CI': '1', 'RELEASE_FILM_CI_WORKERS': '4',
                                              'RELEASE_FILM_CI_DEVICE_SCALE': '1'}, clear=True):
                self.assertTrue(harness.serial(run, recipe))
                env = harness.environment(run, recipe, [])
                self.assertEqual(env['DEMO_WORKER_LIMIT'], '4')
                self.assertEqual(env['DEMO_DEVICE_SCALE'], '1.0')
            with mock.patch.dict(os.environ, {'RELEASE_FILM_CI': '1', 'RELEASE_FILM_CI_WORKERS': '1'}, clear=True):
                self.assertTrue(harness.serial(run, dict(recipe, workers=6)))

    def test_generated_worker_limit_caps_numeric_percentage_and_default_counts(self):
        import shutil
        node = shutil.which('node')
        if not node:
            self.skipTest('node is needed to execute the generated worker calculation')
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / 'playwright.config.ts'
            config.write_text('export default {};')
            generated = harness.demo_config(config).read_text()
            calculation = 'const requestedWorkers' + generated.split('const requestedWorkers', 1)[1].split('// a filmed run', 1)[0]
            for base, limit, wanted in ((1, 4, 1), (6, 2, 2), ('25%', 4, 2), (None, 8, 4)):
                with self.subTest(base=base, limit=limit):
                    script = ('const os = {cpus: () => Array(8)}; const base = {workers: ' + json.dumps(base) + '}; '
                              'const process = {env: {DEMO_WORKER_LIMIT: ' + json.dumps(str(limit)) + '}}; '
                              + calculation + '\nconsole.log(workers);')
                    actual = harness.core.sh([node, '-e', script]).stdout.strip()
                    self.assertEqual(actual, str(wanted))


class Listing(unittest.TestCase):
    def test_the_json_report_is_found_after_what_the_config_printed(self):
        report = {'config': {'rootDir': '/x'}, 'suites': [{'title': 'a.spec.ts', 'specs': [{'title': 't', 'file': 'a.spec.ts'}]}]}
        printed = ('[dotenv@17.4.2] injected env (3) from .env -- tip: ⌘ suppress logs { quiet: true }\n'
                   '{"not": "the report"}\n' + json.dumps(report, indent=2) + '\n')
        self.assertEqual(harness.json_report(printed), report)
        self.assertIsNone(harness.json_report('Error: no tests found { quiet: true }\n'))


class Runner(unittest.TestCase):
    def test_an_isolated_run_gets_the_passed_through_variables(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder) / 'runs' / 'o__r' / 'v1' / 'r1'
            run.mkdir(parents=True)
            recipe = {'isolate': True, 'env': {'VITE_TEST': 'true'}, 'env_passthrough': ['E2E_IMAGE_TAG']}
            env = {'VITE_TEST': 'true', 'E2E_IMAGE_TAG': 'release-film', 'CLAUDE_CODE_OAUTH_TOKEN': 'secret',
                   'DEMO_DEVICE_SCALE': '1.5', 'PATH': '/usr/bin'}
            harness.inside(run, recipe, env, run, ['true'])
            passed = dict(line.split('=', 1) for line in (run / 'runner.env').read_text().splitlines())
        self.assertEqual(passed['E2E_IMAGE_TAG'], 'release-film')
        self.assertEqual(passed['VITE_TEST'], 'true')
        self.assertNotIn('CLAUDE_CODE_OAUTH_TOKEN', passed)

    def test_the_keepers_log_may_be_in_a_folder_with_a_space(self):
        with tempfile.TemporaryDirectory() as folder:
            log = Path(folder) / 'x y' / 'keeper.log'
            log.parent.mkdir()
            done = subprocess.run(harness.appending(log, ['echo', 'kept up']), capture_output=True, text=True)
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(log.read_text(), 'kept up\n')


if __name__ == '__main__':
    unittest.main()
