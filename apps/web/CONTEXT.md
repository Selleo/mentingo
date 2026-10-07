# Web Context

Glossary for the web app's interface design.

## Design variants

- **Design variant** — the interface design of a web build, set at build time with `VITE_DESIGN_VARIANT`. Every tenant served by the build shares it.
- **Default variant** — the current UI. Must stay visually unchanged.
- **Mono variant** — monospace UI text, 4px controls, 8px surfaces, flat cards, blue brand by default. It restyles shared components and redesigns only the redesigned layouts below.
- **Mono classes** — mono-only classes in a component's own file, behind `IS_MONO_DESIGN`.
- **Variant fork** — a mono copy of a component in a `mono/` folder, used only when markup differs.
- **Redesigned layout** — the logged-in app shell (sidebar + top bar), the page header and the auth pages. The courses page keeps its layout.
- **Top bar** — part of the mono app shell: global search on the left, user menu on the right. The tenant logo stays in the sidebar.

## Brand color

- **Brand color** — the tenant's `primaryColor` from Organization settings. When set, it overrides the variant's default `--primary-*` scale at runtime; when `null`, the variant default applies (mono: #005FCB).

## Typography

- **UI text** — headings, navigation, tables, form values: Noto Sans Mono Condensed in mono. The Figma file uses Roboto Mono as a stand-in.
- **Control text** — button labels, status badges, table headers: Roboto in mono.
- **Long-form content** — editor content such as lessons, articles and news: Roboto in mono, never monospace.

## Themes

- **Theme** — light or dark mode, independent of the design variant. Mono ships light only for now.
