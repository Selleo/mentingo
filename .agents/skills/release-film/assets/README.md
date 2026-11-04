# Mentingo tutorial frame

The banner uses Mentingo’s website palette (`#eef4ff`, `#daeaff`, `#b5d5ff`, `#4796fd`, `#3f58b6`) and the official, unchanged logo from https://mentingo.com/_astro/mentingo-logo.BByvjzS3.svg (retrieved 2026-11-04). The source SVG embeds the logo; rendering never downloads assets.

Regenerate the checked-in PNGs after changing their SVG sources:

```sh
rsvg-convert mentingo-tutorial-banner.svg -o mentingo-tutorial-banner.png
rsvg-convert mentingo-tutorial-mask.svg -o mentingo-tutorial-mask.png
```

The mask rounds only the outermost 20 pixels of the full application viewport. The app is uniformly scaled, with no camera crop. Release films retain their existing renderer. Captures, localized narration and speech caches remain reusable when the frame changes.
