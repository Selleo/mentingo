# Course Overview Management

## Business Overview

The course overview gives course managers one place to review the learner-facing course and manage its operational settings. The compact page keeps the hero, progress cards, certificate access, curriculum, discussions, and management controls close together.

Learners use the same overview to understand the course, continue learning, review outcomes, and open an awarded certificate. Administrators can edit rich course details, manage the curriculum, and open a tabbed settings sheet for status, pricing, enrollment, sharing, and course behavior.

## Who Uses It

- Course creators update course details and maintain the curriculum while previewing the learner experience.
- HR and L&D administrators manage publication, pricing, enrollment, sharing, deadlines, and certification from the overview.
- Learners review course expectations, continue progress, participate in discussions, and preview an awarded certificate.

## Feature Functions

- Present course details, learning outcomes, progress, curriculum, and discussions in one compact overview.
- Show course learning outcomes in the selected course language while keeping the section label in the learner's UI language.
- Edit course descriptions with rich-text formatting.
- Update inline course-overview edits immediately without making the user wait for a broad page refresh.
- Manage curriculum through a dedicated action while keeping the legacy editor focused on curriculum.
- Organize status, pricing, enrollment, sharing, and course behavior in a consistent tabbed settings sheet.
- Let eligible learners open, download, and share an awarded certificate from the course page.
- Keep mention suggestions usable with long participant names and near viewport edges.

## End-User Value

Course teams spend less time navigating between management pages and see changes in the context learners experience. Learners receive clearer course information and immediate access to completion evidence.

## How It Works

An administrator opens the course overview, selects a course language, and edits learner-facing details in place, or opens the settings sheet to choose a management area. The selected language's learning outcomes can be edited independently, including clearing a translation without replacing the base-language content. Learners continue to see the base-language outcome fallback when a translated outcome is unavailable. Curriculum editing remains available through its dedicated action, and the course overview uses the established accordion curriculum with chapter counters, progress, access indicators, and lesson actions. A learner who completes a certificate-enabled course sees a certificate card and can open the existing localized preview.

## Key Technical Context

- Existing API mutations, generated client contracts, permission checks, and query invalidation remain authoritative.
- Course editors receive exact selected-language values for localized learning outcomes; learner and preview experiences retain base-language fallback behavior.
- Inline overview edits update the active course view from the saved value and preserve the selected course language.
- The settings sheet reuses established course-management panels and the course overview tab visual language.
- Certificate visibility still depends on an issued certificate, completed course progress, and the effective learner experience.
- Course language remains explicit throughout localized management and certificate rendering.

## Verification Notes

- Source coverage exists for the modern overview, TOC tabs, settings drawer, details, outcomes, certificates, and discussions.
- API coverage verifies localized course outcomes for editor and learner experiences, including empty translated outcomes.
- Narrow frontend unit, E2E, and type-check validation remains to be run for the deploy-feedback changes.
