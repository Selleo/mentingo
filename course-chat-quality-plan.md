# Course Chat Quality Plan

## Frontend

- [x] Invalidate course chat message queries for top-level message creation instead of appending to every cached page.
- [x] Replace `mutateAsync` usage in the course chat tab with destructured `mutate`.
- [x] Add reply pagination for opened threads so conversations with more than one reply page can be fully read.
- [x] Extract heavy chat message UI pieces into smaller components.
- [x] Replace repeated `users.find` lookups with a precomputed user map.
- [x] Replace brittle `99` string replacement for reply counts with an explicit capped count helper.
- [x] Move tab URL updates to `Tabs` `onValueChange` in `CourseView`.

## Backend

- [x] Add Redis presence expiration so stale socket/user keys age out after missed disconnects.
- [x] Replace inline Redis Lua scripts with readable Redis client commands/transactions in a dedicated presence store.
- [x] Keep parent message validation in the service and pass the validated context into repository creation.
- [x] Publish message/reply/mention outbox events in the same transaction as message creation, then emit realtime events after commit.
- [x] Extract duplicated message/reply filters with `$with` CTEs.
- [x] Combine reply count and latest reply summary into one CTE query.

## Verification

- [x] Run API TypeScript check.
- [x] Run web TypeScript check.
- [x] Fix ambiguous SQL column references from course chat CTE projections.
