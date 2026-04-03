# Structure And Style

## Suggested Structure (Example)

```txt
playwright-strategy/examples/
  fixtures/
  factories/
    core/
    primitives/
    composites/
    scenarios/
  api/
  flows/
  data/
    scenarios/
    expected/
  specs/
```

## Style Rules

- Specs: business intent + assertions only.
- Flows: reusable interaction sequences (`createCourseFlow`, `enrollLearnerFlow`).
- Factories: deterministic data creation.
- Fixtures: provide dependencies and cleanup.

## Selector Standard

- static: `<domain>-<entity>-<element>`
- dynamic: `<domain>-<entity>-<element>--<id>`

Examples:

- `course-create-button`
- `course-row--<courseId>`
- `chapter-freemium-toggle--<chapterId>`

Rules:

- kebab-case only
- no translated text in test IDs
- no spaces
- reserve `--` for opaque IDs

## Expected Data Placement

- short constants: inline
- shared expected outputs: `data/expected/*`
- scenario inputs: `data/scenarios/*`
- translation labels: keep separate from business expected values
