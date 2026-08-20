# Course Duration Estimates Business Spec

## Business Overview

Course duration estimates help learners decide whether a course fits their available time and help course creators and L&D managers plan learning workloads. Mentingo builds the estimate from the course's readable content, interactive activities, and embedded resources, including authoritative lengths for supported internal videos when that metadata is available.

Learners see the same rounded course and chapter totals wherever they encounter a course: overview, course lists, cards, the table of contents, and the progress card. As learners complete lessons, the progress card shows the remaining estimate without counting completed lessons. A completed course shows a finished message instead of a zero-minute duration.

## Who Uses It

- Learners compare courses by expected time before starting and use the remaining estimate to plan their next learning session.
- Course creators review the time commitment represented by their course content as lessons, questions, and media change.
- L&D managers use consistent course estimates when planning and assigning training.

## Feature Functions

- Estimate course effort from reading, questions, lesson types, images, downloads, presentations, embeds, and video content.
- Use server-owned video metadata when available while retaining a documented fallback for videos whose metadata is not yet available.
- Aggregate lesson estimates into chapter and course totals with an exact internal value and a consistent learner-facing display.
- Present chapter-based duration labels in 15-minute increments so the displayed course total equals the sum of displayed chapters.
- Show remaining learning time by excluding completed lessons and rounding each chapter's remaining work once.
- Keep duration calculations consistent across the course base language and its available locales; each persisted projection contains exactly those course languages.
- Recalculate estimates when course structure, lesson content, questions, or relevant video metadata changes.
- Carry known video length into shared course copies and retry metadata discovery for the copied Bunny video when the source length is still unavailable.

## End-User Value

Learners get a more trustworthy expectation of the work involved, especially when a course contains substantial video. Consistent chapter-based labels prevent different screens from disagreeing about the same course, while remaining-time estimates make progress easier to plan. Course creators and L&D teams can communicate training commitments using a stable, content-based measure.

## How It Works

When a learner or course manager opens a course, Mentingo calculates exact seconds for each lesson and sums those exact values into exact chapter and course totals. For presentation, each positive chapter total is rounded up to the next 15-minute display bucket; the course display is the sum of those rounded chapter displays. Course-list responses already contain the compatible rounded minute total, so cards and hero surfaces display that value directly.

For remaining time, Mentingo looks at the learner's current lesson statuses, removes completed lessons, sums the unfinished lesson seconds within each chapter, rounds each non-empty chapter remainder to a 15-minute bucket, and adds the chapter results. Partial progress inside an unfinished lesson is not subtracted in this feature. When every chapter is complete, the progress card shows the localized course-finished message.

The estimate uses localized lesson text independently for each course language, falling back to the base-language text when a translation is unavailable. Internal videos use their positive server-owned duration metadata when present; missing or invalid metadata uses the established 180-second estimate fallback. New uploads and copied Bunny videos discover that metadata in a retryable background flow, so video processing does not hold up course editing or sharing. Resource attachments that are not embedded in lesson content do not add time, and repeated embedded occurrences are counted separately. Persisted lesson, chapter, and course projections contain exactly the base language plus the course's available locales.

## Key Technical Context

- Detailed course responses expose exact `estimatedDurationSeconds` for lessons and chapters; the frontend shared helpers in `apps/web/app/modules/Courses/utils/formatDuration.ts` own 15-minute display bucketing and display aggregation.
- Course-list fields retain `estimatedDurationMinutes` for compatibility and are derived server-side from rounded chapter projections; frontend cards and carousels do not apply a second ceiling.
- `apps/web/app/modules/Courses/CourseView/CourseStatBar/CourseStatBar.tsx` calculates remaining time at render time from incomplete lessons and does not persist a per-learner duration projection.
- Duration projections are refreshed from current course state after relevant content, structure, question, or authoritative video metadata changes; tenant and language fallback behavior remains server-side.
- Projection calculation and video metadata ownership are backend responsibilities; the frontend never supplies or overwrites canonical video length.
- Bunny webhook and watchdog paths accept provider-ready states only when Bunny also returns a positive video length; shared Bunny resources retain known source metadata and schedule target-side verification.

## Test Evidence

- Frontend utility coverage verifies zero, exact 15-minute, and just-over-boundary values; sums independently rounded chapter displays; and groups unfinished lessons by chapter before display rounding.
- Course overview, chapter, author, and progress component tests cover the visible duration and completion states. Broader course-flow E2E coverage opens the course overview and learning flows, while API course tests cover duration hierarchy responses and refresh behavior.
- Dedicated browser assertions for every duration surface, shared-video retry behavior, and migration upgrade coverage remain follow-up validation areas when the backend contract and generated client are regenerated.
