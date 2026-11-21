# WCAG 2.1 AA audit

Automated accessibility audit of Mentingo's key views and user paths. It is separate from the E2E
suite: it does not fail on known violations, it scores them.

## What it checks

Every scanned view or state gets:

- **axe-core** (`@axe-core/playwright`) with the WCAG 2.0/2.1 A and AA rules, plus WCAG 2.2 AA and
  best-practice rules reported outside the score.
- **Mentingo checks** (`custom-checks.ts`) for what axe does not cover:
  - Tab walk from the top of the page: focus on hidden elements (2.4.7, 2.4.3), keyboard traps
    (2.1.2), missing focus outline/ring (2.4.7, review), skip link (2.4.1, review);
  - pointer-only controls: pointer cursor on an element the keyboard cannot reach (2.1.1, review);
  - reflow at 320 CSS px: page-level horizontal scrolling (1.4.10), regions that scroll or clip
    sideways (review);
  - text spacing from 1.4.12 applied: text that gets cut off (review);
  - page titles: empty, or one title shared by different pages of one role (2.4.2).

"Review" results are never counted as passes or failures.

Paths and views live in `*.audit.ts` (visitor, student, admin). Transient states (open menu,
form errors) skip the Tab walk and resizing, which would close them.

## Score

Each of the 50 WCAG 2.1 A/AA success criteria (`wcag21-criteria.ts`) gets one status:

| Status                       | Meaning                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Failed                       | at least one violation                                                               |
| Met                          | automation decides it (3.1.1 language of page) or WCAG says it is always met (4.1.1) |
| No automated failures        | checks ran and passed, but a human must still confirm                                |
| Needs review                 | no violation, but axe or a heuristic could not decide                                |
| Not verifiable automatically | no automated check, or no matching content in the scanned views                      |

The report gives:

- **estimate** = (met + no automated failures) / (those + failed): conformance among the criteria
  automation could assess;
- **range** over all 50 criteria: lower bound if every unverified criterion fails, upper bound if
  every one passes;
- the verdict: WCAG conformance is all-or-nothing, so one failed criterion means "not conformant".

No axe errors is never reported as 100%: most criteria need manual testing (screen readers,
keyboard-only use, zoom, captions, content).

## Running

Needs the same running stack as the E2E suite (see `e2e/strategy.md`).

```bash
pnpm test:web:a11y                        # from the repo root
pnpm --filter=web test:a11y-audit         # same
A11Y_REPORT_DIR=/tmp/a11y pnpm --filter=web test:a11y-audit
```

Output in `apps/web/a11y-report/` (git-ignored):

- `wcag-report.md` — score, violations by impact, criteria table, locations per view;
- `wcag-report.json` — the same data for tooling;
- `wcag-scans.json` — raw results per view (every axe rule and check);
- `html/` — Playwright HTML report.

## Baseline

`wcag-baseline.json` lists the known violations as `<viewId>::<ruleId>`. A run fails when a
violation appears that is not listed (a regression, or a known problem on a new view). Fixed
violations are only reported; remove them from the baseline in the fixing PR:

```bash
A11Y_UPDATE_BASELINE=true pnpm --filter=web test:a11y-audit   # rewrite the baseline from this run
A11Y_ENFORCE_BASELINE=false pnpm --filter=web test:a11y-audit # report new violations without failing
```

Only update the baseline to remove fixed entries or, deliberately, to accept a new known issue.

## CI

`.github/workflows/accessibility-audit.yml` runs the audit through the E2E workflow
(`suite: a11y-audit`) on:

- the `run accessibility audit ♿` PR label,
- every Monday at 03:00 UTC,
- manual dispatch.

The report is uploaded as the `wcag-audit-report` artifact and shown in the job summary.

## Adding a view

Add an `AuditedView` (stable `viewId`, a `ready` locator from a `data-testid` handle) to the
matching `*.audit.ts`, or call `scanView` after a flow step for a state. A new view with an
already-known violation fails the baseline check on purpose: decide whether to fix it or add it to
the baseline.
