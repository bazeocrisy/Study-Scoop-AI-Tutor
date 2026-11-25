# Assignment 002B — Teaching Engine Foundation Report

**Date:** 2026-11-25
**Developer:** Claude Code
**Repository:** https://github.com/bazeocrisy/Study-Scoop-AI-Tutor
**Branch:** `feature/division-academy`, at https://github.com/bazeocrisy/study-scoop-ai-tutor/tree/feature/division-academy
**Base:** `feature/lesson-6-1-prototype` at `e2b03609e8cff37b2e450ef96d70c4ca49abc5cc`
**Implementation commit:** `20fc92d0b1787dd743b028fed1f257de3c8b6c26`. This report is added in the commit that follows it.

**Scope:**

- Only Phases 1 and 2 were done.
- Not started (awaiting architectural review): narration timelines, persistence, division visuals and division curriculum.
- Nothing was merged or deployed.
- The original area prototype branch was not changed.
- No paid or live AI calls were made, and no external AI service was contacted.
- No new student information is collected.
- No physical device or live voice testing was performed.

---

## 1. Pre-work verification

| Check | Result |
|---|---|
| Repository identity | Cloned from `https://github.com/bazeocrisy/study-scoop-ai-tutor`, and `remote.origin.url` matches. **Verified.** |
| Baseline | `origin/feature/lesson-6-1-prototype` resolved to `e2b03609e8cff37b2e450ef96d70c4ca49abc5cc`, matching the audited baseline exactly. **Verified.** |
| Write permission | The repository was attached with push access. I created `feature/division-academy` at the baseline and pushed it **before** making any changes, which proved write access. **Verified.** |
| Node version | The README documents Node 24 or later. The container had Node 22.23.5, so I installed Node **24.22.3** from the npm registry (`node@24`) in a scratch folder. All final verification ran on Node 24.22.3. |
| Original branch | No commits were made to `feature/lesson-6-1-prototype`. It still points to `e2b0360`. |

---

## 2. Phase 1 — Teaching-engine generalisation

### What changed

| Requirement | Implementation |
|---|---|
| 1. Versioned schema and registry | **`engine/schema.js`** contains `SCHEMA_VERSION = 1`, `validateLesson()`, `assertLesson()` and `validateRegistry()`. The schema covers fields, ids, concepts, checks, follow-ups, examples, visuals, prerequisites, assessment items, remediation settings, presentation text and unit words. Unknown fields are rejected. **`curriculum/registry.json`** lists the lessons and a default lesson. **`curriculum/lessons.js`** bundles the lessons for the Worker, which cannot read files at runtime; a test fails if it differs from the registry. |
| 2. Lesson identifiers removed | See the list after this table. No engine, Worker, browser or script code names lesson 6-1 or the subject "area". A test enforces this, ignoring comments. |
| 3. Pluggable visual renderers | **`engine/visuals.js`** is a DOM-free registry that handles validation, completion checks and build capacity. **`ui/renderers.js`** is the matching browser drawing registry. A visual chooses its renderer with `visual.renderer` (default `grid`). A test requires both registries to have the same names. |
| 4. Pluggable graders | **`engine/graders.js`** registers four graders: `number`, `exact`, `build` and `reason`. Each grader validates its own curriculum data, declares the kind of response it expects, and grades deterministically. Teaching checks and assessment items use the same graders. |
| 5. Hardcoded answers and grid sizes removed | The teaching build target now lives in the curriculum (`check.answer: 8`). Connectivity and bounds use each item's own canvas (any rows × columns). The review screen redraws a built figure on the canvas of the item that was answered. |
| 6. Area curriculum preserved | `curriculum/6-1.json` keeps every teaching text, question, option, answer, example, visual and feedback unchanged. It only gains metadata: `schemaVersion`, `subject`, `grade`, `version` 2→3, `presentation` (the page text that used to be in `index.html`), `language.units`, `remediation`, `requires` for each concept, and `make.check.answer`. |
| 7. Browser and Worker compatibility | Both use the same controller. The Worker accepts only tokens for registered lessons that pass validation and fails closed otherwise. Sessions saved by the earlier engine are upgraded automatically on their next turn: the completion record is inferred from the linear position. |
| 8. Golden transcripts | `tests/golden/scenarios.js` holds 5 scenarios (108 turns). Their transcripts were **recorded from the unmodified engine and curriculum at `e2b0360`** with `scripts/record-golden.mjs` into `tests/golden/area-6-1.baseline.json`. `tests/golden.test.js` replays them through the new engine **and** through the Worker with its Durable Object coordinator. Every field the baseline produced in each output and saved state must match exactly; fields added in 002B are allowed. A one-word change to a speech string made the golden test fail, then pass again once reverted. |
| 9. Content separated from logic | Lesson content, page text, unit words, prerequisites and remediation limits are in curriculum JSON. Instructional logic is in `engine/`. Subject-specific drawing is in renderer plug-ins. |

