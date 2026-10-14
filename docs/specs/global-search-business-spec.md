# Global Search Business Spec

## Business Overview

Global Search helps Mentingo users find learning and administration content quickly from the main navigation. Instead of browsing through separate areas, users can open the search dialog, type a term, and jump directly to matching courses, lessons, learning paths, users, groups, categories, news, articles, or Q&A entries.

For HR and L&D teams, this reduces navigation friction in large tenant workspaces where content libraries, learner records, and operational objects grow over time. It is especially useful for multilingual organizations because indexed learning and knowledge content can be found through any translated language that matches the user's search term, even when the interface is set to a different language.

The main workflow is direct: a user opens search from the navigation or keyboard shortcut, enters at least three characters, reviews grouped results, and selects the item they need. When AI embedding credentials are configured, users can also select the sparkle button, labelled “Search by meaning”, to combine keyword matches with related concepts. This helps learners find guidance even when they do not know the exact wording used in a course or document.

## Who Uses It

- Learners search for assigned courses, available courses, learning paths, and lesson content so they can resume training faster.
- Content creators search across courses, lessons, articles, news, and Q&A to manage training materials without manually navigating each module.
- HR admins and L&D managers search for users, groups, categories, and learning content to support day-to-day administration.
- Multilingual teams find translated or base-language content from one search box, even when the user's interface language differs from the language of the matching content.

## Feature Functions

- Search across major learning, knowledge, and administration areas from one navigation dialog.
- Search learning and knowledge content by meaning through an explicit sparkle action, combining keyword and semantic matches without a reranking service.
- Discover information inside supported lesson attachments and review a short matching passage with the attachment filename.
- Group results by type so users can scan courses, lessons, people, groups, and knowledge content separately.
- Respect the signed-in user's permissions so each user only sees result categories they are allowed to access.
- Search every indexed language for learning and knowledge content so multilingual materials remain discoverable.
- Show a learner's completed-chapter progress beside assigned course results.
- Support keyboard opening, navigation, and selection for faster repeated use.

## End-User Value

Global Search saves time for learners and administrators by turning Mentingo into a searchable workspace instead of a collection of separate menus. It helps large organizations keep content discoverable as course catalogs, knowledge-base content, groups, and users expand.

The language-aware behavior improves multilingual delivery: users can search from their current interface without losing access to content whose searchable text exists in another language.

## How It Works

Users open the search dialog from the navigation, enter a term, and Mentingo requests matching results for the current interface language. Results are grouped by content type, and selecting a result takes the user to the relevant course overview, lesson, article, user, or administration area.

Typing uses the existing keyword search. The sparkle action is hidden until the existing AI configuration check confirms effective OpenAI credentials; removing configuration returns an active hybrid search to keyword mode. Empty or partially built indexes do not hide the action. Selecting “Search by meaning” submits the current text immediately and combines keyword results with semantic results for courses, lessons, learning paths, news, articles, and Q&A. People, groups, and categories continue to use keyword matching. Editing the query returns to keyword search; users can also select “Back to keywords”. Semantic search is an explicit action rather than a paid embedding request on each keystroke.

Hybrid results can include a short passage from the matched content. For PDF, DOCX, and plain-text lesson attachments, the search includes extracted file text once background indexing completes. Unsupported attachment formats remain discoverable through their existing indexed filename and title. Extraction follows size and text limits; oversized or unreadable files do not gain content-based search coverage automatically.

Existing content is indexed progressively in the background. The dialog explains that indexing is pending while searchable sources visible to the user still lack current embeddings, and combines available semantic matches with keyword results during that period. If the embedding service is unavailable, the dialog explains that keyword results are being shown. Unsupported files continue to have filename/title coverage rather than extracted-content coverage.

For indexed learning and knowledge content, Mentingo searches all language-specific documents attached to each item. The displayed title and category still use the user's selected interface language where those fields are localized, but a result can be found because its Polish, English, or other indexed text matched the query.

Search visibility remains permission-aware. For example, users without user-management permissions do not receive user results, and course/lesson results follow the existing course access distinctions.

When learners find an assigned course, the result includes the same completed-chapter count used by their course list, so the search result accurately reflects where they are in the course.

## Key Technical Context

- The frontend search dialog lives under `apps/web/app/components/Navigation/GlobalSearch` and sends the current UI language through `useGlobalSearch`.
- The backend endpoint is `GET /api/global-search`, implemented by `GlobalSearchController`, `GlobalSearchService`, and `GlobalSearchRepository`.
- Indexed search documents live in the `search_documents` table and are refreshed by `SearchIndexService`. Semantic chunks use a cosine HNSW index, with access and current-source checks inside retrieval. Semantic retrieval uses bounded ANN candidates without an exact semantic fallback. Restrictive filters can reduce semantic recall; keyword results remain available.
- Hybrid search uses separately stored text chunks and a fixed embedding model, `text-embedding-3-small`. Query and content embeddings use the same provider and model; embedding failures fall back to lexical results. Keyword and semantic rankings are combined by entity rather than counting matching chunks, with no reranking API.
- Background indexing uses tenant-scoped jobs and a recurring reconciliation process. A repeatable backfill command supports existing content without making external embedding calls in a database migration. Source hashes and attachment revisions keep changed or detached attachment chunks out of retrieval before replacement indexing finishes.
- Indexed content matching is language-inclusive: `search_documents` rows from every stored language can match, and the repository tracks which languages matched each result.
- Permissions are enforced by the global-search endpoint and service-level result category checks.
- Assigned-course progress is read from the learner's enrolled course record and is not shown for administrative or generally available course result groups.

## Test Evidence

- API E2E coverage verifies requested-language search, non-requested-language search, matching another indexed language even when requested-language documents exist, and returning multiple entities that match through different indexed languages in one request.
- API E2E coverage verifies that lesson attachment filename matches still resolve when the match comes from a non-requested-language document.
- API E2E coverage verifies that an enrolled course result returns its stored completed-chapter count.
- New frontend component tests cover explicit sparkle submission, returning to keyword search on edits, the minimum query length, hiding the sparkle for missing/unknown AI configuration, returning to keyword mode when configuration is removed, clear/back actions, safe passage rendering, loading states, keyword fallback, pending indexing, and request failures. These are deterministic component tests, not browser E2E or live-provider evidence.
- The opt-in PostgreSQL integration suite passed all 13 cases against the disposable local #2036 database after applying the actual migrations. It exercised deterministic vector retrieval, keyword prefix and late-passage excerpts, tenant RLS through a restricted database role, access filtering before candidate limits, attachment invalidation and visibility, source-language filtering, and partial/model-version readiness. The HNSW case also verified natural index selection, bounded candidate expansion, and result limits under restrictive filters. Updated tests cover stopping when ANN candidates are exhausted without an exact semantic fallback; these changes await CI validation. Fixture vectors prove retrieval mechanics; they do not measure a live model's semantic relevance or a production speed advantage.
- No live embedding-provider, attachment extraction, deployed migration, or authenticated hybrid-search E2E result is claimed by this source review.

Keyword-only search and hybrid search share the same access-checked FTS corpus, including indexed accessible file text. Hybrid additionally retrieves semantic candidates and fuses their ranking. Student MCP course search is restricted to title/description documents and metadata-only output. New scope and FTS parity tests await CI; local validation was skipped by request.
