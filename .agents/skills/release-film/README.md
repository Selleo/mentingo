# Release films

Every release deserves a demo. For a release tag, this skill records a narrated film of the release's user-facing
changes in the product itself, in short scenes an AI agent writes from the project's own end-to-end tests, and builds a
page with the film, its chapters and every pull request of the release. For Mentingo v4.15.0, with 111 pull requests, it
made a 4-minute film in 8 chapters in 17 minutes of GitHub Actions, for $8.56 of model calls at API list prices.

[![The first chapter of the Mentingo v4.15.0 release film, "Live Training scheduled from the calendar", in a player
bar at 0:00 of 4:03 with the sound off: an admin clicks a day in the calendar, picks Live Training, types the
workshop's title, keeps it in person with a room as its location and creates it; the training appears on that day,
its details open, and a button leads to the training's own page. A bar under the picture says what happens at each
step.](readme/film.webp)](https://selleo.github.io/mentingo/v4.15.0/)

The first of the 8 chapters of the Mentingo v4.15.0 film, shown here without sound: [watch the whole film with its
narration, chapters and the release's 111 pull requests](https://selleo.github.io/mentingo/v4.15.0/). Every film:
https://selleo.github.io/mentingo/.

## 1. The problem

A release often bundles dozens of pull requests: Mentingo v4.15.0 has 111 since the previous published release, v4.9.0.
Turning them into a demo by hand means reading them and deciding which changes matter to users, starting the right
version with data that shows each change, clicking through every feature until the take is clean, recording a
voice-over, and editing.

The symptoms are familiar. The demo is skipped when the sprint is busy. It shows the few changes the presenter
remembers, not everything that shipped. It is recorded weeks later on a different build, and the people who could
answer "what did we ship?" are pulled away from development to make a video.

We still want a demo for every release. A recording is cheap evidence that the filmed changes work end to end on the
released build, and it shows stakeholders and clients what the release gave them. The skill needs a web product whose
Playwright end-to-end tests start it with test data, which is what a CI job that runs those tests already does. We
use it on Mentingo, an open-source learning platform (a NestJS API and a Remix front end in a pnpm monorepo), and on
an internal product built on Rails, NestJS and React.

## 2. Business impact

The direct cost is people's time. A QA or marketing specialist estimates about two hours for one release demo. With
a release every two weeks, that is 26 demos and 52 hours a year for each product, and a team that ships every week
spends twice as much.

The indirect costs are harder to count:

- **Late feedback.** Changes nobody sees get feedback only when someone stumbles on them, when changing them costs
  more.
- **One person as the bottleneck.** When the same developer or product manager always prepares the demo, release
  day depends on their calendar.
- **No evidence.** Without a recording there is no cheap proof that the release's main changes work end to end
  before they reach the client.
- **Lost sales material.** A release nobody can see does not help sell the next phase of work.

## 3. How to check whether you have this problem

Answer four questions for your last few releases.

**How much would a complete demo have to cover?** Count the pull requests between two published releases. With squash
merges, the pull request's number is in the commit subject:

```bash
git log --oneline v4.9.0..v4.15.0 | grep -cE '\(#[0-9]+\)'
```

For Mentingo this prints 111.

**How many of those releases had a demo, and how much of the release did it show?** If the answers are "some" and
"a few changes", stakeholders are guessing.

**How many hours went into them?** Time entries or calendar blocks named after demos and release notes will tell.

**Can a clean machine start the product with test data and a test user in one command?** If your CI runs Playwright
end-to-end tests, it already does. That is the main prerequisite; the others are a GitHub repository and a Claude
subscription with Claude Code. If the answer is no, start there.

## 4. Root cause

Preparing a demo is manual, sequential and hard to repeat. What it needs lives in people's heads: how to start this
version, which user sees a feature, which data makes it visible, where the new button is. Every release pays for
finding it out again.

Handing the whole job to an AI agent is the obvious next step, and the obvious version is slow. In our first attempt
the agents clicked through the application themselves, step by step, and a run took 55 minutes, about 60% of it the
model generating output click by click. The skill therefore splits the job. The AI decides: what to film, how to show
it, what to say and whether the words match the picture. Scripts do the mechanics: starting the product, filming, the
voice and the editing. What a run learns about the product is written down for the next one.

## 5. The solution, step by step

![One run, from the release tag v4.15.0 to a film: a script collects 111 pull requests and starts the E2E stack;
Claude Opus 5.5 picks 8 changes to film; eight scene workers film them, four on the first try and the others in two to
four tries; the review checks 43 sentences and rewrites 13; the voice, the caption bar, the cut and the render make a
4:03 film and a page with all 111 pull requests; the run keeps 15 new lessons for the next one.](readme/one-run.webp)

A run takes the release tag and the previous release, and every step leaves plain files that the next step, and a
person, can read.

**1. Start from the tag.** A script collects the pull requests since the previous release and starts the product
from the release tag in its test environment, with its test data. Because it starts from the tag, the film shows
exactly what was released.

**2. Choose what to film.** Claude Opus 5.5 picks the changes a user can see and the test environment can show. Every
other pull request gets its reason on the page, and the ones a script sets aside as technical are grouped together.
For v4.15.0 that accounts for all 111 pull requests:

| In the film, or why not | Pull requests |
| --- | --- |
| In one of the 8 chapters | 13 |
| Set aside as technical changes | 51 |
| Small bug fixes, too minor for a short film | 18 |
| Login, security, email, storage and setup changes, mostly behind the scenes | 10 |
| Small usability improvements | 8 |
| Translation and language support | 6 |
| AI mentor changes, better covered in their own demo | 4 |
| A change its scene could not show | 1 |

Thirteen pull requests fill a four-minute film. The other 98 are not hidden: the page lists each with its reason.

**3. Write and film each scene.** For each change, an AI agent writes a short scene from one of the product's
existing end-to-end tests, creates its data through the product's own test helpers and films it. After a failed try
it gets what the camera saw, such as the step that failed or a screen left empty, and fixes the scene. In v4.15.0
four of the eight scenes passed on the first try. The "Video completion tracking" scene passed on its fourth: the
agent found that the app keeps lesson data for five minutes, brought the learner back in a new session, then waited
for the server to save the finished lesson before closing the first one.
Starting from existing tests means the scenes use the setup the team already maintains.

**4. Narrate, tied to the picture.** The agent narrates its take and ties each sentence to the action it describes.
The film starts every sentence on that action and holds the picture while it is spoken, so the voice and the picture
stay together.

**5. Check every sentence against the frames.** Claude Opus 5.5 compares each sentence with the frames of its own
moment and rewrites or removes what they do not show. In the Mentingo recording in GitHub Actions it rewrote 13 of
43 sentences. An example from a local recording of v4.15.0:

![Every sentence is checked against the frames. The scene worker wrote "With both drafts ticked, one dialog now
publishes them together." The recorded page shows "Selected (0)" and no dialog, so "both drafts ticked" and "one
dialog" fail; both courses show Published and a message confirms the update, so "publishes them together" holds. The
sentence is rewritten to "We now publish both courses together, and a message confirms the update." In that local
recording of Mentingo v4.15.0 the review rewrote 11 of 37 sentences and dropped none.](readme/review.webp)

The agent had written that both drafts were ticked and that a dialog published them. The frames showed no ticked row
and no dialog, only the result, so the sentence now says only what they show.

**6. Produce the film and the page.** One quick Claude call per chapter writes the bar under the picture, which says
what happens, so the film works without sound. Scripts add the voice (Microsoft's free voices, English or Polish) and
chapter cards, in the product's own font and colours when its recipe names them, render a 1080p film and build the
page with the film, its chapters and the list of pull requests.

[![The page of the Mentingo v4.15.0 film: "Changes since v4.9.0: 111 pull requests, a 243-second film", the player and
the list of 8 chapters with their times.](readme/page.webp)](https://selleo.github.io/mentingo/v4.15.0/)

**7. Learn for the next release.** What worked is written down, and the next recording reads it first. The first
successful Mentingo recording in GitHub Actions started with nothing and kept 15 lessons (such as the five-minute cache
of lesson data), 8 recipes for preparing data and 10 rules for the narration.

After a successful recording the film goes to the release on GitHub and to the project's GitHub Pages site of films. A
release that already has a film keeps it: the recording stops before it starts, unless it is asked to replace the old
film. To watch a film before it is published, record it with publishing off and publish it later, to the release or to
the site alone, as the Mentingo v4.15.0 film was.

To try it on a project, see [For developers](#for-developers) below.

## 6. Before and after

For one release:

| | By hand | With the skill |
| --- | --- | --- |
| A person's time | about 2 hours (a QA or marketing specialist's estimate) | about 10 minutes to watch the film and check the page (our estimate) |
| Machine time | none | 17–31 minutes, unattended |
| Cost | the specialist's hours | $7–10 of model calls at Claude API list prices; about a third of a Claude for Teams seat's 5-hour usage limit (25–35%, measured while the scene workers ran) |
| What the stakeholders get | a demo of the changes someone chose to show | a film of the main changes a user can see (8 in v4.15.0), and every pull request with its chapter or reason |

A person's work changes from making the demo to reviewing it. Machine time, limits and prices come from three
recordings in GitHub Actions on two products in September 2026.

The yearly business case follows from these numbers:

```text
yearly saving = releases × (hours by hand − hours of review) × hourly rate − releases × cost of a film
```

With a release every two weeks, the two estimates above, $10 a film and an assumed $50 an hour:

```text
yearly saving = 26 × (2 h − 0.17 h) × $50 − 26 × $10 ≈ $2,380 − $260 ≈ $2,120 per product
```

That is about 48 hours of a specialist's time a year for each product, and twice as much for a team that ships every
week. The model calls are paid by the Claude subscription, so on a seat that already exists and has room in its
limits a film costs little extra. The case leaves out the seat itself, the one-time setup of a project's recipe and
re-runs after a failed recording.

## 7. When it does not make sense

- **Small or invisible releases.** With a handful of pull requests, or with changes only behind the interface, a
  two-minute recording by the author is enough.
- **No Playwright end-to-end tests that start the product with test data.** They come first; without them the skill
  has nothing to film through.
- **Projects outside GitHub.** The skill reads the release's pull requests from GitHub.
- **Features that depend on outside services.** Payments, video calls or an AI provider cannot be shown with test
  data. Mentingo's test environment has no AI provider configured, so no AI mentor change was filmed; the page lists
  four of them in a group of their own.
- **Promotional videos.** A synthetic voice and automatic editing show stakeholders and clients what changed. They
  do not replace a produced launch video.

## Safety

- The product runs on an isolated copy with test data, never on a live system, and scenes create data only through
  the product's own test helpers or its interface.
- The AI token is available only to the steps that need it, and secrets are removed from the run's files before
  anything is uploaded.
- A published film is never removed by accident: a recording or a publication for a tag that already has a film
  stops, unless it is asked to replace that film.
- A film can be watched before it is published: with publishing off, it waits in the run's artifacts for 14 days
  until someone publishes it (in a public repository, anyone signed in to GitHub can download those artifacts).

## For developers

On a machine the skill needs Python 3.9 or later, Docker with 8 GB of memory, 20 GB of free disk, the project's Node,
FFmpeg, Git, a signed-in `gh` and the Claude Code CLI signed in with a Claude subscription. Check the machine first (it
lists anything missing with the commands to install it), then record:

```bash
python3 .agents/skills/release-film/scripts/film.py doctor --repo <owner>/<name>
python3 .agents/skills/release-film/scripts/film.py run --repo <owner>/<name> --tag <tag>
```

A project needs a recipe in `projects/<owner>__<name>.json`: how to install it, which services its tests need and
which Playwright config runs them, plus optional keys for its language, font and colours. [SKILL.md](SKILL.md)
describes the keys and the other commands.

<details>
<summary>Mentingo's recipe, shortened</summary>

```json
{
  "language": "en",
  "brand": { "font": { "family": "all-round-gothic" }, "colors": { "accent": "#3f58b6", "frame": "#222949" } },
  "harness": {
    "config": "apps/web/playwright.config.ts",
    "node": "22.15.0",
    "install": [
      "cd ../.. && pnpm install --frozen-lockfile",
      "cd ../.. && pnpm -w packages:build",
      "pnpm exec playwright install chromium"
    ],
    "services": [
      { "name": "postgres", "image": "pgvector/pgvector:pg16", "ports": ["54321:5432"] },
      { "name": "redis", "image": "redis:alpine", "ports": ["6380:6379"] },
      { "name": "mailhog", "image": "mailhog/mailhog:v1.0.1", "ports": ["1025:1025", "8025:8025"] },
      { "name": "rustfs", "image": "rustfs/rustfs:latest", "ports": ["9100:9000"] }
    ],
    "scene_limit": 8
  }
}
```

</details>

In GitHub Actions a person starts every recording, and a recording with `publish` on starts the publication itself.
Publishing to the site needs GitHub Pages built from GitHub Actions, with the branch allowed in the `github-pages`
environment.

- `release-film.yml` records the film of a tag on a Claude for Teams token (`CLAUDE_CODE_OAUTH_TOKEN` from
  `claude setup-token`, kept in the `release-film` environment, whose branch rule names the branches that may use
  it). One recording runs at a time. Its `publish` input is on by default: after a successful recording the film
  goes to the tag's release and the Pages site. A tag that already has a film stops the recording before it starts,
  unless `replace` (off by default) is on.
- `release-film-publish.yml` publishes a recording (its run ID) to a test draft release, to the tag's release or to
  the Pages site alone. A tag that already has a film stops it unless `replace` is on, which first deletes that
  film's release assets (never another asset). The site keeps every other film it already shows.

<details>
<summary>The recording job's steps</summary>

| Step | Claude token | What it does |
| --- | --- | --- |
| Install the tools, prepare the film home | | FFmpeg, fonts, Chromium's libraries and a pinned Claude Code |
| Check the machine, check Claude Opus on the seat | yes | stops the run early when something is missing |
| Check the narrator's voice | | the free voice service may refuse a cloud machine |
| Resolve the release | | checks the tag and the base; with `publish` on, that the tag has a release and, unless `replace` is on, no film yet |
| Restore the project's knowledge | | from the last recording's `release-film-knowledge` artifact |
| Record the film | yes | `film.py run`, sized for a 2-core, 8 GB runner |
| Hide secrets in the run's files | yes | replaces the CI's secrets with `***` before anything is uploaded |
| Stage the film for its release | | checks that the film plays to its end, names its files and records their SHA-256 |
| Summarize the film | | the job summary: the film, the seat's limits used, the list-price cost |
| Upload | | the film and its page and the run's report, kept 14 days; the project knowledge, kept 90 days |

In a public repository the artifacts and the job summary can be read by anyone signed in to GitHub.

</details>

| Path | What it holds |
| --- | --- |
| [SKILL.md](SKILL.md) | The skill's instructions for the agent that runs it |
| `scripts/` | `film.py` and the steps of a run |
| `scripts/capture/` | The Playwright camera that films a scene's test |
| `ci/` | The helpers the workflows run |
| `projects/` | Each project's recipe and the pronunciation shared by all projects |
| `readme/` | The pictures in this README |
| `tests/` | The skill's tests |
