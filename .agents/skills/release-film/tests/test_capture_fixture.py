"""The capture fixture films an action once, a check that something is gone at once, and each test's own pages only.

The same scenes run twice: against Playwright's client objects mocked as 1.61.1 has them (Node only, as in CI), and
through the project's Playwright runner in Chromium when this checkout has it (NODE_PATH, else e2e/node_modules).
"""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import takes  # noqa: E402

CAPTURE = Path(__file__).resolve().parents[1] / 'scripts' / 'capture'
ABSENCE = {'to.be.hidden', 'to.be.detached', 'to.have.count'}  # toBeHidden(), toBeAttached({ attached: false }), …


def node_or_skip():
    node = shutil.which('node')
    if not node:
        raise unittest.SkipTest('node is needed to run the capture')
    version = subprocess.run([node, '--version'], capture_output=True, text=True).stdout.strip()
    if tuple(int(n) for n in re.findall(r'\d+', version)[:2]) < (22, 7):  # a version manager's old default
        raise unittest.SkipTest(f'node {version} cannot strip TypeScript types (22.7 or newer)')
    return node


def picture(path):
    """The MD5 of an image's decoded pixels (FFmpeg's framemd5): two JPEGs of one picture, encoded apart, match. None
    without FFmpeg or a picture."""
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        return None
    out = subprocess.run([ffmpeg, '-v', 'error', '-i', str(path), '-f', 'framemd5', '-'], capture_output=True, text=True)
    lines = [line for line in out.stdout.splitlines() if line and not line.startswith('#')]
    return lines[-1].split(',')[-1].strip() if out.returncode == 0 and lines else None


def filmed(root):
    """{test title: {'actions', 'frames' (listed in frames.json), 'on_disk' (in its frames/ folder), 'sizes' (of its
    first frame and first still), 'pictures' (its stills' and its last frame's, as ``picture`` gives them)}}."""
    found = {}
    for folder in Path(root).iterdir():
        if (folder / 'page-log.json').is_file():
            actions = json.loads((folder / 'actions.json').read_text())
            frames = sorted(f['file'] for f in json.loads((folder / 'frames.json').read_text()))
            stills = [a['still'] for a in actions if a.get('still')]
            found[json.loads((folder / 'page-log.json').read_text())['title']] = {
                'actions': actions, 'frames': frames,
                'on_disk': sorted(f'frames/{name}' for name in os.listdir(folder / 'frames')),
                'sizes': [takes.jpeg_size(folder / files[0]) if files else None for files in (frames, stills)],
                'pictures': {file: picture(folder / file) for file in stills + frames[-1:]}}
    return found


