# Mentingo tutorial frame

The banner uses Mentingo’s website palette (`#eef4ff`, `#daeaff`, `#b5d5ff`, `#4796fd`, `#3f58b6`) and the official, unchanged logo from https://mentingo.com/_astro/mentingo-logo.BByvjzS3.svg (retrieved 2026-11-04). The source SVG embeds the logo; rendering never downloads assets.

Regenerate the checked-in PNGs after changing their SVG sources:

```sh
rsvg-convert mentingo-tutorial-banner.svg -o mentingo-tutorial-banner.png
rsvg-convert mentingo-tutorial-mask.svg -o mentingo-tutorial-mask.png
```

The mask rounds only the outermost 20 pixels of the full application viewport. The base view uniformly scales the complete app. Tutorials may briefly zoom up to 12% toward at most two recorded interior controls, with cubic subpixel interpolation and a return to the full view. Dialogs, drawers and edge controls use outlines without zooming. Captions have no accent bar or extra corner heading. Release films retain their existing renderer. Captures, localized narration and speech caches remain reusable when the frame changes.
