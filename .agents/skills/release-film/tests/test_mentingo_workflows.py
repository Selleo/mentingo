"""Mentingo's release film workflows (.github/workflows/release-film*.yml): the seat's token only in the steps that call
Claude, never an API key, nothing started on its own, publishing a separate job without the token, the Node of the
project's recipe, and only this workflow's own knowledge read back. Mentingo is public: anyone signed in can download
its artifacts, so what they hold and what the token reaches is checked here."""
import json
from pathlib import Path
import re
import sys
import unittest

sys.dont_write_bytecode = True
SKILL = Path(__file__).resolve().parents[1]
WORKFLOWS = SKILL.parents[2] / '.github' / 'workflows'
RECORD, PUBLISH = WORKFLOWS / 'release-film.yml', WORKFLOWS / 'release-film-publish.yml'
try:
    import yaml
except ImportError:  # the runner's python3 has it (python3-yaml); a bare interpreter skips these checks
    yaml = None
TOKEN_STEPS = ['Check the machine', 'Check Claude Opus on the seat', 'Record the film',
               "Hide secrets in the run's files"]


def load(path):
    workflow = yaml.safe_load(path.read_text(encoding='utf-8'))
    workflow['on'] = workflow.pop(True, None) or workflow.get('on')  # YAML 1.1 reads the key `on` as true
    return workflow


def uses(step, action):
    return str(step.get('uses') or '').startswith(action + '@')


