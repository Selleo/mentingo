"""The machine check: what a film cannot be made without, and the install commands proposed for this system."""
from pathlib import Path
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

import doctor  # noqa: E402

READY = {'system': 'Darwin', 'machine': 'arm64', 'version': '15.1', 'python': (3, 9, 6), 'root': False, 'brew': True,
         'apt': False, 'git': True, 'gh': True, 'gh_signed_in': True, 'docker': True, 'docker_running': True,
         'docker_memory_gb': 12.0, 'node': 'v24.18.0', 'npx': True, 'ffmpeg': '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg',
         'ffmpeg_lacks': [], 'ffprobe': '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe',
         'font': '/System/Library/Fonts/Supplemental/Arial.ttf', 'provider': 'cli', 'provider_chosen': False,
         'claude': True, 'claude_flags_missing': [], 'claude_signed_in': True, 'timeout': True,
         'pdf': True, 'asdf': False, 'disk_free_gb': 120.0, 'api_key': False, 'voice': None,
         'voice_ready': False, 'ci': False}


def names(items):
    return [item['name'] for item in items]


def proposal(found):
    missing, advised = doctor.judge(found)
    return missing, advised, doctor.plan(found, missing + advised)


class Judge(unittest.TestCase):
    def test_a_ready_mac_needs_nothing(self):
        self.assertEqual(doctor.judge(READY), ([], []))

    def test_a_new_mac_gets_one_homebrew_line_per_kind_then_the_commands_that_need_them(self):
        new = dict(READY, git=False, gh=False, gh_signed_in=False, docker=False, docker_running=False, node=None,
                   npx=False, ffmpeg='/opt/homebrew/bin/ffmpeg', ffmpeg_lacks=['drawtext'], claude=False,
                   claude_signed_in=None, provider='agent', timeout=False, pdf=False)
        missing, advised, (install, manual) = proposal(new)
        self.assertEqual(names(missing), ['git', 'gh', 'docker', 'node', 'ffmpeg', 'claude'])
        self.assertEqual(names(advised), ['timeout', 'pdf tools'])
        self.assertEqual(install, ['brew install git gh node ffmpeg-full coreutils poppler',
                                   'brew install --cask docker-desktop', doctor.CLAUDE_CODE])  # npm after Node
        self.assertEqual(manual, ['Sign in to GitHub: gh auth login',
                                  'Open Docker Desktop once and give it at least 8 GB of memory (Settings → Resources)',
                                  doctor.SIGN_IN])

    def test_docker_set_to_the_advised_memory_is_not_told_to_add_more(self):
        self.assertEqual(doctor.judge(dict(READY, docker_memory_gb=7.7)), ([], []))  # 8 GB set in Docker Desktop
        self.assertEqual(names(doctor.judge(dict(READY, docker_memory_gb=1.9))[1]), ['docker memory'])

    def test_an_old_docker_desktop_is_told_to_update_for_newer_compose_files(self):  # 4.3 had Compose 2.2
        missing, advised, (_, manual) = proposal(dict(READY, compose=(2, 2)))
        self.assertEqual((missing, names(advised)), ([], ['docker compose']))
        self.assertEqual(advised[0]['detail'], '2.2')
        self.assertIn('Update Docker Desktop', manual[0])
        self.assertEqual(doctor.judge(dict(READY, compose=(2, 40))), ([], []))
        self.assertEqual(names(doctor.judge(dict(READY, compose=None))[1]), ['docker compose'])  # no plugin at all

    def test_an_intel_mac_is_also_told_of_a_static_ffmpeg(self):  # Homebrew has no ffmpeg-full bottle for it
        _, _, (install, manual) = proposal(dict(READY, machine='x86_64', ffmpeg=None, ffprobe=None))
        self.assertEqual(install, ['brew install ffmpeg-full'])
        self.assertIn('static FFmpeg with drawtext', manual[0])
        self.assertIn(str(doctor.core.HOME / 'tools' / 'bin'), manual[0])
        _, _, (_, on_arm) = proposal(dict(READY, ffmpeg=None, ffprobe=None))
        self.assertEqual(on_arm, [])

    def test_without_homebrew_the_user_installs_it_first(self):
        _, _, (install, manual) = proposal(dict(READY, brew=False, ffmpeg_lacks=['drawtext']))
        self.assertEqual(install, ['brew install ffmpeg-full'])
        self.assertTrue(manual[0].startswith('Install Homebrew first'))

    def test_linux_without_homebrew_uses_apt_and_leaves_the_rest_to_the_user(self):
        linux = dict(READY, system='Linux', brew=False, apt=True, ffmpeg=None, ffprobe=None, font=None, docker=False,
                     docker_running=False, timeout=False)
        missing, _, (install, manual) = proposal(linux)
        self.assertEqual(names(missing), ['docker', 'ffmpeg', 'font'])
        self.assertEqual(install, ['sudo apt-get update && sudo apt-get install -y ffmpeg fonts-dejavu-core coreutils'])
        self.assertEqual(manual, [doctor.BY_HAND['docker']])
        _, _, (as_root, _) = proposal(dict(linux, root=True))
        self.assertEqual(as_root, ['apt-get update && apt-get install -y ffmpeg fonts-dejavu-core coreutils'])

    def test_a_command_waits_for_what_the_user_installs_by_hand(self):  # npm needs Node
        linux = dict(READY, system='Linux', brew=False, apt=True, node=None, npx=False, claude=False, provider='agent')
        _, _, (install, manual) = proposal(linux)
        self.assertEqual(install, [])
        self.assertEqual(manual, [doctor.BY_HAND['node'], 'Then: ' + doctor.CLAUDE_CODE, doctor.SIGN_IN])

    def test_linux_with_homebrew_takes_its_formulae_and_fonts_from_apt(self):
        _, _, (install, _) = proposal(dict(READY, system='Linux', apt=True, ffmpeg_lacks=['drawtext'], font=None))
        self.assertEqual(install, ['brew install ffmpeg-full',
                                   'sudo apt-get update && sudo apt-get install -y fonts-dejavu-core'])

    def test_signing_in_and_starting_docker_are_the_users_steps(self):
        missing, _, (install, manual) = proposal(dict(READY, gh_signed_in=False, claude_signed_in=False,
                                                      docker_running=False))
        self.assertEqual(names(missing), ['gh sign-in', 'docker running', 'claude sign-in'])
        self.assertEqual(install, [])
        self.assertEqual(len(manual), 3)

    def test_an_old_claude_code_is_updated(self):
        missing, _, (install, _) = proposal(dict(READY, claude_flags_missing=['--permission-prompts']))
        self.assertEqual((names(missing), missing[0]['detail']), (['claude update'], '--permission-prompts'))
        self.assertEqual(install, [doctor.CLAUDE_CODE])

    def test_memory_disk_and_the_optional_tools_are_advice_not_blockers(self):
        missing, advised, _ = proposal(dict(READY, docker_memory_gb=4.0, disk_free_gb=5.0, timeout=False, pdf=False))
        self.assertEqual(missing, [])
        self.assertEqual(names(advised), ['docker memory', 'timeout', 'pdf tools', 'disk space'])

    def test_a_recipes_node_needs_asdf_and_its_nodejs_plugin(self):
        pinned = dict(READY, recipe_node='22.15.0', recipe_node_ready=False, asdf_nodejs=False)
        missing, _, (install, _) = proposal(pinned)
        self.assertEqual((names(missing), install), (['asdf'], ['brew install asdf', 'asdf plugin add nodejs']))
        missing, _, (install, _) = proposal(dict(pinned, asdf=True))
        self.assertEqual((names(missing), install), (['asdf nodejs'], ['asdf plugin add nodejs']))
        self.assertEqual(doctor.judge(dict(pinned, asdf=True, asdf_nodejs=True)), ([], []))  # the harness installs it
        self.assertEqual(doctor.judge(dict(pinned, recipe_node_ready=True)), ([], []))

    def test_the_agent_chosen_explicitly_needs_no_claude_code_and_an_api_key_is_only_noted(self):
        self.assertEqual(doctor.judge(dict(READY, claude=False, provider='agent', provider_chosen=True)), ([], []))
        missing, _ = doctor.judge(dict(READY, claude=False, provider='cli', provider_chosen=True))
        self.assertEqual(names(missing), ['claude'])
        missing, advised = doctor.judge(dict(READY, api_key=True))  # left out of every call: the subscription runs
        self.assertEqual((missing, names(advised)), ([], ['api key']))

    def test_the_voxcpm_narrator_is_needed_only_when_asked_for(self):
        for settled in (dict(system='Linux'), dict(voice='edge'), dict(voice_ready=True), dict(ci=True)):
            self.assertEqual(doctor.judge(dict(READY, **settled)), ([], []))  # the Microsoft voice needs no setup
        missing, _, (install, _) = proposal(dict(READY, system='Linux', voice='voxcpm'))  # asked for by name: required
        self.assertEqual((names(missing), install), (['voxcpm'], [doctor.VOICE_SETUP]))
        self.assertEqual(doctor.judge(dict(READY, voice='voxcpm', voice_ready=True)), ([], []))
        missing, _ = doctor.judge(dict(READY, voice='piper'))
        self.assertEqual((names(missing), missing[0]['detail']), (['voice'], 'piper'))

    def test_an_old_python_is_reported(self):
        missing, _ = doctor.judge(dict(READY, python=(3, 8, 10)))
        self.assertEqual((names(missing), missing[0]['detail']), (['python'], 'this is 3.8.10'))


class Check(unittest.TestCase):
    def test_ok_only_without_required_needs_and_the_proposal_only_when_there_is_one(self):
        with mock.patch.object(doctor, 'facts', return_value=READY):
            self.assertEqual(doctor.check(), {'ok': True, 'system': 'macOS 15.1 arm64'})
        with mock.patch.object(doctor, 'facts', return_value=dict(READY, timeout=False)):
            result = doctor.check()
            self.assertTrue(result['ok'])
            self.assertEqual(result['install'], ['brew install coreutils'])
        with mock.patch.object(doctor, 'facts', return_value=dict(READY, gh=False)):
            result = doctor.check()
            self.assertFalse(result['ok'])
            self.assertIn('approves', result['next'])

    def test_a_projects_recipe_is_read_for_its_node(self):
        with mock.patch.object(doctor.core, 'addon', return_value={'harness': {'node': '22.15.0'}}), \
                mock.patch.object(doctor, 'facts', return_value=READY) as facts:
            doctor.check('Owner/name')
        facts.assert_called_once_with({'node': '22.15.0'})


if __name__ == '__main__':
    unittest.main()
