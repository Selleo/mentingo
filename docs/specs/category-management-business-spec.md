# Category Management Business Spec

## Business Overview

Category Management lets HR and L&D administrators maintain the shared labels used to organize courses. Clear, current categories make it easier for course creators to classify learning content and for learners and administrators to find it.

Administrators create, rename, translate, and delete categories from the category administration area. Categories are available wherever course metadata is selected and in global search; there is no separate archive state.

## Who Uses It

- HR and L&D administrators create consistent category structures for onboarding, compliance, and role-specific learning.
- Course creators select an existing category or create one while preparing a course, so content is grouped consistently.
- Learners and administrators use category names to find relevant learning content and administration records.

## Feature Functions

- Create categories in a supported content language.
- Rename categories while preserving their localized versions.
- Add, remove, and choose the base language for category translations.
- Search and sort categories in the administration list.
- Find permitted categories through global search.
- Delete categories that are no longer needed when they are not assigned to courses.

## End-User Value

Teams keep their learning catalogue understandable without maintaining a second archive workflow. Categories stay available consistently in course forms, administration, and search, while deletion safeguards prevent accidental removal of categories that courses still use.

## How It Works

An administrator maintains categories from the administration list and can open a category to edit its name or translations. Course creators then choose the maintained category when creating or editing learning content. When a category becomes obsolete, an administrator deletes it after moving or updating any courses that still rely on it.

Each tenant manages its own categories. Category titles are shown in the requested supported language, falling back to the category's base language when a translation is unavailable.

## Key Technical Context

- The category administration UI is under `/admin/categories`; category updates require category-management access.
- The category API preserves tenant isolation and localized titles.
- Category deletion remains blocked while a course is assigned to the category.
- Global search returns categories only to users with category read or management access.

## Test Evidence

Backend E2E coverage verifies category list visibility, localization, creation, update, and deletion safeguards, plus matching categories in global search. Browser E2E coverage verifies category listing, title filtering, sorting, selection, navigation, and title editing.
