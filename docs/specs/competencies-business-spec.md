# Competencies Business Spec

## Business Overview

Organizations can describe the capabilities a job requires, check each person's current confirmation and plan work for missing requirements. Employees see what is expected of them and which evidence or development action comes next. Managers compare their current teams with job profiles, while designated verifiers confirm observations and review documents.

Mentingo supplies people, reporting relationships, courses and learning results. The connected competencies plugin owns the catalog, evidence, confirmation rules, job requirements and development actions. These are separately entitled for each organization.

## Who Uses It

- Employees review their own requirements, complete linked courses and submit documents for designated review.
- Group managers inspect their current teams, assign an active job profile and coordinate practical work, mentoring or courses for actual gaps.
- Designated verifiers review evidence for their assigned observation and document conditions, recognize prior qualifications and revoke confirmation with a reason.
- Competency administrators inspect employees and their job profiles, make reasoned condition overrides, and maintain definitions, ordered levels, condition verifiers, job profiles in the organization's current catalog.

## Feature Functions

- Compare current confirmation with all of a job's required levels.
- Combine course completion, quiz scores, AI Mentor assessments, observations and documents under the same conditions.
- Confirm a level only when its conditions and all lower-level conditions are satisfied.
- Retain attained levels and decision history when evidence expires, changes or is revoked.
- Recognize specified current conditions through a documented decision, and let administrators override a condition outcome with a required comment and retained history.
- Turn gaps into actions with an owner, optional due date and visible progress, including confirmed course assignments.
- Maintain the organization's current competency catalog and job profiles, and assign or remove a person's active job profile.

## End-User Value

Employees can see the remaining work behind a missing confirmation instead of repeating requirements that are still satisfied. Managers can distinguish missing job requirements from expiring evidence and coordinate the appropriate learning or practical activity. HR and L&D can reuse one competency across several positions while retaining evidence and the reasons for human decisions.

## How It Works

Administrators start in **Competencies**, followed by **Job Profiles**. Employee inspection and other operational tabs follow these configuration areas; general settings are last. The organization maintains one current catalog directly. Saving updates the current definition while retaining historical evidence and achievements. An administrator configures named levels and the evidence required for each level. They select competencies and required levels in a labeled, scrollable section of the job profile editor. Every selected competency is required. Saving creates or updates an active profile immediately, without a draft or publication step. A manager or administrator assigns or clears one active profile from the employee list, restricted to the people they can plan for. Changed requirements immediately update current comparisons. Administrators can delete an unassigned profile from its editor after confirmation; assigned profiles must first be unassigned. Deletion retains revision history and existing evidence, achievements and development actions.

Each distinct condition needs one fulfillment, such as completing its specific course or receiving one approved confirmation. Several different requirements are separate conditions. Course, quiz and assessed AI Mentor conversation conditions are fulfilled automatically from their learning results and have no verifiers. Administrators assign verifiers only to observation and document conditions; a verifier may review or revoke evidence only for those conditions assigned to them. Assigned employees see **Approval** without manager or administrator rights. A verifier who also manages a group can review designated evidence from outside that group. Verifiers can choose an active person and open their assigned competency details directly from a review item; they do not need earlier evidence about themselves to discover the person.

Every role enters through **Competencies** in the main navigation. The employee's **My Competencies** tab shows their position, fulfilled requirements and next development step. Competency details distinguish the current level and category, numbered level requirements, condition types and statuses. The employee's own competency details and Documents tab omit evidence history and previous submissions; authorized inspection views retain history. The **Documents** tab lists missing required documents and documents for renewing expiring attained levels, including levels above the job requirement, with a visible submission action and pending status. A pending document prevents duplicate submission for the same condition. An employee or their current manager selects the document condition, writes a note and can attach a supporting file. The condition fixes the evidence type; the actor does not choose between observation and document. Documents remain pending until a designated verifier approves them. Only a verifier assigned to an observation condition can record and confirm it directly for another person; an employee does not submit an observation. Self-assessment is forbidden even when the employee is a designated verifier. Authorized administrators can still designate themselves to assess other people. Optional evidence dates use the same calendar and time controls as other Mentingo forms.

The employee's development plan shows unmet conditions at the required levels, even before a manager creates an action. Plan rows are static and do not expand. Applicable course and Documents actions appear on the right of the row. Current planned actions cover matching steps without duplicating them, completed actions remain visible, and cancelled actions are excluded. Document actions link to the Documents tab. Expiring competency rows also have a separate details button instead of making the whole row clickable. The next-step card uses the same requirements. Digital results arrive from Mentingo, and human confirmation does not waive other conditions.

Each confirmation starts at the latest fulfillment of its applicable conditions and ends at their earliest finite expiry. Without a finite condition expiry, no expiry date is calculated. Expiry of a lower condition invalidates dependent current levels while preserving the highest attained level. Renewing the missing condition restores the stack when its other conditions remain satisfied.

Prior recognition covers the selected conditions as they exist at the time of the decision. It requires a note and can include an attachment. New or changed conditions require separate fulfillment. Revocation also requires a recorded reason.

