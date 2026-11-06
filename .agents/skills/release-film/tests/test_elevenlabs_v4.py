"""Dialogue protocol and PCM-relative timings; mocked WebSocket frames never spend provider credits."""
import base64
from contextlib import nullcontext
import json
import math
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import cut  # noqa: E402
import elevenlabs_v4 as dialogue  # noqa: E402
import voice  # noqa: E402


def chunk(text=None, seconds=0.25):
    pcm = b'\0' * round(seconds * dialogue.SAMPLE_RATE * dialogue.BYTES_PER_SAMPLE)
    frame = {'audio': base64.b64encode(pcm).decode()}
    if text is not None:
        frame['alignment'] = {'chars': list(text), 'char_start_times_ms': [i * 50 for i in range(len(text))],
                              'char_durations_ms': [50] * len(text)}
    return frame


class Socket:
    def __init__(self, frames):
        self.frames = iter(frames)
        self.sent = []
        self.timeouts = []

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def send(self, text):
        self.sent.append(json.loads(text))

    def recv(self, timeout):
        self.timeouts.append(timeout)
        value = next(self.frames)
        if isinstance(value, Exception):
            raise value
        return json.dumps(value)


class Dialogue(unittest.TestCase):
    def setUp(self):
        self.payload = {'text': 'One two.', 'language_code': 'en', 'model_id': 'eleven_v4_turbo',
                        'voice_settings': {'stability': 0.6}, 'apply_text_normalization': 'off'}

    def run_stream(self, frames, **limits):
        socket = Socket(frames)
        with mock.patch.object(dialogue, 'connect', return_value=socket) as connection, \
                mock.patch.multiple(dialogue, **limits) if limits else nullcontext():
            result = dialogue.synthesize('same_narrator', self.payload, 'secret-key')
        return result, socket, connection

    def test_pcm_clock_counts_audio_only_chunks_and_offsets_each_alignment_chunk(self):
        (pcm, alignment), socket, connection = self.run_stream([
            chunk(), chunk('One '), {'is_final_audio_for_turn': True}, chunk('two.'), {'is_final': True}])
        self.assertEqual(len(pcm), round(0.75 * 24_000 * 2))
        self.assertEqual(''.join(alignment['characters']), 'One two.')
        self.assertEqual(alignment['character_start_times_seconds'][0], 0.25)
        self.assertEqual(alignment['character_start_times_seconds'][4], 0.5)
        events = voice.aligned_words(alignment, 'One two.')
        self.assertEqual([(e['offset'] / 1e7, e['text']) for e in events], [(0.25, 'One'), (0.5, 'two.')])
        self.assertEqual(socket.sent, [
            {'voices': ['same_narrator'], 'voice_settings': {'stability': 0.6}},
            {'inputs': [{'text': 'One two.', 'voice_id': 'same_narrator'}], 'flush': True}, {'close_socket': True}])
        uri, key = connection.call_args.args
        self.assertTrue(uri.startswith('wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?'))
        self.assertIn('model_id=eleven_v4_turbo', uri)
        self.assertIn('output_format=pcm_24000', uri)
        self.assertIn('language_code=en', uri)
        self.assertIn('sync_alignment=true', uri)
        self.assertEqual(key, 'secret-key')
        self.assertNotIn(key, json.dumps(socket.sent))
        self.assertTrue(all(0 < timeout <= 10 for timeout in socket.timeouts))
        connection.assert_called_once()

    def test_turn_marker_does_not_end_the_stream(self):
        with self.assertRaisesRegex(dialogue.DialogueError, 'before completion'):
            self.run_stream([chunk('One '), {'is_final_audio_for_turn': True}])

    def test_missing_alignment_or_missing_words_fail_without_estimated_timings(self):
        for frames in ([chunk(), {'is_final': True}], [chunk('One '), {'is_final': True}]):
            with self.subTest(frames=frames), self.assertRaisesRegex(dialogue.DialogueError, 'timing evidence|does not cover'):
                self.run_stream(frames)

    def test_stream_errors_and_transport_exceptions_never_echo_provider_details(self):
        for failure in ({'error': 'secret-key'}, RuntimeError('HTTP redirect secret-key'), {'detail': {'message': 'secret-key'}}):
            with self.subTest(failure=failure), self.assertRaises(dialogue.DialogueError) as caught:
                self.run_stream([failure])
            self.assertNotIn('secret-key', str(caught.exception))

    def test_total_bytes_audio_frames_and_deadline_are_bounded(self):
        cases = [({'STREAM_LIMIT': 12}, [chunk()]), ({'AUDIO_LIMIT': 2}, [chunk()]),
                 ({'MESSAGE_LIMIT': 12}, [chunk()]), ({'FRAME_LIMIT': 1}, [{'is_final_audio_for_turn': True}])]
        for limits, frames in cases:
            with self.subTest(limits=limits), self.assertRaisesRegex(dialogue.DialogueError, 'limit'):
                self.run_stream(frames, **limits)
        with mock.patch.object(dialogue.time, 'monotonic', side_effect=[0, 121]), \
                self.assertRaisesRegex(dialogue.DialogueError, 'deadline'):
            self.run_stream([])

    def test_waiting_sends_keepalive_but_never_reconnects(self):
        (_, _), socket, connection = self.run_stream([TimeoutError(), chunk('One '), chunk('two.'), {'is_final': True}])
        self.assertIn({'keep_alive': True}, socket.sent)
        connection.assert_called_once()

    def test_invalid_pcm_base64_and_unbound_or_nonfinite_alignment_fail(self):
        invalid_alignment = chunk('One ')
        invalid_alignment['alignment']['char_start_times_ms'][0] = math.nan
        missing_audio = {'alignment': chunk('One ')['alignment']}
        odd_pcm = {'audio': base64.b64encode(b'x').decode(), 'alignment': {
            'chars': ['O'], 'char_start_times_ms': [0], 'char_durations_ms': [0]}}
        for frame in ({'audio': '***'}, invalid_alignment, missing_audio, odd_pcm):
            with self.subTest(frame=frame), self.assertRaises(dialogue.DialogueError):
                self.run_stream([frame, {'is_final': True}])

    def test_timestamps_are_checked_against_the_completed_audio(self):
        self.payload['text'] = 'One '
        frame = chunk('One ')
        frame['alignment']['char_durations_ms'][-1] = 240
        with self.assertRaisesRegex(dialogue.DialogueError, 'exceed generated audio'):
            self.run_stream([frame, {'is_final': True}])

    def test_sync_connection_has_fixed_limits_no_proxy_and_quiet_logging(self):
        open_socket = mock.Mock()
        fake_module = SimpleNamespace(connect=open_socket)
        with mock.patch.dict(sys.modules, {'websockets.sync.client': fake_module}):
            dialogue.connect('wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input', 'secret-key')
        kwargs = open_socket.call_args.kwargs
        self.assertIsNone(kwargs['proxy'])
        self.assertIsNone(kwargs['compression'])
        self.assertEqual(kwargs['additional_headers'], {'xi-api-key': 'secret-key'})
        self.assertEqual((kwargs['open_timeout'], kwargs['close_timeout'], kwargs['max_size'], kwargs['max_queue']),
                         (15, 3, dialogue.MESSAGE_LIMIT, 4))
        self.assertFalse(kwargs['logger'].propagate)
        self.assertGreater(kwargs['logger'].level, 50)
        open_socket.assert_called_once()


