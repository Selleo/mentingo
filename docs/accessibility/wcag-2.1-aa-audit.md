> Snapshot of `pnpm test:web:a11y` on staging 0dc7da82 (local stack, Chromium 1920×1080, E2E seed). Regenerate with the same command; CI uploads the current report as the `wcag-audit-report` artifact.

# WCAG 2.1 AA automated audit

Generated 2026-11-21T14:37:03.830Z with axe-core 4.14.1 and Mentingo checks; 39 views and states scanned.

> Automated tools find only part of the accessibility problems. A criterion without automated failures is not proven to pass; only a manual audit (keyboard, screen readers, zoom, content review) can confirm conformance.

## Result

- **Verdict:** **not conformant** with WCAG 2.1 AA: 6 of 50 success criteria fail
- **Estimated conformance (criteria automation could assess):** 62.5% (10 met or without automated failures / 16 assessed)
- **Range over all 50 criteria:** 20% (every unverified criterion fails) – 88% (every unverified criterion passes)
- **Automated coverage:** 32% of criteria got a pass/fail signal; 34 need manual testing or review

| Status                                         | Criteria |
| ---------------------------------------------- | -------- |
| ❌ Failed                                      | 6        |
| ✅ Met                                         | 2        |
| 🟡 No automated failures (manual check needed) | 8        |
| 🟠 Needs review                                | 4        |
| ⚪ Not verifiable automatically                | 30       |

## Violations (WCAG 2.1 A/AA)

11 rules violated, 56 findings (rule × view), 217 occurrences (elements across all scans), about 183 distinct elements (shared layout counted once).

| Count                  | Critical | Serious | Moderate | Minor | Total |
| ---------------------- | -------- | ------- | -------- | ----- | ----- |
| Rules                  | 2        | 8       | 1        | 0     | 11    |
| Findings (rule × view) | 11       | 39      | 6        | 0     | 56    |
| Occurrences            | 30       | 181     | 6        | 0     | 217   |