@unittest.skipUnless(yaml and RECORD.is_file() and PUBLISH.is_file(), "PyYAML and Mentingo's release film workflows")
class Workflows(unittest.TestCase):
    def setUp(self):
        self.record, self.publish = load(RECORD), load(PUBLISH)
        self.film = self.record['jobs']['film']

    def test_the_seat_token_reaches_only_the_steps_that_call_claude(self):
        for path in (RECORD, PUBLISH):
            # an API key would take precedence over the subscription in `claude -p` and bill the API instead
            self.assertNotRegex(path.read_text(encoding='utf-8'), r'ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN')
        self.assertNotIn('CLAUDE_CODE_OAUTH_TOKEN', PUBLISH.read_text(encoding='utf-8'))
        self.assertEqual(self.record['permissions'], {})
        self.assertEqual(self.film['permissions'], {'actions': 'read', 'contents': 'read', 'pages': 'read',
                                                   'pull-requests': 'read'})
        self.assertEqual(self.film['environment'], 'release-film')
        self.assertNotIn('CLAUDE_CODE_OAUTH_TOKEN', json.dumps(self.film['env']))
        with_token = [s.get('name') for s in self.film['steps'] if 'CLAUDE_CODE_OAUTH_TOKEN' in json.dumps(s)]
        self.assertEqual(with_token, TOKEN_STEPS)
        for step in self.film['steps']:
            if 'CLAUDE_CODE_OAUTH_TOKEN' in json.dumps(step):
                self.assertEqual(step['env']['CLAUDE_CODE_OAUTH_TOKEN'], '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}')
        # the Actions runtime (a cache's write access) is exposed by no step and never reaches what the film runs
        self.assertNotIn('ghaction-github-runtime', RECORD.read_text(encoding='utf-8'))
        steps = {s.get('name'): s for s in self.film['steps']}
        self.assertRegex(steps['Record the film']['run'], r'unset ACTIONS_RUNTIME_TOKEN ')
        for workflow in (self.record, self.publish):
            for job in workflow['jobs'].values():
                for step in job.get('steps') or []:
                    if uses(step, 'actions/checkout'):
                        self.assertIs(step['with']['persist-credentials'], False, 'a checkout keeps no GitHub token')

    def test_films_start_only_by_hand_one_at_a_time(self):
        for workflow, expected in ((self.record, ['workflow_dispatch']),
                                   (self.publish, ['workflow_call', 'workflow_dispatch'])):
            self.assertEqual(sorted(workflow['on']), expected)  # no push, tag, release, schedule or pull request trigger
        self.assertEqual(self.film['env']['FILM'], "${{ github.event_name == 'workflow_dispatch' }}")
        # a recording or a publication waiting for its turn is queued, never cancelled by the next one
        self.assertEqual(self.record['concurrency'],
                         {'group': 'release-film', 'cancel-in-progress': False, 'queue': 'max'})
        for job, group in (('publish', 'release-film-publish'), ('pages', 'release-film-pages')):
            self.assertEqual(self.publish['jobs'][job]['concurrency'],
                             {'group': group, 'cancel-in-progress': False, 'queue': 'max'})

    def test_a_tag_without_a_published_release_stops_before_the_seat_is_used(self):
        steps = [s.get('name') for s in self.film['steps']]
        resolve = self.film['steps'][steps.index('Resolve the release')]
        self.assertLess(steps.index('Resolve the release'), steps.index('Record the film'))
        self.assertEqual(resolve['env']['PUBLISH'], '${{ inputs.publish }}')
        self.assertIn('gh api "repos/${GITHUB_REPOSITORY}/releases/tags/${tag}"', resolve['run'])
        self.assertIn('^v[0-9]+\\.[0-9]+\\.[0-9]+(-[A-Za-z0-9.]+)?$', resolve['run'])  # .chglog/config.yml's tags
        # the base reaches git as a revision: only an existing tag, never an option
        self.assertEqual(resolve['env']['BASE'], '${{ inputs.base }}')
        self.assertIn('^[A-Za-z0-9][A-Za-z0-9._-]*$', resolve['run'])
        self.assertIn('refs/tags/${BASE}^{commit}', resolve['run'])
        # a recording publishes its film by default; a tag that already has one stops it here, unless replace is on
        inputs = self.record['on']['workflow_dispatch']['inputs']
        self.assertIs(inputs['publish']['default'], True)
        self.assertIs(inputs['replace']['default'], False)
        self.assertEqual(resolve['env']['REPLACE'], '${{ inputs.replace }}')
        self.assertRegex(resolve['run'], r'\[ "\$\{PUBLISH\}" = "true" \] && \[ "\$\{REPLACE\}" != "true" \][\s\S]*'
                                         r'release_assets\.py earlier --tag')

    def test_every_action_is_pinned_to_a_commit(self):  # these jobs hold the seat's token and write releases and Pages
        for path in (RECORD, PUBLISH, WORKFLOWS / 'pr-release-film-ci.yml'):
            for line in path.read_text(encoding='utf-8').splitlines():
                if 'uses:' in line and 'uses: ./' not in line:
                    with self.subTest(workflow=path.name, line=line.strip()):
                        self.assertRegex(line, r'uses: [\w./-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$')

    def test_the_runner_has_the_node_of_the_recipe(self):
        recipe = json.loads((SKILL / 'projects' / 'selleo__mentingo.json').read_text(encoding='utf-8'))['harness']
        [node] = [s for s in self.film['steps'] if uses(s, 'actions/setup-node')]
        # the machine check wants the recipe's Node on the runner: a runner has no asdf to install it
        self.assertEqual(str(node['with']['node-version']), recipe['node'])
        self.assertTrue(recipe.get('isolate'))
        # the film's own pnpm install runs in a worktree of this clone: husky must not set its hooks path there
        self.assertEqual(recipe['env']['HUSKY'], '0')
        self.assertEqual(self.film['env']['RELEASE_FILM_CI_WORKERS'], '2')  # as the project's films were rehearsed

    def test_the_films_and_their_pages_look_like_mentingo(self):  # apps/web/app/index.css: its fonts and colours
        brand = json.loads((SKILL / 'projects' / 'selleo__mentingo.json').read_text(encoding='utf-8'))['brand']
        self.assertEqual((brand['font']['family'], brand['font']['kit']),
                         ('all-round-gothic', 'https://use.typekit.net/qqt7bjl.css'))
        self.assertEqual(brand['body_font']['family'], 'Open Sans')
        self.assertEqual(brand['colors'], {'accent': '#3f58b6', 'frame': '#222949'})  # primary-700, primary-950

    def test_the_artifacts_hold_no_secret_and_the_knowledge_only_its_own_runs(self):
        steps = {s.get('name'): s for s in self.film['steps']}
        names = [s.get('name') for s in self.film['steps']]
        hide = names.index("Hide secrets in the run's files")  # GitHub masks the log, never the files a run writes
        self.assertGreater(hide, names.index('Record the film'))
        for later in ('Stage the film for its release', 'Upload the film and its page', "Upload the run's report",
                      "Keep the project's knowledge"):
            self.assertLess(hide, names.index(later), later)
        self.assertIn('always()', steps["Hide secrets in the run's files"]['if'])
        self.assertIn('ci/redact.py', steps["Hide secrets in the run's files"]['run'])
        # and nothing of the run's files leaves the runner, not even the job summary, unless that redaction succeeded
        self.assertEqual(steps["Hide secrets in the run's files"]['id'], 'redact')
        for name in ('Summarize the film', "Upload the run's report", "Keep the project's knowledge"):
            self.assertIn("steps.redact.outcome == 'success'", steps[name]['if'], name)
        self.assertTrue(steps['Upload the film and its page']['if'].startswith('success()'))
        report = steps["Upload the run's report"]['with']['path']
        for private in ('secrets.json', 'keeper.env.json'):
            self.assertIn(f'!${{{{ steps.release.outputs.run }}}}/{private}', report)
        self.assertNotIn('runner.env', report)  # the runner's variables (per-run secrets among them)
        self.assertNotIn('**', report)  # nothing of the release's checkout
        retention = {s['with']['name']: s['with']['retention-days'] for s in self.film['steps']
                     if uses(s, 'actions/upload-artifact')}
        self.assertEqual(retention, {'release-film': 14, 'release-film-report': 14, 'release-film-knowledge': 90})
        keep = steps["Keep the project's knowledge"]
        self.assertEqual(keep['with']['path'], '${{ env.RELEASE_FILM_HOME }}/projects/*/knowledge')
        self.assertIn("steps.record.outcome == 'success'", keep['if'])  # kept even when staging refuses the film
        restore = steps["Restore the project's knowledge"]['run']
        self.assertIn('actions/workflows/release-film.yml', restore)  # never another workflow's artifact
        self.assertIn('workflow_dispatch', restore)
        self.assertIn('.workflow_run.head_repository_id == .workflow_run.repository_id', restore)  # never a fork's
        self.assertIn('/knowledge/*/knowledge', restore)  # never a recipe (commands) from an artifact
        self.assertIn('[ ! -L "${folder}" ]', restore)
        self.assertNotIn('uses', steps["Restore the project's knowledge"])
        # the listing is read before the loop: inside a for list a failed request would not stop the step, and a
        # recording would start from nothing and keep that as the project's knowledge
        self.assertIn('candidates=$(gh api', restore)
        self.assertIn('for candidate in ${candidates}; do', restore)
        self.assertNotIn('for candidate in $(', restore)

    def test_publishing_is_a_separate_job_without_the_token_that_never_records(self):
        chained = self.record['jobs']['publish']
        self.assertEqual(chained['uses'], './.github/workflows/release-film-publish.yml')
        self.assertEqual(chained['needs'], 'film')
        self.assertNotIn('secrets', chained)
        self.assertEqual(chained['with'], {'run_id': '${{ github.run_id }}', 'target': 'release',
                                           'replace': '${{ inputs.replace }}'})
        self.assertEqual(chained['if'], "${{ github.event_name == 'workflow_dispatch' && inputs.publish }}")
        self.assertEqual(chained['permissions'], {'actions': 'read', 'contents': 'write', 'pages': 'write',
                                                  'id-token': 'write'})
        publish, pages = self.publish['jobs']['publish'], self.publish['jobs']['pages']
        self.assertEqual(self.publish['permissions'], {})
        self.assertNotIn('environment', publish)
        self.assertEqual(publish['permissions'], {'actions': 'read', 'contents': 'write', 'pages': 'read'})
        self.assertIs(self.publish['on']['workflow_dispatch']['inputs']['replace']['default'], False)
        self.assertIs(self.publish['on']['workflow_call']['inputs']['replace']['default'], False)
        self.assertEqual(publish['env']['PUBLISH'], "${{ github.event_name == 'workflow_dispatch' }}")
        commands = '\n'.join(s.get('run') or '' for job in self.publish['jobs'].values() for s in job['steps'])
        self.assertNotIn('film.py', commands)
        # the site alone may take a recording's film (that run's artifact, read only), never a release
        self.assertEqual(pages['permissions'], {'actions': 'read', 'contents': 'read', 'pages': 'write', 'id-token': 'write'})
        self.assertEqual(pages['environment']['name'], 'github-pages')
        self.assertIn("inputs.target == 'release' && needs.publish.result == 'success'", pages['if'])
        recorded, = [s for s in pages['steps'] if str(s.get('uses', '')).startswith('actions/download-artifact@')]
        self.assertEqual(recorded['if'], "inputs.target == 'pages' && inputs.run_id != ''")
        self.assertEqual(recorded['with']['run-id'], '${{ inputs.run_id }}')
        site = '\n'.join(s.get('run') or '' for s in pages['steps'])
        self.assertNotIn('release_assets.py publish', site)
        self.assertIn('--base-url', site)
        # a cancelled run deploys nothing (always() would carry the job past a cancel)
        self.assertTrue(pages['if'].startswith('${{ !cancelled() && '))
        # only a recording of release-film.yml in this repository, started by hand, is ever published: any run (a
        # fork's pull request among them) may upload an artifact named release-film
        for job in (publish, pages):
            names = [s.get('name') for s in job['steps']]
            for download in (s for s in job['steps'] if uses(s, 'actions/download-artifact') and 'run-id' in s['with']):
                check = job['steps'][names.index(download['name']) - 1]
                self.assertEqual(check['name'], 'Check the run is a recording')
                self.assertIn("inputs.run_id != github.run_id", check['if'])
                self.assertEqual(check['env'], {'RUN_ID': '${{ inputs.run_id }}'})
                self.assertEqual(check['run'],
                                 'python3 .agents/skills/release-film/ci/release_assets.py recording --run-id "${RUN_ID}"')
        # the films site's address: read by the helper, where only a 404 means "no site"
        for workflow in (self.record, self.publish):
            scripts = '\n'.join(s.get('run') or '' for job in workflow['jobs'].values() for s in job.get('steps') or [])
            self.assertNotIn('/pages', scripts)
            self.assertNotIn('|| true', scripts)
        # it deletes only release assets (the tag's earlier film, with replace: see test_ci), never a release
        helper = (SKILL / 'ci' / 'release_assets.py').read_text(encoding='utf-8')
        self.assertIsNone(re.search(r"\"DELETE\"|'release', 'delete'|--clobber", helper))
        self.assertEqual(re.findall(r"'DELETE'.*", helper), ["'DELETE', f'repos/{repo}/releases/assets/{assets[name][\"id\"]}')"])


if __name__ == '__main__':
    unittest.main()