class SharedVoice(unittest.TestCase):
    def test_pcm_encoder_preserves_sample_rate_and_produces_the_existing_mp3_contract(self):
        import tempfile
        if not cut.core.tool('ffmpeg'):
            self.skipTest('FFmpeg is unavailable')
        pcm = b'\0' * (24_000 * 2 // 5)
        encoded = voice.pcm_to_mp3(pcm)
        self.assertGreater(len(encoded), 100)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'audio.mp3'
            path.write_bytes(encoded)
            self.assertAlmostEqual(cut.audio_seconds(path), 0.2, delta=0.1)

    def test_single_voice_takes_precedence_over_legacy_language_specific_ids(self):
        addon = {'elevenlabs': {'voice_id': 'shared_config', 'voice_ids': {'en': 'old_en', 'pl': 'old_pl'}}}
        with mock.patch.dict(os.environ, {'ELEVENLABS_VOICE_ID': 'shared_env', 'ELEVENLABS_VOICE_ID_EN': 'legacy_env_en',
                                         'ELEVENLABS_VOICE_ID_PL': 'legacy_env_pl'}, clear=True):
            for code in ('en', 'pl'):
                config = voice.elevenlabs_config(addon, code)
                self.assertEqual(config['voice'], 'shared_env')
                self.assertEqual(config['model_id'], 'eleven_v4_turbo')
                self.assertEqual(config['output_format'], 'mp3_44100_128')
        with mock.patch.dict(os.environ, {'ELEVENLABS_VOICE_ID_EN': 'legacy_env_en'}, clear=True):
            self.assertEqual(voice.elevenlabs_config(addon, 'en')['voice'], 'shared_config')

    def test_modern_models_use_complete_dialogue_timing_without_websocket_chunks(self):
        import tempfile
        alignment = {'characters': list('One two.'), 'character_start_times_seconds': [i / 20 for i in range(8)],
                     'character_end_times_seconds': [(i + 1) / 20 for i in range(8)]}
        for code in ('en', 'pl'):
            with self.subTest(language=code), tempfile.TemporaryDirectory() as folder, \
                    mock.patch.dict(os.environ, {'ELEVENLABS_API_KEY': 'secret-key', 'ELEVENLABS_VOICE_ID': 'shared_voice'}, clear=True), \
                    mock.patch.object(voice, 'elevenlabs_request', return_value={
                        'audio_base64': base64.b64encode(b'ID3-valid').decode(), 'alignment': alignment}) as request, \
                    mock.patch.object(dialogue, 'synthesize') as realtime:
                job = {'out': folder, 'text': 'One two.', 'language': code, 'voice': 'shared_voice'}
                [result] = voice.elevenlabs([job])
                self.assertNotIn('error', result)
                self.assertEqual(request.call_args.args[0], 'shared_voice')
                self.assertEqual(request.call_args.args[1]['language_code'], code)
                self.assertEqual(request.call_args.args[1]['model_id'], 'eleven_v4_turbo')
                realtime.assert_not_called()
                self.assertEqual((Path(folder) / 'audio.mp3').read_bytes(), b'ID3-valid')
                self.assertTrue((Path(folder) / 'subtitles.srt').is_file())

    def test_dialogue_request_has_one_audio_timeline_and_never_retries_on_failure(self):
        payload = {'text': 'One two.', 'model_id': 'eleven_v4_turbo', 'language_code': 'pl',
                   'voice_settings': {'stability': 0.5, 'speed': 1, 'similarity_boost': 0.7}}
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({'audio_base64': 'YQ=='}).encode()
        opener = mock.Mock()
        opener.open.return_value = response
        with mock.patch.object(voice.urllib.request, 'build_opener', return_value=opener):
            voice.elevenlabs_request('shared_voice', payload, 'secret-key')
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, 'https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_128')
        body = json.loads(request.data)
        self.assertEqual(body['inputs'], [{'text': 'One two.', 'voice_id': 'shared_voice'}])
        self.assertEqual(body['settings'], {'stability': 0.5, 'speed': 1, 'similarity': 0.7})
        self.assertEqual((body['model_id'], body['language_code']), ('eleven_v4_turbo', 'pl'))
        self.assertNotIn('secret-key', json.dumps(body))
        opener.open.assert_called_once()

    def test_v4_provider_failure_never_switches_to_websocket_or_repeats_synthesis(self):
        with mock.patch.dict(os.environ, {'ELEVENLABS_API_KEY': 'secret-key', 'ELEVENLABS_VOICE_ID': 'shared_voice'}, clear=True), \
                mock.patch.object(voice, 'elevenlabs_request', side_effect=ValueError('Speech provider unavailable')) as request, \
                mock.patch.object(dialogue, 'synthesize') as realtime:
            [result] = voice.elevenlabs([{'out': '/tmp/not-written', 'text': 'One two.', 'language': 'en'}])
        self.assertEqual(result['error'], 'Speech provider unavailable')
        request.assert_called_once()
        realtime.assert_not_called()


if __name__ == '__main__':
    unittest.main()
