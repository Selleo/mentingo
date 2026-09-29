"""Capture keeps DOM probe readings when project fixtures close their own pages/contexts."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest


class ClosedPages(unittest.TestCase):
    def test_close_hooks_preserve_measurements_and_failed_probes_stay_unknown(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('node is needed to execute the TypeScript capture')
        version = subprocess.run([node, '--version'], capture_output=True, text=True).stdout.strip()
        if tuple(int(n) for n in re.findall(r'\d+', version)[:2]) < (22, 7):  # a version manager's old default
            self.skipTest(f'node {version} cannot strip TypeScript types (22.7 or newer)')
        capture = Path(__file__).resolve().parents[1] / 'scripts' / 'capture'
        script = r"""
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { Recorder } = await import(pathToFileURL(process.argv[1]));
const results = [];
for (const mode of ['context-clean', 'page-empty', 'probe-failure', 'already-closed']) {
  const dir = path.join(process.argv[2], mode);
  const recorder = new Recorder(dir);
  const calls = [];
  let closed = false;
  const context = {
    pages: () => closed ? [] : [page],
    addInitScript: async () => {},
    on: () => {},
    newCDPSession: async () => ({ on: () => {}, send: async () => {} }),
    close: async (options) => { calls.push(['context.close', options]); closed = true; },
  };
  const page = {
    isClosed: () => closed,
    context: () => context,
    on: () => {},
    viewportSize: () => ({ width: 1600, height: 900 }),
    close: async (options) => { calls.push(['page.close', options]); closed = true; },
    evaluate: async () => {
      calls.push(['probe', closed]);
      if (mode === 'probe-failure') throw new Error('execution context gone');
      return JSON.stringify({ empty: mode === 'page-empty' ? ['No courses yet'] : [] });
    },
  };
  await recorder.context(context);
  if (mode === 'already-closed') closed = true; // crash/unwrapped closure: no invented reading
  else if (mode === 'page-empty') await page.close({ reason: 'test page cleanup' });
  else await context.close({ reason: 'test fixture cleanup' });
  await recorder.finish({ status: 'passed' });
  results.push({ mode, calls, pages: JSON.parse(fs.readFileSync(path.join(dir, 'page-log.json'))).pages });
}
console.log(JSON.stringify(results));
"""
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'capture.mts'
            source.write_text((capture / 'capture.ts').read_text() + '\nexport { Recorder };\n')
            result = subprocess.run([node, '--experimental-transform-types', '--input-type=module', '-e', script,
                                     str(source), folder], env=dict(os.environ, DEMO_SCRIPTS=str(capture)),
                                    capture_output=True, text=True, timeout=30, check=True)
        rows = {r['mode']: r for r in json.loads(result.stdout)}
        clean = rows['context-clean']
        self.assertEqual(clean['calls'], [['probe', False], ['context.close', {'reason': 'test fixture cleanup'}]])
        self.assertEqual(clean['pages'][0]['text']['empty'], [])
        self.assertTrue(clean['pages'][0]['closed'])
        empty = rows['page-empty']
        self.assertEqual(empty['calls'], [['probe', False], ['page.close', {'reason': 'test page cleanup'}]])
        self.assertEqual(empty['pages'][0]['text']['empty'], ['No courses yet'])
        self.assertEqual(rows['probe-failure']['pages'][0]['text'], {})
        self.assertEqual(rows['already-closed']['pages'], [])


if __name__ == '__main__':
    unittest.main()