**Lesson identifiers removed:**

- **Worker:** the static `6-1.json` import, the `lesson==='6-1'` token check, the `'lesson-6-1-budget'` coordinator name, and `/health` returning `lesson:'6-1'`.
- **Session issuer and browser:** the token issuer's `'6-1'`, and the browser's `fetch('./curriculum/6-1.json')`.
- **AI coach prompt:** "third-grade area lesson".
- **Validator script:** the fixed 9/8 counts.
- **`index.html`:** the title, chapter label, stamp, page-range note, ARIA label and intro text.

**Lesson selection:** the browser loads the registry default, or `?lesson=<id>`. In protected mode it switches to the lesson named in the session token. That token check only keeps the pictures matching the Worker's lesson; the Worker verifies the signature.

### Security controls (verified not weakened)

These are unchanged:

- Origin allow-list and CORS.
- HMAC token signature and expiry check (one hour or less).
- `jti` format check.
- 4,096-byte request limit and 500-character message limit.
- Idempotent `requestId` replay and stale-revision rejection.
- 300 ms answer throttle and 120-turn session limit.
- AI budget of 4 calls per session and 12 per day, off by default.
- Expiry cleanup alarm.
- No secrets in the browser.

The 8 original Worker tests and 5 runtime checks pass unmodified. **Added:**

- A token must name a lesson that is registered and valid.
- A saved session is bound to its lesson; a mismatch returns 409.
- An invalid or unregistered lesson returns 503 instead of being taught.
- The AI prompt's lesson label is reduced to plain characters.

---

## 3. Phase 2 — Confirmed defects corrected

| # | Defect (from the audit) | Correction | Regression tests |
|---|---|---|---|
| 1 | "I need help" in assessment was recorded as a wrong answer | Help phrases are interpreted as commands before any grading. In assessment, help returns the original "independent turn" message and never records, grades, reveals the answer or reveals feedback. | 10 help phrases × (index, records, speech) checks; same phrases through `voiceTurn` |
| 2 | Only exact command phrases worked | `engine/language.js` `command()` covers pause, repeat, help, resume, stop, skip and finished. It allows polite filler but requires the **whole** utterance to be a command, so "squares help us count" stays an answer. In teaching, "skip" becomes a help request. Spoken skip is routed through the answer path. | About 40 phrase→intent cases, 9 must-not-be-a-command answers, and voice routing |
| 3 | Number words above twenty failed | `numeric()` parses words 0–100: "twenty four", "twenty-four", "a hundred", "one hundred". It accepts lead phrases such as "I think it is", "the quotient is" and "my answer is", plus generic and per-lesson unit words. Negatives, decimals, ranges, lists and invented words are still rejected. | Every value 0–100 as words, hyphenated words and digits; 12 rejection cases |
| 4 | Ambiguous speech was graded | `clarity()` runs before grading. A response is asked for again (not graded, not counted as an attempt, revision unchanged) when it is filler only, an affirmation alone, an unclear or multiple number, no number where one is expected, or two different choices. After repeated unclear turns the tutor suggests tapping or typing. Assessment prompts also mention "skip this problem". | Assessment: 7 cases plus a choice item. Teaching: choice, number and reasoning cases |
| 5 | Unlimited repeated remediation | The limit is `remediation.maxAttempts` (6-1 uses 3). Wrong answers 1–2 keep the exact original wording (golden-verified). The 3rd wrong answer, or a 4th help request, ends the loop. | Alternative explanation spoken exactly twice; a child who always answers wrong reaches parent review in 10 turns or fewer; help limit |
| 6 | Struggling child moved on to dependent concepts | Each concept declares `requires` (earlier concept ids). The tutor never starts a concept unless all its prerequisites are learned. | Dependent concepts skipped (`partial`, `irregular` and `make` never taught while `count` is unresolved) and unlocked when it is learned |
| 7 | No safe unresolved-learning state | See the walkthrough after this table. | Prerequisite review then retry; review prerequisite also failing; reteach success unlocking dependents; final unresolved state; survives reconnect; parent notice; assessment opt-in |
| 8 | Assessment integrity | No feedback before review. First answer is locked. Help is never recorded. Unclear answers are not recorded. Natural skip is recorded as skipped. Stale turns are rejected. | Integrity test plus the golden assessment scenario |

