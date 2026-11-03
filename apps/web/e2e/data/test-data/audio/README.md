# Deterministic lesson audio

`lesson-tone.wav` is an actual, decodable 12-second 440 Hz tone: mono, 16 kHz,
16-bit little-endian PCM WAV (384,044 bytes). It contains no speech or external
content. The browser regression uploads these bytes through the application and
compares both the full stream and a byte range against this file.

SHA-256: `87f0a89ebde7a1beaa997a7c82b643a644e4eb432e449717d116ca0bd6465d9e`.

Regenerate from the repository root with Python's standard library:

```python
import math
import struct
import wave

with wave.open("apps/web/e2e/data/test-data/audio/lesson-tone.wav", "wb") as audio:
    audio.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
    audio.writeframes(b"".join(
        struct.pack("<h", round(3000 * math.sin(2 * math.pi * 440 * n / 16000)))
        for n in range(16000 * 12)
    ))
```

The fixture is intentionally tracked; missing audio must fail rather than skip
the content-lesson-audio regression. No ffmpeg installation or network request is
needed to run the test.
