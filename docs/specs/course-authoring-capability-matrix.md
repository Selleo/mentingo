# Course authoring assistant capability matrix

This matrix describes the course-authoring assistant in the current Core and AI worktrees (2026-10-29). It is not a catalogue of every capability elsewhere in Mentingo. **Supported** means an implementation path exists, not that every model/provider outcome has been verified live. The authenticated actor, tenant, current course, selected targets, language and request permissions always constrain access.

## Read and understand

| Capability | Availability | Boundary |
| --- | --- | --- |
| Look up the current course | Supported | Read trusted course metadata, visibility status, supported settings and chapter/lesson outline. |
| Look up selected lesson content | Supported | Core supplies authorized native content for selected lesson IDs; an outline/title alone is not proof of reading the lesson. |
| Read content lessons, quiz definitions and AI Mentor configuration | Supported | Selected native details within the current course and language; no learner attempts or conversations. |
| Search arbitrary courses across the tenant | Not exposed here | The authoring session is bound to one course. Do not promise a cross-course catalogue search. |
| Read another tenant's courses or files | Not allowed | Tenant and actor authorization remain enforced by Core and source ownership checks. |
| Read attached PDF, DOCX, TXT and Markdown files | Conditional | Files must be uploaded, processed and selected for this request. Excluded sections and descendants stay excluded. |
| Read whole selected documents in order | Supported | Bounded pages with continuation and coverage metadata; a first page or search result is not a whole-document read. |
| Search selected document passages | Supported | Session-owned indexed evidence and selected source versions only. |
| Analyze PDF native text once and reuse it | Supported | Saved per-source/window analysis and grounded extracts; partial/failed analysis retains readable native text and explicit limitations. |
| Interpret PDF images, scans or table layout | Conditional | Requires configured PDF vision/OCR and readable results. Native text extraction alone does not verify diagrams or layout. |
| Read previous questions, answers and proposal notes | Supported | Bounded session history and revision-scoped draft notes; old turns cannot grant new permissions. |
| Check running, waiting, completed or failed work | Supported | Durable task status for this authoring session, not an estimate of unseen external work. |

## Research

| Capability | Availability | Boundary |
| --- | --- | --- |
| Run public web searches | Conditional | Web access must be enabled or explicitly allowed by the author. Autopilot cannot grant it. |
| Read a supplied public page URL | Conditional | Uses the web-research permission and page-fetch restrictions; a URL is not permission to access private services. |
| Perform deeper research | Conditional | Research-depth/capability controls and runtime budgets apply; independent of Fast/Balanced/Thorough model effort. |
| Reuse saved research | Conditional | Permitted session evidence must be selected/available to the request. |
| Use general knowledge | Conditional | Governed by source policy. It is not proof of specific product claims or missing facts. |
| Search private sites, arbitrary drives or authenticated third-party systems | Not exposed here | No general browser, drive or authenticated connector tool in this authoring flow. |
| Turn document instructions into permissions | Not allowed | Source text is evidence, not authority to enable tools, change scope or reveal private material. |

## Create and change courses

| Capability | Availability | Boundary |
| --- | --- | --- |
| Ask about audience, goals, duration and depth | Supported in both modes | Ask focused questions when material information is missing; reuse prior answers. Autopilot is not “choose for me.” |
| Draft an outline and detailed lesson plan | Supported | Respect the brief, selected evidence, approved structure and lesson types. |
| Create or update theory lessons | Supported | Human-readable theory with clear progression. No learner exercises, assessment questions or assignments inside content lessons. |
| Create or update quizzes | Supported | Native supported assessment types/settings; assessment belongs in quizzes or AI Mentor. |
| Create or update AI Mentor lessons | Supported | Native teacher/roleplay configurations, supported judge and voice settings; retain requested Mentor lessons through planning and application. |
| Add chapters or lessons, including lessons in several chapters | Supported | Explicit targets and complete grouped proposals; no silent scope expansion. |
| Revise selected blocks or lesson metadata | Supported | Supported native blocks/fields and current baseline required. |
| Reorder or delete chapters/lessons | Supported | Explicitly resolved author intent, authorized target scope and validated operation; ambiguity must be clarified. |
| Update course title/description and supported settings | Supported | Schema allowlist only: lesson sequence, quiz feedback, video completion tracking and supported certificate appearance/validity/signature fields. |
| Generate or attach visual assets | Conditional | Configured asset capability/provider, source policy, asset readiness and explicit retry rules apply. |
| Generate arbitrary video, podcast or SCORM lesson bodies | Not supported by this operation contract | Do not confuse available Mentingo media features with authoring operations. |
| Translate/rewrite supported course content | Supported | Explicit content language and authorized targets; not arbitrary language administration. |
| Publish a course or change public/private visibility | Not supported here | Visibility can be read, but publication/access changes are outside the mutation allowlist. |
| Enroll users, change roles, access learner results or issue certificates | Not exposed here | Course authoring is not a learner-management or reporting tool. Certificate settings are distinct from issuing certificates. |
| Apply validated changes to the course | Supported through Core | Revision/baseline, permission and application fences still apply. Conflict is not permission to overwrite newer changes. |

## Review changes versus Autopilot

| Decision | Review changes | Autopilot |
| --- | --- | --- |
| Missing material audience, goals or learner time | Ask the author | Ask the author |
| Missing source facts, ambiguous target or new web permission | Ask the author | Ask the author |
| Approve a valid proposed outline | Author reviews | Automatic |
| Approve completed, eligible changes | Author reviews | Automatic |
| Apply the exact validated change set | Explicit apply flow | Automatic through Core |
| Bypass quality blockers, permission checks or stale baselines | Never | Never |
| Publish or broaden access | Unavailable | Unavailable |

After a clarification answer, the request retains its selected mode. Autopilot continues automatic approvals/application; it does not answer substantive questions for the author. Authors can stop work. A stop before application freeze prevents a new automatic application; an already frozen application uses its existing recovery/idempotency rules.

## Source of truth and maintenance

This Markdown file documents the capability boundary; it does **not** grant tools or replace runtime checks. A row marked conditional must be evaluated against actual request capabilities. Update this matrix when tools, operation schemas or approval semantics change. Do not claim unsupported actions succeeded.

Core evidence:

- [Authorized context and selected native content](../../apps/api/src/luma/course-authoring-context.service.ts)
- [Durable context bridge](../../apps/api/src/luma/course-authoring-context-bridge.service.ts)
- [Native operation allowlist](../../apps/api/src/luma/schema/course-authoring-operations.schema.ts)
- [Application checks](../../apps/api/src/luma/course-authoring-application.service.ts)
- [Authoring business workflow](course-authoring-business-spec.md)

Companion `mentingo-ai` evidence (paths relative to that repository):

- `apps/api/src/app/services/authoring/routing_nodes.py`: bounded read tools, semantic routing and research permission decisions.
- `apps/api/src/app/core/authoring/question_policy.py` and `graph.py`: focused intake and durable question interruption/resumption.
- `apps/api/src/app/core/authoring/contracts.py`: supported operations, lesson schemas and source policy.
- `apps/api/src/app/services/authoring/evidence.py`, `source_analysis.py` and `source_page_ocr.py`: source scope, analysis and OCR reuse.
- `apps/api/src/app/services/authoring/autonomous_outline.py`, `autonomous_completion.py` and `autonomous_control.py`: approval and application fences.

Validation: checked against the current implementation paths above. Clarification changes passed 1,836 AI authoring unit tests and 10 disposable-database autonomous fence tests. This is not a live-model evaluation of every matrix row.
