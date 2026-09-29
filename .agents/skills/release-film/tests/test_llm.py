import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import llm  # noqa: E402

FAKE = '''#!/usr/bin/env python3
import json, os, sys
prompt = sys.stdin.read()
if os.environ.get("FAKE_CLAUDE_SLEEP"):
    import time
    time.sleep(float(os.environ["FAKE_CLAUDE_SLEEP"]))
json.dump({"argv": sys.argv[1:], "prompt": prompt, "cwd": os.getcwd(), "scrub": os.environ.get("CLAUDE_CODE_SUBPROCESS_ENV_SCRUB"),
           "api_key": os.environ.get("ANTHROPIC_API_KEY")}, open(os.environ["FAKE_CLAUDE_LOG"], "w"))
calls = os.environ.get("FAKE_CLAUDE_CALLS")
count = 0
if calls:
    count = int(open(calls).read() or 0) + 1 if os.path.exists(calls) else 1
    open(calls, "w").write(str(count))
if os.environ.get("FAKE_CLAUDE_FAIL") and count <= int(os.environ.get("FAKE_CLAUDE_FAIL_TIMES") or 99):
    print(json.dumps({"type": "result", "subtype": "success", "is_error": True, "result": os.environ["FAKE_CLAUDE_FAIL"]}))
else:
    print(json.dumps([{"type": "system", "subtype": "init"},
                      {"type": "result", "subtype": "success", "is_error": False, "result": "# chapter F1 | 7 | Karta",
                       "duration_ms": 61234, "total_cost_usd": 0.5,
                       "usage": {"input_tokens": 2, "cache_read_input_tokens": 10, "cache_creation_input_tokens": 30,
                                 "output_tokens": 900, "output_tokens_details": {"thinking_tokens": 700}}}]))
'''


