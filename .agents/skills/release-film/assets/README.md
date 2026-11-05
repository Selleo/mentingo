# Mentingo tutorial frame

The banner uses Mentingo’s website palette (`#eef4ff`, `#daeaff`, `#b5d5ff`, `#4796fd`, `#3f58b6`) and the official, unchanged logo from https://mentingo.com/_astro/mentingo-logo.BByvjzS3.svg (retrieved 2026-11-04). The source SVG embeds the logo; rendering never downloads assets.

Regenerate the checked-in PNGs after changing their SVG sources:

```sh
rsvg-convert mentingo-tutorial-banner.svg -o mentingo-tutorial-banner.png
rsvg-convert mentingo-tutorial-mask.svg -o mentingo-tutorial-mask.png
```

The mask rounds only the outermost 20 pixels of the full application viewport. The base view uniformly scales the complete app. Tutorials borrow the focus-and-ring treatment from the mentingo-linkedin-clips skill: measured control bounds drive a context-preserving camera fit, capped at 1.45x magnification. Each move eases for 0.7 seconds, holds, and eases back for 0.7 seconds; short actions never pulse the camera. At most two stable interior controls per flow receive zooms. Rounded Mentingo-blue rings with a soft halo fade in after the camera settles, and move with the real control and pointer. Dialogs, drawers, navigation and edge controls retain the full view. Highlights end before a changing control disappears. No dimming, guessed targets, social hooks or omitted tutorial actions are introduced. Captions have no accent bar or extra corner heading. Release films retain their existing renderer. Captures, localized narration and speech caches remain reusable when the frame changes.

Tutorial captions use the bundled **Open Sans SemiBold** (`open-sans.ttf`),
separately from the All Round Gothic headings. Source:
https://github.com/googlefonts/opensans/blob/main/fonts/ttf/OpenSans-SemiBold.ttf
The accompanying `open-sans-OFL.txt` contains its SIL Open Font License.
Captions therefore need no runtime font download or platform fallback.

Camera cues use the recorded accessible control label matched uniquely inside
its pinned sentence's measured word timings. Unmatched labels keep their
existing evidence pin without a zoom; unspoken helper actions do not drive the
camera. Internal navigation-key badges (such as End) are omitted in tutorials.
Each tutorial flow leaves 1.6 seconds after narration. Any audio fade is placed
after the complete measured narration, never across the final syllable.
`timeline.json` records the caption font checksum and global camera windows for
reviewing timing without exposing raw capture metadata.
