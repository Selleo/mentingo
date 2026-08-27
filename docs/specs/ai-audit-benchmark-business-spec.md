# Audit and Benchmark — Business Specification

## Business Overview

Audit gives learners and school leaders a short, repeatable way to assess AI readiness. Benchmark turns completed School Audits into a comparison between participating schools and connects identified development areas to relevant learning in Mentingo.

The predefined questionnaire produces an overall score, a capability or department breakdown, and a paced learning roadmap. Previous attempts remain available so individuals and schools can review results and track progress over time.

## Who Uses It

- Learners with access to their own statistics complete Individual Audits and review their personal development areas.
- School administrators and other users with organization-wide statistics access complete School Audits, review school results, and compare them in Benchmark.
- The managing organization can use Individual Audit but cannot access School Audit or Benchmark because it does not represent a participating school.

## Feature Functions

### Audit

- Presents permitted Individual and School Audits as guided, translated questionnaires with progress controls.
- Calculates and stores each result from versioned answer definitions so historical attempts remain meaningful.
- Lists previous attempts by type, completion date, and score, with a detailed statistics view for each result.
- Turns each result into a paced learning roadmap using real courses available in the school: three monthly phases for 3 months, six monthly phases for 6 months, or four quarterly phases for 12 months.
- Keeps Individual results private to the learner and School results within the current school.

### Benchmark

- Compares each participating school's latest School Audit and shows the current school's score, overall rank, cross-school average, participant count, and change from its previous result.
- Places the current school alongside nearby ranked schools in a compact comparison.
- Shows published courses already available to the user as practical next steps.
- Provides a clear path to School Audit when the current school has no result yet.

## End-User Value

- Individuals receive a clear starting point for developing their AI knowledge and confidence.
- Schools gain a repeatable readiness measure and leaders can see relative progress without collecting comparison data manually.
- Recommended courses turn assessment results into immediate learning actions inside the existing product.

## How It Works

1. The user opens Audit, chooses an assessment available to them, and answers five individual capability questions or six school department questions.
2. Mentingo validates the completed questionnaire, calculates the scores, and saves the attempt. The result page highlights strengths and development areas and links a 3-, 6-, or 12-month roadmap to available courses.
3. The Audit page lists every result the user is permitted to see. Opening an attempt displays its original score and breakdown without changing it.
4. Benchmark compares the latest School Audit from each participating school. A school's prior result is used only to show improvement.
5. Users without a School Audit are directed to complete one before their school can join the comparison.

## Key Technical Context

- Audit definitions and answer weights live in `@repo/shared`, keeping the web presentation and API validation aligned. Earlier definition versions remain available for historical results.
- Submissions are tenant-owned records protected by PostgreSQL row-level security. Cross-tenant benchmark aggregation uses the existing privileged database connection deliberately and returns only benchmark fields.
- Existing statistics permissions protect Audit and `/benchmark`; school-only access also requires a non-managing school tenant. Support mode follows the tenant currently being supported.
- Ranking is overall rather than regional and uses standard competition ranking for ties. Improvement means the change since the previous completed School Audit.
- School department scores are an administrator's self-assessment, not an aggregation of staff submissions or Mentingo groups.
- Roadmaps are deterministic and unsaved. Courses are drawn from the available catalogue in its existing order because courses do not currently carry audit-competency metadata.
- The feature does not include audit authoring, AI-generated recommendations, academic-term tracking, assessed-staff counts, PDF reports, weighted department rollups, or changes to the quiz/lesson model.

## Test Evidence

- API unit tests cover server-owned scoring, benchmark ranking and ties, definition versions, answer validation, history/detail access, and individual-versus-school scoping.
- Web configuration tests cover Audit and Benchmark navigation and route permissions.
- API and web TypeScript/ESLint validation cover the contract and application integration.
