# Capability Coverage Checklist

## Auth (Its-Gabo)

- login success/failure
- register
- password recovery/reset
- magic-link
- MFA
- logout

## Navigation (Its-Gabo)

- public visibility
- authenticated visibility
- manage/super-admin visibility
- invalid-route redirects

## Courses (Japrolol)

- browse list
- open details
- create/update
- update pricing
- update status
- toggle student mode
- toggle certificate
- archive/delete
- delete many
- transfer ownership
- language add/remove
- generate missing translations

## Curriculum (Japrolol)

- chapter create/update/delete/reorder/freemium
- lesson create/update/delete/reorder
- lesson types: content/quiz/AI mentor/embed
- resource upload
- initialize lesson context

## Enrollment (Japrolol)

- self-enroll
- bulk user enroll
- bulk group enroll
- group unenroll
- enrolled users/groups verification

## Learning (Its-Gabo)

- lesson open
- next lesson progression
- mark complete
- sequence enforcement
- quiz submit/retake
- AI mentor interaction entry
- blocked/unblocked access

## Users (Japrolol)

- create/update/archive
- bulk archive/delete
- bulk assign groups/update attributes
- import users

## Groups (Japrolol)

- create/edit/delete
- bulk delete
- membership assignment/verification

## Categories (Japrolol)

- create/update/delete/delete-many
- list/search

## Announcements (Its-Gabo)

- create/list
- unread count
- mark read
- feed visibility

## QA (Japrolol)

- list/open/create/update/delete
- language variant create/update/delete

## News (Its-Gabo)

- list/open/create/update/delete
- draft/preview
- language variant add/delete
- resource upload

## Articles (Its-Gabo)

- list/open/create/update/delete
- sections + section languages
- preview
- TOC

## Settings (Its-Gabo)

- user settings
- org/company info
- branding assets
- login page files
- registration form
- global toggles
- MFA-related settings
- default currency
- feature toggles

## Environment (Japrolol)

- env values load
- env toggles update
- frontend env availability checks

## Certificates (Its-Gabo)

- view/download/share link/share render

## Promotion Codes (Skip for now)

- list/create/update/delete

## Statistics (Japrolol)

- learner progress
- admin analytics
- course stats widgets
- learning time
- quiz results

## Tenants (Japrolol)

- list/create/edit

## Onboarding (Its-Gabo)

- progression/completion/reset

## Support Mode (Its-Gabo)

- entry/exit
- visibility/badge behavior

## Voice / AI (Japrolol)

- voice entry points
- AI chat/thread entry points
- AI course generation availability check

## Stripe / Payments (Skip for now)

- paid course checkout entry
- promo code application
- payment success/failure handling

## i18n (Its-Gabo)

- language switch
- localized navigation
- localized validation/copy
- business tests remain locale-independent
