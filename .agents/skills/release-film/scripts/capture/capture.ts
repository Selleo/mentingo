// Demo capture for Playwright tests: wraps a project's `test` so every page of the test is filmed.
//
// - frames: CDP screencast (JPEG) with the browser's paint timestamps, so no clock strip is needed;
// - stills: a screenshot right before every action, the page the viewer looks at while the narration talks (the
//   holds of the film), in CSS pixels: the very picture of a screencast frame;
// - actions: every locator/page action with start and end time, the target's box, the value it typed or chose, a
//   page probe before it (the element and its panel) and one after it (what the action changed), taken when the next
//   action starts, and the text the viewer can read before it (dialog title, headings, toasts);
// - looks: every check that passed (expect(locator)…) with its expected text and a still of the state it proves;
// - steps: the title of the test.step block each action ran in (a scene names the part a second user plays);
// - in-page log: the init script (loading indicators, addresses, settling counters) runs in every document.
//
// Output: $DEMO_CAPTURE_DIR/<test title slug>-<test id>/ frames/, stills/, frames.json, actions.json, page-log.json
// (with the spec file, line and test id).
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";

import type { BrowserContext, Locator, Page, TestType } from "@playwright/test";

const HERE = process.env.DEMO_SCRIPTS as string;  // set by harness.py (no __dirname in ES modules)
const INIT = fs.readFileSync(path.join(HERE, "init.js"), "utf8");
const PROBE = fs.readFileSync(path.join(HERE, "probe.js"), "utf8");
const AMBIENT = fs.readFileSync(path.join(HERE, "ambient.js"), "utf8");
const TEXT = fs.readFileSync(path.join(HERE, "text.js"), "utf8");
const SCALE = Number(process.env.DEMO_SCALE || 1.5);
// Before the still of the page the viewer looks at: wait while a loading indicator shows or a request is in flight
// (at most 1.5 s; an idle page answers at once).
const SETTLE = `(async()=>{const t0=Date.now();const busy=()=>{const n=Date.now();for(const t of (window.__demoReq||new Map()).values())if(n-t<2000)return true;return false};while(Date.now()-t0<1500){const loading=window.__demoLoading?window.__demoLoading():false;if(!loading&&!busy()&&document.readyState==="complete")break;await new Promise(r=>setTimeout(r,50))}return Date.now()-t0})()`;
// a test may end on a page that is still loading (a reload, then a check that passes at once): film it loaded
const SETTLE_END = SETTLE.replace("Date.now()-t0<1500", "Date.now()-t0<6000");
// a scene's check waits at most this long: one that will never pass frees the one camera of all the scenes sooner
const CHECK_LIMIT = process.env.DEMO_TRY ? 15000 : 0;
const LOCATOR_ACTIONS = ["click", "dblclick", "fill", "press", "pressSequentially", "type", "check", "uncheck",
  "selectOption", "hover", "setInputFiles", "tap", "dragTo", "clear", "focus", "setChecked"];
const PAGE_ACTIONS = ["goto", "click", "dblclick", "fill", "press", "type", "check", "uncheck", "selectOption", "hover",
  "tap", "reload", "goBack", "setViewportSize"];  // a size change (a phone view) ends the film: the frames change shape
// keys pressed on the page itself (a shortcut): the film shows each on a badge, the page alone shows nothing of them
const KEYBOARD_ACTIONS = ["press", "type", "insertText"];

type Action = {
  id: number; kind: string; target: string; url: string; page: number; m: number; a: number; box: unknown;
  still?: string; still_t?: number; pre?: unknown; post?: unknown; error?: string; value?: string; text?: unknown;
  expect?: { expression: string; expected: string[]; not: boolean; received?: string }; step?: string;
};
// the argument that holds what an action typed, pressed or chose (page methods take a selector first)
const LOCATOR_VALUE: Record<string, number> = { fill: 0, type: 0, pressSequentially: 0, press: 0, selectOption: 0,
  setChecked: 0 };
const PAGE_VALUE: Record<string, number> = { fill: 1, type: 1, press: 1, selectOption: 1 };
const KEYBOARD_VALUE: Record<string, number> = { press: 0, type: 0, insertText: 0 };
const TYPED = new Set(["fill", "type", "pressSequentially"]);
// checks that pass when no element shows (toBeHidden(), toBeVisible({ visible: false }), toBeAttached({ attached:
// false }), toHaveCount(0)): they prove no text, and their .not proves the element is there
const absence = (expression: string, options: any) => expression === "to.be.hidden" || expression === "to.be.detached"
  || (expression === "to.have.count" && options?.expectedNumber === 0);
