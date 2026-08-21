# Course Sharing Business Spec

## Business Overview

Course sharing lets a managing organization distribute one centrally maintained course to other organizations without rebuilding or manually updating the training in every tenant. HR and L&D teams can keep one authoritative curriculum while each recipient organization controls when its local copy is published and who is enrolled.

The managing-tenant administrator selects recipient organizations from the course editor and shares the course. Mentingo creates a read-only draft copy in each selected organization, then automatically synchronizes later content changes from the source. Recipient administrators can publish the shared course and manage enrollment without gaining access to alter centrally owned content.

## Who Uses It

- Managing-tenant administrators share centrally maintained onboarding, compliance, or skills courses with selected customer or subsidiary organizations.
- Recipient-organization administrators publish the shared course when it is ready for their learners and manage local enrollment while relying on the source organization for content updates.
- Learners receive the current centrally managed course content according to the publication and enrollment decisions of their own organization.

## Feature Functions

- Share one course with selected recipient organizations.
- Create each newly shared course as a draft so the recipient can decide when to launch it.
- Synchronize later course, chapter, lesson, category, resource, quiz, AI Mentor, and supported SCORM content changes from the source.
- Copy AI Mentor voice configuration with the shared lesson. Preset settings and localized custom provider voice identifiers are configuration values, so custom voice identifiers are preserved literally and do not require tenant asset copying.
- Preserve the recipient course's publication status when source content is synchronized.
- Let recipient administrators publish shared courses and manage participants while keeping shared content read-only.
- Show source and recipient copies as shared courses and prevent an exported copy from becoming a new sharing source.
- Offer only active organizations as sharing destinations and reject exports to inactive organizations.
- Process exports and subsequent synchronization asynchronously so cross-tenant copying is retryable and does not block the source edit request.

## End-User Value

Central course ownership reduces duplicated authoring and makes training updates consistent across organizations. Recipient teams retain operational control over rollout and enrollment, so a central content change cannot unexpectedly withdraw an already published course from learners. Read-only content and tenant-scoped copies also make ownership and access boundaries clear.

## How It Works

A managing-tenant administrator opens a course's sharing area, selects one or more active organizations, and starts sharing. Inactive organizations are omitted from the selector and cannot be supplied directly through the API. Mentingo creates a separate draft course for each recipient and copies the supported curriculum and resources in the background. The source becomes the centrally managed master, while recipient copies display a shared-course notice and restrict editing to the local controls that remain available, including status and enrollment.

When the source course or its curriculum changes, Mentingo queues synchronization for every active sharing link. The recipient copy receives the latest centrally managed content but keeps its existing draft or published status. A later sync therefore updates what learners see without making a locally published course unavailable.

## Key Technical Context

- The source workflow is exposed in the admin course editor's Sharing tab and is limited in the UI to managing-tenant administrators outside support mode.
- API export endpoints require `course.export` and the managing-tenant administrator guard; cross-tenant work runs through explicit tenant contexts.
- `apps/api/src/courses/master-course.service.ts` creates recipient courses as drafts and synchronizes existing recipient courses without owning their status.
- Source update events enqueue durable BullMQ synchronization jobs through the master-course handler and worker.
- `apps/web/app/modules/Admin/EditCourse/EditCourse.tsx` limits exported copies to the Status and Enrolled tabs, matching the product boundary between central content ownership and local rollout control.

## Test Evidence

API E2E coverage verifies managing-tenant authorization, active-recipient selection, rejection of inactive recipients, initial draft creation, read-only exported content, localized course/category copying, repeated sharing behavior, resource and video handling, category synchronization, and source deletion propagation. Regression coverage also verifies that after a recipient publishes its shared copy, a later source update synchronizes content without changing that published status.

There is no dedicated Playwright E2E flow for tenant-to-tenant course sharing; the UI workflow and local controls are evidenced by the course editor implementation and translations rather than browser-level coverage.
