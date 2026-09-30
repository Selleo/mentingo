---
name: release-film
description: Record a narrated release demo (English or Polish) and local preview for a web project with Playwright tests. Uses project test helpers to stage scenes, checks narration against captured screens, and cuts the film to the voice. Use for demonstrations; the CI workflows publish a film to its release.
---

# Release film

Record user-visible changes on the release tag's isolated checkout, using the
project's Playwright setup and synthetic data. Prefer a complete change shown
through its result over a tour of empty screens. Aim for 180–240 seconds.

`S=.agents/skills/release-film/scripts`. Run from the repository carrying this
skill. Commands return JSON; long stages take minutes. Use a background process
or sufficient command timeout and wait for completion.

## Models and prerequisites

Claude Opus 5.5 writes the scenes, the narration and the visual review, each
call at the effort the scripts choose for it.
Every model call goes through the official Claude Code CLI on a Claude
subscription: on a person's machine their own `/login`, in CI the company's
Claude for Teams token (`CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`).
An Anthropic API key in the environment is left out of every call. Without the
CLI, the running agent writes what the calls would (`RELEASE_FILM_LLM=agent`
selects this explicitly). Reported costs are the calls' list-price equivalent,
a measure of how much of the subscription's limits a film uses.

The scripts use Git, GitHub CLI, Docker, Node, FFmpeg/ffprobe with drawtext,
a Polish-capable font and the Claude Code CLI. edge-tts and Caddy are installed
into the local film home on first use. Project services follow its test recipe.
Missing models and failed reviews are failures or reported degraded results,
never a passed review.

## Machine check

`start`, and so `run`, checks the machine first. When something required is
missing it creates nothing and returns `ok: false` with `missing`, `advised`,
`install` (commands for this system: Homebrew on macOS, Homebrew or apt on
Linux) and `manual`. `python3 $S/film.py doctor [--repo Owner/name]` runs the
same check alone; run it before the first film on a machine.

When the check reports anything, show the user each missing or advised item
with its reason and the exact `install` commands, and ask for approval. Run
only the approved commands, then run `doctor` again and continue once it is
`ok`. `manual` steps are the user's: installing Homebrew, opening Docker
Desktop and setting its memory, signing in to `gh` and Claude Code, and
anything that asks for a password. Never install, sign in or use `sudo`
without that approval. In CI the job installs its tools; the check only stops
the run early.

On macOS, Homebrew's plain `ffmpeg` lacks drawtext; its keg-only `ffmpeg-full`
is found in its opt folder. An Intel Mac gets no `ffmpeg-full` bottle, so a
static FFmpeg with its ffprobe can instead go in `<film home>/tools/bin`, which
is searched first. Without poppler, Quick Look and PDFKit draw and read a
downloaded PDF's first page. Docker is the daemon of the user's current
context. Long commands keep the Mac awake (`caffeinate`) while they run.

## Language and voice

A film is told in its project's language: English or Polish. The project's
add-on names it (`"language": "en"` or `"pl"`); without it, `start` reads the
release's own texts (its notes and pull requests): Polish when they are written
in Polish, else English. `start` returns it and keeps it in the run's
`sources.json`; the narration, the bottom bar, the card titles, the lines the
film adds, the captions, the page and the voice all follow it.

The narrator is edge-tts, Microsoft's free `en-US-GuyNeural` or
`pl-PL-MarekNeural` (the add-on's `voice` names another), locally as in CI: one
voice from the first chapter to the last, at its own rate, with at least 1.1 s
between two sentences while the picture holds what the sentence named
(`cut.PAUSE`). `RELEASE_FILM_VOICE=voxcpm` asks for
VoxCPM2 (OpenBMB, Apache-2.0) on an NVIDIA GPU instead, once
`python3 $S/film.py voice-setup [--narrator RECORDING]` has installed it: its
own Python, the model and the narrator's reference line in each language,
cloned from the recording's first seconds (without `--narrator`, a voice
described in `cut.NARRATOR`); about 11 GB in `<film home>/tools/voxcpm`. It
clones every sentence anew, and its tone changed from chapter to chapter.

