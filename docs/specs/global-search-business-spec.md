# Global Search Business Spec

## Business Overview

Global Search helps Mentingo users find learning and administration content quickly from the main navigation. Instead of browsing through separate areas, users can open the search dialog, type a term, and jump directly to matching courses, lessons, learning paths, users, groups, categories, news, articles, or Q&A entries.

For HR and L&D teams, this reduces navigation friction in large tenant workspaces where content libraries, learner records, and operational objects grow over time. It is especially useful for multilingual organizations because indexed learning and knowledge content can be found through any translated language that matches the user's search term, even when the interface is set to a different language.

The main workflow is direct: a user opens search from the navigation or keyboard shortcut, enters at least three characters, reviews relevance-ordered results, and selects the item they need. When AI embedding credentials are configured, users can also select the visible “Search with AI” button, to combine keyword matches with related concepts. This helps learners find guidance even when they do not know the exact wording used in a course or document.

## Who Uses It

- Learners search for assigned courses, available courses, learning paths, and lesson content so they can resume training faster.
- Content creators search across courses, lessons, articles, news, and Q&A to manage training materials without manually navigating each module.
- HR admins and L&D managers search for users, groups, categories, and learning content to support day-to-day administration.
- Multilingual teams find translated or base-language content from one search box, even when the user's interface language differs from the language of the matching content.

## Feature Functions

- Search across major learning, knowledge, and administration areas from one navigation dialog.
- Search learning and knowledge content by meaning through an explicit “Search with AI” action, combining keyword and semantic matches without a reranking service.
- Discover information inside supported lesson, article, and news files with the matching filename and a short text excerpt.
- Rank learning and knowledge results together by relevance, with a type label on each result; show people, groups, and categories in a separate administrative section.
- Respect the signed-in user's permissions so each user only sees result categories they are allowed to access.
- Search every indexed language for learning and knowledge content so multilingual materials remain discoverable.
- Show a learner's completed-chapter progress beside assigned course results.
- Support keyboard opening, navigation, and selection for faster repeated use.

## End-User Value

Global Search saves time for learners and administrators by turning Mentingo into a searchable workspace instead of a collection of separate menus. It helps large organizations keep content discoverable as course catalogs, knowledge-base content, groups, and users expand.

The language-aware behavior improves multilingual delivery: users can search from their current interface without losing access to content whose searchable text exists in another language.

## How It Works

Users open the search dialog from the navigation, enter a term, and Mentingo requests matching results for the current interface language. Learning and knowledge results appear in one relevance-ordered list with type labels, and selecting a result takes the user to the relevant course overview, lesson, article, user, or administration area.

Typing uses the existing keyword search. The “Search with AI” action is hidden until the existing AI configuration check confirms effective OpenAI credentials; removing configuration returns an active hybrid search to keyword mode. Empty or partially built indexes do not hide the action. Selecting “Search with AI” submits the current text immediately and combines keyword results with semantic results for courses, lessons, learning paths, news, articles, and Q&A. People, groups, and categories continue to use keyword matching. Editing the query returns to keyword search; users can click the active AI search button again to return to keyword search. Desktop users can press ⌘Enter or Ctrl+Enter to run AI search, with the shortcut shown in the dialog footer. Semantic search is an explicit action rather than a paid embedding request on each keystroke.

Search shows a compact content-type label, the matching filename when available, and a short escaped excerpt to explain a result. Duplicate course destinations appear once. For PDF, DOCX, PPTX, XLSX, and CSV files attached to or embedded in lessons, articles, and news, search includes extracted file text once background indexing completes. XLSX extraction includes sheet names and all sheets. Search extraction is restricted to supported document types accepted by resource-library uploads; HTML, Markdown, and plain-text attachments are excluded. The separate ingestion flow retains its plain-text support. Matching files lead to their containing lesson, article, or news item. Unsupported attachment formats remain discoverable through their existing indexed filename and title. Search extraction retains the 10 MB file limit and extracted-text/chunk limits, and bounds Office archive expansion; oversized or unreadable files do not gain content-based search coverage automatically.

Existing content is indexed progressively in the background. The dialog explains that indexing is pending while searchable sources visible to the user still lack current embeddings, and combines available semantic matches with keyword results during that period. If the embedding service is unavailable, the dialog explains that keyword results are being shown. Unsupported files continue to have filename/title coverage rather than extracted-content coverage.

For indexed learning and knowledge content, Mentingo searches all language-specific documents attached to each item. The displayed title and category still use the user's selected interface language where those fields are localized, but a result can be found because its Polish, English, or other indexed text matched the query.

Search visibility remains permission-aware. For example, users without user-management permissions do not receive user results, and course/lesson results follow the existing course access distinctions.

When learners find an assigned course, the result includes the same completed-chapter count used by their course list, so the search result accurately reflects where they are in the course.

## Key Technical Context

- Demo and local environments can pause automatic semantic index refresh with `SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED=false` and an API restart. This stops scheduled reconciliation and the indexing worker, retaining queued jobs for a later restart with indexing enabled. Existing indexed content remains searchable, but new or changed content and attachments will not receive refreshed semantic indexing while paused. Keyword search remains available; explicit meaning-search queries can still call the embedding provider. The switch defaults to enabled and applies to each API process, so all processes consuming the same demo queue must use the same setting.