class Scenes:
    """'first' types (pressSequentially), checks (setChecked), clears, saves, proves a dialog gone, opens a second
    user's context and acts on both pages at once in two test.step blocks; 'second' runs next in the same worker; 'own
    page' gets its page from a project fixture that opens a context of its own."""
    films = {}

    def test_an_action_playwright_carries_out_with_another_is_filmed_once(self):
        actions = [a for a in self.films['first']['actions'] if a['kind'] != 'look']
        self.assertEqual([a['kind'] for a in actions],
                         ['click', 'pressSequentially', 'setChecked', 'clear', 'click', 'click', 'click'])
        self.assertEqual([actions[1]['value'], actions[2]['value']], ['Bright', 'true'])
        # the first click's result is probed when pressSequentially starts, and not probed again (emptied) by its type
        self.assertTrue(actions[0]['post']['changes'], actions[0]['post'])
        for before, after in zip(actions[:4], actions[1:5]):  # no action inside another's window (till the two at once)
            self.assertLessEqual(before['a'], after['m'])

    def test_a_check_that_something_is_gone_waits_for_no_element_and_films_none(self):
        looks = [a for a in self.films['first']['actions'] if a['kind'] == 'look']
        self.assertTrue(looks[0]['text'].get('target'))  # a check of an element films it
        gone = [a for a in looks if a['expect']['expression'] in ABSENCE and not a['expect']['not']]
        self.assertGreaterEqual(len(gone), 3)
        for look in gone:
            self.assertLess(look['still_t'] - look['a'], 1500, look)  # not ~3.9 s of waiting for the missing element
            self.assertIsNone(look['box'])
            self.assertNotIn('target', look['text'], look)  # nor the element an earlier check filmed
        shown = [a for a in looks if a['expect']['expression'] == 'to.be.hidden' and a['expect']['not']]
        self.assertEqual(len(shown), 1)
        self.assertTrue(shown[0]['box'])  # not.toBeHidden(): the element is there

    def test_a_test_films_its_own_pages_only_when_another_follows_it_in_the_worker(self):
        for title in ('first', 'second'):
            film = self.films[title]
            self.assertEqual(film['on_disk'], film['frames'], title)  # no later test's page, nothing after its end
            self.assertEqual({f.split('/')[1].split('-')[0] for f in film['frames']}, {'p0', 'p1'}, title)
            self.assertEqual({a['page'] for a in film['actions']}, {0, 1}, title)

    def test_steps_running_at_once_keep_their_own_titles(self):
        both = self.films['first']['actions'][-2:]
        self.assertEqual(sorted((a['step'], a['page']) for a in both), [('Admin view', 0), ('Learner view', 1)])

    def test_a_page_a_project_fixture_opens_in_a_context_of_its_own_is_filmed(self):
        film = self.films['own page']
        self.assertEqual([(a['kind'], a['page']) for a in film['actions']], [('click', 0)])
        self.assertTrue(film['frames'])


