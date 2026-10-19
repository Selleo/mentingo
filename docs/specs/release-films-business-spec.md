# Release Films

## Business Overview

Each stable Mentingo release can present its main user-facing changes as a short narrated demonstration. Publishing
the release automatically queues the existing film process, so release owners do not need to start a recording
separately. Viewers find a clickable film preview at the top of the release notes and can browse the public archive
on GitHub Pages.

The recording follows the same process as the v4.15.0 demonstration: scenes show changes in the released application,
with narration checked against the captured screens. The film highlights selected changes; its accompanying page
accounts for the release's pull requests, including changes not demonstrated.

## Who Uses It

- Release owners publish a stable version and follow its recording run to confirm the demonstration was produced.
- Clients and stakeholders watch the demonstration to understand what the release delivers; L&D teams can use it
  to discover improvements relevant to their training workflows.

## Feature Functions

- Generate a narrated demonstration after each stable release is published.
- Show selected user-facing changes since the previous published ancestor release.
- Present a clickable poster and film download link above the existing release notes.
- Keep current and earlier demonstrations accessible in the public film archive.
- Retry recording or publication manually while protecting an existing film from unintended replacement.

## End-User Value

Viewers can understand a release through concrete examples in the application. A prominent film preview makes the
demonstration easy to find, and the archive provides a lasting reference for earlier improvements. Release owners
get a repeatable publication process with less manual coordination.

## How It Works

A release owner publishes a stable release on GitHub. Mentingo queues a recording for that exact tag, compares it
with the previous published ancestor release, and selects changes that can be demonstrated through the interface.
The existing process records scenes, checks the narration against the pictures, adds the voice and renders the film.

After a successful recording, publication attaches the film, poster, subtitles and page archive to the release,
places one film section at the top of its notes, and rebuilds the GitHub Pages archive while keeping earlier films.
Repeated publication updates the section without duplicating it and keeps the remaining notes. The poster opens
the MP4; it is not an inline video player.

Drafts and prereleases do not queue automatic films. There is no monthly timer: each stable release triggers its
own recording. A failed recording leaves the release published and can be retried manually. Existing films require
an explicit replacement choice; releases published before this automation is deployed can be recorded manually.

## Key Technical Context

- `.github/workflows/release-film-on-release.yml` reacts to `release: published` and dispatches the existing
  `release-film.yml` on the default branch with the release's exact tag, publication on and replacement off. Both
  workflows must be deployed before future releases; release-event workflows execute from the release tag.
- Default-branch dispatch respects the existing `release-film` and `github-pages` environment branch rules. It
  uses the repository token with Actions write access; the separate recorder uses the existing Claude subscription
  secret. Film selection, voice, visual checks, queueing and branding remain in the established recording process.
- `.agents/skills/release-film/ci/release_assets.py` publishes the film section and rebuilds the archive. Recordings,
  release assets, GitHub Pages, reports and project knowledge are public; production tenant data is not used.
- The dispatch run reports whether recording was queued. The separate recording and publication run reports the
  film's outcome. Release-note edits do not trigger additional recordings.

## Test Evidence

- Workflow tests check stable-publication eligibility and execute the dispatch shell step with a fake GitHub CLI,
  verifying the exact tag, default branch, publication options, dispatch failure and safe handling of tag text.
- Publication tests verify that the film section precedes the original notes, older sections move to the top,
  repeated publication stays idempotent, and the poster points to the film. Existing tests cover asset protection
  and preservation of films already shown on Pages.
- No application behavior changes. A live GitHub release event, provider-backed recording and public deployment
  have not been executed as part of this change; they require the workflows to be deployed.
