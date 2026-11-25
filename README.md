# Study Scoop AI Tutor — Lesson 6-1 development prototype

A separate private-pilot lesson app. Original Study Scoop is unchanged. The area prototype is on `feature/lesson-6-1-prototype`; the reusable teaching-engine foundation for the Division Academy is on `feature/division-academy`. Owner review is required before merge or production deployment.

## Run locally

Requires Node.js 24+ and npm. Run `npm ci`, then `npm start`; open `http://localhost:5173`. The local curriculum demo needs no credentials and makes no model calls. Click Let's begin. Teach first, then complete the independent activities. For grown-ups contains optional Worker connection and session-specific microphone consent. Browser voice may use its vendor's servers. Typed input and interactive squares work without voice.

`npm test` runs 70 automated checks (the original 33, golden transcripts, foundation and defect regressions). `npm run check` checks syntax. `npm run validate` checks the lesson registry and every lesson against the versioned schema. `npm run test:runtime` bundles without deployment and runs five workerd/Durable Object checks locally with a public test fixture secret. `npm run test:browser [screenshotDir]` runs a headless Chromium walkthrough (needs Playwright with Chromium). No provider calls occur. Dependencies are pinned by package-lock.json. Use Node.js 24 or later.

## How the pieces work

`curriculum/registry.json` lists the available lessons; open `?lesson=<id>` or get the registry default. Each lesson (for example `curriculum/6-1.json`, nine teaching concepts and eight independent activities, privately aligned to original textbook pages 213–216) follows schema version 1 in `engine/schema.js`; a lesson that fails validation is never taught by the browser or the Worker. `engine/controller.js` owns lesson order, checked answers, assistance records, bounded remediation and review, and contains no lesson-specific content. `engine/graders.js` (number, exact, build, reason) and `engine/visuals.js` with `ui/renderers.js` (grid) are plug-in registries. `engine/language.js` interprets natural commands, spoken numbers to one hundred and unclear answers. The browser and protected Worker share the controller. Diagrams are built from data, not generated images.

`app.js` handles the screen, speech playback, optional speech recognition and retries. `engine/voice-turn.js` collects phrases until explicit completion; a browser silence event is never an answer. The Worker validates one-hour sessions and keeps authoritative progress in a Durable Object with request limits and expiration cleanup. Session tokens name a registered lesson (`node scripts/issue-session.js [lesson-id]`). Optional Claude integration can select reviewed explanations, with strict response validation and fallback. It is disabled by default, cannot change grading, and is not a full conversational AI system yet.

See [division foundation report](docs/DIVISION-FOUNDATION-REPORT.md), [actual QA and remaining limitations](docs/PROTOTYPE-QA.md) and [separate Worker setup](cloudflare/tutor-worker/README.md). No live voice service or AI model has been validated. Do not treat this as production-ready or independently verified mastery.