class Cli(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        fake = Path(self.folder.name) / 'claude'
        fake.write_text(FAKE)
        fake.chmod(0o755)
        self.log = Path(self.folder.name) / 'call.json'
        self.env = mock.patch.dict(os.environ, {'PATH': f'{self.folder.name}{os.pathsep}{os.environ["PATH"]}',
                                                'FAKE_CLAUDE_LOG': str(self.log)})
        self.env.start()
        self.addCleanup(self.env.stop)
        for name in ('ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'RELEASE_FILM_LLM', 'FAKE_CLAUDE_FAIL',
                     'FAKE_CLAUDE_FAIL_TIMES', 'FAKE_CLAUDE_CALLS'):
            os.environ.pop(name, None)
        sleep = mock.patch('llm.time.sleep')
        sleep.start()
        self.addCleanup(sleep.stop)

    def test_the_cli_is_chosen_whenever_installed_and_the_agent_without_it(self):
        self.assertEqual((llm.choose(), llm.capabilities()), ('cli', {'text': True, 'review': True, 'workers': True}))
        os.environ['ANTHROPIC_API_KEY'] = 'x'
        self.assertEqual(llm.choose(), 'cli')  # a key changes nothing: every call leaves it out
        with mock.patch('llm.shutil.which', return_value=None):
            self.assertEqual((llm.choose(), llm.capabilities()), ('agent', {'text': False, 'review': False, 'workers': False}))

    def test_only_a_subscription_sign_in_counts(self):  # a /login, or the CI token from claude setup-token
        os.environ['ANTHROPIC_API_KEY'] = 'x'
        for out, expected in (('{"loggedIn": true, "authMethod": "claude.ai"}', True),
                              ('{"loggedIn": true, "authMethod": "oauth_token"}', True),
                              ('{"loggedIn": true, "authMethod": "api_key"}', False), ('{"loggedIn": false}', False),
                              ('{"loggedIn": true}', True), ('not json', True), ('[]', True)):
            with self.subTest(out=out), mock.patch('llm.subprocess.run',
                                                   return_value=mock.Mock(stdout=out, returncode=0)) as run:
                self.assertEqual(llm.signed_in(), expected)
                self.assertNotIn('ANTHROPIC_API_KEY', run.call_args.kwargs['env'])  # asked as the calls run
        with mock.patch('llm.subprocess.run', side_effect=FileNotFoundError('claude')):
            self.assertTrue(llm.signed_in())  # no such command: the calls find out

    def test_a_step_left_out_is_recorded_and_said(self):
        run = Path(self.folder.name) / 'run'
        run.mkdir()
        with mock.patch('sys.stderr') as err:
            llm.degraded(run, 'review', 'no Claude Code CLI')
            llm.degraded(run, 'review', 'no Claude Code CLI')
        self.assertEqual(json.loads((run / 'degraded.json').read_text()), {'review': 'no Claude Code CLI'})
        self.assertIn('DEGRADED', ''.join(c.args[0] for c in err.write.call_args_list if c.args))

    def test_a_passing_failure_is_tried_again(self):
        os.environ.update({'FAKE_CLAUDE_FAIL': 'API Error: 529 Overloaded', 'FAKE_CLAUDE_FAIL_TIMES': '2',
                           'FAKE_CLAUDE_CALLS': str(Path(self.folder.name) / 'calls')})
        text, usage = llm.complete('the prompt', 'the system')
        self.assertEqual((text, usage['provider']), ('# chapter F1 | 7 | Karta', 'cli'))
        self.assertEqual((Path(self.folder.name) / 'calls').read_text(), '3')

    def test_a_lasting_failure_is_not_tried_again(self):
        os.environ.update({'FAKE_CLAUDE_FAIL': 'Not logged in', 'FAKE_CLAUDE_CALLS': str(Path(self.folder.name) / 'calls')})
        text, usage = llm.complete('the prompt', 'the system')
        self.assertEqual((text, usage['provider']), ('', 'agent'))
        self.assertEqual((Path(self.folder.name) / 'calls').read_text(), '1')

    def test_one_call_at_the_given_effort_without_tools_or_project_files(self):
        os.environ['ANTHROPIC_API_KEY'] = 'x'  # left out: the call runs on the subscription
        text, usage = llm.complete('the prompt', 'the system', effort='low')
        self.assertEqual(text, '# chapter F1 | 7 | Karta')
        call = json.loads(self.log.read_text())
        argv = call['argv']
        self.assertEqual(argv[argv.index('--model') + 1], 'claude-opus-5-5')
        self.assertEqual(argv[argv.index('--effort') + 1], 'low')
        self.assertEqual(argv[argv.index('--tools') + 1], '')
        self.assertIn('--no-session-persistence', argv)
        self.assertEqual(call['prompt'], 'the prompt')
        self.assertEqual((call['scrub'], call['api_key']), ('0', None))  # no Bash here: no sandbox needed
        self.assertFalse(call['cwd'].startswith(str(Path(__file__).resolve().parents[1])))
        self.assertEqual((usage['provider'], usage['effort'], usage['seconds'], usage['input'], usage['output'], usage['thinking']),
                         ('cli', 'low', 61.2, 42, 900, 700))

    def test_every_call_of_a_run_is_logged_with_its_cost(self):
        os.environ.pop('RELEASE_FILM_RUN', None)
        llm.complete('the prompt', 'the system')  # no run: nothing to log into
        run = Path(self.folder.name) / 'run'
        run.mkdir()
        os.environ['RELEASE_FILM_RUN'] = str(run)
        llm.complete('the prompt', 'You check a demo film\n against its pictures.', effort='low')
        lines = [json.loads(line) for line in (run / 'usage.jsonl').read_text().splitlines()]
        self.assertEqual([(line['step'], line['usd_list'], line['effort']) for line in lines],
                         [('You check a demo film against its pictures.', 0.5, 'low')])
        os.environ.pop('RELEASE_FILM_RUN')

    def test_a_call_past_its_time_limit_is_a_failed_call(self):
        os.environ['FAKE_CLAUDE_SLEEP'] = '5'
        try:
            with self.assertRaisesRegex(RuntimeError, 'within 1 s'):
                llm.cli('the prompt', 'the system', 'low', timeout=1)
            text, usage = llm.complete('the prompt', 'the system', timeout=1)
            self.assertEqual((text, usage['provider']), ('', 'agent'))  # a reserve chapter is then left out
        finally:
            os.environ.pop('FAKE_CLAUDE_SLEEP')

    def test_a_failed_call_hands_the_prompt_to_the_agent(self):
        os.environ['FAKE_CLAUDE_FAIL'] = 'Not logged in'
        text, usage = llm.complete('the prompt', 'the system')
        self.assertEqual(text, '')
        self.assertEqual(usage['provider'], 'agent')
        self.assertIn('Not logged in', usage['fallback'])


if __name__ == '__main__':
    unittest.main()
