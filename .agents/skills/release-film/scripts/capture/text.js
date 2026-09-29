// What the viewer can read on the page right now, for the narration: the open dialog's title, the visible headings,
// toasts and alerts, the acted element's name and value, and any empty state (a "No … yet" text, an element named
// empty, three or more tiles that read 0): a screen that shows nothing of a change. Short strings only; empty fields
// are left out.
(() => {
  const W = innerWidth, H = innerHeight;
  const clean = (text, limit) => (text || "").replace(/\s+/g, " ").trim().slice(0, limit);
  const visible = (element) => {
    if (!element || element.nodeType !== 1 || !element.isConnected) return false;
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2 || box.bottom <= 0 || box.right <= 0 || box.top >= H || box.left >= W) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
  };
  const texts = (selector, count, limit, root = document) => {
    const found = [];
    for (const element of root.querySelectorAll(selector)) {
      if (!visible(element) || element.closest("#demo-clock")) continue;
      const text = clean(element.innerText || element.textContent, limit);
      if (text && !found.includes(text)) found.push(text);
      if (found.length >= count) break;
    }
    return found;
  };
  const dialogs = [...document.querySelectorAll('[role=dialog],[role=alertdialog],dialog[open],[aria-modal="true"]')]
    .filter(visible);
  const dialog = dialogs[dialogs.length - 1];
  const result = {};
  if (dialog) {
    const title = texts("h1,h2,h3,h4,[role=heading]", 1, 80, dialog)[0] || clean(dialog.getAttribute("aria-label"), 80);
    if (title) result.dialog = title;
  }
  const headings = texts("h1,h2,h3,[role=heading]", 4, 70).filter((text) => text !== result.dialog);
  if (headings.length) result.headings = headings;
  const TOAST = '[role=status],[role=alert],[class*="toast" i],[class*="snackbar" i],[class*="notification" i]';
  const toasts = texts(TOAST, 2, 90);
  if (toasts.length) {
    result.toasts = toasts;
    // where the first one is: the camera shows a message that comes up far from what an action clicked
    const first = [...document.querySelectorAll(TOAST)].find((element) => visible(element) && !element.closest("#demo-clock")
      && clean(element.innerText || element.textContent, 90) === toasts[0]);
    if (first) {
      const box = first.getBoundingClientRect();
      result.toastBox = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
    }
  }
  // empty states, English and Polish: never a button, link, field or menu entry ("No" on a button is an answer)
  const EMPTY = /\b(no|nothing)\b[^.!?]{0,40}\b(yet|found|available|to (show|display)|here|results?|data|items?|records?|matches)\b|\bcould ?n[o']t find\b|\bthere (are|is) no\b|\byou (do not|don't) have any\b|^no [a-z][a-z ]{1,40}\.?$|\bbrak\b|\bnie (ma|znaleziono)\b|\bjeszcze nie\b|\bpusto\b/i;
  const ZERO = /^[$€£]?\s*0([.,]0+)?\s*(%|zł|pln|h|godz\.?|min|€|\$|usd|eur|pts?)?$/i;
  const SKIP = "#demo-clock,button,[role=button],a,label,select,option,input,textarea,[role=option],[role=menuitem],[role=tab],nav,[aria-hidden=true]";
  const empty = [], zeros = new Set();
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(), seen = 0; node && empty.length < 3 && seen < 20000; node = walker.nextNode(), seen++) {
    const element = node.parentElement;
    let text = clean(node.textContent, 400);
    // a dialog's longer message is an empty state by its first sentence ("There are no active certificates to update
    // right now. Future certificates will use this setting."); longer prose elsewhere explains, it is no status
    const long = text.length > 100;
    if (long) text = element && element.closest("[role=dialog],[role=alertdialog],dialog")
      ? ((text.match(/^[^.!?]{1,99}[.!?]/) || [""])[0]) : "";
    if (!element || !text) continue;
    const zero = ZERO.test(text);
    if (!zero && !EMPTY.test(text)) continue;
    if (element.closest(SKIP) || !visible(element)) continue;
    // Free prices and zero counters in populated table rows are not empty dashboard tiles.
    // Actual empty-state text in a table must still be reported.
    if (zero && element.closest('table,[role=table],[role=grid],[role=treegrid]')) continue;
    const whole = long ? text : clean(element.innerText || element.textContent, 100);
    // A paragraph can quote an empty-state label in inline markup while explaining a feature.
    // Keep standalone labels (including a leading emphasized label), not a quote after prose.
    const paragraph = element.closest("p,li");
    if (!zero && paragraph && paragraph !== element) {
      const context = clean(paragraph.innerText || paragraph.textContent, 500);
      if (!context.startsWith(whole)) {
        const position = context.indexOf(whole);
        const lead = context.slice(0, position).trim();
        const tail = context.slice(position + whole.length).trim();
        // Preserve a split status such as "There are <strong>no records</strong> to display".
        // A longer explanation of a missing UI control is documentation, not a live empty state.
        if (!/^there (are|is)$/i.test(lead) || !/^(to (show|display)|yet|found|available)?\.?$/i.test(tail)) continue;
      }
    }
    if (zero) zeros.add(element);
    else if (whole && !empty.includes(whole)) empty.push(whole);
  }
  // an element named as an empty state: a whole class name ("empty-state", "is-empty", "no-data"), never a variant
  // such as Tailwind's "empty:hidden" that any tile may carry
  const NAMED = /^(is-?)?empty([-_]?(state|list|message|placeholder|view|content|result|results))?$|^no-?(data|results?)$|emptystate/i;
  const named = (element) => [...element.classList].some((name) => !name.includes(":") && NAMED.test(name))
    || /empty|no-?data/i.test(element.getAttribute("data-testid") || "");
  for (const element of document.querySelectorAll('[class*="empty" i],[data-testid*="empty" i],[class*="no-data" i],[class*="nodata" i],[data-testid*="no-data" i]')) {
    if (empty.length >= 3) break;
    if (!named(element) || element.closest(SKIP) || !visible(element)) continue;
    const text = clean(element.innerText || element.textContent, 80) || "(an empty-state element)";
    if (!empty.includes(text)) empty.push(text);
  }
  if (zeros.size >= 3) empty.push(`${zeros.size} values read 0`);
  result.empty = empty.slice(0, 3); // [] proves the probe ran; an absent field is unknown in older takes
  const target = window.__demoTarget;
  if (target && target.isConnected) {
    const name = clean(target.getAttribute("aria-label") || target.innerText || target.getAttribute("title")
      || (target.labels && target.labels[0] && target.labels[0].innerText) || target.getAttribute("placeholder"), 60);
    if (name) result.target = name;
  }
  return JSON.stringify(result);
})()