- The frontend search dialog lives under `apps/web/app/components/Navigation/GlobalSearch` and sends the current UI language through `useGlobalSearch`.
- The backend endpoint is `GET /api/global-search`, implemented by `GlobalSearchController`, `GlobalSearchService`, and `GlobalSearchRepository`.
- Indexed search documents live in the `search_documents` table and are refreshed by `SearchIndexService`. Semantic chunks use a cosine HNSW index, with access and current-source checks inside retrieval. Semantic retrieval uses bounded ANN candidates without an exact semantic fallback. Restrictive filters can reduce semantic recall; keyword results remain available.
- Hybrid search uses separately stored text chunks and a fixed embedding model, `text-embedding-3-small`. Query and content embeddings use the same provider and model; embedding failures fall back to lexical results. Keyword and semantic candidates are first ordered globally across content types, then combined with reciprocal rank fusion using type-qualified entity identities. The API exposes a query-local relevance score for the UI; it is not a confidence percentage. No reranking API is called. Semantic candidates must meet a cosine similarity floor of 0.55 (previously 0.35), while keyword matches remain eligible independently. This stricter default is provisional and has not been calibrated on judged production queries.
- Background indexing uses tenant-scoped jobs and a recurring reconciliation process. A repeatable backfill command supports existing content without making external embedding calls in a database migration. Canonical lesson/article/news file relations are reconciled before jobs are queued, so previously uploaded files are discovered automatically. Source hashes and attachment revisions keep changed or detached attachment chunks out of retrieval before replacement indexing finishes.
- Indexed content matching is language-inclusive: `search_documents` rows from every stored language can match, and the repository tracks which languages matched each result.
- Permissions are enforced by the global-search endpoint and service-level result category checks.
- Assigned-course progress is read from the learner's enrolled course record and is not shown for administrative or generally available course result groups.

## Test Evidence

- API E2E coverage verifies requested-language search, non-requested-language search, matching another indexed language even when requested-language documents exist, and returning multiple entities that match through different indexed languages in one request.
- API E2E coverage verifies that lesson attachment filename matches still resolve when the match comes from a non-requested-language document.
- API E2E coverage verifies that an enrolled course result returns its stored completed-chapter count.
- Frontend component tests cover the visible AI-search action, query-edit reset, configuration gating, cross-type relevance ordering, course deduplication, keyboard indices/counts, escaped excerpts and filenames, legacy responses, loading, keyword fallback, pending indexing, and request failures. These are deterministic component tests, not browser E2E or live-provider evidence.
- The opt-in PostgreSQL integration suite runs against a disposable local database with the actual migrations. It exercised deterministic vector retrieval, keyword prefix and late-passage excerpts, tenant RLS through a restricted database role, access filtering before candidate limits, attachment invalidation and visibility, source-language filtering, and partial/model-version readiness. The HNSW case also verified natural index selection, bounded candidate expansion, and result limits under restrictive filters. Updated tests cover stopping when ANN candidates are exhausted without an exact semantic fallback; the full 29-case database-backed suite passed locally in a fresh, loopback-only pgvector container after applying the real migrations. Fixture vectors prove retrieval mechanics; they do not measure a live model's semantic relevance or a production speed advantage.
- Additional PostgreSQL coverage verifies article/news file discovery, extraction-source metadata, FTS and semantic retrieval, attachment/content deduplication, private and nonpublic access, tenant isolation, archive/detach cleanup, and read-only backfill previews. File extraction itself is tested with mocked storage/extraction/provider responses for lessons, articles, and news.
- Real-parser fixture tests now exercise PPTX, multi-sheet XLSX, and quoted CSV extraction, plus malformed/oversized inputs and archive expansion limits. Database integration tests verify discovery of each new format and reject a 0.54 semantic match while accepting 0.56, retaining the below-threshold keyword hit. No live embedding-provider, production reindexing, or authenticated browser E2E result is claimed.

Keyword-only search and hybrid search share the same access-checked FTS corpus, including indexed accessible file text. Hybrid additionally retrieves semantic candidates and fuses their ranking. Student MCP course search is restricted to title/description documents and metadata-only output. Before narrowing attachment formats to the upload allowlist, 104 affected backend tests passed, including 37 real PostgreSQL integration cases and real-parser extraction fixtures. After narrowing, 26 focused extraction, source-discovery, indexing, and queue tests passed, including rejection of HTML, Markdown, and plain-text search attachments. All 24 focused frontend component tests passed. API and web TypeScript checks and scoped ESLint passed. OpenAPI and the web client were regenerated from the source contract. Database-backed HTTP/OAuth E2E, browser/device rendering, production indexing, and live embedding relevance were not verified in this pass.

## Ranking Research And Follow-up

The implemented correction removes category-based priority and uses one global keyword ranking and one global vector ranking before fusion. [Elastic's RRF documentation](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion) describes combining independently ranked retrieval lists without adding their incompatible raw scores. The application already used RRF, but previously restarted its ranking for every content type; those scores could not express a meaningful global order.

Apply relevance cutoffs to vector similarity before fusion. [OpenSearch's RRF guidance](https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/rrf/) explains that fusion discards score magnitudes, so a fused score is unsuitable as a confidence threshold. The new 0.55 floor is an engineering starting point, not a research-derived optimum for Mentingo.

A second-stage cross-encoder reranker is a possible next step: score the query together with a bounded set of retrieved titles/passages, then sort that shortlist. [Microsoft's hybrid ranking documentation](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking) describes semantic reranking after RRF. This adds inference latency, cost, and another availability dependency; it is not enabled in this change.

Before adopting a reranker or tuning the cutoff further, assemble representative English/Polish queries with human judgments: exact titles, paraphrases, document-only answers, multilingual queries, ambiguous terms, and queries with no relevant result. Compare precision at 5, nDCG at 10, no-answer false positives, recall, and latency for the current baseline, several similarity floors, weighted fusion, and a bounded reranker. Permission and tenant tests must continue passing independently of relevance evaluation.
