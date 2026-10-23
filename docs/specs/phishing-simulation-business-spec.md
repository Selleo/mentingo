# Phishing Simulations

## Business Overview

Phishing simulations help training teams identify risky email responses and connect those actions with follow-up learning. Authorized users select a scenario, audience, training course and sending window, then review campaign results and course progress in Mentingo.

## Who Uses It

- Users with campaign management and course enrollment permissions organize simulations for selected people or groups and choose their follow-up training.
- Users with reporting permission review campaign outcomes; managers with restricted group access see only their permitted audience.
- Learners receive an assigned course after a verified risky action in a simulation.

## Feature Functions

- Create campaigns using scenarios supplied by the connected phishing service.
- Choose training-reminder, account-verification or password-reset simulations, each available as one email or two emails sent three days apart.
- Receive simulated emails rendered by core using its built-in email publications, learner language and organization branding.
- Search and select multiple people or groups, then choose one scenario and educational course using searchable selectors. People, groups and courses load more results as the list is scrolled.
- Schedule the sending window and review a unique recipient count that accounts for overlapping group membership.
- Review delivery, risky actions and follow-up course progress for individuals and groups. The campaign report shows an outcomes chart around the at-risk rate (submitted data, clicked only, no action), a recent-activity feed of clicks and submissions, and a paged people list that can be searched by name or email, filtered by group (each group shows its risk rate) or to at-risk people, and sorted by name or by sent, clicked or submitted time. Searching, filtering, sorting and paging run on the server, so large campaigns load one page at a time; course status is shown but not sortable. For click-only scenarios (training reminders) the report leaves out submitted data entirely: the chart shows clicked and no action, and the people list has no Submitted column. There is no separate "Hall of Shame" view.
- Cancel campaigns and inspect campaign reports.
- Assign the selected course after a verified risky action, avoiding duplicate active enrollments.
- Redirect learners to the selected course once enrollment is confirmed; form scenarios require a submission, while training-reminder scenarios require a click.
- Show the Phishing menu only when the tenant connection is configured, phishing is enabled in Mission Control and the user has the required permission.

## End-User Value

Training teams can connect simulation outcomes to practical learning and track the audience that needs support. Group-scoped reports help managers focus on their own teams.

## How It Works

An authorized user creates a campaign, chooses a scenario and audience, selects a training course and reviews the details before launch. The connected service sends the simulation. Mentingo displays campaign results alongside course progress and assigns follow-up learning after an authenticated risky-action notification.

For two-email scenarios, the sending window applies to the first email. The second becomes due 72 hours after the first successful SMTP send, even if that falls outside the original window. Both messages are simulated phishing emails, with separate tracking links and delivery retries. The campaign remains scheduled until both deliveries finish or fail. Cancellation stops pending messages; an in-flight delivery can still finish. If the first email exhausts its retries, its second email is cancelled. Reports continue to summarize people rather than individual messages.

The emails use the same built-in publications and renderer as core; the action link leads to the simulation. Training reminders use the assignment-without-deadline template, account verification uses the magic-link template, and password reset uses the password-recovery template. Custom automation templates are not selected automatically. The simulation form never sends its input values. After the required risky action, the landing page waits for core to acknowledge enrollment before redirecting to the course. If enrollment takes longer than four minutes, it offers instructions to open Mentingo or refresh later.

The tenant needs a service URL, API key and webhook secret, plus phishing enabled in Mission Control. The menu stays hidden while availability is unknown or the check fails. Users without phishing permissions do not trigger the menu's availability request. Existing page and API access checks still apply to direct links.

## Key Technical Context

- Campaigns and reports are available under `/phishing`; creation also requires course enrollment permission.
- `apps/web/app/components/Navigation/Navigation.tsx` uses the existing tenant configuration query to control menu visibility.
- `apps/api/src/env/services/env.service.ts` checks connection settings and the connected service's phishing capability together.
- `apps/api/src/phishing/phishing.service.ts` scopes manager reports; the webhook controller validates notifications before assigning training.
- The configuration query caches availability for 30 seconds; menu visibility is refreshed through ordinary query refetches rather than a live Mission Control subscription.
- The plugin requests rendered emails through the HMAC-authenticated, server-only `/api/phishing/webhook/email` endpoint. Core verifies campaign membership and renders the subject, HTML, plain text and branding attachments. Rendering failures retry rather than falling back to independent plugin HTML. Deploy this core endpoint before the updated plugin.
- The plugin uses additive SQLite tables for second-message delivery and course destinations; existing campaigns remain readable. The new redirect is available for messages rendered through core. Scenario descriptions and landing-page explanations remain English; email content follows the learner's supported language.

## Test Evidence

Frontend unit tests cover enabled and disabled navigation, loading and failed availability checks, both phishing permissions and users without access. Page gate tests cover disabled, enabled and failed configuration checks. API unit tests cover manager report boundaries, enrollment permission, signed notifications and duplicate enrollment prevention. Dedicated phishing browser E2E and API E2E coverage was not found; these tests do not prove a complete live campaign delivery workflow.

Validation for the extended scenarios passed core typechecking and 12 existing phishing tests, plugin typechecking and 24 campaign tests. A temporary smoke check with real temporary SQLite databases and mocked rendering/SMTP/webhook transports exercised all six scenarios, the 72-hour boundary, restart recovery, distinct message tracking, failure-action selection and redirect readiness. No persistent tests were added or changed under the local repository instructions. Existing delivery/tracking fixtures still assume standalone plugin email HTML and need adaptation to the core-rendering protocol. Real cross-service email delivery and a browser login-to-course journey remain unverified.

Selector validation passed API and web typechecking and scoped linting. Browser checks covered scenario and course search, people selections across searches, empty results, gray placeholders and the server-calculated unique audience count. Existing frontend tests passed 18 of 20 cases; two campaign-form cases still mock the former options hook and need updated query providers/mocks for the new selectors. Test files were left unchanged under local repository instructions.
