# Course Authoring And Management Business Spec

## Business Overview

Course authoring and management is the administrative lifecycle for Mentingo courses. It lets L&D teams create courses, maintain metadata, prepare content privately, publish training when ready, localize it for supported languages, manage operational settings, and retire draft material safely.

For HR and L&D teams, this is the control center for the learning catalog. It keeps course ownership, status, settings, pricing, certificates, enrollment, language variants, and export actions inside one governed workflow.

## Who Uses It

- Content creators creating and maintaining courses they own.
- L&D administrators managing the broader course catalog and publication flow.
- Course administrators configuring settings, certificates, pricing, language variants, enrollment, and ownership.
- Managing-tenant administrators exporting eligible master courses to other tenants.

## Feature Functions

- Create standard courses from the admin create workflow.
- Choose supported course types where the tenant configuration allows them.
- Browse, filter, and open manageable courses from the admin course list.
- Update course title, description, category, thumbnail, and related metadata.
- Open category management directly from the course category selector when permitted.
- Add up to five concise learning outcomes so learners can quickly understand what the course delivers.
- Keep unavailable lessons visible in the Table of Contents without letting learners open content blocked by enrollment, freemium, or lesson-sequence rules.
- Review and edit localized course metadata in the selected course language from the modern overview, including the title, description, category, learning outcomes, and curriculum titles.
- Drag and drop or browse for a course thumbnail, reposition it, and add a course trailer from the modern media editor, with server-side file validation and storage.
- Change course category and status individually or in bulk, including draft, private, and published states.
- Configure course settings such as certificate behavior and lesson sequencing options.
- Manage course pricing when Stripe pricing is configured.
- Add, switch, delete, and generate course language variants directly from the modern course overview while editing media and metadata.
- Manage course enrollment for users and groups from the course edit area.
- Create, reorder, edit, and remove chapters while maintaining the course curriculum.
- Transfer course ownership to another eligible user.
- Delete draft courses individually or in bulk while protecting private and published courses.
- Share eligible master courses with managed tenants while preserving course content, cover-image quality, trailers, and future source updates.
- Export supported courses as SCORM packages when permissions and configuration allow it.

## End-User Value

The feature gives L&D teams governance over the training library. Teams can prepare courses before learners see them, publish only when content is ready, keep accountability through ownership, and maintain multilingual versions for different learner populations.

Operational controls reduce mistakes. Permissions distinguish full course management from own-course editing, private and published courses are protected from draft-delete flows, and optional capabilities such as pricing, certificates, SCORM, and master exports appear only when the course and tenant support them.

## How It Works

Administrators start in the admin course list and open a course edit screen or create a new course. Course creation validates required metadata, then sends the user into the edit workflow where tabs expose curriculum, pricing when available, status, enrollment, and export areas. Course metadata and operational settings are managed from the modern course overview instead of a duplicate Settings tab in the legacy edit screen.

While maintaining a course curriculum, authorized administrators can create, reorder, update, and remove chapters. Removing a chapter also removes the learner progress that belongs only to that chapter, so obsolete curriculum does not leave broken learner records behind.

The edit experience adapts to course type, tenant configuration, integrations, available languages, and permissions. For example, pricing depends on Stripe configuration, AI/Luma-related tools depend on their configuration, SCORM courses hide unsupported admin features, and managing-tenant exports are shown only to eligible users.

When a managing-tenant administrator shares a master course, Mentingo creates a read-only copy for each selected target tenant and copies tenant-owned media into that tenant's storage. Course covers retain every generated size, including the highest-quality version, and an incomplete earlier copy is repaired by transferring only the missing variants. Learning outcomes, author-section visibility, and cover-image positioning are preserved when the copy is created and when later source changes synchronize to linked target courses.

Course mutations are permission-gated. Users with organization-wide course update access can edit any course, while content creators with own-course update access can edit only courses they authored. The Course Overview exposes its editor controls according to the same rule, preventing authorized users from losing access and preventing unrelated permissions from exposing actions that the API would reject. In the admin course list, permitted users can select multiple courses and use the bulk-edit menu to change their category, change their status, or delete draft courses in one governed workflow. Private and published courses must be moved back to draft before deletion is allowed. Language operations respect supported-language and base-language rules.

When a course editor lacks update access or a course image/media update fails, Mentingo returns a translatable error identifier so the interface can explain the failure in the user's active language instead of exposing a fixed English backend message.

The modern course overview uses the active interface language for learner and administrator controls. English, Polish, German, Spanish, Czech, and Lithuanian users see localized learning-mode guidance, course actions, media controls, deadlines, certificates, author information, related author courses, curriculum labels, lesson statuses, and summary statistics. The author modal shows all other published courses by the same author, including courses in which the viewer is already enrolled, while always excluding the currently open course. Cards provide practical catalog context such as enrolled learner count and estimated course duration. Selecting a related course closes the modal and opens that course directly.