**How the unresolved-learning state (defect 7) works:**

1. When the limit is reached, the tutor first **reviews the concept's learned prerequisites**, then retries the original concept.
2. If it is still too hard, the concept is **set aside**, and teaching continues only with concepts that don't depend on it.
3. Set-aside concepts are **retaught once at the end**. If one is learned then, the concepts that depend on it unlock and are taught.
4. If it is still unresolved, the session ends in a parent review marked `needs-reteach`. The review lists the unresolved ideas (with the prerequisites reviewed), any concepts not started because they depend on them, and a **parent notice**.
5. By default (`assessWhenUnresolved: false`) there is no independent assessment of untaught ideas. A lesson can opt in.
6. The state is held in the controller state, so the Worker's Durable Object saves it.

---

## 4. Changed-file inventory (implementation commit `20fc92d`)

29 files: 9,759 lines added and 96 removed. Of the added lines, 7,809 are the recorded golden fixture.

| File | Change |
|---|---|
| `engine/controller.js` | Rewritten around the plug-in registries. Speech strings and progression are kept exactly. Adds bounded remediation, prerequisite review, deferral, one-time reteach, unresolved state, the clarity gate and the saved-state upgrade. |
| `engine/schema.js` | **New.** Versioned lesson and registry validation. |
| `engine/graders.js` | **New.** Grader registry: number, exact, build and reason. |
| `engine/visuals.js` | **New.** Visual specification registry (grid). Canvas-size connectivity and partial-tiling completion. |
| `engine/language.js` | **New.** Normalisation, numbers 0–100, natural commands, clarity checks. |
| `engine/voice-turn.js` | Spoken "skip" goes through the answer path. |
| `engine/coach.js` | The lesson label comes from metadata and is sanitised. Off by default, never called. |
| `ui/renderers.js` | **New.** Browser renderer registry: the grid, extracted unchanged from `app.js`, plus redrawing a built figure. |
| `app.js` | Registry and lesson loading with schema validation; presentation text from the lesson; renderer plug-in; review canvas taken from the answered item; parent-notice section; lesson named by the session token. |
| `index.html` | Lesson-specific text replaced with ids that the lesson fills in. CSP unchanged. |
| `styles.css` | Stamp-number and parent-notice styles. |
| `cloudflare/tutor-worker/worker.js` | Registry-driven, fail-closed lesson loading; tokens must name a registered lesson; session bound to its lesson; neutral coordinator name. |
| `cloudflare/tutor-worker/README.md`, `README.md` | Documentation updated (registry, scripts, 70 tests, Node 24). |
| `curriculum/6-1.json` | Metadata only, as described in Phase 1 row 6. Teaching and assessment content unchanged. |
| `curriculum/registry.json`, `curriculum/lessons.js` | **New.** Registry and Worker bundle. |
| `scripts/issue-session.js` | Optional `[lesson-id]` argument, checked against the registry. |
| `scripts/build-curriculum.py` | Generic structural check of every registered lesson (no fixed counts). |
| `scripts/validate-curriculum.mjs` | **New.** Full schema validation (`npm run validate`). |
| `scripts/record-golden.mjs` | **New.** Records golden transcripts from any controller and lesson. |
| `tests/golden/scenarios.js`, `tests/golden/area-6-1.baseline.json` | **New.** Scenarios and the baseline transcripts recorded at `e2b0360`. |
| `tests/golden.test.js` | **New.** 11 tests: fixture coverage, 5 engine replays, 5 Worker replays. |
| `tests/foundation.test.js` | **New.** 11 tests: registry and bundle, schema acceptance, 27 invalid-lesson cases, 5 invalid-registry cases, Worker fail-closed, token and lesson binding, renderer/grader agreement, canvas-size grading, curriculum build target, no hardcoded lesson text, AI label sanitising. |
| `tests/defects.test.js` | **New.** 15 regression tests for the 8 defect areas. |
| `integration/browser-walkthrough.mjs` | **New.** Headless Chromium walkthrough (`npm run test:browser`). |
| `package.json` | `engines.node >=24`; new `validate` and `test:browser` scripts; `check` covers the new files. |
| `docs/DIVISION-DISCOVERY-AUDIT.md` | Copy of the accepted 002A audit (originally on `bazeocrisy/Add-it-` branch `claude/gallant-ride-ypb5y5`). |

