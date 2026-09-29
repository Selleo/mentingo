// NODE_PATH=<project>/e2e/node_modules node --test tests/test_capture_text.cjs
// When Chromium cannot launch, RF_CAPTURE_DOM=jsdom uses a DOM parser with mocked visibility.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test, before, after } = require('node:test');

const source = readFileSync(join(__dirname, '../scripts/capture/text.js'), 'utf8');
const fallback = process.env.RF_CAPTURE_DOM === 'jsdom';
let browser;

before(async () => {
  if (!fallback) {
    const { chromium } = require('@playwright/test');
    browser = await chromium.launch({ timeout: 10000 });
  }
});
after(async () => { if (browser) await browser.close(); });

async function probe(html) {
  if (fallback) {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const { window } = dom;
    window.HTMLElement.prototype.getBoundingClientRect = () =>
      ({ x: 0, y: 0, width: 200, height: 30, top: 0, left: 0, right: 200, bottom: 30 });
    const style = window.getComputedStyle.bind(window);
    window.getComputedStyle = element => {
      const actual = style(element);
      return { display: actual.display, visibility: actual.visibility, opacity: actual.opacity || '1' };
    };
    try { return JSON.parse(window.eval(source)); } finally { window.close(); }
  }
  const page = await browser.newPage();
  try {
    await page.setContent(html);
    return JSON.parse(await page.evaluate(source));
  } finally { await page.close(); }
}

test('documentation can quote an empty-state label inside an article', async () => {
  const data = await probe('<article><p>When an authorised viewer opens a contractor without an assigned path, they see <strong>No path assigned yet.</strong></p></article>');
  assert.deepEqual(data.empty, []);
});

test('a dialog message is an empty state by its first sentence', async () => {
  const data = await probe('<div role="dialog"><p>There are no active certificates to update right now. Future certificates will use this validity setting.</p></div>');
  assert.deepEqual(data.empty, ['There are no active certificates to update right now.']);
});

test('long prose outside a dialog is not an empty state', async () => {
  const data = await probe('<article><p>There are no limits on how many courses a tenant can publish. Each course keeps its own settings and certificates.</p></article>');
  assert.deepEqual(data.empty, []);
});

test('a short explanatory paragraph is not itself an empty state', async () => {
  const data = await probe('<p>The message is <em>No results found.</em></p>');
  assert.deepEqual(data.empty, []);
});

test('an actual standalone empty state inside an article is still detected', async () => {
  const data = await probe('<article><p>No path assigned yet.</p></article>');
  assert.deepEqual(data.empty, ['No path assigned yet.']);
});

test('documentation list items can explain a missing control without becoming an empty state', async () => {
  const data = await probe('<article><ul><li>There is <strong>no button in the admin UI</strong> for sending to the service. Open its URL directly.</li></ul></article>');
  assert.deepEqual(data.empty, []);
});

test('real split and standalone empty messages in list items remain detected', async () => {
  const data = await probe('<ul><li>There are <strong>no records</strong> to display.</li><li>No invoices found.</li></ul>');
  assert.deepEqual(data.empty, ['no records', 'No invoices found.']);
});

test('leading emphasized empty labels with follow-up guidance remain detected', async () => {
  const data = await probe('<p><strong>No results found.</strong> Try another search.</p>');
  assert.deepEqual(data.empty, ['No results found.']);
});

test('a real empty-state sentence can be split by inline markup', async () => {
  const data = await probe('<p>There are <strong>no records</strong> to display.</p>');
  assert.deepEqual(data.empty, ['no records']);
});

test('an explanatory quote does not hide a separate real empty state', async () => {
  const data = await probe('<article><p>The message is <code>No path assigned yet.</code></p><section><p>No invoices found.</p></section></article>');
  assert.deepEqual(data.empty, ['No invoices found.']);
});

test('Tailwind empty variants are not named empty states', async () => {
  const data = await probe('<div class="empty:hidden">A completed invoice</div><div class="group-empty:hidden">A completed budget</div>');
  assert.deepEqual(data.empty, []);
});

test('an actual named empty-state component remains detected', async () => {
  const data = await probe('<div class="empty-state">Add the first invoice</div>');
  assert.deepEqual(data.empty, ['Add the first invoice']);
});

test('three visible zero tiles remain detected', async () => {
  const data = await probe('<div><span>0 PLN</span><span>0 PLN</span><span>0 PLN</span></div>');
  assert.deepEqual(data.empty, ['3 values read 0']);
});

test('free courses plus an unselected-row counter are not empty tiles', async () => {
  const data = await probe('<div>Selected (<span>0</span>)</div><table><tbody>' +
    '<tr><td>Customer care: listening</td><td>0 zł</td></tr>' +
    '<tr><td>Customer care: complaints</td><td>0 zł</td></tr></tbody></table>');
  assert.deepEqual(data.empty, []);
});

test('zero values in ARIA table and grid cells are not empty tiles', async () => {
  for (const role of ['table', 'grid', 'treegrid']) {
    const data = await probe(`<div role="${role}"><div role="row">` +
      '<div role="cell">0 PLN</div><div role="cell">0</div><div role="cell">0%</div></div></div>');
    assert.deepEqual(data.empty, []);
  }
});

test('an actual empty-state message in a table remains detected', async () => {
  const data = await probe('<table><tbody><tr><td>No courses found.</td></tr></tbody></table>');
  assert.deepEqual(data.empty, ['No courses found.']);
});

test('table values do not hide three zero summary tiles outside the table', async () => {
  const data = await probe('<table><tr><td>0 PLN</td><td>0 PLN</td></tr></table>' +
    '<section><div>0 PLN</div><div>0 PLN</div><div>0 PLN</div></section>');
  assert.deepEqual(data.empty, ['3 values read 0']);
});