MOCKED = r"""
import path from 'node:path';
import { pathToFileURL } from 'node:url';

globalThis.window = {};  // where the capture's in-page functions (the element it films) run here
const { withCapture } = await import(pathToFileURL(process.argv[1]));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const calls = [];

// Playwright 1.61.1's client objects, reduced to what the capture uses; a method on an element that is not there waits
// its whole timeout, as Playwright's does
class Locator {
  constructor(page, selector) { this._page = page; this.selector = selector; }
  page() { return this._page; }
  first() { return new Locator(this._page, this.selector); }
  toString() { return `locator('${this.selector}')`; }
  async _element(options) {
    if (!this.selector.includes('missing')) return { name: this.selector };
    await sleep(options?.timeout ?? 1000);
    throw new Error(`Timeout ${options?.timeout}ms exceeded`);
  }
  async getAttribute(name, options) { await this._element(options); return null; }
  async boundingBox(options) { await this._element(options); return { x: 10, y: 20, width: 100, height: 30 }; }
  async evaluate(fn, arg, options) { return fn(await this._element(options), arg); }
  async click() { calls.push(['click', this.selector]); this._page.changes.push([Date.now(), 0, 0, 500, 200]); }
  async fill(value) { calls.push(['fill', this.selector, value]); }
  async type(text) { await sleep(5); calls.push(['type', this.selector, text]); }
  async check() { calls.push(['check', this.selector]); }
  async uncheck() { calls.push(['uncheck', this.selector]); }
  // Playwright's methods that carry out another
  async pressSequentially(text, options = {}) { return await this.type(text, options); }
  async clear(options = {}) { await this.fill('', options); }
  async setChecked(checked, options) { if (checked) await this.check(options); else await this.uncheck(options); }
  async _expect(expression, options) { return { matches: !options.isNot }; }  // every check passes
}
class Page {
  constructor(context) { this._context = context; this.changes = []; this.sessions = []; this.closed = false; this.keyboard = {}; }
  locator(selector) { return new Locator(this, selector); }
  url() { return 'http://app.test/'; }
  context() { return this._context; }
  isClosed() { return this.closed; }
  on() {}
  viewportSize() { return { width: 800, height: 450 }; }
  async close() { this.closed = true; }
  async screenshot() { return Buffer.from('still'); }
  async evaluate(script) {
    if (typeof script === 'function') return script();
    if (script.includes('__demoLog')) return JSON.stringify({ t: Date.now(), changes: this.changes.splice(0) });  // probe
    if (script.includes('toastBox')) return JSON.stringify(window.__demoTarget ? { target: window.__demoTarget.name } : {});
    if (script.includes('__demoLoading')) return 0;  // settled
    return null;
  }
  paint() { for (const session of this.sessions) session.frame(); }  // each screencast on the page gets a frame
}
class Session {
  constructor(page) { this.handlers = {}; this.streaming = false; page.sessions.push(this); }
  on(event, handler) { this.handlers[event] = handler; }
  async send(method) {
    if (method === 'Page.startScreencast') { this.streaming = true; this.frame(); }
    if (method === 'Page.stopScreencast') this.streaming = false;
  }
  frame() {
    if (this.streaming) this.handlers['Page.screencastFrame']?.({ data: 'ZnJhbWU=', metadata: { timestamp: Date.now() / 1000 },
      sessionId: 1 });
  }
}
class Context {
  constructor() { this._pages = []; this.listeners = []; this.films = 0; }
  pages() { return this._pages.filter((page) => !page.closed); }
  async newPage() {
    const page = new Page(this);
    this._pages.push(page);
    for (const listener of this.listeners) listener(page);
    return page;
  }
  on(event, listener) { if (event === 'page') this.listeners.push(listener); }
  async addInitScript() { this.films++; }  // once for every film the context joins
  async newCDPSession(page) { return new Session(page); }
  async close() { for (const page of this._pages) page.closed = true; }
}
const contexts = [];
const browser = { async newContext() { const context = new Context(); contexts.push(context); return context; } };
// a project's test: extend() keeps the fixtures; test.step runs its body a moment later, as Playwright's does
const base = { extend: (fixtures) => ({ fixtures, step: async (title, body) => { await sleep(1); return await body(); } }) };
const test = withCapture(base);
const [demoCapture] = test.fixtures.demoCapture;

// one test of the worker as Playwright runs it: its context (browser.newContext) and page, then the capture around it
async function run(title, body, ownPage) {
  const context = await browser.newContext();
  const page = ownPage ? await ownPage() : await context.newPage();
  const testInfo = { titlePath: ['film.spec.ts', title], testId: `${title.replace(/\W/g, '')}00000000`, status: 'passed',
    file: 'film.spec.ts', line: 1, error: null, outputPath: (name) => path.join(process.argv[2], name) };
  await demoCapture({ page, context, browser }, () => body(page), testInfo);
  await context.close();
}
const expectOf = (locator, expression, options = {}) => locator._expect(expression, { isNot: false, timeout: 5000, ...options });

await run('first', async (page) => {
  await page.locator('#open').click();
  await page.locator('#search').pressSequentially('Bright', { delay: 10 });
  await page.locator('#agree').setChecked(true);
  await page.locator('#search').clear();
  await page.locator('#save').click();
  await expectOf(page.locator('#toast'), 'to.be.visible');
  await expectOf(page.locator('#missing-dialog'), 'to.be.hidden');
  await expectOf(page.locator('.missing'), 'to.have.count', { expectedNumber: 0 });
  await expectOf(page.locator('#missing-dialog'), 'to.be.detached');
  await expectOf(page.locator('#toast'), 'to.be.hidden', { isNot: true });
  const other = await (await browser.newContext()).newPage();  // a second user's, left open
  await Promise.all([
    test.step('Admin view', async () => { await page.locator('#open').click(); }),
    test.step('Learner view', async () => { await other.locator('#open').click(); }),
  ]);
});
await run('second', async (page) => {
  await page.locator('#open').click();
  await (await (await browser.newContext()).newPage()).locator('#open').click();
});
await run('own page', async (page) => { await page.locator('#open').click(); },
  async () => (await browser.newContext()).newPage());
for (const context of contexts) for (const page of context._pages) page.paint();  // pages that go on painting
console.log(JSON.stringify({ calls, films: contexts.map((context) => context.films) }));
process.exit(0);  // not the 15 s the capture's last wait for downloads keeps its timer
"""


