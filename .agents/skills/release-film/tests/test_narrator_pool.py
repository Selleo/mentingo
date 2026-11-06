"""Release narration selects once, resumes consistently and never exposes provider credentials."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import core
import cut
import gaps
import llm
import narrator_pool


class NarratorPool(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.run = Path(self.temp.name)
        self.voices = dict(zip(narrator_pool.VOICE_VARIABLES, ['woman1', 'woman2', 'man1', 'man2']))
        patcher = mock.patch.dict(os.environ, self.voices | {'RELEASE_FILM_VOICE': 'elevenlabs'}, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        core.save(self.run / 'sources.json', {'language': 'en'})
        self.story = {'chapters': [{'sentences': [{'text': 'Open the course.'}]}] * 2}

    def test_draw_once_for_all_chapters_languages_and_resumed_processes(self):
        with mock.patch.object(narrator_pool.secrets, 'choice', return_value='woman2') as draw:
            narrator_pool.for_run(self.run, {}, persist=True)
            english = cut.narration_jobs(self.run, self.story, {}, self.run / 'voice')
            core.save(self.run / 'sources.json', {'language': 'pl'})
            narrator_pool.for_run(self.run, {}, persist=True)
            polish = cut.narration_jobs(self.run, self.story, {}, self.run / 'voice')
        draw.assert_called_once_with(tuple(self.voices.values()))
        self.assertEqual({job['voice'] for job in english + polish}, {'woman2'})

    def test_tutorial_keeps_its_saved_video_voice_instead_of_drawing_a_release_voice(self):
        core.save(self.run / 'sources.json', {'mode': 'tutorial', 'language': 'en'})
        addon = {'elevenlabs': {'voice_id': 'woman1'}}
        with mock.patch.object(narrator_pool, 'for_run') as release_voice:
            cut.narration_addon(self.run, addon, persist=True)
            jobs = cut.narration_jobs(self.run, self.story, addon, self.run / 'voice')
        release_voice.assert_not_called()
        self.assertEqual({job['voice'] for job in jobs}, {'woman1'})
        self.assertEqual({job['audio_profile'] for job in jobs}, {'pcm-48000-v1'})

    def test_cache_check_and_recut_never_create_a_narrator(self):
        self.assertFalse(cut.spoken(self.run, self.story))
        self.assertFalse((self.run / 'narrator.json').exists())

    def test_partial_duplicate_and_conflicting_configurations_fail(self):
        for changes in [{narrator_pool.VOICE_VARIABLES[0]: ''},
                        {narrator_pool.VOICE_VARIABLES[0]: 'man1'}, {'ELEVENLABS_VOICE_ID': 'other'}]:
            with self.subTest(changes=changes), mock.patch.dict(os.environ, changes), self.assertRaises(ValueError):
                narrator_pool.for_run(self.run, {}, persist=True)

    def test_removed_narrator_is_not_silently_replaced(self):
        core.save(self.run / 'narrator.json', {'voice_id': 'removed'})
        with self.assertRaisesRegex(ValueError, 'no longer in'):
            narrator_pool.for_run(self.run, {}, persist=True)

    def test_narration_uses_pool_and_reuses_audio_without_repaying(self):
        def speak(command, **kwargs):
            jobs = json.loads(Path(command[2]).read_text())
            for job in jobs:
                out = Path(job['out'])
                out.mkdir(parents=True)
                (out / 'audio.mp3').write_bytes(b'audio')
                (out / 'subtitles.srt').write_text('captions')
            return mock.Mock(stdout=json.dumps([{'out': job['out']} for job in jobs]))
        with mock.patch.object(core, 'sh', side_effect=speak) as request, mock.patch.object(core, 'mark'), \
                mock.patch.object(cut, 'paced') as pace, mock.patch.object(core, 'ensure_tts') as install:
            cut.narrate(self.run, self.story, {})
            cut.narrate(self.run, self.story, {})
        request.assert_called_once()
        self.assertEqual(pace.call_count, 2)
        self.assertTrue(all(call.kwargs['clip_tail'] for call in pace.call_args_list))
        install.assert_not_called()
        self.assertTrue(cut.spoken(self.run, self.story, {}))

    def test_provider_tail_is_clipped_before_strict_release_validation(self):
        path = self.run / 'subtitles.srt'
        path.write_text('1\n00:00:24,859 --> 00:00:25,659\nResult.\n')
        with mock.patch.object(cut, 'audio_seconds', return_value=25.631):
            cut.bound_voice_captions(self.run)
        self.assertIn('00:00:25,631', path.read_text())
        self.assertIn('Result.', path.read_text())

    def test_entire_words_missing_from_audio_are_reported_instead_of_silently_dropped(self):
        (self.run / 'subtitles.srt').write_text('1\n00:00:26,000 --> 00:00:27,000\nMissing.\n')
        with mock.patch.object(cut, 'audio_seconds', return_value=25.631), \
                self.assertRaisesRegex(ValueError, 'outside its audio'):
            cut.bound_voice_captions(self.run)

    def test_provider_key_is_not_available_to_scene_workers_or_text_models(self):
        with mock.patch.dict(os.environ, {'ELEVENLABS_API_KEY': 'provider-secret'}):
            self.assertNotIn('ELEVENLABS_API_KEY', gaps.worker_environ())
            self.assertNotIn('ELEVENLABS_API_KEY', core.environ(llm.SUBSCRIPTION))


if __name__ == '__main__':
    unittest.main()
