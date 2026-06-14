# Q&A Business Spec

## Business Overview

Q&A gives organizations a lightweight frequently asked questions area. It is separate from the Articles Knowledge Base: Q&A is designed for short, direct question-and-answer content, while the knowledge base is handled by the Articles feature with sections, drafts, and richer article publishing workflows.

The feature supports multilingual entries, public access settings, and permission-controlled editing, making it useful for onboarding, platform support, learning-program guidance, and internal HR answers.

## Who Uses It

- HR and L&D administrators who publish common answers.
- Content creators who maintain localized Q&A entries.
- Learners and employees who browse or search for answers.
- Public visitors when guest Q&A access is enabled.

## Feature Functions

- Browse a list of Q&A entries in an accordion-style interface.
- Search and open a focused Q&A entry.
- Create new Q&A items with a base language.
- Edit question titles and answer descriptions by language.
- Add or remove non-base language versions.
- Delete Q&A entries when permitted.
- Hide unsupported language variants from regular learners.
- Gate guest access through tenant-level settings.

## End-User Value

Learners can answer common questions faster, reducing repetitive support requests. HR and L&D teams can keep guidance consistent across languages and decide whether answers should be available only to signed-in users or also to visitors.

## How It Works

Users open the Q&A page and see available entries for the current language. Managers can create new entries, choose the base language, edit localized text, add extra language versions, and delete entries.

The system checks whether Q&A is enabled and whether guest access is allowed before returning public content. For signed-in users, permissions determine whether the user only reads the Q&A list or can manage entries.

Language management protects the base language: editors can add supported languages and remove non-base translations, but cannot delete the base-language version.

## Key Technical Context

- Frontend routes include `/qa`, `/qa/new`, and `/qa/:id`.
- API endpoints live under `apps/api/src/qa`.
- Access is controlled by the Q&A feature flag, unregistered Q&A access setting, and permissions such as `QA_READ_PUBLIC`, `QA_MANAGE`, and `QA_MANAGE_OWN`.
- Q&A create, update, and delete operations publish activity events.

## Test Evidence

- API E2E coverage verifies authenticated and guest list access, disabled-feature behavior, guest-access denial, requested-language reads, create/update/delete, invalid body handling, language add/remove, duplicate language rejection, unsupported language rejection, and base-language deletion protection.
- Web E2E coverage verifies list behavior, create/update/delete, public access, role access, settings gates, and language visibility/management flows.