**Unchanged:** `tests/controller.test.js`, `tests/independent.test.js`, `tests/regressions.test.js`, `tests/worker.test.js`, `integration/runtime-check.mjs` and `server/index.js`. I confirmed the test files and the runtime check are byte-identical to `e2b0360` with `git diff --quiet`.

---

## 5. Actual test results

Run on **Node v24.22.3**, npm 10.9.9, Linux container, at commit `20fc92d`, after `npm ci` (0 vulnerabilities). `WRANGLER_SEND_METRICS=false` was set.

| Command or suite | Result |
|---|---|
| `npm test` (all files) | **70 tests: 70 passed, 0 failed**, 0 cancelled, 0 skipped |
| ↳ original `controller.test.js` | 11 passed, 0 failed |
| ↳ original `independent.test.js` | 8 passed, 0 failed |
| ↳ original `regressions.test.js` | 6 passed, 0 failed |
| ↳ original `worker.test.js` | 8 passed, 0 failed |
| ↳ **original total** | **33 of 33 passed** (files unmodified) |
| ↳ new `golden.test.js` | 11 passed, 0 failed (5 scenarios × engine and Worker, 108 turns each way) |
| ↳ new `foundation.test.js` | 11 passed, 0 failed |
| ↳ new `defects.test.js` | 15 passed, 0 failed |
| `npm run check` | Passed: syntax of 11 files |
| `npm run validate` | Passed: "OK 6-1: 9 concepts, 8 assessment items"; Python structural check passed |
| `npm run test:runtime` | Passed. Wrangler 4.156.0 dry-run bundle (58.13 KiB, 15.94 KiB gzipped), then **5 of 5** workerd/Durable Object checks: "PASS: real workerd authorization, Durable Object state, idempotent replay, progression and stale-turn rejection (5 checks)". Nothing was deployed. |
| `npm run test:browser` | **5 of 5 passed** (headless Chromium; details below). |

**Browser walkthrough checks:**

1. **Full area lesson.** One wrong answer (stays on idea 1 and shows the example), then all 9 teaching ideas through touch options, typed answers, tile taps and building. Then all 8 independent problems. Before the first problem, "I need help", "can you help me", "I don't know", "twelve or fifteen" and "um" were typed: none were recorded and progress stayed at "1 of 8". "hold on" paused the lesson and Resume continued it. The review shows "Independent work: 7 of 7", and the built figure is redrawn. No console errors.
2. **Responsive layout.** At 360, 768, 1024 and 1366 px: no horizontal overflow and no errors through idea 5 (the partial-tiling screen). I visually checked screenshots at 360 and 768 px.
3. **Struggle path.** Six wrong answers on idea 1 lead to a review with "Ideas that still need teaching", the unresolved idea, 8 "not started yet" ideas and "0 of 0" scored.
4. **Invalid curriculum.** Served with a build target larger than its canvas: Start stays disabled and the load error is shown.
5. **Protected Worker retry and recovery.** Requests went to the real Worker code and coordinator, answered inside the test with no network. A forced connection reset kept the typed answer and showed Retry, and Retry completed the turn. A spoken-style "I need help" in teaching did not advance. After closing the page, a new page at 360 px reconnected with the same token and **resumed at the saved idea 3**.

**Not performed:**

- Physical Chromebook, iPad or phone testing.
- Live text-to-speech or speech recognition: headless Chromium has no voices, so the app showed its "Audio unavailable" fallback.
- Any live Worker deployment or AI call.

---

## 6. Known limitations