// what runs in this async flow (actions run at once, with Promise.all, keep their own): the action whose Playwright
// method calls another (pressSequentially types with type, clear fills, setChecked checks), and the test.step block
const acting = new AsyncLocalStorage<Action>();
const section = new AsyncLocalStorage<string>();

const shown = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value.slice(0, 80);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(shown).filter(Boolean).join(", ").slice(0, 80) || undefined;
  if (typeof value === "object") {
    const option = value as { label?: unknown; value?: unknown; index?: unknown };
    return shown(option.label ?? option.value ?? option.index);
  }
  return undefined;
};

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const json = async (page: Page, script: string) => {
  const value = await page.evaluate(script).catch(() => null);
  try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; }
};

class Recorder {
  frames: { file: string; t: number; page: number }[] = [];
  actions: Action[] = [];
  pages = new Map<Page, number>();
  closedText = new Map<number, { text: unknown; text_t: number }>();
  last: { action: Action; page: Page } | null = null;
  // files the test downloaded (a PDF's first page can end its chapter), saved while the test runs
  downloads: { name: string; file: string; t: number; after: number; page: number; saved: boolean }[] = [];
  pending: Promise<void>[] = [];
  // the test ended: a page still open (a context the test left open, one shared with the next test) films no more here
  done = false;
  constructor(readonly dir: string) {
    for (const sub of ["frames", "stills"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }

  download(page: number, download: { suggestedFilename(): string; path(): Promise<string | null> }) {
    const name = download.suggestedFilename();
    const entry = { name, file: path.join("downloads", `${this.downloads.length}-${name.replace(/[^\w.-]+/g, "_").slice(-80)}`),
      t: Date.now(), after: this.actions.length - 1, page, saved: false };
    this.downloads.push(entry);
    this.pending.push((async () => {
      const source = await download.path().catch(() => null);
      if (!source) return;
      fs.mkdirSync(path.join(this.dir, "downloads"), { recursive: true });
      fs.copyFileSync(source, path.join(this.dir, entry.file));
      entry.saved = true;
    })().catch(() => undefined));
  }

  async beforeClose(page: Page) {
    const id = this.pages.get(page);
    if (id === undefined || page.isClosed() || this.done) return;
    // Project helpers may close their own context before our fixture finishes.
    // Preserve a real final reading; a failed probe stays unknown, never an inferred [].
    const text = await json(page, TEXT);
    this.closedText.set(id, { text: text ?? {}, text_t: Date.now() });
  }

  async attach(page: Page) {
    if (this.pages.has(page) || this.done) return;
    const id = this.pages.size;
    this.pages.set(page, id);
    const close = page.close.bind(page);
    page.close = async (...args: Parameters<typeof page.close>) => {
      await this.beforeClose(page).catch(() => undefined);
      return close(...args);
    };
    page.on("download", (download) => this.download(id, download));
    const cdp = await page.context().newCDPSession(page);
    let n = 0;
    cdp.on("Page.screencastFrame", (frame) => {
      if (this.done) {  // frames.json is written: a later frame would only lie in the folder
        cdp.send("Page.stopScreencast").catch(() => undefined);
        return;
      }
      const file = path.join("frames", `p${id}-${String(n++).padStart(6, "0")}.jpg`);
      fs.writeFileSync(path.join(this.dir, file), Buffer.from(frame.data, "base64"));
      this.frames.push({ file, t: Math.round((frame.metadata.timestamp ?? Date.now() / 1000) * 1000), page: id });
      cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => undefined);
    });
    // Chromium sends the frames in CSS pixels, whatever the device scale and the largest size asked for
    const size = page.viewportSize() || { width: 1600, height: 900 };
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: size.width, maxHeight: size.height,
      everyNthFrame: 1 });
  }

  async context(context: BrowserContext) {
    const close = context.close.bind(context);
    context.close = async (...args: Parameters<typeof context.close>) => {
      await Promise.all(context.pages().map((page) => this.beforeClose(page).catch(() => undefined)));
      return close(...args);
    };
    // init scripts run before the document has its <html> element: install once it exists
    await context.addInitScript({ content: `(()=>{const run=()=>{${INIT}};const wait=()=>document.documentElement?run():setTimeout(wait,4);wait()})()` });
    context.on("page", (page) => { this.attach(page).catch(() => undefined); });
    for (const page of context.pages()) await this.attach(page);
  }

  // The previous action's result (what changed since its own probe), then this action's element.
  async before(page: Page, action: Action, locator: Locator | null) {
    if (this.last && !this.last.page.isClosed()) this.last.action.post = await json(this.last.page, PROBE);
    (action as any).settled = await page.evaluate(SETTLE).catch(() => null);
    if (locator) await locator.evaluate((element) => { (window as any).__demoTarget = element; }, undefined,
      { timeout: 1500 }).catch(() => undefined);
    action.pre = await json(page, PROBE);
    action.text = await json(page, TEXT);
    await this.still(page, action);
  }

  // A still in CSS pixels is the very picture of a screencast frame (Chromium scales both from the page drawn at the
  // device scale): the take switches between them. A still in device pixels drew every letter a little sharper than
  // the frames beside it, so the text flickered at each switch.
  async still(page: Page, action: Action) {
    const still = path.join("stills", `a${String(action.id).padStart(4, "0")}.jpg`);
    const t = Date.now();
    const shot = await page.screenshot({ scale: "css", type: "jpeg", quality: 90 }).catch(() => null);
    if (shot) {
      fs.writeFileSync(path.join(this.dir, still), shot);
      action.still = still;
      action.still_t = t;
    }
  }

  // A check that passed (expect(locator)…): what it proves, with the text on screen and a still taken after it held.
  async look(locator: Locator, expression: string, options: any, result: any, started: number) {
    const page = locator.page();
    const expected: string[] = [];
    for (const item of options?.expectedText || []) {
      const text = item?.string ?? (item?.regexSource ? `/${item.regexSource}/` : "");
      if (text) expected.push(String(text).slice(0, 120));
    }
    if (typeof options?.expectedNumber === "number") expected.push(String(options.expectedNumber));
    const action: Action = { id: this.actions.length, kind: "look", target: String(locator), url: page.url(),
      page: this.pages.get(page) ?? -1, m: started, a: Date.now(), box: null,
      expect: { expression, expected: expected.slice(0, 3), not: !!options?.isNot,
        received: typeof result?.received === "string" ? result.received.slice(0, 160) : undefined } };
    const step = section.getStore();
    if (step) action.step = step;
    this.actions.push(action);
    // a check on a password field keeps its value out of the record, as typing into it does
    if (!absence(expression, options)
      && await locator.first().getAttribute("type", { timeout: 300 }).catch(() => null) === "password") {
      action.expect!.expected = action.expect!.expected.map(() => "••••");
      action.expect!.received = undefined;
    }
    // a check can pass while the page around it still loads (a chart's data): the still waits for it, as before an action
    (action as any).settled = await page.evaluate(SETTLE).catch(() => null);
    if (!!options?.isNot === absence(expression, options)) {  // an element there, not a check that one is gone
      // Playwright counts an element fading in (opacity 0, a toast's first frames) as visible: the still waits until
      // it is painted, at most 0.8 s, then lets a slide settle
      await locator.first().evaluate(async (element) => {
        const opacity = () => { let value = 1; for (let node: Element | null = element; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity || 1); return value; };
        const until = Date.now() + 800;
        while (Date.now() < until && opacity() < 0.95) await new Promise((done) => requestAnimationFrame(() => done(null)));
        await new Promise((done) => setTimeout(done, 120));
      }, undefined, { timeout: 1500 }).catch(() => undefined);
      // a check passes on an element below the fold (Playwright's visible is not in view), which the film cannot show:
      // the page scrolls it into view first (only what fits the view, and only when it lies outside it). Only as a
      // viewer scrolls, up or down in the page or a panel that scrolls: scrollIntoView also scrolls sideways and moves
      // boxes that hide their overflow, which left a page cut off under its sidebar (a card at a carousel's edge)
      await locator.first().evaluate(async (element) => {
        const box = element.getBoundingClientRect();
        if (box.height < innerHeight * 0.8 && (box.bottom > innerHeight - 8 || box.top < 0)) {
          const kept: [Element, number, number][] = [];
          for (let node = element.parentElement; node; node = node.parentElement) kept.push([node, node.scrollLeft, node.scrollTop]);
          const left = scrollX;
          element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
          for (const [node, x, y] of kept) {
            const scrolls = node === document.scrollingElement || /auto|scroll|overlay/.test(getComputedStyle(node).overflowY);
            if (node.scrollLeft !== x || (!scrolls && node.scrollTop !== y)) {
              node.scrollTo({ left: x, top: scrolls ? node.scrollTop : y, behavior: "instant" });
            }
          }
          if (scrollX !== left) scrollTo({ left, top: scrollY, behavior: "instant" });
          await new Promise((done) => setTimeout(done, 150));
        }
      }, undefined, { timeout: 1500 }).catch(() => undefined);
      action.box = await locator.first().boundingBox({ timeout: 300 }).catch(() => null);
      await locator.first().evaluate((element) => { (window as any).__demoTarget = element; }, undefined,
        { timeout: 300 }).catch(() => undefined);
    } else {  // a check that something is gone (hidden, none left, .not) has no element, nor an earlier one's text
      await page.evaluate(() => { (window as any).__demoTarget = null; }).catch(() => undefined);
    }
    action.text = await json(page, TEXT);
    await this.still(page, action);
  }

  async finish(extra: { status?: string; [key: string]: unknown }) {
    if (this.last && !this.last.page.isClosed()) this.last.action.post = await json(this.last.page, PROBE);
    await Promise.race([Promise.all(this.pending), new Promise((done) => setTimeout(done, 15_000))]);
    const pages = [];
    for (const [page, id] of this.pages) {
      if (page.isClosed()) {
        const ending = this.closedText.get(id);
        if (ending) pages.push({ page: id, closed: true, ...ending });
        continue;
      }
      const log = await json(page, "JSON.stringify({loading: window.__demoLoad || [], routes: window.__demoRoutes || []})");
      const ambient = await json(page, AMBIENT);
      const text = await json(page, TEXT);  // what the page ends on (an empty state there ends the scene on nothing)
      const still = path.join("stills", `end-p${id}.jpg`);
      const t = Date.now();
      const shot = await page.screenshot({ scale: "css", type: "jpeg", quality: 90 }).catch(() => null);  // as still()
      if (shot) fs.writeFileSync(path.join(this.dir, still), shot);
      const aria = extra.status !== "passed" ? await ariaOf(page) : null;  // what the page held when the test failed
      if (aria) fs.writeFileSync(path.join(this.dir, `aria-p${id}.txt`), aria);
      pages.push({ page: id, ...(log || {}), ambient: ambient || [], still: shot ? still : null, still_t: t, url: page.url(),
        aria: aria ? `aria-p${id}.txt` : null, text: text || {} });
    }
    fs.writeFileSync(path.join(this.dir, "frames.json"), JSON.stringify(this.frames));
    fs.writeFileSync(path.join(this.dir, "actions.json"), JSON.stringify(this.actions, null, 1));
    fs.writeFileSync(path.join(this.dir, "page-log.json"), JSON.stringify({ ...extra, pages,
      downloads: this.downloads.filter((d) => d.saved) }, null, 1));
  }
}