Course administrators can switch the active course language from the modern overview next to the media editor. Selecting an existing language reloads the overview in that translation and preserves the selection while Mentingo resolves the language-specific course address. Selecting a new language starts the language-creation flow and can offer AI-assisted translation generation, while deleting the active translation returns the overview to the base language.

On small screens, the overview keeps the administrator settings, media, and language controls in one compact row. The language selector shows only the active language flag until the small-screen breakpoint, then restores the language name, while keeping its information and delete actions accessible. The hero keeps this toolbar, the course title, and the primary actions within both its horizontal and vertical boundaries, while reserving separate space for the course category, duration, title, and actions even when a title wraps onto multiple lines. Primary course actions remain fully inside the hero below the course title and may wrap when space is limited, so learners can still enroll, start or continue learning, and open course details, while course editors can enter or exit Learning Mode. The larger learning-outcomes summary stays hidden on smaller screens to keep the hero readable.

While editing, the course title and description use the selected course language exactly, so administrators can identify and complete those translation gaps. Learning outcomes remain useful in the Course Overview by falling back to the base-language list when the selected translation is missing or empty, including in the administrator experience.

The course title keeps its edit affordance directly beside the displayed text, making the action easy to associate with the title regardless of its length. Once editing starts, the pencil is removed so the focused title field becomes the single active control.

The category selector requests category titles in the active course language. When a category does not have that translation, it keeps the standard category-service fallback to the category's default language. Administrators with category-management access can also open the tenant's category administration page directly from the bottom of the selector.

If a chapter or lesson title is missing in the selected non-default language, administrators see a compact warning icon next to the Table of Contents edit action. Its tooltip explains that learners will temporarily see the default-language content, keeping the overview uncluttered while still making curriculum translation gaps discoverable.

The Table of Contents shows the full curriculum so learners can understand the course structure, but only lessons available to the current user are interactive. Enrollment, freemium chapter access, and enforced lesson order determine learner access, while authorized course editors can use Learning Mode or preview access to review the curriculum without weakening learner-facing restrictions. Its heading remains visible on small screens whenever no tab bar is present. On mobile, the collapsed learner view starts with the in-progress chapter and the following chapter; when no chapter is in progress, it shows the first two remaining chapters and reports the exact number still hidden.

Course statistics are available only to users with the dedicated statistics permission and are hidden while the user is in Learning Mode. If Learning Mode is enabled while Statistics is active, the overview returns to the table of contents. Course description, deadline, and media editors use accessible dialogs with keyboard dismissal and managed focus. Changing or removing group deadlines from the Course Overview preserves whether each group assignment is mandatory or optional.

Course administrators can select a trailer video in the same media editor used for the hero image. Mentingo uploads the video through the resumable video-upload flow, associates it with the course as its trailer, and refreshes course and catalog data after the media update completes.

Course administrators can add, edit, and remove learning outcomes directly from the modern course overview. The learner-facing heading presents these outcomes as “What you'll master” in every supported interface language. Mentingo displays no more than five outcomes and prevents adding another after the limit is reached, keeping the course summary compact for learners. The API applies the same five-item limit to course creation and updates.

## Key Technical Context

