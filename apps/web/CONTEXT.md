# Web Context

Glossary for the web app's interface design.

## Design variants

- **Design variant** — the interface design of a web build, set at build time with `VITE_DESIGN_VARIANT`. Every tenant served by the build shares it.
- **Default variant** — the current UI. Must stay visually unchanged.
- **Mono variant** — monospace UI text, 4px controls, 8px surfaces, flat cards, blue brand by default. It restyles shared components and the app shell; page layouts stay as in the default variant.
- **Mono classes** — `mono:`-prefixed Tailwind classes in a component's own file. They apply only under `data-design-variant="mono"`.
- **Variant fork** — a mono copy of a component in a `mono/` folder, used only when markup differs and chosen in one switch point.
- **App shell** — the logged-in sidebar with the tenant logo, global search, navigation and user menu. Mono restyles it without changing its structure.

## Brand color

- **Brand color** — the tenant's `primaryColor` from Organization settings. When set, it overrides the variant's default `--primary-*` scale at runtime; when `null`, the variant default applies (mono: #005FCB).

## Typography

- **UI text** — headings, navigation, tables, form values: Noto Sans Mono at condensed width in mono.
- **Control text** — button labels, status badges, table headers: Roboto in mono.
- **Long-form content** — editor content such as lessons, articles and news: Roboto in mono, never monospace.

## Themes

- **Theme** — light or dark mode, independent of the design variant. Mono ships light only for now.
