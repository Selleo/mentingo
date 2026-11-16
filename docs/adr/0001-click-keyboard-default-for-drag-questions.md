# 1. Click/keyboard selection is the default answer method for drag-based quiz questions

Date: 2026-11-16

## Status

Accepted

## Context

Drag fill-in-the-blanks and matching questions could only be answered by dragging
(dnd-kit). A UX audit for Premia Społeczna (finding F13, critical) showed this blocks
keyboard, screen-reader and tremor users: keyboard drag could not reach later blanks,
screen-reader announcements read raw IDs in English, and in the final quiz every attempt
by mouse, pointer and keyboard ended in "Dragging was cancelled." Because no certificate
is issued without finishing the quiz, this blocks the platform's main goal for those users.
It also fails WCAG 2.5.7, 2.1.1, 3.1.2 and 4.1.3.

The issue (#2211) requires a non-drag way to answer and explicitly asks to keep dragging
as an extra; the client raised keeping drag at a workshop.

## Decision

Selecting a word/target from a list — by click or by keyboard — is the **default** answer
method for drag fill-in-the-blanks and matching. Dragging is kept as a **secondary**
alternative. Both methods go through one shared swap reducer per question type and write
the same answer state, so grading and the API payload are unchanged.

## Consequences

- Every blank/item is answerable by click or keyboard alone, satisfying F13 and the WCAG
  criteria above.
- Keeping both methods on the same element costs more than a drag-only or click-only UI:
  the two input modes must coexist on one element without stealing each other's gestures,
  and drag's screen-reader announcements still have to be translated and de-ID'd.
- Reversing this (dropping drag) later is cheap; dropping the click/keyboard path is not,
  since it is the accessible baseline.

## Alternatives considered

- **Drop drag entirely, click/keyboard only.** Smaller and more robust, and satisfies every
  acceptance criterion, but overrides the client's explicit request to keep drag, so it was
  not taken unilaterally.