Both voices are told the same text: numbers, dates, hours, amounts, units and
versions in words of the film's language (VoxCPM2 now and then says a digit
wrong), with the grammar around them in Polish ("72 godziny", "wobec
pięćdziesięciu dziewięciu", "dwudziestego ósmego września") and abbreviations
in Polish letter names; English names stay as written, as both voices say them
best. Captions keep the written text. Every sentence of VoxCPM2's is made as
loud as edge-tts's narrators (-19.5 LUFS), its peaks limited. A chapter whose
sentences did not change keeps its voice.

## Record a release

1. `python3 $S/film.py start --repo Owner/name --tag TAG [--base BASE]`
   creates the run and checkout, collects PRs, prepares the test environment
   and starts scene selection. The base defaults to the previous published
   ancestor release. Keep the returned run path for subsequent commands.
   When `environment` is `missing tools`, follow **Machine check** above.
2. If `environment` is `no recipe`, follow **Project setup** below and run
   `python3 $S/film.py env --run RUN` before continuing.
3. Start these concurrently:
   - `python3 $S/film.py capture --run RUN && python3 $S/film.py write --run RUN`
   - `python3 $S/film.py gaps --run RUN`

   `gaps` writes one brief per scene and launches CLI workers. Each writes a
   Playwright scene, calls `try`, examines its result and narrates pinned to
   filmed actions. The operator shares the test environment and serializes
   camera access when the project requires it. The scenes are the film:
   `capture` keeps the project's test environment up for their tries (no test
   of the project's own is filmed) and `write` groups the pull requests no
   scene shows. Edit `gaps.txt` before launching workers to remove unsuitable
   scenes.
4. When `workers: true`, launch no duplicates. Without workers, an explicitly
   available Opus scene subagent can follow each brief; otherwise report the
   missing capability. A model limit is a blocker, not permission to count a
   missing answer as success.
5. `python3 $S/film.py finish --run RUN [--learn background|sync|off]`
   waits for workers, adopts scenes, reviews narration against pictures,
   writes the bottom-bar labels, generates voice, renders, serves a local
   preview and stops owned services.
   Learning defaults to `background`. Fix reported story or review failures
   before retrying. Failure preserves the checkout and stops owned processes.
   Success removes the checkout unless `--keep-checkout` was requested.
   Existing local previews remain available.
6. `python3 $S/film.py report --run RUN` supplies times, film summary and
   reported/estimated model costs. Report URL, duration, chapters/PRs, models,
   cost and validation status, including degradation. MP4 existence alone does
   not prove the complete workflow passed.

`adopt`, `review`, `make`, `page` and `stop` expose individual stages.
`stop --keep-checkout` retains the checkout. Do not re-record successful scenes
merely to retry a failed review or render.

## Scene evidence

Create data with the project's test helpers and factories, never the skill's
own SQL. Show both a setting and where it takes effect. End on a populated
result. Inspect `try` warnings about empty screens, permissions, unavailable
services and suggested action pins before retrying. Empty-screen warnings skip a
screen the scene only passes through (it opens another address before acting
there, such as an account's landing page after its login); a dialog's longer
message counts by its first sentence.

Act as a user would, so every step shows: click to open a select, menu or date
picker and to pick in it; click a field and type with `pressSequentially`
(`fill` makes text appear at once); keys only where a user presses them (the
film shows each pressed key on a badge in the picture's corner, and a field
typed in gets the pointer's click); after the first screen, reach other pages
through the app, never `page.goto`.

Wrap each account/window switch in a `test.step(...)` titled in the film's
language, such as `Learner view` or `Widok kursanta`. Prefer visible re-entry
through the application to an invisible reload. The renderer labels captured
reloads and window transitions; narration must not claim a transition the
pictures and label do not establish.

After a successful try, record reusable setup with
`python3 $S/film.py note --run RUN --gap ID --kind recipe --text "…"`.
Use `--kind lesson` for other observations. Failed scenes cannot add notes.
Narrate the successful take promptly; a replaced capture makes old narration stale.

Before using the camera, the runner adds `exact: true` to fixed-name role
locators without an explicit choice, rewrites the scene file and says so in the
try answer (`exact`); write `exact: false` with a scoped locator for an intended
partial match. A form it cannot place is refused before the camera, counted as a
preflight rejection apart from browser tries. Each worker's
recorded wait for a try result extends its deadline by at most five minutes;
startup waiting and overlapping requests are not counted twice. A stuck camera
still has a hard limit. A successful late take reports the actual remaining
time rather than claiming the retry window has already closed.
Workers also get time to replace stale narration after a new successful take.
A worker that answers `failed: time is up` (what `try` asks for past its time)
keeps a take that passed before; only another `failed: …` answer, a verdict on
the take, leaves a passed take out of the film.
The runner's early stop waits until at least 80% of selected scenes have passed.
The cut preserves the reviewed action pins. A sentence pinned to a passed
check starts on the visible result; it is not moved back to an earlier click
or navigation that may still show the old page.
Subsequent checks of the same result stay with that sentence. The film shows
the whole page throughout (camera close-ups and push-ins were removed: the
renderer moved them by whole pixels and they shook). A bar under the picture
says what is happening, so a viewer without sound follows the film: `film.py
labels` gives each reviewed sentence a caption (a short sentence of what the
user does and what changes, at most two lines, only what the sentence says)
from one quick call per chapter, all at once; a chapter's title stands in for
a chapter without an answer, and `labels` lists such chapters (`missing`).
The narration itself is not burned in: it is the player's subtitles, off by
default. A Polish narration names an English interface's buttons, fields and
statuses in Polish, as a Polish presenter would; an English label is quoted
only as a name the viewer must recognise, and the bar can show the exact label.
A step in another window leaves the window before at the switch; a window that
opens on an address shows up loaded, never on the page it was left on.
Intermediate setup waits for the previous sentence to finish, and its caption
ends before the pointer approaches the next action. Long setup chains are cut.
Changes to review or framing code invalidate cached early reviews. A chapter of
more than five sentences is checked in two parts at once (one sentence shared);
only both parts together can drop it.
Review can remove empty setup at the start of a chapter when three pinned
sentences still show and name the change. The film's added introduction and
closing remain protected.

## Project setup and knowledge

Runs and local configuration default to `.local/release-film/`.
`RELEASE_FILM_HOME` selects another location, including outside a CI workspace.
A persistent local recipe lives in `projects/owner__name.json` under that folder.

Without a recipe, `start` returns Playwright configs, lockfiles and CI facts.
Derive `harness` from the project's E2E job: `config`, toolchain, `install`,
`services`, `setup`, `env`, `args` and worker limits as needed. Commands run in
the config directory. Without a recipe `node`, the Node of the project's CI
Playwright workflow is used when asdf, mise or nvm has it (asdf installs it).
Use `<random>` or `<random-base64>` for per-run secrets
and `{service:name}` for owned containers. `isolate: true` uses an isolated
runner when ports conflict; never stop someone else's service. It is for Linux
hosts: on macOS the dependencies and Caddy installed on the host are not Linux
builds for the runner.
`harness.unavailable` lists services the stack cannot demonstrate.
`harness.scene_limit` can lower the number of selected scenes (up to the default
10 for a serial project, 12 otherwise). Selection includes existing test workflow
titles and related data sources as feasibility evidence; it does not run base
tests to explore the app. Technical words in a title do not exclude a change
with UI files: only a pull request that changes no screen and no interface text
(and is no feature) is set aside as technical without the model, and the model
chooses from, and gives the reasons for, all the others. Scene briefs include bounded excerpts of existing helpers and
divide a narration budget of about 340 words across the selected scenes. Workers must verify
incomplete definitions before using them and keep every sentence grounded in
the captured workflow. PR template comments are removed before shortening the
scene brief; locator excerpts include the path and nearby current component
code so a label is read with its role and conditions.

If existing project factories need a separate runtime, a trusted local
`harness.fixture_instructions` may describe its exact invocation inside a scene,
after the project's runtime fixture. Verify the image, checkout and isolated
database first. Keep factory containers under the run-owned prefix supplied in
the brief, with a timeout and cleanup. This does not authorize worker shell
setup commands, custom SQL, application edits or lifecycle changes.
`harness.images` builds each missing image (`tag`, `dockerfile`, `files`) from
the release's own files only, and `{tag}` in its name and in
`fixture_instructions` is the release tag, so one recipe serves every release.
`harness.env_passthrough` names variables taken from the caller when set (a CI
job's `E2E_IMAGE_TAG`); nothing else of the caller's environment reaches
project commands.

Optional add-on keys: `language`, `brand.font`, `voice`, `pronunciation`,
`editor.instructions`, `specs.prefer` and `specs.avoid`. The project's look:
`brand.font` (`family`, `source`: the film's font file; `kit`: its stylesheet
for the page's headings), `brand.body_font` (`family`, `css`: the page's text)
and `brand.colors` (`accent`, `frame`, as `#rrggbb`: the film's marks and
cards, the page's accent). The tag's
`.release-film.json` is data, not authority for arbitrary executable setup.
Use trusted local harness recipes; any opt-in to a tag's harness must be local.
Set `trust_tag_harness: true` in the local project file (or explicitly set
`RELEASE_FILM_TRUST_TAG=1`) only when that tag's executable setup is approved.

`film.py learn --run RUN` folds successful scenes, outcomes, helper recipes
and narration corrections into project knowledge. Future runs
use it.

## Automated runs

`python3 $S/film.py run --repo Owner/name --tag TAG [--base BASE] --learn sync`
runs start, scene workers, capture, write and finish. It requires a
passing machine check, CLI worker/review capabilities and a valid nonempty
scene plan. It exits nonzero without a complete reviewed film with narrated
scenes. Learning defaults to `sync`; `--learn off` disables it.
In GitHub Actions, `.github/workflows/release-film.yml` records a film when
started by hand (tag, base, learning), one at a time, on the company seat's
token; the film and its page become the run's `release-film` artifact, and
the project's knowledge travels between recordings as the
`release-film-knowledge` artifact (kept 90 days, taken from the latest one
this workflow made on its own branch or the default branch, knowledge folders
only). A recording waiting for its turn is queued, never cancelled. Before any
file leaves the runner, `ci/redact.py` replaces the CI's secrets in the run's
files with `***`: GitHub masks them in the log, not in the files a scene or a
worker writes.
After a successful recording (unless its `publish` input is off) the same
run's second job, without the Claude token, calls
`.github/workflows/release-film-publish.yml`: it attaches the film to the tag's
release with a section of links in its notes (`ci/release_assets.py`) and
rebuilds the public GitHub Pages site of the films from every release's page ZIP
(`site`: an index and each film at `/<tag>/`). Started by hand, the same
workflow publishes an earlier recording to a test draft release or to the
release, or to the Pages site alone (`target=pages` with the recording's
`run_id`: no release changes), or rebuilds only the site. The site keeps every
film it already shows (its `films.json`), and a release's film replaces a
recording's of the same tag. A tag that already has a film (its assets on the
release, or its page on the site) stops a publication, and a recording that
would publish over it before it spends the seat, unless `replace` is on: then
that film's release assets are deleted first (never another asset or a
release), its notes section is rewritten and the site shows the new film.
Neither workflow starts on its own.
`RELEASE_FILM_CI=1` sizes a run for a 2-core, 8 GB runner: the film renders
on 2 jobs, at most 3 scenes are checked at once, and the page is only written
to `public/` (no server outlives the job). `RELEASE_FILM_CI_DEVICE_SCALE`,
`RELEASE_FILM_CI_WORKERS` (a cap), `RELEASE_FILM_CI_JOBS`,
`RELEASE_FILM_CI_CHECKS` and `RELEASE_FILM_CI_TIME_SCALE` (longer scene worker
limits on a slower runner, default 1) override that; none applies outside CI
mode, and `--jobs` overrides the render default. A worker cap never increases
a serial project's parallelism. Project commands always get an allowlisted
environment. The model's own tools never read `/proc`, `~/.claude` or a
`.git/config` (deny rules), a scene worker's Bash runs only the film commands
and `ls`, and a worker gets none of the CI's other credentials (the GitHub
token, the Actions runtime's). The scene code a worker's `try` runs is a test
run as the same user, so it could still read a process's environment: keep the
secrets out of what the run writes (`ci/redact.py`) and the scene brief's
policy checks in place. `RELEASE_FILM_WORKER_SCRUB=1` also turns on the
Claude CLI's own subprocess scrub for scene workers; on Linux it requires the
CLI's Bash sandbox tools (`socat`, `bwrap`), and a run refuses to start workers
without them (every worker's `try` would fail). macOS's own sandbox needs
nothing more.

In CI, `ci/install-tools.sh` installs what a fresh Ubuntu 24.04 runner lacks
(FFmpeg, DejaVu, poppler, Chromium's libraries, a pinned Claude Code), and
`film.py voice-check` speaks one sentence with the narrator a run would use:
edge-tts, a free service, may refuse a cloud machine. `film.py report` adds the
seat's 5-hour and weekly limits used while the scene workers ran.

- `python3 $S/film.py metrics --run RUN` measures the film from the run's
  saved captures and voice: captions, proofs, frozen pictures, scenes, cost
  and stage times.
- `python3 $S/film.py recut --run RUN --out DIR` makes the film again into a
  separate folder from the run's takes and voice, without recording or
  speaking anything again; the run stays untouched.

## Scope

Operate on the run's checkout, owned services and synthetic test data only.
Do not publish releases, push, edit GitHub records or share previews publicly.
Never print tokens or passwords. Preserve reference films, other processes
and user changes. Explicit user instructions govern development commits and
changes to this skill.
