"""Select fast PR checks explicitly; manual workflows retain the complete suite."""
import argparse
from pathlib import Path
import unittest

TESTS = Path(__file__).resolve().parent
# Classes with real media in their shared setup, or a live browser.
MEDIA_CLASSES = {
    'test_render.RenderTest', 'test_render.FFmpegFeatures', 'test_tutorial_media.TutorialMedia',
    'test_opening_frame.OpeningFrame', 'test_ci.Stage', 'test_takes.Convert',
    'test_review.Sheets', 'test_documents.MacDocuments',
    'test_capture_fixture.PlaywrightInChromium',
}
MEDIA_METHODS = {
    'test_voice.Pace.test_sentences_said_close_together_get_the_pause_between_them',
    'test_viewport_edges.ViewportEdges.test_rendered_footage_keeps_all_four_edges',
    'test_elevenlabs_v4.SharedVoice.test_pcm_encoder_preserves_sample_rate_and_produces_the_existing_mp3_contract',
    'test_tutorial_focus.TutorialFocus.test_rendered_zoom_returns_to_full_view_and_outline_tracks_the_control',
    'test_tutorial_focus.TutorialFocus.test_full_footage_graph_renders_two_rings_and_scaled_camera',
    'test_self_onboarding_pipeline.PipelineTest.test_real_assembly_keeps_ids_and_recalculates_offsets_without_rerecording',
    'test_self_onboarding_pipeline.PipelineTest.test_assembly_preserves_fractional_final_captions_with_a_held_frame_tail',
    'test_documents.Documents.test_the_page_is_rendered_once',
    'test_gaps.Failures.test_a_video_scene_gets_a_clip_the_test_browser_plays',
}
ONBOARDING = (
    'test_self_onboarding_catalog', 'test_self_onboarding_pipeline',
    'test_self_onboarding_localization', 'test_self_onboarding_progress',
    'test_elevenlabs', 'test_elevenlabs_v4', 'test_tutorial_media',
    'test_tutorial_focus', 'test_viewport_edges',
)


def cases(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from cases(item)
        else:
            yield item


def is_media(identifier):
    return identifier.rsplit('.', 1)[0] in MEDIA_CLASSES or identifier in MEDIA_METHODS


def select(suite):
    return unittest.TestSuite(test for test in cases(suite) if not is_media(test.id()))


if __name__ == '__main__':
    import os
    import sys
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('suite', choices=('release', 'onboarding'))
    args = parser.parse_args()
    os.environ['RELEASE_FILM_UNIT_ONLY'] = '1'
    sys.path.insert(0, str(TESTS))
    loader = unittest.TestLoader()
    suite = loader.discover(str(TESTS)) if args.suite == 'release' else loader.loadTestsFromNames(ONBOARDING)
    selected = select(suite)
    print(f'Running {selected.countTestCases()} fast checks; '
          f'{suite.countTestCases() - selected.countTestCases()} manual media checks excluded.', flush=True)
    # Fail if a future unclassified test tries to launch a real media tool on a PR.
    # Mocked tool calls remain unit tests; excluded tests are still run by manual CI.
    import subprocess
    from unittest.mock import patch
    original_popen = subprocess.Popen

    def without_media(command, *args, **kwargs):
        executable = command[0] if isinstance(command, (list, tuple)) else command.split()[0]
        if Path(executable).name in {'ffmpeg', 'ffmpeg-full', 'ffprobe', 'pdftoppm', 'fc-query', 'qlmanage'}:
            raise AssertionError('Real media command belongs in the manual suite: ' + str(executable))
        return original_popen(command, *args, **kwargs)

    with patch.object(subprocess, 'Popen', side_effect=without_media):
        success = unittest.TextTestRunner(verbosity=1).run(selected).wasSuccessful()
    raise SystemExit(not success)