A submission covering several manual conditions requires a common designated verifier; incompatible selections are rejected without creating pending work. Verifier-only access to a peer's competency does not reveal that peer's assigned job profile. Archived or deleted employees retain their history, while new evidence reviews and development-action changes are blocked.

Administrators open **Employees** to inspect every active employee in their organization, including people with no competency records yet, their assigned job profile and current competency conditions. Managers use the same inspection layout for their currently managed people. The competency selector opens condition details even when the person has no assigned profile. Managers cannot override condition outcomes. An administrator can mark any condition as met, including a course condition without completing the course, or restore automatic evaluation. Every change requires a comment and retains its author and time in history. The change affects competency assessment only; learning progress, course completion and certificates stay as recorded in Mentingo. A changed condition requires a new decision. The editor distinguishes the applicable decision from older history, and the highest attained level is retained even when a manual grant is restored to automatic evaluation before anyone reads the assessment.

Managers filter **Team Competencies** by the current position assigned to their people. Every summary, attention item and readiness count uses the same filtered people as the corresponding matrix. Changing a person or matrix position keeps the page header and filters visible while the data region loads. Submitted document history uses server pagination in authorized inspection views.

Managers open **Development Plans** to review actions for their whole managed team in server-paginated lists. Cancelled actions are omitted while their records remain retained. **Create plan** in the page header opens the existing planning form, where they choose an employee and an actual competency gap. Opening an action in the table shows a labelled detail dialog with a full-width status control, separate footer actions and a structured, server-paginated change history. Action details and history have no expansion controls. Managers can amend an action's objective, owner, due date and state. Completing a practical action does not itself confirm a competency. A course action reports assignment as pending until Mentingo confirms it; retries reuse its receipt. Course repetition remains the existing explicit learner action for courses whose editors have enabled repetition.

Coverage counts satisfied profile requirements divided by all profile requirements. An empty or unassigned profile is not assessed. An organization can set an expiry-warning horizon; there is no default horizon. Position and manager changes preserve achievements and development actions, while access follows the current reporting relationship.

The team view and matrix treat all selected competencies as requirements. Competencies outside the selected profile do not appear as matrix columns.

The matrix groups employees by their assigned job profile. Its header offers the profiles represented in the current team, or shows the profile name when there is only one. Search sits above the table beside a color legend. Each employee row shows their name and compact required-level tiles, with status markers showing whether current confirmation meets that requirement or is expiring. A short tooltip summarizes the requirement status and level. Accessible labels retain the actual and required levels.

Administrators edit validation conditions directly in **Competencies**. **Settings** contains expiry-warning settings. Loading, unavailable and failed requests use the normal application page layout and feedback components, with a retry action after a failed read.

The approval workspace places pending submissions first, with processed evidence in a separate paginated history below. Both lists use current condition-verifier assignments and exclude self-assessment. Evidence cards show their contents directly. Managers and administrators inspecting another employee see neutral next-step wording. Paginated development plans retain readable actions for inactive or deleted employees, with editing disabled, so the displayed rows match the server's totals.

## Key Technical Context

- `/competencies` is a core workspace built from the generated API client and existing UI components. Browser input cannot supply an actor's permissions or reporting scope.
- Core authenticates the user and sends current scope through the server-side SDK. The plugin additionally enforces its own competency-specific verifier lists and tenant entitlement.
- Learning evidence contains identifiers, source revisions, fulfillment time, assessment outcome and actual certificate expiry. It excludes course content, conversations and hidden AI criteria. Source events trigger retryable delivery, and opening a workspace refreshes digital results for the people the user can currently access. Competencies do not scan tenants on a timer.
- Catalog, evidence, revisions and actions live in the private plugin's tenant-bound catalog storage. Attachments use private object storage and are authorized on each download.
- Disabling the plugin preserves its records and blocks protected operations and automated processing.
- Administrators with environment-management access can connect the competencies service from `/admin/envs` using its service URL and tenant API key. The existing secret fields require explicit reveal before editing, and saving refreshes competency availability. The platform must also grant competency access to the organization.

## Test Evidence

The environment-settings form regression verifies explicit field reveal, saving the service URL and tenant API key, and refreshing competency availability after saving.

Plugin domain and API tests cover direct verifier observations, rejected self-assessment, document submission by employees and managers, rejected verifier-only document submission, cumulative conditions, condition-derived dates, retained achievements, recognition revisions, verifier designation, tenant boundaries, assignment receipts and private attachments. Profile tests cover immediate activation and updates, deletion permissions, revision conflicts and assigned-profile protection. Catalog migration and backup/restore tests include competency data.

Core unit tests verify trusted context, rejected references, source withdrawals, retry recovery and current authorization before course enrollment. UI tests cover visible required-document submission, condition-derived evidence kinds, the shared calendar, no employee observation action, the managed-team plan scope, required employee selection, compact matrix labels, grouped confirmation methods, profile assignment, comparison recovery and profile deletion confirmation. Database integration tests verify stable completion dates, real certificate expiry, quiz and AI assessment facts, distinct learning-state references after repetition and original attribution through account renaming, archive and soft deletion. Browser acceptance uses an already connected test tenant and checks all four workspaces, including Polish and English navigation, whole-team plans, narrow layouts, all required matrix competencies; its run results are recorded separately from this capability description.
