# App-wide self-onboarding coverage

This inventory describes registered recording contracts, not a library of verified finished videos.
The catalog covers all 30 user-facing route areas and the 59 app business specifications currently
in `docs/specs`. It contains 224 explicit flows, assigned exactly once to 91 stable video groups per
language. Groups contain one to three related flows. English and Polish therefore allow up to 182
video variants for this inventory; an individual build selects affected groups rather than requiring
all of them to be generated together.

The public source of area keys, page mappings and business-spec ownership is
`packages/shared/src/constants/self-onboarding-areas.json`. The recording source is
`.agents/skills/release-film/projects/mentingo-self-onboarding.json`. Area keys remain metadata used
for contextual help and semantic filtering. They do not limit the text query to a topic filter or force
AI search. Workflow selection by business spec maps to these same recording features.

| Area key | Registered flows | Stable video groups | Source business specifications |
| --- | ---: | ---: | --- |
| `development-paths` | 20 | 7 | `learning-paths` |
| `course-authoring` | 32 | 13 | `course-authoring-management`, `course-overview-management`, `curriculum-lesson-builder`, `ai-course-generation`, `ai-course-translation`, `course-duplication`, `course-sharing`, `course-authoring`, `resource-library`, `course-duration-estimates`, `learning-time-tracking` |
| `course-learning` | 16 | 6 | `lesson-delivery-learning-mode`, `course-enrollment`, `course-repetition`, `quiz-assessment-engine`, `scorm-support`, `course-discussions`, `certificates`, `learning-time-tracking`, `course-duration-estimates` |
| `knowledge-base-articles` | 11 | 4 | `knowledge-base-articles`, `knowledge-base` |
| `news` | 11 | 4 | `news-hub` |
| `authentication` | 7 | 3 | `authentication-account-access`, `mentingo-mcp` |
| `dashboard` | 9 | 4 | `personal-dashboard`, `featured-course`, `global-search`, `onboarding-tours`, `self-onboarding` |
| `assistant` | 5 | 3 | `assistant` |
| `ai-mentor` | 4 | 2 | `ai-mentor-lessons` |
| `phishing` | 4 | 2 | `phishing-simulation` |
| `content-marketplace` | 4 | 2 | `content-marketplace` |
| `notifications` | 4 | 2 | `announcements-notifications` |
| `personal-settings` | 11 | 4 | `organization-settings`, `language-localization`, `platform-branding-theme`, `registration-form-builder`, `role-permission-management`, `support-mode`, `dynamic-pwa-branding` |
| `provider-information` | 2 | 1 | `provider-information` |
| `profiles` | 3 | 1 | `user-management`, `personal-dashboard`, `statistics-analytics` |
| `calendar` | 4 | 2 | `calendar` |
| `reports` | 4 | 2 | `reports`, `statistics-analytics` |
| `qa` | 5 | 2 | `qa` |
| `live-training` | 5 | 3 | `live-training` |
| `environment-configuration` | 3 | 1 | `environment-integration-configuration` |
| `users` | 10 | 4 | `user-management`, `group-manager` |
| `automations` | 5 | 2 | `automations` |
| `email-templates` | 7 | 3 | `email-template-builder` |
| `categories` | 6 | 2 | `category-management` |
| `groups` | 5 | 2 | `group-management`, `group-manager` |
| `promotion-codes` | 3 | 1 | `billing-promotion-codes` |
| `activity-logs` | 2 | 1 | `activity-logs` |
| `ai-conversations` | 2 | 1 | `ai-conversations` |
| `tenants` | 5 | 2 | `tenant-administration` |

| `competencies` | 15 | 5 | `competencies` |

## Evidence and boundaries

Each contract references the actual web/API source roots and business specs for its area and states
its audience, prerequisites, actions and expected result. The pre-existing 81 flow contracts and 29
video groups retain their IDs and contents. Additional course contracts explicitly include AI course
generation and translation, duplication, resource reuse/privacy, AI Mentor authoring, automatic
duration estimates and learner engagement reports. Learner duration guidance and Assistant dictation
also have separate groups. Learning-time tracking itself is background behavior; the recorded user
operation is inspecting its statistics, without pretending a still screenshot proves timing internals.

`validate_app_coverage` checks every public area has a recording feature, public spec assignments are
present, every referenced spec exists, each contract has actual implementation evidence, page keys
match the canonical registry, and no app business spec is unassigned. Catalog validation separately
checks flow IDs, stable video keys and exactly-once assignment into groups of at most three. Removed
legacy watch paths may remain for change detection when other current implementation evidence exists.
Tests also retain a fingerprint of the original contracts and groups to detect accidental rewrites.

Two utility destinations are explicitly outside contextual area suggestions: `/tenant-inactive`
displays availability state rather than a usable product task; `/helpdesk/tutorials` is the tutorial
playback destination itself. Account OAuth consent belongs to Account access. The
`release-films-business-spec.md` is excluded from the app capability audit because it describes
production infrastructure, rather than an end-user feature. The self-onboarding business spec is
part of Dashboard's global search/help flows.

## Recording prerequisites

Registration in this inventory is source-backed scope, not evidence that every feature is enabled
in a particular tenant or that all its fixtures have already been implemented for the recorder.
Recordings still need isolated localized seed data, the intended feature flags, role permissions,
and the target version's working UI. Native Polish UI and example data must be recorded separately
from English. The semantic coverage review remains authoritative for a target version; newly
identified tasks require explicit contracts and group assignments before complete coverage can be
claimed. This inventory is not a proof of exhaustive behavioral test coverage.

AI generation, translation, transcription, Mentor voice/practice and semantic search require their
configured isolated providers or provider fixtures. Calendar authorization requires a Microsoft
sandbox. Phishing uses only a sandbox service and synthetic sink recipients. Live training needs
an isolated room service with fake media. Billing/promotion flows use test mode and never charge a
real account. Environment settings and integration keys use disposable dummy values; raw keys and
credentials must be masked or cut from public footage. Tenant, user and resource deletion operate
only on explicitly disposable synthetic targets. Mail links use the isolated mail viewer.

Competencies recordings require an entitled isolated tenant connected to the competencies plugin and synthetic evidence, with real permission and verifier boundaries.

Missing prerequisites must produce an explicit failed/skipped flow in build reports, with other
independent flows continuing. They must never produce fabricated browser success, omit the flow
from the required inventory, or claim a complete published guide. No new hosted recording,
provider request, Bunny upload, indexing, playback check or production deployment was performed
as part of this app-wide registration change.
