# Global Discussions Toggle

## Type

#AFK

## What to build

Platform-level toggle to enable or disable course discussions globally.
New `discussionsEnabled` boolean in the platform settings JSONB blob,
PATCH endpoint, admin Customize Platform UI row, effective flag
surfaced on the course detail response, and the Discussion tab hidden
when disabled.

See parent PRD `course-discussions-prd.md` sections:

- "Settings — global discussions toggle"
- "Admin UI"
- "Web — Discussion tab + thread UI" → "Hidden when
  `discussionsEnabled` is false."

Mirrors the existing `qaEnabled` / News / Articles toggle pattern.

## Acceptance criteria

- [ ] `discussionsEnabled` boolean added to the platform settings JSONB
      blob and constants, default `true`
- [ ] PATCH endpoint added under the existing settings controller
      matching the established Q&A / News / Articles route shape
- [ ] Course detail response surfaces the effective `discussionsEnabled`
      flag so the web client can hide the tab without a second roundtrip
- [ ] New `SettingItem` row in the existing Customize Platform tab
      alongside Q&A / News / Articles toggles
- [ ] New `useChangeDiscussionsSetting` mutation hook calling the new
      PATCH endpoint, modeled on `useChangeQASetting`
- [ ] Discussion tab is hidden on every course when
      `discussionsEnabled` is false
- [ ] All admin UI strings go through the existing i18n layer

## Blocked by

- Blocked by `discussions-full-feature-issue.md`

## User stories addressed

- User story 19
  - "As an admin, I want a global toggle in Platform Customization to
    enable or disable course discussions for the whole platform, so
    that I can turn the feature off if my organization doesn't want
    it."
- User story 20
  - "As an admin, when I disable discussions globally, I want the tab
    to disappear from every course, so that students don't see a
    broken or empty feature."
