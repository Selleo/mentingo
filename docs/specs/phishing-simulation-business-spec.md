# Phishing Simulations

## Business Overview

Phishing simulations help training teams identify risky email responses and connect those actions with follow-up learning. Authorized users select a scenario, audience, training course and sending window, then review campaign results and course progress in Mentingo.

## Who Uses It

- Users with campaign management and course enrollment permissions organize simulations for selected people or groups and choose their follow-up training.
- Users with reporting permission review campaign outcomes; managers with restricted group access see only their permitted audience.
- Learners receive an assigned course after a verified risky action in a simulation.

## Feature Functions

- Create campaigns using scenarios supplied by the connected phishing service.
- Target selected people or groups and schedule the sending window.
- Review delivery, risky actions and follow-up course progress for individuals and groups.
- Cancel campaigns and inspect campaign reports.
- Assign the selected course after a verified risky action, avoiding duplicate active enrollments.
- Show the Phishing menu only when the tenant connection is configured, phishing is enabled in Mission Control and the user has the required permission.

## End-User Value

Training teams can connect simulation outcomes to practical learning and track the audience that needs support. Group-scoped reports help managers focus on their own teams.

## How It Works

An authorized user creates a campaign, chooses a scenario and audience, selects a training course and reviews the details before launch. The connected service sends the simulation. Mentingo displays campaign results alongside course progress and assigns follow-up learning after an authenticated risky-action notification.

The tenant needs a service URL, API key and webhook secret, plus phishing enabled in Mission Control. The menu stays hidden while availability is unknown or the check fails. Users without phishing permissions do not trigger the menu's availability request. Existing page and API access checks still apply to direct links.

## Key Technical Context

- Campaigns and reports are available under `/phishing`; creation also requires course enrollment permission.
- `apps/web/app/components/Navigation/Navigation.tsx` uses the existing tenant configuration query to control menu visibility.
- `apps/api/src/env/services/env.service.ts` checks connection settings and the connected service's phishing capability together.
- `apps/api/src/phishing/phishing.service.ts` scopes manager reports; the webhook controller validates notifications before assigning training.
- The configuration query caches availability for 30 seconds; menu visibility is refreshed through ordinary query refetches rather than a live Mission Control subscription.

## Test Evidence

Frontend unit tests cover enabled and disabled navigation, loading and failed availability checks, both phishing permissions and users without access. Page gate tests cover disabled, enabled and failed configuration checks. API unit tests cover manager report boundaries, enrollment permission, signed notifications and duplicate enrollment prevention. Dedicated phishing browser E2E and API E2E coverage was not found; these tests do not prove a complete live campaign delivery workflow.