- Admin course pages live under `apps/web/app/modules/Admin/Courses`, `apps/web/app/modules/Admin/AddCourse`, and `apps/web/app/modules/Admin/EditCourse`.
- Main routes include `/admin/courses`, `/admin/beta-courses/new/standard`, and `/admin/beta-courses/:id`.
- Chapter editing is provided by the curriculum area and `apps/api/src/chapter`; chapter deletion removes its related learner chapter-progress data in the same database operation.
- Course create, update, bulk category update, bulk status update, settings, language, deletion, SCORM export, master export, enrollment, and ownership endpoints live in `apps/api/src/courses/course.controller.ts`.
- Master-course sharing and synchronization run as queued work in `apps/api/src/courses/master-course.service.ts`; course update snapshots detect learning outcomes, author-section visibility, and cover-image positioning, while both the create and update mappings copy those values to the target course. Copied storage references are tenant- and target-course-prefixed, and every discovered image variant is checked independently so retries repair partial copies and preserve future image sizes.
- Key permissions include `PERMISSIONS.COURSE_CREATE`, `PERMISSIONS.COURSE_READ_MANAGEABLE`, `PERMISSIONS.COURSE_UPDATE`, `PERMISSIONS.COURSE_UPDATE_OWN`, `PERMISSIONS.COURSE_DELETE`, `PERMISSIONS.COURSE_ENROLLMENT`, and `PERMISSIONS.COURSE_EXPORT`. Course Overview editor visibility follows the API update rule: `COURSE_UPDATE` applies to any course, while `COURSE_UPDATE_OWN` additionally requires matching the course author.
- The category-management shortcut is shown only with `PERMISSIONS.CATEGORY_MANAGE` and uses the tenant-relative `/admin/categories` route.
- The edit UI adapts to course type, enabled integrations, available locales, Stripe configuration, AI/Luma configuration, and managing-tenant status.
- Modern course overview translations are maintained under the shared `modernCourseView` locale namespace in every supported web locale.
- The modern overview stores the selected course language in the URL so course content, media edits, and metadata updates stay aligned with the active translation.
- The course-details service keeps editable title and description values exact to the selected language. Category names and learning outcomes retain base-language fallback behavior in both learner and administrator Course Overview experiences; missing or empty translated learning-outcome lists fall back to the course base language.
- Missing curriculum translations are reported separately from displayed chapter and lesson titles, so the warning does not change the existing Table of Contents fallback behavior.
- The modern Table of Contents reuses the established course-wide lesson-sequence calculation and course access context, keeping enrollment, freemium, preview, and Learning Mode behavior consistent with lesson delivery.
- The shared `MAX_COURSE_LEARNING_OUTCOMES` constant keeps the five-item UI and API validation rules aligned.
- Trailer videos use the existing resumable video-upload integration and the course `trailer` relationship rather than a separate upload path.

## Test Evidence

- Web E2E coverage verifies course creation, invalid create-form validation, course list browsing/filtering, opening the create page, updating settings, updating status, bulk category updates, bulk status updates, deleting draft courses, bulk deleting draft courses, transferring ownership, student-mode preview, course pricing, course language variants, SCORM course creation/import behavior, unsupported SCORM feature hiding, and SCORM export flows.
- API E2E coverage verifies draft course deletion and rejects deletion of private or published courses for single-course deletion and protected bulk selections.
- Curriculum web E2E coverage verifies an administrator can create, update, reorder, and delete a chapter; chapter API E2E coverage verifies deletion also clears the chapter's learner progress.
- Master-course API E2E coverage verifies eligible tenant selection, queued export and synchronization, read-only target copies, category and lesson updates, tenant-owned resource copying, Bunny/S3 video handling, and complete course-cover variant copying when the target already has only part of the image set.
- Source-level API evidence covers permission checks and service paths for course creation, updates, bulk category updates, bulk status updates, settings, language management, enrollment, deletion, ownership transfer, and export operations.
- Component-level coverage verifies permission-based statistics visibility and the return to the table of contents in Learning Mode, accessible keyboard dismissal for the description, deadline, and media dialogs, preservation of each group's mandatory/optional assignment status when deadlines change, complete published-course loading plus modal-closing navigation from related-author course cards, expanded lesson links to course lesson routes, and allowed trailer selection in the modern media editor. The upload service itself remains covered through the existing course settings flow and source-level integration evidence.
- Focused component coverage verifies that deleting the active course translation returns the language selector to the base language.
- Focused frontend and API schema tests verify that only five learning outcomes can be displayed or submitted and that the add action is disabled at the limit.
- Course API E2E coverage verifies exact-language title and description for editors, category and learning-outcome fallback in the administrator Course Overview, and base-language fallback for learner-facing metadata.
- Focused API and component coverage verifies that missing chapter or lesson translations produce the administrator-only warning tooltip and that completed translations remove it.
- Focused frontend coverage verifies that redirects to language-specific course addresses preserve the selected course language instead of falling back to the default language.
- Focused component coverage verifies that the category selector renders the localized and default-language fallback titles returned by the API.
- Focused component coverage verifies that permitted users receive the category-management shortcut and other course editors do not.
- Focused component coverage verifies that the course-title pencil follows the displayed title and is hidden while the title field is being edited.
- Focused component coverage verifies that the course language selector uses an accessible flag-only value on small screens, restores the language name at the small-screen breakpoint, and preserves its deletion behavior.
- Focused responsive E2E coverage verifies that the language selector, course title, and primary actions remain fully inside the hero on a small screen, the larger learning-outcomes summary remains hidden, and the administrator toolbar does not overlap the course metadata, title, or actions.
- Focused component coverage verifies that accessible lessons link to their lesson pages, while lessons blocked by enrollment, freemium content type, or lesson sequence remain visible but non-interactive; Learning Mode retains authorized access. It also verifies that the Table of Contents heading remains visible on mobile and that the collapsed mobile chapter list shows two remaining chapters when none is in progress with the correct hidden count.