| Rule                                                                                        | Impact   | WCAG   | Views | Occurrences | Distinct elements | Problem                                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | -------- | ------ | ----- | ----------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name)                     | critical | 4.1.2  | 9     | 28          | 19                | Buttons must have discernible text                                                                                                                         |
| [`aria-valid-attr-value`](https://dequeuniversity.com/rules/axe/4.14/aria-valid-attr-value) | critical | 4.1.2  | 2     | 2           | 2                 | ARIA attributes must conform to valid values                                                                                                               |
| [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast)               | serious  | 1.4.3  | 25    | 153         | 137               | Elements must meet minimum color contrast ratio thresholds                                                                                                 |
| [`dlitem`](https://dequeuniversity.com/rules/axe/4.14/dlitem)                               | serious  | 1.3.1  | 1     | 10          | 10                | &lt;dt&gt; and &lt;dd&gt; elements must be contained by a &lt;dl&gt;                                                                                       |
| `mentingo-reflow-320`                                                                       | serious  | 1.4.10 | 6     | 8           | 5                 | The page does not scroll horizontally in a 320 CSS px wide viewport                                                                                        |
| [`aria-hidden-focus`](https://dequeuniversity.com/rules/axe/4.14/aria-hidden-focus)         | serious  | 4.1.2  | 2     | 4           | 4                 | ARIA hidden element must not be focusable or contain focusable elements                                                                                    |
| [`listitem`](https://dequeuniversity.com/rules/axe/4.14/listitem)                           | serious  | 1.3.1  | 2     | 2           | 1                 | &lt;li&gt; elements must be contained in a &lt;ul&gt; or &lt;ol&gt;                                                                                        |
| [`role-img-alt`](https://dequeuniversity.com/rules/axe/4.14/role-img-alt)                   | serious  | 1.1.1  | 1     | 2           | 2                 | [role="img"] and [role="image"] elements must have alternative text                                                                                        |
| [`aria-input-field-name`](https://dequeuniversity.com/rules/axe/4.14/aria-input-field-name) | serious  | 4.1.2  | 1     | 1           | 1                 | ARIA input fields must have an accessible name                                                                                                             |
| [`definition-list`](https://dequeuniversity.com/rules/axe/4.14/definition-list)             | serious  | 1.3.1  | 1     | 1           | 1                 | &lt;dl&gt; elements must only directly contain properly-ordered &lt;dt&gt; and &lt;dd&gt; groups, &lt;script&gt;, &lt;template&gt; or &lt;div&gt; elements |
| `mentingo-page-title-unique`                                                                | moderate | 2.4.2  | 6     | 6           | 1                 | Each page has a title that tells it apart from other pages                                                                                                 |

## Success criteria

| SC     | Level | Name                                                 | Status                                         | Evidence                                                                            |
| ------ | ----- | ---------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1.1.1  | A     | Non-text Content                                     | ❌ Failed                                      | fails: role-img-alt                                                                 |
| 1.2.1  | A     | Audio-only and Video-only (Prerecorded)              | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 1.2.2  | A     | Captions (Prerecorded)                               | ⚪ Not verifiable automatically                | no applicable content in scanned views                                              |
| 1.2.3  | A     | Audio Description or Media Alternative (Prerecorded) | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 1.2.4  | AA    | Captions (Live)                                      | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 1.2.5  | AA    | Audio Description (Prerecorded)                      | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 1.3.1  | A     | Info and Relationships                               | ❌ Failed                                      | fails: definition-list, dlitem, listitem                                            |
| 1.3.2  | A     | Meaningful Sequence                                  | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 1.3.3  | A     | Sensory Characteristics                              | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 1.3.4  | AA    | Orientation                                          | ⚪ Not verifiable automatically                | no applicable content in scanned views                                              |
| 1.3.5  | AA    | Identify Input Purpose                               | 🟡 No automated failures (manual check needed) | passes: autocomplete-valid                                                          |
| 1.4.1  | A     | Use of Color                                         | 🟡 No automated failures (manual check needed) | passes: link-in-text-block                                                          |
| 1.4.2  | A     | Audio Control                                        | ⚪ Not verifiable automatically                | no applicable content in scanned views                                              |
| 1.4.3  | AA    | Contrast (Minimum)                                   | ❌ Failed                                      | fails: color-contrast                                                               |
| 1.4.4  | AA    | Resize Text                                          | 🟡 No automated failures (manual check needed) | passes: meta-viewport                                                               |
| 1.4.5  | AA    | Images of Text                                       | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 1.4.10 | AA    | Reflow                                               | ❌ Failed                                      | fails: mentingo-reflow-320                                                          |
| 1.4.11 | AA    | Non-text Contrast                                    | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 1.4.12 | AA    | Text Spacing                                         | 🟠 Needs review                                | review: mentingo-text-spacing                                                       |
| 1.4.13 | AA    | Content on Hover or Focus                            | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 2.1.1  | A     | Keyboard                                             | 🟠 Needs review                                | review: mentingo-pointer-only-control                                               |
| 2.1.2  | A     | No Keyboard Trap                                     | 🟡 No automated failures (manual check needed) | passes: mentingo-keyboard-trap                                                      |
| 2.1.4  | A     | Character Key Shortcuts                              | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 2.2.1  | A     | Timing Adjustable                                    | ⚪ Not verifiable automatically                | no applicable content in scanned views                                              |
| 2.2.2  | A     | Pause, Stop, Hide                                    | ⚪ Not verifiable automatically                | no applicable content in scanned views                                              |
| 2.3.1  | A     | Three Flashes or Below Threshold                     | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 2.4.1  | A     | Bypass Blocks                                        | 🟡 No automated failures (manual check needed) | passes: bypass, mentingo-skip-link                                                  |
| 2.4.2  | A     | Page Titled                                          | ❌ Failed                                      | fails: mentingo-page-title-unique                                                   |
| 2.4.3  | A     | Focus Order                                          | 🟡 No automated failures (manual check needed) | passes: mentingo-focus-on-hidden-element                                            |
| 2.4.4  | A     | Link Purpose (In Context)                            | 🟡 No automated failures (manual check needed) | passes: link-name                                                                   |
| 2.4.5  | AA    | Multiple Ways                                        | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 2.4.6  | AA    | Headings and Labels                                  | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 2.4.7  | AA    | Focus Visible                                        | 🟠 Needs review                                | review: mentingo-focus-indicator                                                    |
| 2.5.1  | A     | Pointer Gestures                                     | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 2.5.2  | A     | Pointer Cancellation                                 | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 2.5.3  | A     | Label in Name                                        | 🟡 No automated failures (manual check needed) | passes: label-content-name-mismatch                                                 |
| 2.5.4  | A     | Motion Actuation                                     | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 3.1.1  | A     | Language of Page                                     | ✅ Met                                         | passes: html-has-lang, html-lang-valid                                              |
| 3.1.2  | AA    | Language of Parts                                    | ⚪ Not verifiable automatically                | no applicable content in scanned views                                              |
| 3.2.1  | A     | On Focus                                             | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 3.2.2  | A     | On Input                                             | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 3.2.3  | AA    | Consistent Navigation                                | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 3.2.4  | AA    | Consistent Identification                            | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 3.3.1  | A     | Error Identification                                 | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 3.3.2  | A     | Labels or Instructions                               | 🟠 Needs review                                | review: form-field-multiple-labels                                                  |
| 3.3.3  | AA    | Error Suggestion                                     | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 3.3.4  | AA    | Error Prevention (Legal, Financial, Data)            | ⚪ Not verifiable automatically                | manual test only                                                                    |
| 4.1.1  | A     | Parsing                                              | ✅ Met                                         | always satisfied for HTML (WCAG 2.1 errata)                                         |
| 4.1.2  | A     | Name, Role, Value                                    | ❌ Failed                                      | fails: aria-hidden-focus, aria-input-field-name, aria-valid-attr-value, button-name |
| 4.1.3  | AA    | Status Messages                                      | ⚪ Not verifiable automatically                | manual test only                                                                    |

## Locations

### Login (`auth-login`, anonymous, `/auth/login`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.underline-offset-2` — Element has insufficient color contrast of 1.63 (foreground color: #c8c8c8, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1

### Login with validation errors (`auth-login-validation-errors`, anonymous, `/auth/login`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.grid.gap-2:nth-child(1) > .text-red-500.text-sm` — Element has insufficient color contrast of 3.66 (foreground color: #ef4444, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.grid.gap-2:nth-child(2) > .text-red-500.text-sm` — Element has insufficient color contrast of 3.66 (foreground color: #ef4444, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.underline-offset-2` — Element has insufficient color contrast of 1.63 (foreground color: #c8c8c8, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1

### Login with wrong credentials (`auth-login-wrong-credentials`, anonymous, `/auth/login`)

- [`aria-hidden-focus`](https://dequeuniversity.com/rules/axe/4.14/aria-hidden-focus) (serious, 4.1.2): ARIA hidden element must not be focusable or contain focusable elements
  - `span[aria-hidden="true"]:nth-child(1)` — Focusable content should have tabindex="-1", be removed from the DOM, or not be hidden with aria-hidden
  - `span[aria-hidden="true"]:nth-child(3)` — Focusable content should have tabindex="-1", be removed from the DOM, or not be hidden with aria-hidden
- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.underline-offset-2` — Element has insufficient color contrast of 1.63 (foreground color: #c8c8c8, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.opacity-90` — Element has insufficient color contrast of 2.9 (foreground color: #f3e2e9, background color: #fb3b40, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1

### Register (`auth-register`, anonymous, `/auth/register`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `p` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1

### Password recovery (`auth-password-recovery`, anonymous, `/auth/password-recovery`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `p` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `a[data-discover="true"]` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1

### Magic link sign-in (`auth-magic-link`, anonymous, `/auth/magic-link`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `p` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `a[data-testid="magic-link-back-to-login-link"]` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1

### Courses list (`admin-courses`, admin, `/courses`)

- [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name) (critical, 4.1.2): Buttons must have discernible text
  - `.h-\[42px\]` — Element's default semantics were not overridden with role="none" or role="presentation"

### New course: type selector (`admin-course-type-selector`, admin, `/admin/beta-courses/new`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.text-neutral-850` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.hover\:border-primary-500.group.gap-4 > .min-w-0.flex-1 > .body-sm.mt-1.text-neutral-700` — Element has insufficient color contrast of 4.12 (foreground color: #7b7b7b, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.hover\:border-emerald-500 > .min-w-0.flex-1 > .body-sm.mt-1.text-neutral-700` — Element has insufficient color contrast of 4.12 (foreground color: #7b7b7b, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.hover\:border-sky-500 > .min-w-0.flex-1 > .body-sm.mt-1.text-neutral-700` — Element has insufficient color contrast of 4.12 (foreground color: #7b7b7b, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
- `mentingo-page-title-unique` (moderate, 2.4.2): Each page has a title that tells it apart from other pages
  - `title` — The same title is used on 2 different pages

### New course form (`admin-create-course`, admin, `/admin/beta-courses/new/standard`)

- [`aria-input-field-name`](https://dequeuniversity.com/rules/axe/4.14/aria-input-field-name) (serious, 4.1.2): ARIA input fields must have an accessible name
  - `.tiptap` — Element has no title attribute
- [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name) (critical, 4.1.2): Buttons must have discernible text
  - `button[aria-controls="radix-:r1l:"]` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `.h-8` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `.gap-x-1.border-r.border-neutral-200:nth-child(2) > .hover\:bg-primary-100.h-9.bg-transparent:nth-child(1)` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `.gap-x-1.border-r.border-neutral-200:nth-child(2) > .hover\:bg-primary-100.h-9.bg-transparent:nth-child(2)` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `.gap-x-1.border-r.border-neutral-200:nth-child(2) > .hover\:bg-primary-100.h-9.bg-transparent:nth-child(3)` — Element's default semantics were not overridden with role="none" or role="presentation"
  - …and 9 more
- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.text-neutral-850` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1
  - `#categoryId > span` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.body-sm` — Element has insufficient color contrast of 3.95 (foreground color: #7b7b7b, background color: #f7f7f7, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
- `mentingo-page-title-unique` (moderate, 2.4.2): Each page has a title that tells it apart from other pages
  - `title` — The same title is used on 2 different pages

### Course editor: settings (`admin-edit-course-settings`, admin, `/admin/beta-courses/968b47c2-e88c-49c0-b42d-0928c07c4b06`)

- [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name) (critical, 4.1.2): Buttons must have discernible text
  - `.h-\[42px\]` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `button[role="button"]` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `#radix-\:r10\:` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `#freemiumToggle` — Element's default semantics were not overridden with role="none" or role="presentation"
- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.rounded` — Element has insufficient color contrast of 3.36 (foreground color: #7b7b7b, background color: #e5e5e5, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1
- [`listitem`](https://dequeuniversity.com/rules/axe/4.14/listitem) (serious, 1.3.1): &lt;li&gt; elements must be contained in a &lt;ul&gt; or &lt;ol&gt;
  - `ul > li` — List item parent element has a role that is not role="list". Ensure the parent element has role="list", or move the &lt;li&gt; inside a &lt;ul&gt; or &lt;ol&gt;.
- `mentingo-reflow-320` (serious, 1.4.10): The page does not scroll horizontally in a 320 CSS px wide viewport
  - `[data-testid="edit-course-page-heading"]` — Right edge at 337px: the page scrolls horizontally at 320px
  - `div.flex.gap-4` — Right edge at 721px: the page scrolls horizontally at 320px

### Course editor: curriculum (`admin-edit-course-curriculum`, admin, `/admin/beta-courses/968b47c2-e88c-49c0-b42d-0928c07c4b06`)

- [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name) (critical, 4.1.2): Buttons must have discernible text
  - `.h-\[42px\]` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `button[role="button"]` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `#radix-\:r10\:` — Element's default semantics were not overridden with role="none" or role="presentation"
  - `#freemiumToggle` — Element's default semantics were not overridden with role="none" or role="presentation"
- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.rounded` — Element has insufficient color contrast of 3.36 (foreground color: #7b7b7b, background color: #e5e5e5, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1
- [`listitem`](https://dequeuniversity.com/rules/axe/4.14/listitem) (serious, 1.3.1): &lt;li&gt; elements must be contained in a &lt;ul&gt; or &lt;ol&gt;
  - `ul > li` — List item parent element has a role that is not role="list". Ensure the parent element has role="list", or move the &lt;li&gt; inside a &lt;ul&gt; or &lt;ol&gt;.
- `mentingo-reflow-320` (serious, 1.4.10): The page does not scroll horizontally in a 320 CSS px wide viewport
  - `[data-testid="edit-course-page-heading"]` — Right edge at 337px: the page scrolls horizontally at 320px
  - `div.flex.gap-4` — Right edge at 721px: the page scrolls horizontally at 320px

### Student dashboard (`student-dashboard`, student, `/dashboard`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `td:nth-child(1) > .day-outside.text-neutral-400.opacity-50` — Element has insufficient color contrast of 1.43 (foreground color: #d5d5d5, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `tr:nth-child(1) > td:nth-child(2) > .day-outside.text-neutral-400.opacity-50` — Element has insufficient color contrast of 1.43 (foreground color: #d5d5d5, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `tr:nth-child(1) > td:nth-child(3) > .day-outside.text-neutral-400.opacity-50` — Element has insufficient color contrast of 1.43 (foreground color: #d5d5d5, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `tr:nth-child(1) > td:nth-child(4) > .day-outside.text-neutral-400.opacity-50` — Element has insufficient color contrast of 1.43 (foreground color: #d5d5d5, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `tr:nth-child(1) > td:nth-child(5) > .day-outside.text-neutral-400.opacity-50` — Element has insufficient color contrast of 1.43 (foreground color: #d5d5d5, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - …and 1 more

### Course catalogue (`student-courses`, student, `/courses`)

No WCAG 2.1 A/AA violations found by automation.

### Course overview (`student-course-overview`, student, `/course/ctk6d-wcag-audit-1795271794810-course`)

No WCAG 2.1 A/AA violations found by automation.

### Content lesson (`student-content-lesson`, student, `/course/ctk6d-wcag-audit-1795271794810-course/lesson/26c0e830-c6ec-458e-a45d-9f481be54fb9`)

No WCAG 2.1 A/AA violations found by automation.

### Content lesson after sidebar navigation (`student-content-lesson-next`, student, `/course/ctk6d-wcag-audit-1795271794810-course/lesson/1141ca3f-8d1e-4cc3-a772-1935ba6bed40`)

No WCAG 2.1 A/AA violations found by automation.

### Open profile menu (`student-profile-menu-open`, student, `/course/ctk6d-wcag-audit-1795271794810-course/lesson/1141ca3f-8d1e-4cc3-a772-1935ba6bed40`)

- [`aria-hidden-focus`](https://dequeuniversity.com/rules/axe/4.14/aria-hidden-focus) (serious, 4.1.2): ARIA hidden element must not be focusable or contain focusable elements
  - `.focus\:not-sr-only` — Focusable content should have tabindex="-1", be removed from the DOM, or not be hidden with aria-hidden
  - `.h-screen` — Focusable content should have tabindex="-1", be removed from the DOM, or not be hidden with aria-hidden

### Profile (`student-profile`, student, `/profile/ab271252-7229-404d-b965-5f65f855b8f3`)

No WCAG 2.1 A/AA violations found by automation.

### Account settings (`student-settings`, student, `/settings`)

- [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name) (critical, 4.1.2): Buttons must have discernible text
  - `.data-\[placeholder\]\:text-muted-foreground` — Element's default semantics were not overridden with role="none" or role="presentation"
- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `#change-language > .space-y-1\.5.p-6.flex-col > p` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `form > .space-y-1\.5.p-6.flex-col > p` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
- `mentingo-reflow-320` (serious, 1.4.10): The page does not scroll horizontally in a 320 CSS px wide viewport
  - `[data-testid="settings-reset-onboarding-button"]` — Right edge at 337px: the page scrolls horizontally at 320px

### Quiz with every question type (`student-quiz`, student, `/course/en61m-wcag-audit-quiz-1795271804211-course/lesson/dbdd2ab3-2e8c-4676-92a1-3634899cfe54`)

- `mentingo-reflow-320` (serious, 1.4.10): The page does not scroll horizontally in a 320 CSS px wide viewport
  - `fieldset.flex.flex-col` — Right edge at 506px: the page scrolls horizontally at 320px

### Quiz results (`student-quiz-results`, student, `/course/en61m-wcag-audit-quiz-1795271804211-course/lesson/dbdd2ab3-2e8c-4676-92a1-3634899cfe54`)

- `mentingo-reflow-320` (serious, 1.4.10): The page does not scroll horizontally in a 320 CSS px wide viewport
  - `fieldset.flex.flex-col` — Right edge at 506px: the page scrolls horizontally at 320px

### Admin dashboard (`admin-dashboard`, admin, `/dashboard`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.p-4.text-neutral-600` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `td:nth-child(1) > .day-outside.text-neutral-400.opacity-50` — Element has insufficient color contrast of 1.43 (foreground color: #d5d5d5, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `tr:nth-child(1) > td:nth-child(2) > .day-outside.text-neutral-400.opacity-50` — Element has insufficient color contrast of 1.43 (foreground color: #d5d5d5, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `tr:nth-child(1) > td:nth-child(3) > .day-outside.text-neutral-400.opacity-50` — Element has insufficient color contrast of 1.43 (foreground color: #d5d5d5, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `tr:nth-child(1) > td:nth-child(4) > .day-outside.text-neutral-400.opacity-50` — Element has insufficient color contrast of 1.43 (foreground color: #d5d5d5, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - …and 3 more

### Users list (`admin-users`, admin, `/admin/users`)

- [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name) (critical, 4.1.2): Buttons must have discernible text
  - `.h-\[42px\]` — Element's default semantics were not overridden with role="none" or role="presentation"
- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.text-muted-foreground.truncate` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1

### Create user (`admin-create-user`, admin, `/admin/users/new`)

- [`aria-valid-attr-value`](https://dequeuniversity.com/rules/axe/4.14/aria-valid-attr-value) (critical, 4.1.2): ARIA attributes must conform to valid values
  - `#radix-\:ru\:` — Invalid ARIA attribute value: aria-controls="radix-:rs:"

### Groups list (`admin-groups`, admin, `/admin/groups`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.mt-1` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1

### Create group (`admin-create-group`, admin, `/admin/groups/new`)

- [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name) (critical, 4.1.2): Buttons must have discernible text
  - `.data-\[placeholder\]\:text-muted-foreground` — Element's default semantics were not overridden with role="none" or role="presentation"

### Categories list (`admin-categories`, admin, `/admin/categories`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.mt-1` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1

### Learning paths management (`admin-learning-paths`, admin, `/development-paths`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.mt-1` — Element has insufficient color contrast of 3.24 (foreground color: #888888, background color: #f2f5fc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1

### Gamification settings (`admin-gamification`, admin, `/admin/gamification`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `p` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.hover\:bg-neutral-100:nth-child(1) > td:nth-child(1) > .gap-3.items-center > .flex-col > .gap-2.items-center > .bg-neutral-100.px-1\.5.py-0\.5` — Element has insufficient color contrast of 3.02 (foreground color: #888888, background color: #ededed, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1
  - `span[title="Log in on consecutive days."]` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.hover\:bg-neutral-100:nth-child(1) > td:nth-child(2) > .flex-col > .text-neutral-500.details` — Element has insufficient color contrast of 2.77 (foreground color: #999999, background color: #fcfcfc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.hover\:bg-neutral-100:nth-child(1) > td:nth-child(4) > .body-sm.text-neutral-700.gap-1\.5` — Element has insufficient color contrast of 4.12 (foreground color: #7b7b7b, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - …and 24 more
- `mentingo-reflow-320` (serious, 1.4.10): The page does not scroll horizontally in a 320 CSS px wide viewport
  - `a` — Right edge at 388px: the page scrolls horizontally at 320px

### Email templates (`admin-email-templates`, admin, `/admin/automations`)

- [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name) (critical, 4.1.2): Buttons must have discernible text
  - `.h-\[42px\]` — Element's default semantics were not overridden with role="none" or role="presentation"
- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.hover\:bg-neutral-50.focus-visible\:bg-neutral-50.focus-visible\:ring-inset:nth-child(1) > td:nth-child(2) > .line-clamp-2.max-w-xs.break-words` — Element has insufficient color contrast of 4.12 (foreground color: #7b7b7b, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.text-yellow-600` — Element has insufficient color contrast of 2.85 (foreground color: #ca8a04, background color: #fefde8, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `time` — Element has insufficient color contrast of 4.12 (foreground color: #7b7b7b, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.hover\:bg-neutral-50.focus-visible\:bg-neutral-50.focus-visible\:ring-inset:nth-child(2) > td:nth-child(2) > .line-clamp-2.max-w-xs.break-words` — Element has insufficient color contrast of 4.12 (foreground color: #7b7b7b, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.hover\:bg-neutral-50.focus-visible\:bg-neutral-50.focus-visible\:ring-inset:nth-child(2) > td:nth-child(3) > .text-neutral-600.bg-neutral-100.px-2` — Element has insufficient color contrast of 3.02 (foreground color: #888888, background color: #ededed, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - …and 16 more

### Reports (`admin-reports`, admin, `/reports`)

- [`aria-valid-attr-value`](https://dequeuniversity.com/rules/axe/4.14/aria-valid-attr-value) (critical, 4.1.2): ARIA attributes must conform to valid values
  - `#radix-\:rr\:-trigger-organisation` — Invalid ARIA attribute value: aria-controls="radix-:rr:-content-organisation"
- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.max-w-2xl` — Element has insufficient color contrast of 3.24 (foreground color: #888888, background color: #f2f5fc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.rounded-r-none` — Element has insufficient color contrast of 2.24 (foreground color: #f7f9fc, background color: #99a7d9, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.hover\:bg-accent` — Element has insufficient color contrast of 4.12 (foreground color: #7b7b7b, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `main > div:nth-child(1) > .details` — Element has insufficient color contrast of 2.61 (foreground color: #999999, background color: #f2f5fc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `article[data-testid="reports-metric-learners"] > .text-neutral-600` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - …and 15 more
- [`definition-list`](https://dequeuniversity.com/rules/axe/4.14/definition-list) (serious, 1.3.1): &lt;dl&gt; elements must only directly contain properly-ordered &lt;dt&gt; and &lt;dd&gt; groups, &lt;script&gt;, &lt;template&gt; or &lt;div&gt; elements
  - `dl` — dl element has direct children that are not allowed: div &gt; div
- [`dlitem`](https://dequeuniversity.com/rules/axe/4.14/dlitem) (serious, 1.3.1): &lt;dt&gt; and &lt;dd&gt; elements must be contained by a &lt;dl&gt;
  - `.last\:pb-0.gap-1\.5.py-3:nth-child(1) > .items-baseline.gap-3.justify-between > dt` — Description list item does not have a &lt;dl&gt; parent element
  - `.last\:pb-0.gap-1\.5.py-3:nth-child(1) > .items-baseline.gap-3.justify-between > dd` — Description list item does not have a &lt;dl&gt; parent element
  - `.last\:pb-0.gap-1\.5.py-3:nth-child(2) > .items-baseline.gap-3.justify-between > dt` — Description list item does not have a &lt;dl&gt; parent element
  - `.last\:pb-0.gap-1\.5.py-3:nth-child(2) > .items-baseline.gap-3.justify-between > dd` — Description list item does not have a &lt;dl&gt; parent element
  - `.last\:pb-0.gap-1\.5.py-3:nth-child(3) > .items-baseline.gap-3.justify-between > dt` — Description list item does not have a &lt;dl&gt; parent element
  - …and 5 more

### Platform settings (`admin-settings`, admin, `/settings`)

- [`button-name`](https://dequeuniversity.com/rules/axe/4.14/button-name) (critical, 4.1.2): Buttons must have discernible text
  - `.data-\[placeholder\]\:text-muted-foreground` — Element's default semantics were not overridden with role="none" or role="presentation"
- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `#change-language > .space-y-1\.5.p-6.flex-col > p` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `#user-details > form > .space-y-1\.5.p-6.flex-col > p` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1

### Learning paths (`student-learning-paths`, student, `/development-paths`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.text-base` — Element has insufficient color contrast of 3.95 (foreground color: #7b7b7b, background color: #f7f7f7, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1

### Calendar (`student-calendar`, student, `/calendar`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.gap-1\.5:nth-child(2)` — Element has insufficient color contrast of 3.24 (foreground color: #888888, background color: #f2f5fc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.gap-1\.5:nth-child(3)` — Element has insufficient color contrast of 3.24 (foreground color: #888888, background color: #f2f5fc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `.gap-1\.5:nth-child(4)` — Element has insufficient color contrast of 3.24 (foreground color: #888888, background color: #f2f5fc, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1
  - `a[aria-label="Monday"]` — Element has insufficient color contrast of 3.95 (foreground color: #7b7b7b, background color: #f7f7f7, font size: 9.0pt (12px), font weight: bold). Expected contrast ratio of 4.5:1
  - `a[aria-label="Tuesday"]` — Element has insufficient color contrast of 3.95 (foreground color: #7b7b7b, background color: #f7f7f7, font size: 9.0pt (12px), font weight: bold). Expected contrast ratio of 4.5:1
  - …and 31 more
- [`role-img-alt`](https://dequeuniversity.com/rules/axe/4.14/role-img-alt) (serious, 1.1.1): [role="img"] and [role="image"] elements must have alternative text
  - `.fc-icon-chevron-left` — Element has no title attribute
  - `.fc-icon-chevron-right` — Element has no title attribute

### News (`student-news`, student, `/news`)

- `mentingo-page-title-unique` (moderate, 2.4.2): Each page has a title that tells it apart from other pages
  - `title` — The same title is used on 4 different pages

### Articles (`student-articles`, student, `/articles`)

- `mentingo-page-title-unique` (moderate, 2.4.2): Each page has a title that tells it apart from other pages
  - `title` — The same title is used on 4 different pages

### Q&A (`student-qa`, student, `/qa`)

No WCAG 2.1 A/AA violations found by automation.

### Forum (`student-forum`, student, `/forum`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.space-y-1 > p` — Element has insufficient color contrast of 3.24 (foreground color: #888888, background color: #f2f5fc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `p[data-testid="forum-empty-state"]` — Element has insufficient color contrast of 3.24 (foreground color: #888888, background color: #f2f5fc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
- `mentingo-page-title-unique` (moderate, 2.4.2): Each page has a title that tells it apart from other pages
  - `title` — The same title is used on 4 different pages

### Leaderboard (`student-leaderboard`, student, `/leaderboards`)

- [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast) (serious, 1.4.3): Elements must meet minimum color contrast ratio thresholds
  - `.gap-y-1.flex-col > p` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
  - `p[data-testid="leaderboard-empty"]` — Element has insufficient color contrast of 3.45 (foreground color: #888888, background color: #fcfcfc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
- `mentingo-page-title-unique` (moderate, 2.4.2): Each page has a title that tells it apart from other pages
  - `title` — The same title is used on 4 different pages

## Needs manual review

Results axe or the heuristics could not decide. They are not counted as failures.

| Rule                                                                                                  | WCAG   | Views | Occurrences | Check                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | ------ | ----- | ----------- | ------------------------------------------------------------------------------------------------------ |
| [`aria-valid-attr-value`](https://dequeuniversity.com/rules/axe/4.14/aria-valid-attr-value)           | 4.1.2  | 31    | 49          | ARIA attributes must conform to valid values                                                           |
| `mentingo-pointer-only-control`                                                                       | 2.1.1  | 31    | 65          | Clickable-looking elements can be reached with the keyboard (heuristic)                                |
| [`color-contrast`](https://dequeuniversity.com/rules/axe/4.14/color-contrast)                         | 1.4.3  | 10    | 41          | Elements must meet minimum color contrast ratio thresholds                                             |
| [`aria-prohibited-attr`](https://dequeuniversity.com/rules/axe/4.14/aria-prohibited-attr)             | 4.1.2  | 1     | 9           | Elements must only use permitted ARIA attributes                                                       |
| [`aria-hidden-focus`](https://dequeuniversity.com/rules/axe/4.14/aria-hidden-focus)                   | 4.1.2  | 1     | 2           | ARIA hidden element must not be focusable or contain focusable elements                                |
| `mentingo-focus-indicator`                                                                            | 2.4.7  | 25    | 53          | Focused element shows an outline or ring (heuristic: focus styled by other means needs a manual check) |
| [`form-field-multiple-labels`](https://dequeuniversity.com/rules/axe/4.14/form-field-multiple-labels) | 3.3.2  | 2     | 20          | Form field must not have multiple label elements                                                       |
| `mentingo-reflow-320-region`                                                                          | 1.4.10 | 11    | 14          | No region scrolls sideways or cuts content off at 320 CSS px (heuristic)                               |
| `mentingo-text-spacing`                                                                               | 1.4.12 | 1     | 1           | No text is cut off with increased line, letter, word and paragraph spacing (heuristic)                 |

## Outside WCAG 2.1 AA (informational)

WCAG 2.2 AA rules and axe best practices; not part of the score.

| Rule                                                                                                  | Impact   | Tags          | Views | Occurrences | Problem                                                                                    |
| ----------------------------------------------------------------------------------------------------- | -------- | ------------- | ----- | ----------- | ------------------------------------------------------------------------------------------ |
| [`region`](https://dequeuniversity.com/rules/axe/4.14/region)                                         | moderate | best-practice | 39    | 40          | All page content should be contained by landmarks                                          |
| [`skip-link`](https://dequeuniversity.com/rules/axe/4.14/skip-link)                                   | moderate | best-practice | 38    | 38          | The skip-link target should exist and be focusable                                         |
| [`page-has-heading-one`](https://dequeuniversity.com/rules/axe/4.14/page-has-heading-one)             | moderate | best-practice | 25    | 25          | Page should contain a level-one heading                                                    |
| [`landmark-unique`](https://dequeuniversity.com/rules/axe/4.14/landmark-unique)                       | moderate | best-practice | 5     | 5           | Landmarks should have a unique role or role/label/title (i.e. accessible name) combination |
| [`landmark-main-is-top-level`](https://dequeuniversity.com/rules/axe/4.14/landmark-main-is-top-level) | moderate | best-practice | 4     | 4           | Main landmark should not be contained in another landmark                                  |
| [`landmark-no-duplicate-main`](https://dequeuniversity.com/rules/axe/4.14/landmark-no-duplicate-main) | moderate | best-practice | 4     | 4           | Document should not have more than one main landmark                                       |
| [`heading-order`](https://dequeuniversity.com/rules/axe/4.14/heading-order)                           | moderate | best-practice | 4     | 4           | Heading levels should only increase by one                                                 |
| [`landmark-one-main`](https://dequeuniversity.com/rules/axe/4.14/landmark-one-main)                   | moderate | best-practice | 1     | 1           | Document should have one main landmark                                                     |
| [`aria-allowed-role`](https://dequeuniversity.com/rules/axe/4.14/aria-allowed-role)                   | minor    | best-practice | 3     | 3           | ARIA role should be appropriate for the element                                            |
| [`empty-heading`](https://dequeuniversity.com/rules/axe/4.14/empty-heading)                           | minor    | best-practice | 2     | 2           | Headings should not be empty                                                               |
| [`empty-table-header`](https://dequeuniversity.com/rules/axe/4.14/empty-table-header)                 | minor    | best-practice | 1     | 1           | Table header text should not be empty                                                      |

## Scanned views

| View                                                                    | Role      | Path                                                                                             | Title                                                                                       |
| ----------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Login (`auth-login`)                                                    | anonymous | `/auth/login`                                                                                    | Login – Mentingo                                                                            |
| Login with validation errors (`auth-login-validation-errors`)           | anonymous | `/auth/login`                                                                                    | Login – Mentingo                                                                            |
| Login with wrong credentials (`auth-login-wrong-credentials`)           | anonymous | `/auth/login`                                                                                    | Login – Mentingo                                                                            |
| Register (`auth-register`)                                              | anonymous | `/auth/register`                                                                                 | Register – Mentingo                                                                         |
| Password recovery (`auth-password-recovery`)                            | anonymous | `/auth/password-recovery`                                                                        | Password Recovery – Mentingo                                                                |
| Magic link sign-in (`auth-magic-link`)                                  | anonymous | `/auth/magic-link`                                                                               | Login Link – Mentingo                                                                       |
| Courses list (`admin-courses`)                                          | admin     | `/courses`                                                                                       | Courses – Mentingo                                                                          |
| New course: type selector (`admin-course-type-selector`)                | admin     | `/admin/beta-courses/new`                                                                        | Create a new course – Mentingo                                                              |
| New course form (`admin-create-course`)                                 | admin     | `/admin/beta-courses/new/standard`                                                               | Create a new course – Mentingo                                                              |
| Course editor: settings (`admin-edit-course-settings`)                  | admin     | `/admin/beta-courses/968b47c2-e88c-49c0-b42d-0928c07c4b06`                                       | Edit Course – Mentingo                                                                      |
| Course editor: curriculum (`admin-edit-course-curriculum`)              | admin     | `/admin/beta-courses/968b47c2-e88c-49c0-b42d-0928c07c4b06`                                       | Edit Course – Mentingo                                                                      |
| Student dashboard (`student-dashboard`)                                 | student   | `/dashboard`                                                                                     | Dashboard – Mentingo                                                                        |
| Course catalogue (`student-courses`)                                    | student   | `/courses`                                                                                       | Courses – Mentingo                                                                          |
| Course overview (`student-course-overview`)                             | student   | `/course/ctk6d-wcag-audit-1795271794810-course`                                                  | wcag-audit-1795271794810-course – Mentingo                                                  |
| Content lesson (`student-content-lesson`)                               | student   | `/course/ctk6d-wcag-audit-1795271794810-course/lesson/26c0e830-c6ec-458e-a45d-9f481be54fb9`      | wcag-audit-1795271794810-first-lesson – wcag-audit-1795271794810-course – Mentingo          |
| Content lesson after sidebar navigation (`student-content-lesson-next`) | student   | `/course/ctk6d-wcag-audit-1795271794810-course/lesson/1141ca3f-8d1e-4cc3-a772-1935ba6bed40`      | wcag-audit-1795271794810-second-lesson – wcag-audit-1795271794810-course – Mentingo         |
| Open profile menu (`student-profile-menu-open`)                         | student   | `/course/ctk6d-wcag-audit-1795271794810-course/lesson/1141ca3f-8d1e-4cc3-a772-1935ba6bed40`      | wcag-audit-1795271794810-second-lesson – wcag-audit-1795271794810-course – Mentingo         |
| Profile (`student-profile`)                                             | student   | `/profile/ab271252-7229-404d-b965-5f65f855b8f3`                                                  | Profile – Mentingo                                                                          |
| Account settings (`student-settings`)                                   | student   | `/settings`                                                                                      | Settings – Mentingo                                                                         |
| Quiz with every question type (`student-quiz`)                          | student   | `/course/en61m-wcag-audit-quiz-1795271804211-course/lesson/dbdd2ab3-2e8c-4676-92a1-3634899cfe54` | wcag-audit-quiz-1795271804211-quiz-lesson – wcag-audit-quiz-1795271804211-course – Mentingo |
| Quiz results (`student-quiz-results`)                                   | student   | `/course/en61m-wcag-audit-quiz-1795271804211-course/lesson/dbdd2ab3-2e8c-4676-92a1-3634899cfe54` | wcag-audit-quiz-1795271804211-quiz-lesson – wcag-audit-quiz-1795271804211-course – Mentingo |
| Admin dashboard (`admin-dashboard`)                                     | admin     | `/dashboard`                                                                                     | Dashboard – Mentingo                                                                        |
| Users list (`admin-users`)                                              | admin     | `/admin/users`                                                                                   | Users – Mentingo                                                                            |
| Create user (`admin-create-user`)                                       | admin     | `/admin/users/new`                                                                               | Create New User – Mentingo                                                                  |
| Groups list (`admin-groups`)                                            | admin     | `/admin/groups`                                                                                  | Groups – Mentingo                                                                           |
| Create group (`admin-create-group`)                                     | admin     | `/admin/groups/new`                                                                              | Create Group – Mentingo                                                                     |
| Categories list (`admin-categories`)                                    | admin     | `/admin/categories`                                                                              | Categories – Mentingo                                                                       |
| Learning paths management (`admin-learning-paths`)                      | admin     | `/development-paths`                                                                             | Development Paths – Mentingo                                                                |
| Gamification settings (`admin-gamification`)                            | admin     | `/admin/gamification`                                                                            | Gamification – Mentingo                                                                     |
| Email templates (`admin-email-templates`)                               | admin     | `/admin/automations`                                                                             | Admin – Mentingo                                                                            |
| Reports (`admin-reports`)                                               | admin     | `/reports`                                                                                       | Reports – Mentingo                                                                          |
| Platform settings (`admin-settings`)                                    | admin     | `/settings`                                                                                      | Settings – Mentingo                                                                         |
| Learning paths (`student-learning-paths`)                               | student   | `/development-paths`                                                                             | Development Paths – Mentingo                                                                |
| Calendar (`student-calendar`)                                           | student   | `/calendar`                                                                                      | Calendar – Mentingo                                                                         |
| News (`student-news`)                                                   | student   | `/news`                                                                                          | Mentingo                                                                                    |
| Articles (`student-articles`)                                           | student   | `/articles`                                                                                      | Mentingo                                                                                    |
| Q&A (`student-qa`)                                                      | student   | `/qa`                                                                                            | Q&A – Mentingo                                                                              |
| Forum (`student-forum`)                                                 | student   | `/forum`                                                                                         | Mentingo                                                                                    |
| Leaderboard (`student-leaderboard`)                                     | student   | `/leaderboards`                                                                                  | Mentingo                                                                                    |
