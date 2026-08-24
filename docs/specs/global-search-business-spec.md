# Global Search Business Spec

## Business Overview

Global Search helps Mentingo users find learning and administration content quickly from the main navigation. Instead of browsing through separate areas, users can open the search dialog, type a term, and jump directly to matching courses, lessons, learning paths, users, groups, categories, news, articles, or Q&A entries.

For HR and L&D teams, this reduces navigation friction in large tenant workspaces where content libraries, learner records, and operational objects grow over time. It is especially useful for multilingual organizations because indexed learning and knowledge content can be found through any translated language that matches the user's search term, even when the interface is set to a different language.

The main workflow is direct: a user opens search from the navigation or keyboard shortcut, enters at least three characters, reviews grouped results, and selects the item they need.

## Who Uses It

- Learners search for assigned courses, available courses, learning paths, and lesson content so they can resume training faster.
- Content creators search across courses, lessons, articles, news, and Q&A to manage training materials without manually navigating each module.
- HR admins and L&D managers search for users, groups, categories, and learning content to support day-to-day administration.
- Multilingual teams find translated or base-language content from one search box, even when the user's interface language differs from the language of the matching content.

## Feature Functions

- Search across major learning, knowledge, and administration areas from one navigation dialog.
- Group results by type so users can scan courses, lessons, people, groups, and knowledge content separately.
- Respect the signed-in user's permissions so each user only sees result categories they are allowed to access.
- Search every indexed language for learning and knowledge content so multilingual materials remain discoverable.
- Show matched lesson attachment filenames when the search term matches an attached resource.
- Show a learner's completed-chapter progress beside assigned course results.
- Support keyboard opening, navigation, and selection for faster repeated use.

## End-User Value

Global Search saves time for learners and administrators by turning Mentingo into a searchable workspace instead of a collection of separate menus. It helps large organizations keep content discoverable as course catalogs, knowledge-base content, groups, and users expand.

The language-aware behavior improves multilingual delivery: users can search from their current interface without losing access to content whose searchable text exists in another language.

## How It Works

Users open the search dialog from the navigation, enter a term, and Mentingo requests matching results for the current interface language. Results are grouped by content type, and selecting a result takes the user to the relevant course overview, lesson, article, user, or administration area.

For indexed learning and knowledge content, Mentingo searches all language-specific documents attached to each item. The displayed title and category still use the user's selected interface language where those fields are localized, but a result can be found because its Polish, English, or other indexed text matched the query.

Search visibility remains permission-aware. For example, users without user-management permissions do not receive user results, and course/lesson results follow the existing course access distinctions.

When learners find an assigned course, the result includes the same completed-chapter count used by their course list, so the search result accurately reflects where they are in the course.

## Key Technical Context

- The frontend search dialog lives under `apps/web/app/components/Navigation/GlobalSearch` and sends the current UI language through `useGlobalSearch`.
- The backend endpoint is `GET /api/global-search`, implemented by `GlobalSearchController`, `GlobalSearchService`, and `GlobalSearchRepository`.
- Indexed search documents live in the `search_documents` table and are refreshed by `SearchIndexService`.
- Indexed content matching is language-inclusive: `search_documents` rows from every stored language can match, and the repository tracks which languages matched each result.
- Permissions are enforced by the global-search endpoint and service-level result category checks.
- Assigned-course progress is read from the learner's enrolled course record and is not shown for administrative or generally available course result groups.

## Test Evidence

- API E2E coverage verifies requested-language search, non-requested-language search, matching another indexed language even when requested-language documents exist, and returning multiple entities that match through different indexed languages in one request.
- API E2E coverage verifies that lesson attachment filename matches still resolve when the match comes from a non-requested-language document.
- API E2E coverage verifies that an enrolled course result returns its stored completed-chapter count.
- Existing frontend behavior is inferred from the global search dialog and query hook; no new frontend E2E coverage was added because the API contract did not change.