let current: Recorder | null = null;

async function ariaOf(page: Page): Promise<string | null> {
  const body = page.locator("body") as any;  // Playwright 1.49 and later
  if (typeof body.ariaSnapshot !== "function") return null;
  return await body.ariaSnapshot({ timeout: 3000 }).catch(() => null);
}

function wrap(proto: Record<string, unknown>, names: string[], pageOf: (self: any) => Page,
  locatorOf: (self: any, args: unknown[]) => Locator | null, describe: (self: any, args: unknown[]) => string,
  values: Record<string, number>) {
  for (const name of names) {
    const original = proto[name] as ((...args: unknown[]) => Promise<unknown>) | undefined;
    if (typeof original !== "function" || (original as any).__demo) continue;
    const wrapped = async function (this: any, ...args: unknown[]) {
      const recorder = current;
      // a method another action calls (pressSequentially types with type) is part of that action, filmed once with it
      if (!recorder || acting.getStore()) return original.apply(this, args);
      const page = pageOf(this);
      const locator = locatorOf(this, args);
      const action: Action = { id: recorder.actions.length, kind: name, target: describe(this, args), url: page.url(),
        page: recorder.pages.get(page) ?? -1, m: 0, a: 0, box: null };
      if (name in values) action.value = shown(args[values[name]]);
      const step = section.getStore();
      if (step) action.step = step;
      if (action.value && TYPED.has(name) && locator
        && await locator.getAttribute("type", { timeout: 300 }).catch(() => null) === "password") action.value = "••••";
      recorder.actions.push(action);
      action.box = locator ? await locator.boundingBox({ timeout: 1500 }).catch(() => null) : null;
      await recorder.before(page, action, locator);
      action.m = Date.now();
      try {
        return await acting.run(action, () => original.apply(this, args));
      } catch (error) {
        action.error = String(error).slice(0, 300);
        throw error;
      } finally {
        action.a = Date.now();
        recorder.last = { action, page };
      }
    };
    (wrapped as any).__demo = true;
    proto[name] = wrapped;
  }
}

