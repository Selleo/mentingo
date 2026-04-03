# Capability Coverage Checklist

## Auth

- login success/failure
- register
- password recovery/reset
- magic-link
- MFA
- logout

## Navigation

- public visibility
- authenticated visibility
- manage/super-admin visibility
- invalid-route redirects

## Courses

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

## Curriculum

- chapter create/update/delete/reorder/freemium
- lesson create/update/delete/reorder
- lesson types: content/quiz/AI mentor/embed
- resource upload
- initialize lesson context

## Enrollment

- self-enroll
- bulk user enroll
- bulk group enroll
- group unenroll
- enrolled users/groups verification

## Learning

- lesson open
- next lesson progression
- mark complete
- sequence enforcement
- quiz submit/retake
- AI mentor interaction entry
- blocked/unblocked access

## Users

- create/update/archive
- bulk archive/delete
- bulk assign groups/update attributes
- import users

## Groups

- create/edit/delete
- bulk delete
- membership assignment/verification

## Categories

- create/update/delete/delete-many
- list/search

## Announcements

- create/list
- unread count
- mark read
- feed visibility

## QA

- list/open/create/update/delete
- language variant create/update/delete

## News

- list/open/create/update/delete
- draft/preview
- language variant add/delete
- resource upload

## Articles

- list/open/create/update/delete
- sections + section languages
- preview
- TOC

## Settings

- user settings
- org/company info
- branding assets
- login page files
- registration form
- global toggles
- MFA-related settings
- default currency
- feature toggles

## Environment

- env values load
- env toggles update
- frontend env availability checks

## Certificates

- view/download/share link/share render

## Promotion Codes

- list/create/update/delete

## Statistics

- learner progress
- admin analytics
- course stats widgets
- learning time
- quiz results

## Tenants

- list/create/edit

## Onboarding

- progression/completion/reset

## Support Mode

- entry/exit
- visibility/badge behavior

## Voice / AI

- voice entry points
- AI chat/thread entry points
- AI course generation availability check

## Stripe / Payments

- paid course checkout entry
- promo code application
- payment success/failure handling

## i18n

- language switch
- localized navigation
- localized validation/copy
- business tests remain locale-independent
