# Course Authoring and Management Business Spec

## Business Overview

Mentingo lets HR and L&D teams build courses, prepare them privately, publish them when ready, and maintain them throughout their life in the learning catalog. Editors can keep the curriculum, media, translations, enrollment, and ownership together while reviewing how learners progress.

An administrator can create a course, add chapters and lessons, assign learners, and release it to the right audience. Content creators can maintain courses they authored; administrators with broader access can manage the catalog across authors. Courses can also be packaged for reuse or shared with managed tenants.

## Who Uses It

- Content creators build and update their own training courses, then review learner outcomes for those courses when they have statistics access.
- L&D administrators manage the wider catalog, including publication, assignments, ownership, and reporting.
- Managing-tenant administrators share eligible master courses with other tenants so teams can reuse approved training.
- Learners see the published course description, outcomes, and curriculum, then access lessons according to enrollment and course rules.

## Feature Functions

- Create available course types, organize chapters and lessons, and maintain titles, descriptions, categories, images, trailers, and up to five learning outcomes.
- Prepare language versions of course content, switch between them while editing, and spot missing translations.
- Publish, move to private or draft, archive, restore, or delete eligible draft courses; apply supported category and status changes to multiple courses.
- Configure course settings, certificates, sequencing, pricing when available, learner and group enrollment, and group assignment deadlines.
- Transfer course ownership and review completion, learning time, quiz, and available AI Mentor results for courses the user manages.
- Share eligible master courses with managed tenants and synchronize later source changes to their read-only copies.
- Export supported courses as SCORM packages or download an editable Mentingo package; import a Mentingo package to create a draft in the destination tenant.
- Let learners inspect the course structure while keeping lessons they cannot yet access visible but unavailable to open.

## End-User Value

L&D teams can prepare training before release, keep responsibility clear through ownership, and deliver localized courses to different learner groups. Bulk actions and reusable packages reduce repetitive catalog work. Enrollment and progress views help administrators coordinate assignments and assess whether training is working.

Learners get a clear course summary and curriculum, while enrolled learners keep their progress when a course is archived. Tenant sharing and course packages help organizations reuse authored material without rebuilding it from scratch.

## How It Works

An administrator starts from the course list, creates a course, and opens its editing experience. The curriculum area supports chapter and lesson changes. The modern Course Overview holds the course title, description, category, learning outcomes, media, and settings; the edit area exposes status, enrollment, pricing when available, and sharing. The course list supports filtering and bulk category, status, archive, and eligible draft-deletion actions.

Editors can select a course language from the overview. Title and description editing shows the selected language's actual values so translation gaps remain visible. Category titles and learning outcomes can fall back to the base language, and a warning identifies incomplete translations. Editors can add up to five learning outcomes and upload or reposition a cover image or add a trailer. Learners see the curriculum, but enrollment, freemium access, and lesson order determine which lessons they can open.

An editor can archive a course from the list or its settings and later restore it. Archived courses leave discovery and self-enrollment, but existing learners retain access and progress. Administrators can still assign learners. Private and published courses must return to draft before deletion. Removing a chapter also removes progress tied only to that chapter.

Administrators can assign users or groups to a course. Group deadlines can be changed without changing whether each assignment is mandatory or optional. Eligible editors can open Statistics to review completion, progress, learning time, quiz results, and available AI Mentor outcomes. The statistics view is hidden in Learning Mode and cannot be opened for another author's course solely through a direct link.

For reuse, an editor can download a Mentingo package ZIP from the course sharing area. A creator selects the package option in the new-course flow, uploads the ZIP, and sees the imported course when processing finishes. The destination course receives its own tenant-specific ID while retaining the source identity for repeat-import detection. It belongs to the importer, starts as a free draft, and reuses a destination category when its base-language title matches. Learner enrollments and progress are not imported. Reimporting an existing course leaves it unchanged and shows a notice. Imported live training keeps its authored schedule and materials and prompts an editor to review them; the reminder does not block publication.

Managing-tenant administrators can instead share a master course with selected tenants. Those tenants receive read-only copies, including course media; later source changes can synchronize to the copies. SCORM export is a separate delivery format from both Mentingo packages and tenant sharing. Available course types and editing options depend on course type, tenant settings, connected services, and the user's access.

## Key Technical Context

- Admin course management lives in `apps/web/app/modules/Admin/Courses`, `AddCourse`, and `EditCourse`; the modern Course Overview supplies language-aware metadata and media editing. Core course operations live in `apps/api/src/courses/course.controller.ts`.
- Course creation, own-course editing, any-course editing, enrollment, statistics, deletion, export, and category management have separate permission checks. Statistics additionally requires access to the specific course. Group deadline editing requires course-enrollment and group-read access.
- Archive state is separate from draft, private, and published status. Catalog and direct-course access enforce archive visibility while retaining access for enrolled learners.
- Mentingo package export and import live in `apps/api/src/native-archive`. ZIPs contain a versioned manifest and checked assets; tenant-scoped background jobs process them. Import maps source identities to destination IDs and checks for an existing course before creating one.
- Master-course sharing and synchronization run as queued work in `apps/api/src/courses/master-course.service.ts`; copied media belongs to the target tenant. Course language selection stays in the overview URL, and shared language and learning-outcome rules keep the UI and API aligned.

## Test Evidence

- Web end-to-end tests cover course creation, list and bulk actions, settings, status, pricing, language variants, SCORM, chapter editing, and responsive Course Overview behavior. Focused component tests cover editing controls, translation warnings, learning outcomes, media selection, statistics visibility, and access-limited lessons.
- Course API end-to-end tests cover draft deletion, archive and restore visibility, enrolled access, statistics access for own versus other authors' courses, localized metadata, and chapter-progress cleanup. Master-course tests cover tenant sharing, synchronization, and media copying.
- Mentingo package API end-to-end tests cover course export, tenant-scoped import, chapter and lesson content, live training, SCORM assets, repeat import, permission rejection, and background job processing. ZIP and upload tests cover format validation and resumable transfer. A web component test covers selecting a ZIP for import; a browser end-to-end import and export journey is not yet covered.
