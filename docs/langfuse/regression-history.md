# Historical failures covered by the AI evaluation baseline

These are synthetic regression reconstructions informed by issue descriptions,
reviewed fixes and repository tests. They are not copies of customer transcripts,
historical model outputs or production source files. A proposed behavior in an
issue is distinguished from a demonstrated fix. None of these references proves
that a current deployed model passes the new evaluations.

## Failure families and independent expectations

| History                                                                                                                                        | Regression to detect                                                                                                            | Expected evidence and decision                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Core #2018](https://github.com/Selleo/mentingo/pull/2018), [evaluation issue #2019](https://github.com/Selleo/mentingo/issues/2019)           | A denial of accessing a client system is interpreted as an admission and fails a learner                                        | PL/EN minimal pairs change only negation, actor, quotation or tense. Compare the final verified blocking-error identities and pass/fail against independent expected labels. Own-account activity, third-party/mentor statements, quotation and hypothetical actions must not become the learner's completed forbidden action. Actual admissions must still be detected. |
| [Core #2040](https://github.com/Selleo/mentingo/issues/2040)                                                                                   | A single raw Luma Judge response is mistaken for the complete verified assessment workflow                                      | Invoke the Core assessment endpoint when testing initial assessment plus independent blocker verification. A direct Luma generation tests a different operation. Inspect final response and owned-thread state; missing/invalid verification cannot silently complete the attempt.                                                                                       |
| [Core #2013](https://github.com/Selleo/mentingo/pull/2013)                                                                                     | Mentor repeatedly introduces the scenario, repeats checklists, or stops reacting to the latest turn                             | Capture the entire conversation and judge relevance to the latest learner statement, continuity, role ownership and unnecessary repetition. Fluent text alone is insufficient. Use fresh threads with pinned effective prompt versions.                                                                                                                                  |
| [Core #2089](https://github.com/Selleo/mentingo/pull/2089), [attachment discovery issue #1493](https://github.com/Selleo/mentingo/issues/1493) | Attachment-only lessons cannot be found, or an attachment match is misrepresented as evidence from lesson body text             | Distinguish body text, attachment filename and readable attachment passages. Preserve authorized lesson IDs and source provenance. Metadata-only matches cannot establish the contents of an unread file. Access/tenant checks remain deterministic.                                                                                                                     |
| [Core #1634](https://github.com/Selleo/mentingo/issues/1634)                                                                                   | Search says no relevant material exists while citing the requested section in the same answer                                   | Supply a bounded source excerpt and a matching query. Reject contradictory no-evidence claims when the captured retrieval actually contains the required section; distinguish unavailable tools from a verified empty result.                                                                                                                                            |
| [Core #1634](https://github.com/Selleo/mentingo/issues/1634)                                                                                   | Course generation ignores an explicit user-provided structure                                                                   | Compare approved chapter/lesson identities, titles, order and types with generated artifacts. Extra, missing, merged or reordered required units cannot be hidden by a high prose-quality score.                                                                                                                                                                         |
| [Core #1357](https://github.com/Selleo/mentingo/issues/1357)                                                                                   | A generated Mentor has no usable context from the selected source files                                                         | Require scenario-relevant source facts in the internal briefing and appropriate attached/reference context. A learner task description or merely saying a file was attached does not prove the Mentor can use it.                                                                                                                                                        |
| [Luma recovery commit 7956a26](https://github.com/Selleo/mentingo-ai/commit/7956a2613eef6db2768e2f946e1509d894cdd2ca)                          | Accepted lesson work is lost or an incomplete course is reported as complete                                                    | Preserve all approved lesson IDs and task terminal states. Failed units remain explicit and recoverable; generated successes do not remove failures from the denominator. The original generic provider error does not establish its underlying cause.                                                                                                                   |
| [Luma #60](https://github.com/Selleo/mentingo-ai/pull/60)                                                                                      | Replacing a lesson loses its position, changes unrelated content or deletes the old lesson prematurely                          | Check replacement create/delete identities, ordering, dependencies and baseline scope; require transactional Core receipt and readback before claiming application success.                                                                                                                                                                                              |
| [Luma #61](https://github.com/Selleo/mentingo-ai/pull/61)                                                                                      | A generated Mentor's structured voice selection disagrees with its intended persona, or an unrelated edit resets a custom voice | Check explicit `voiceMode`, `ttsPreset` and preserved custom voice references. This is configuration fidelity. Audible voice quality, missing spoken words and interruption quality require retained audio and a separate listening review.                                                                                                                              |
| [Core #2079](https://github.com/Selleo/mentingo/pull/2079)                                                                                     | Application failure loses its actionable reason or a mismatched export is accepted as success                                   | Preserve the typed failure category and verify immutable identities/hash before trusting receipts. A completed generation or queued application is not an applied native course.                                                                                                                                                                                         |
| [Core #2096](https://github.com/Selleo/mentingo/pull/2096), [Plugins #12](https://github.com/Selleo/mentingo-plugins/pull/12)                  | Healthy deployment or a sent Slack reply is reported as successful Core transcript synchronization                              | Capture signed transcript delivery and the actual Core acknowledgement separately from agent output and Slack delivery. An HTTP 401 or pending outbox is failure/incomplete evidence, regardless of a successful deployment or agent response.                                                                                                                           |

Slackbot also reconstructs thread-context failures from its lesson-read,
follow-up and grounding fixes: a Polish referent must resolve to the right lesson,
a greeting must not restart an old search, and an MCP failure must not be narrated
as a successful lookup. Its dataset records the relevant repository commit for
each family.

## What the evaluators establish

There are three different checks, with separate reporting:

1. **Application regression oracles:** expected IDs, blocker sets, saved state,
   source/scope boundaries, receipts and explicit failure states. A semantic
   judge cannot override a failed invariant.
2. **Semantic evaluators:** inspect captured candidate output against supplied
   facts, conversation and behavior rubrics. They return dimension verdicts with
   verifiable evidence anchors. Invalid responses, invented quotes and missing
   artifacts cannot yield a successful evaluation.
3. **Evaluator calibration:** paired acceptable and defective synthetic outputs
   test whether a judge agrees with the expected labels. Mocked provider tests
   verify the evaluator's request, validation and reporting logic. Only an actual
   opt-in judge run measures model discrimination; synthetic labels still need
   independent domain review before becoming validated gold.

Keep each minimal-pair/scenario family in one calibration or held-out split.
Do not tune prompts on one member of a pair and call the other a holdout.
Capture errors, timeouts, insufficient evidence and provider refusals alongside
the successful cases. Record the dataset hash, effective evaluator prompt/model
configuration and actual application evidence used for every comparison.

The new provider adapters are opt-in. Ordinary unit tests use controlled provider
responses and do not run models, upload to Langfuse, or modify live evaluators.
The PRs prepare reproducible evaluation; empirical quality and regression results
remain pending until the actual reviewed application and judge runs are executed.