export function withCapture<T extends TestType<any, any>>(base: T): T {
  const extended = base.extend<{ demoCapture: void }>({
    demoCapture: [async ({ page, context, browser }, use, testInfo) => {
      const root = process.env.DEMO_CAPTURE_DIR || testInfo.outputPath("demo");
      // one folder per test: two specs may hold tests of the same title
      const recorder = new Recorder(path.join(root, `${slug(testInfo.titlePath.slice(1).join(" "))}-${testInfo.testId.slice(0, 8)}`));
      current = recorder;
      const locators = Object.getPrototypeOf(page.locator("body"));
      wrap(locators, LOCATOR_ACTIONS, (self) => self.page(), (self) => self.first(), (self) => String(self), LOCATOR_VALUE);
      wrap(Object.getPrototypeOf(page), PAGE_ACTIONS, (self) => self,
        (self, args) => typeof args[0] === "string" && !/^https?:|^\//.test(args[0]) ? self.locator(args[0]).first() : null,
        (_self, args) => typeof args[0] === "object" ? JSON.stringify(args[0]) : String(args[0] ?? ""), PAGE_VALUE);
      wrap(Object.getPrototypeOf(page.keyboard), KEYBOARD_ACTIONS, (self) => self._page ?? page, () => null, () => "",
        KEYBOARD_VALUE);
      const check = locators._expect;  // Playwright's internal hook behind expect(locator)…: guarded, never fails a test
      if (typeof check === "function" && !check.__demo) {
        const looking = async function (this: Locator, expression: string, options: any) {
          if (CHECK_LIMIT && typeof options?.timeout === "number" && options.timeout > CHECK_LIMIT) {
            options = { ...options, timeout: CHECK_LIMIT };
          }
          const started = Date.now();
          const result = await check.call(this, expression, options);
          const filming = current;
          if (filming && result && result.matches !== !!options?.isNot) {
            await filming.look(this, expression, options, result, started).catch(() => undefined);
          }
          return result;
        };
        (looking as any).__demo = true;
        locators._expect = looking;
      }
      // a context the test opens itself is filmed by the test running then: the browser serves the worker's every test,
      // so its method is replaced once (never chained test after test), and a context opened between tests (the next
      // test's own) joins no film
      if (!(browser.newContext as any).__demo) {
        const newContext = browser.newContext.bind(browser);
        const opening = async (...args: Parameters<typeof browser.newContext>) => {
          const created = await newContext(...args);
          await current?.context(created);
          return created;
        };
        (opening as any).__demo = true;
        browser.newContext = opening;
      }
      await recorder.context(context);
      // a project's page fixture may open the page in a context of its own, before this fixture runs
      if (page.context() !== context) await recorder.context(page.context());
      const start = Date.now();
      try {
        await use();
        for (const open of context.pages()) if (!open.isClosed()) await open.evaluate(SETTLE_END).catch(() => null);
        await new Promise((done) => setTimeout(done, 300));  // the loaded page's frames reach the screencast
        await recorder.finish({ start, end: Date.now(), viewport: page.viewportSize(), scale: SCALE,
          status: testInfo.status, title: testInfo.titlePath.slice(1).join(" › "), file: testInfo.file,
          line: testInfo.line, testId: testInfo.testId, error: testInfo.error?.message?.slice(0, 1500) ?? null });
      } finally {
        recorder.done = true;
        current = null;
      }
    }, { auto: true }],
  }) as unknown as T;
  // test.step(title, body): its title is kept with the actions inside it (a guarded wrapper: the step runs as before)
  const step = (extended as any).step;
  if (typeof step === "function" && !step.__demo) {
    const titled = async function (this: unknown, title: string, body: unknown, ...rest: unknown[]) {
      return await section.run(String(title).slice(0, 60), () => step.call(this ?? extended, title, body, ...rest));
    };
    (titled as any).__demo = true;
    for (const key of Object.keys(step)) (titled as any)[key] = step[key];  // test.step.skip and the like
    try { (extended as any).step = titled; } catch { /* a frozen test object keeps its own step */ }
  }
  return extended;
}
