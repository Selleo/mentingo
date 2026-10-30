"""ElevenLabs timing, error boundaries and narration-cache checks without provider calls."""
import base64
import io
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
import urllib.error

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import cut  # noqa: E402
import montage  # noqa: E402
import voice  # noqa: E402


def response_for(text):
    return {'audio_base64': base64.b64encode(b'ID3-test-audio').decode(), 'alignment': {
        'characters': list(text), 'character_start_times_seconds': [i / 20 for i in range(len(text))],
        'character_end_times_seconds': [(i + 1) / 20 for i in range(len(text))]}}


class ElevenLabs(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        patcher = mock.patch.dict(os.environ, {'ELEVENLABS_API_KEY': 'never-print-this-key'}, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.job = {'out': str(self.root / 'voice'), 'text': 'Open the course.', 'language': 'en',
                    'voice': 'test_voice', 'engine': 'elevenlabs', 'model_id': 'eleven_multilingual_v2',
                    'voice_settings': {'stability': 0.6}, 'lexicon': {}}

    def test_provider_audio_and_character_timings_keep_written_captions(self):
        self.job.update(text='Mamy 2 godziny i PDF.', language='pl', lexicon={'PDF': 'pe de ef'})
        requests = []
        def speak(voice_id, payload, key):
            requests.append((voice_id, payload, key))
            return response_for(payload['text'])
        with mock.patch.object(voice, 'elevenlabs_request', side_effect=speak):
            [result] = voice.elevenlabs([self.job])
        self.assertNotIn('error', result)
        narrator, payload, key = requests[0]
        self.assertEqual((narrator, key), ('test_voice', 'never-print-this-key'))
        self.assertEqual(payload['text'], 'Mamy dwie godziny i pe de ef.')
        self.assertNotIn('language_code', payload)
        self.assertEqual(payload['apply_text_normalization'], 'off')
        words = montage.words_from_srt((self.root / 'voice' / 'subtitles.srt').read_text())
        self.assertEqual([word[2] for word in words], ['Mamy', '2', 'godziny', 'i', 'PDF.'])
        self.assertEqual((self.root / 'voice' / 'audio.mp3').read_bytes(), b'ID3-test-audio')
        self.assertNotIn('never-print-this-key', json.dumps(result))

    def test_other_models_receive_requested_language(self):
        self.job['model_id'] = 'eleven_flash_v2_5'
        with mock.patch.object(voice, 'elevenlabs_request', side_effect=lambda _, p, __: response_for(p['text'])) as request:
            [result] = voice.elevenlabs([self.job])
        self.assertNotIn('error', result)
        self.assertEqual(request.call_args.args[1]['language_code'], 'en')

    def test_dialogue_boundary_whitespace_keeps_the_same_written_captions(self):
        self.job['model_id'] = 'eleven_v4_turbo'
        with mock.patch.object(voice, 'elevenlabs_request', return_value=response_for(' Open the course. ')):
            [result] = voice.elevenlabs([self.job])
        self.assertNotIn('error', result)
        words = montage.words_from_srt((self.root/'voice/subtitles.srt').read_text())
        self.assertEqual([word[2] for word in words], ['Open', 'the', 'course.'])

    def test_missing_key_stops_without_request_or_fallback(self):
        os.environ.pop('ELEVENLABS_API_KEY')
        with mock.patch.object(voice, 'elevenlabs_request') as request, mock.patch.object(voice, 'edge') as fallback:
            [result] = voice.elevenlabs([self.job])
        self.assertIn('ELEVENLABS_API_KEY is required', result['error'])
        request.assert_not_called()
        fallback.assert_not_called()
        self.assertFalse((self.root / 'voice').exists())

    def test_invalid_audio_or_alignment_never_write_artifact(self):
        for change in ({'audio_base64': '***'}, {'audio_base64': ''}, {'alignment': None},
                       {'alignment': response_for('Wrong narration')['alignment']}):
            with self.subTest(change=change):
                with mock.patch.object(voice, 'elevenlabs_request', return_value=response_for(self.job['text']) | change):
                    [result] = voice.elevenlabs([self.job])
                self.assertIn('error', result)
                self.assertFalse((self.root / 'voice').exists())

    def test_alignment_rejects_inconsistent_nonfinite_or_reversed_timestamps(self):
        mutations = [lambda a: a['characters'].pop(),
                     lambda a: a['character_start_times_seconds'].__setitem__(0, math.nan),
                     lambda a: a['character_end_times_seconds'].__setitem__(0, math.inf),
                     lambda a: a['character_start_times_seconds'].__setitem__(0, -0.1),
                     lambda a: a['character_end_times_seconds'].__setitem__(1, 0),
                     lambda a: a['character_start_times_seconds'].__setitem__(4, 0.1),
                     lambda a: a['character_end_times_seconds'].__setitem__(-1, 3_601)]
        for mutate in mutations:
            alignment = response_for('One two')['alignment']
            mutate(alignment)
            with self.subTest(alignment=alignment), self.assertRaisesRegex(ValueError, 'ElevenLabs'):
                voice.aligned_words(alignment, 'One two')

    def test_fixed_origin_bounded_request_never_follows_redirects(self):
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(response_for('Hi')).encode()
        opener = mock.Mock()
        opener.open.return_value = response
        with mock.patch.object(voice.urllib.request, 'build_opener', return_value=opener) as build:
            found = voice.elevenlabs_request('safe_voice', {'text': 'Hi'}, 'never-print-this-key')
        self.assertIn('audio_base64', found)
        self.assertIsInstance(build.call_args.args[0], voice.NoVoiceRedirects)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url,
                         'https://api.elevenlabs.io/v1/text-to-speech/safe_voice/with-timestamps?output_format=mp3_44100_128')
        self.assertEqual(request.get_header('Xi-api-key'), 'never-print-this-key')
        self.assertEqual(opener.open.call_args.kwargs['timeout'], voice.ELEVENLABS_TIMEOUT)
        response.__enter__.return_value.read.assert_called_once_with(voice.ELEVENLABS_RESPONSE_LIMIT + 1)
        self.assertIsNone(voice.NoVoiceRedirects().redirect_request(request, None, 302, 'moved', {}, 'https://other.test'))

    def test_error_bodies_and_transport_details_are_never_exposed_or_retried(self):
        error = urllib.error.HTTPError('https://api.elevenlabs.io', 429, 'never-print-this-key', {}, io.BytesIO(b'never-print-this-key'))
        opener = mock.Mock()
        opener.open.side_effect = error
        with mock.patch.object(voice.urllib.request, 'build_opener', return_value=opener), \
                self.assertRaisesRegex(ValueError, r'HTTP 429.*no automatic paid retry') as caught:
            voice.elevenlabs_request('test_voice', {'text': 'Hi'}, 'never-print-this-key')
        self.assertNotIn('never-print-this-key', str(caught.exception))
        opener.open.assert_called_once()
        opener.open.side_effect = urllib.error.URLError('never-print-this-key')
        with mock.patch.object(voice.urllib.request, 'build_opener', return_value=opener), \
                self.assertRaisesRegex(ValueError, 'failed or timed out') as caught:
            voice.elevenlabs_request('test_voice', {'text': 'Hi'}, 'never-print-this-key')
        self.assertNotIn('never-print-this-key', str(caught.exception))

    def test_response_size_limit(self):
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = b'x' * 17
        opener = mock.Mock()
        opener.open.return_value = response
        with mock.patch.object(voice, 'ELEVENLABS_RESPONSE_LIMIT', 16), \
                mock.patch.object(voice.urllib.request, 'build_opener', return_value=opener), \
                self.assertRaisesRegex(ValueError, 'size limit'):
            voice.elevenlabs_request('test_voice', {'text': 'Hi'}, 'key')

    def test_configuration_rejects_path_injection_and_unbounded_settings(self):
        for config in ({'voice_id': '../bad'}, {'voice_id': 'voice', 'model_id': 'model?key=bad'},
                       {'voice_id': 'voice', 'voice_settings': {'speed': 9}},
                       {'voice_id': 'voice', 'voice_settings': {'stability': math.nan}},
                       {'voice_id': 'voice', 'voice_settings': {'use_speaker_boost': 'true'}},
                       {'voice_id': 'voice', 'voice_settings': {'unknown': 1}}):
            with self.subTest(config=config), self.assertRaises(ValueError):
                voice.elevenlabs_config({'elevenlabs': config}, 'en')


class NarrationCache(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.run = Path(self.temp.name)
        self.root = self.run / 'voice'
        (self.root / 'c1').mkdir(parents=True)
        for name in ('audio.mp3', 'subtitles.srt'):
            (self.root / 'c1' / name).write_text('cached')
        (self.run / 'sources.json').write_text(json.dumps({'language': 'en'}))
        self.story = {'chapters': [{'sentences': [{'text': 'Export PDF.'}]}]}
        self.addon = {'elevenlabs': {'voice_ids': {'en': 'narrator_a', 'pl': 'narrator_pl'},
                                    'model_id': 'eleven_multilingual_v2', 'voice_settings': {'stability': 0.6}}}
        patcher = mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'elevenlabs'}, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        jobs = cut.narration_jobs(self.run, self.story, self.addon, self.root)
        (self.root / 'done.json').write_text(json.dumps({'jobs': jobs}))

    def test_cache_identity_includes_provider_voice_model_settings_language_and_pronunciation(self):
        self.assertTrue(cut.spoken(self.run, self.story, self.addon))
        variants = [{'elevenlabs': self.addon['elevenlabs'] | {'voice_ids': {'en': 'narrator_b'}}},
                    {'elevenlabs': self.addon['elevenlabs'] | {'model_id': 'eleven_flash_v2_5'}},
                    {'elevenlabs': self.addon['elevenlabs'] | {'voice_settings': {'stability': 0.7}}},
                    self.addon | {'pronunciation': {'PDF': 'pee dee eff'}}]
        for addon in variants:
            with self.subTest(addon=addon):
                self.assertFalse(cut.spoken(self.run, self.story, addon))
        self.assertTrue(cut.spoken(self.run, self.story, self.addon | {'pronunciation': {'unused': 'other'}}))
        with mock.patch.dict(os.environ, {'RELEASE_FILM_VOICE': 'edge'}):
            self.assertFalse(cut.spoken(self.run, self.story, self.addon))
        (self.run / 'sources.json').write_text(json.dumps({'language': 'pl'}))
        self.assertFalse(cut.spoken(self.run, self.story, self.addon))

    def test_jobs_never_contain_api_key_and_use_standard_python(self):
        seen = []
        def speak(command, **kwargs):
            seen.append(command)
            jobs = json.loads(Path(command[2]).read_text())
            return mock.Mock(stdout=json.dumps([{'out': job['out'], 'terms': []} for job in jobs]))
        (self.root / 'done.json').unlink()
        with mock.patch.dict(os.environ, {'ELEVENLABS_API_KEY': 'never-print-this-key'}), \
                mock.patch.object(cut.core, 'sh', side_effect=speak), mock.patch.object(cut, 'paced'), \
                mock.patch.object(cut.core, 'mark'), mock.patch.object(cut.core, 'ensure_tts') as install:
            cut.narrate(self.run, self.story, self.addon)
        self.assertEqual(seen[0][0], sys.executable)
        self.assertNotIn('never-print-this-key', (self.root / 'jobs.json').read_text())
        self.assertNotIn('never-print-this-key', (self.root / 'done.json').read_text())
        install.assert_not_called()


if __name__ == '__main__':
    unittest.main()
