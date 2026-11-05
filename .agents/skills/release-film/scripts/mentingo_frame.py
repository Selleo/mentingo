"""Offline Mentingo website branding around the complete tutorial viewport."""
import hashlib
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
BANNER = ASSETS / 'mentingo-tutorial-banner.png'
MASK = ASSETS / 'mentingo-tutorial-mask.png'

CAPTION_FONT = ASSETS / 'open-sans.ttf'


def fingerprint():
    """Re-render visual segments when code or branding changes; retain camera and speech caches."""
    digest = hashlib.sha256()
    for path in (Path(__file__), Path(__file__).with_name("tutorial_focus.py"), BANNER, MASK, CAPTION_FONT):
        digest.update(path.read_bytes())
    return digest.hexdigest()


def compose(inputs, visual, segment, language, work, name):
    """Replace the old outer frame with a banner, uniformly scaled app and static rounded mask."""
    banner_index = inputs.count('-i')
    mask_index = banner_index + 1
    inputs = inputs + ['-loop', '1', '-framerate', '30', '-i', BANNER,
                       '-loop', '1', '-framerate', '30', '-i', MASK]
    # The existing camera already preserves every viewport edge. Remove only its
    # surrounding frame before fitting it into this equally proportioned panel.
    crop = '1840:880:40:30' if segment['kind'] == 'image' else '1564:880:178:30'
    graph = (visual + f';[v0]crop={crop},scale=1536:864:force_original_aspect_ratio=decrease,'
             'pad=1536:864:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,format=rgb24[app];'
             f'[{mask_index}:v]format=gray[mask];[app][mask]alphamerge[rounded];'
             f'[{banner_index}:v]setsar=1[brand];'
             '[brand][rounded]overlay=x=192:y=76:shortest=1[branded]')
    return inputs, graph, 'branded'
