-- Store older application receipts as JSON objects, matching new writes.
-- Only the JSON representation changes; receipt IDs, results and timestamps stay intact.
UPDATE "course_authoring_applications"
SET "result" = ("result" #>> '{}')::jsonb
WHERE jsonb_typeof("result") = 'string';