1. **Prerequisite map is my judgement.** The `requires` lists added to 6-1 are: inside → unit → tiling → count → (partial, irregular, make); unit → edge; tiling → reason. They need architect or curriculum review. Because every 6-1 concept depends on "inside", a child unresolved on "inside" sees no other teaching that session. That is the intended safe behaviour, but it should be confirmed.
2. **Default policy is to skip assessment when ideas are unresolved** (`assessWhenUnresolved: false`). This is a product decision to confirm. Lessons can opt in.
3. **Remediation variety is limited by the content.** Each 6-1 concept has one alternative explanation and one example, so the ladder is "alternative ×2 → prerequisite review → set aside → reteach once". Richer reteaching needs more content per concept (Phase 6 of the audit plan).
4. **Unresolved state lasts for one session only.** Local mode loses it on reload. Worker mode keeps it until the one-hour token expires. Parent notification is the review screen only: no messages, accounts or history. Persistence was out of scope.
5. **Language rules are English and pattern-based.** Commands must be the whole utterance, so a mixed utterance such as "wait it is 8" is treated as an answer. The unclear-answer rules are heuristics. Number words cover 0–100 ("one hundred one" is rejected; digits of any size are accepted). Accuracy with real child speech is untested.
6. **A legacy 3×4 canvas remains** only inside the exported `grade()` helper. It is used only when a caller passes a build item with no visual, so the original test API keeps working. The curriculum schema rejects such items, so lessons never reach it.
7. **One renderer (grid) and four graders exist.** Division renderers and graders are future work, which the plug-in registries are ready for.
8. **`curriculum/lessons.js` must be edited when a lesson is added** (Worker bundling). A test fails if it disagrees with the registry.
9. **Golden comparison checks every baseline field** but allows new fields, for example `summary.parentNotice` and the new state fields.
10. **The Worker coordinator name changed** from `lesson-6-1-budget` to `tutor-pilot-coordinator`. Nothing was ever deployed, so no stored data is affected.
11. **No lesson picker yet.** Selection uses `?lesson=` or the session token, and only one lesson is registered.
12. **Playwright is not a declared dependency.** `test:browser` uses the environment's installed Playwright and Chromium.
13. **The optional AI prompt text changed** (lesson label from metadata). AI remains off and was not run.
14. **Not addressed (out of scope):** narration timelines, a speech adapter, auto-listen by default, a number pad, persistence, the 2.17 MB portrait, and narrowing CSP `connect-src`.

---

## 7. Decisions requested from architectural review

1. Approve or correct the 6-1 prerequisite map (`requires`).
2. Should a child with unresolved ideas still do the independent assessment (`assessWhenUnresolved`)?
3. Is a limit of 3 wrong answers and 3 help requests per concept right for grade 3?
4. What wording should the parent notice use, and is the review screen enough until persistence exists?

---

## 8. Recommended next assignment

**Assignment 002C — Speech layer and narration timeline (audit Phase 3).** Owner device testing should happen first or alongside it.

1. **Owner acceptance of 002B on the target Chromebook:** run the area lesson, the struggle path and assessment commands with real speech recognition. This tests real child speech against the new command and number rules.
2. **Voice adapter interface (`Speaker`/`Listener`)** over Web Speech.
3. **Step-based teaching timeline:** one short utterance per step, with visual actions applied on utterance start and end. Golden tests would be extended for the area lesson, which would keep single-step concepts.
4. Auto-listen by default after parental consent.
5. A large number pad for numeric answers.

In parallel, the architect provides the **division curriculum specification**: concepts, prerequisites, misconceptions to diagnose, and assessment blueprint. Persistence (audit Phase 4) and division visuals and lessons (Phases 5–6) follow after review.

---

## 9. Commit and branch

- Implementation commit: `20fc92d0b1787dd743b028fed1f257de3c8b6c26`
- Branch: `feature/division-academy`, at https://github.com/bazeocrisy/study-scoop-ai-tutor/tree/feature/division-academy
- Compare with base: https://github.com/bazeocrisy/study-scoop-ai-tutor/compare/feature/lesson-6-1-prototype...feature/division-academy
- This report is in the commit that follows `20fc92d` on the same branch.

**Stopping here.** Awaiting architectural review before implementing narration timelines, persistence, division visuals or curriculum.
