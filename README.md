# Study Scoop AI Tutor — Lesson 6-1 development prototype

A separate private-pilot lesson app. Original Study Scoop is unchanged. All work stays on `feature/lesson-6-1-prototype`; owner review is required before merge or production deployment.

## Run locally

Requires Node.js 24+ and npm. Run `npm ci`, then `npm start`; open `http://localhost:5173`. The local curriculum demo needs no credentials and makes no model calls. Click Let's begin. Teach first, then complete the independent activities. For grown-ups contains optional Worker connection and session-specific microphone consent. Browser voice may use its vendor's servers. Typed input and interactive squares work without voice.

`npm test` runs 33 automated checks. `npm run check` checks syntax. `npm run test:runtime` bundles without deployment and runs five workerd/Durable Object checks locally with a public test fixture secret. No provider calls occur. Dependencies are pinned by package-lock.json.

## How the pieces work

`curriculum/6-1.json` is the reviewed source for nine teaching concepts and eight independent activities, privately aligned to original textbook pages 213–216. `engine/controller.js` owns lesson order, checked answers, assistance records and review. The browser and protected Worker share that controller. Diagrams are built from square-cell data, not generated images.

`app.js` handles the screen, speech playback, optional speech recognition and retries. `engine/voice-turn.js` collects phrases until explicit completion; a browser silence event is never an answer. The Worker validates one-hour sessions and keeps authoritative progress in a Durable Object with request limits and expiration cleanup. Optional Claude integration can select reviewed explanations, with strict response validation and fallback. It is disabled by default, cannot change grading, and is not a full conversational AI system yet.

See [actual QA and remaining limitations](docs/PROTOTYPE-QA.md) and [separate Worker setup](cloudflare/tutor-worker/README.md). No live voice service or AI model has been validated. Do not treat this as production-ready or independently verified mastery.