class MockedPlaywright(Scenes, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        node = node_or_skip()
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'capture.mts'
            source.write_text((CAPTURE / 'capture.ts').read_text())
            out = Path(folder) / 'films'
            out.mkdir()
            result = subprocess.run([node, '--experimental-transform-types', '--input-type=module', '-e', MOCKED,
                                     str(source), str(out)], env=dict(os.environ, DEMO_SCRIPTS=str(CAPTURE),
                                                                      DEMO_CAPTURE_DIR=str(out)),
                                    capture_output=True, text=True, timeout=120)
            if result.returncode:
                raise AssertionError(result.stderr[-3000:])
            cls.films, cls.ran = filmed(out), json.loads(result.stdout)

    def test_the_methods_an_action_carries_out_with_still_run(self):
        self.assertEqual(self.ran['calls'], [['click', '#open'], ['type', '#search', 'Bright'], ['check', '#agree'],
                                             ['fill', '#search', ''], ['click', '#save'], ['click', '#open'],
                                             ['click', '#open'], ['click', '#open'], ['click', '#open'],
                                             ['click', '#open']])

    def test_each_context_joins_the_film_of_the_test_it_serves_only(self):
        self.assertEqual(self.ran['films'], [1] * 6)  # never the earlier tests' films of the same worker too


CONFIG = """import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", workers: 1, retries: 0, reporter: [["line"]],
  use: { viewport: { width: 800, height: 450 }, deviceScaleFactor: 1.5, headless: true, trace: "off", video: "off",
    screenshot: "off" } });
"""
SPEC = r"""import { expect, test as base } from "@playwright/test";
import { withCapture } from "./capture/capture";

const test = withCapture(base);
const PAGE = `<style>body{font:16px sans-serif;margin:20px}#panel{display:none;width:500px;height:200px}#panel.open{display:block}
.toast{position:fixed;bottom:20px;right:20px;padding:10px;background:#333;color:#fff}</style>
<button onclick="document.getElementById('panel').classList.add('open')">Open</button>
<div id="panel"><p>Search panel</p><input placeholder="Search..."><label><input type="checkbox"> Agree</label></div>
<div role="dialog" aria-label="Edit statement" style="width:300px;height:120px;border:1px solid"><h2>Edit statement</h2>
<button onclick="this.closest('[role=dialog]').remove();const t=document.createElement('div');t.className='toast';
t.setAttribute('role','status');t.textContent='Statement saved';document.body.appendChild(t)">Save</button></div>`;
// a page that goes on painting: its screencast goes on sending frames
const TICKING = `<button>Open</button><p id="n">0</p><script>let k=0;setInterval(()=>{n.textContent=String(++k)},50)</script>`;
// a sidebar and a column that scrolls up and down and hides what is wider (a carousel): its third card lies below
// the fold, cut at the column's right edge
const SIDEWAYS = `<style>body{margin:0;display:flex;height:100vh;font:16px sans-serif}nav{width:200px;flex:none}
main{flex:1;overflow-x:hidden;overflow-y:auto}.row{display:flex;gap:20px;margin-top:700px;height:1000px}
.card{flex:none;width:250px;height:80px;border:1px solid}</style><nav>Menu</nav><main><h1>Courses</h1>
<div class="row"><div class="card">One</div><div class="card">Two</div><div class="card">Far card</div></div></main>`;

test("first", async ({ page, browser }) => {
  await page.setContent(PAGE);
  await page.getByRole("button", { name: "Open" }).click();
  const search = page.getByPlaceholder("Search...");
  await search.pressSequentially("Bright", { delay: 10 });
  await expect(search).toHaveValue("Bright");
  await page.getByRole("checkbox").setChecked(true);
  await expect(page.getByRole("checkbox")).toBeChecked();
  await search.clear();
  await expect(search).toHaveValue("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".missing")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible({ visible: false });
  await expect(page.getByRole("dialog")).toBeAttached({ attached: false });
  await expect(page.getByRole("status")).not.toBeHidden();
  const other = await (await browser.newContext()).newPage();  // a second user's, left open: Playwright keeps it
  await other.setContent(TICKING);
  await Promise.all([
    test.step("Admin view", async () => { await page.getByRole("button", { name: "Open" }).click(); }),
    test.step("Learner view", async () => { await other.getByRole("button", { name: "Open" }).click(); }),
  ]);
});

test("second", async ({ page, browser }) => {
  await page.setContent(TICKING);
  await page.getByRole("button", { name: "Open" }).click();
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.setContent(TICKING);
  await other.getByRole("button", { name: "Open" }).click();
  await context.close();
});

// a project whose page fixture opens a context of its own (a stored login), before the capture's fixture runs
const own = withCapture(base.extend({ page: async ({ browser }, use) => {
  const context = await browser.newContext();
  await use(await context.newPage());
  await context.close();
} }));
own("own page", async ({ page }) => {
  await page.setContent(`<button onclick="this.textContent='Done'">Open</button>`);
  await page.getByRole("button", { name: "Open" }).click();
});

test("sideways", async ({ page }) => {
  await page.setContent(SIDEWAYS);
  await expect(page.getByText("Far card")).toBeVisible();
});
"""


def playwright_modules():
    """The node_modules folder with @playwright/test: NODE_PATH's, else this repository's e2e/node_modules."""
    folders = [Path(p) for p in os.environ.get('NODE_PATH', '').split(os.pathsep) if p]
    parents = Path(__file__).resolve().parents
    if len(parents) > 4:
        folders.append(parents[4] / 'e2e' / 'node_modules')
    return next((f for f in folders if (f / '@playwright' / 'test' / 'cli.js').is_file()), None)


class PlaywrightInChromium(Scenes, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        node = node_or_skip()
        modules = playwright_modules()
        if not modules:
            raise unittest.SkipTest('no @playwright/test (NODE_PATH or e2e/node_modules)')
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            shutil.copytree(CAPTURE, folder / 'capture')  # next to the config, as the harness puts it
            (folder / 'package.json').write_text('{}\n')
            (folder / 'playwright.config.ts').write_text(CONFIG)
            (folder / 'film.spec.ts').write_text(SPEC)
            out = folder / 'films'
            env = {k: v for k, v in os.environ.items() if not k.startswith(('DEMO_', 'PW_', 'PLAYWRIGHT_')) or
                   k == 'PLAYWRIGHT_BROWSERS_PATH'}
            env.update(NODE_PATH=str(modules), DEMO_SCRIPTS=str(folder / 'capture'), DEMO_CAPTURE_DIR=str(out))
            result = subprocess.run([node, str(modules / '@playwright' / 'test' / 'cli.js'), 'test', '-c',
                                     'playwright.config.ts', '--output', str(folder / 'results')],
                                    cwd=folder, env=env, capture_output=True, text=True, timeout=300)
            output = result.stdout + result.stderr
            if result.returncode and 'browserType.launch' in output:
                raise unittest.SkipTest('Chromium cannot launch here')
            if result.returncode:
                raise AssertionError(output[-4000:])
            cls.films = filmed(out)

    def test_a_check_below_the_fold_scrolls_the_page_up_never_sideways(self):
        look, = [a for a in self.films['sideways']['actions'] if a['kind'] == 'look']
        self.assertEqual(round(look['box']['x']), 744)  # 200 + 2 × (250 + 2 + 20): cut at the column's edge, as laid out
        self.assertTrue(0 <= look['box']['y'] <= 450 - look['box']['height'], look['box'])  # brought up into view

    def test_a_still_is_the_very_picture_of_the_screencast_frame(self):
        film = self.films['sideways']
        self.assertEqual(film['sizes'], [(800, 450), (800, 450)])  # both in CSS pixels, at a device scale of 1.5
        look, = [a for a in film['actions'] if a['kind'] == 'look']
        if not shutil.which('ffmpeg'):
            self.skipTest('ffmpeg compares the pictures')
        # the page stands still after the check: its still and the screencast's last frame show it pixel for pixel
        self.assertEqual(film['pictures'][look['still']], film['pictures'][film['frames'][-1]])


if __name__ == '__main__':
    unittest.main()
