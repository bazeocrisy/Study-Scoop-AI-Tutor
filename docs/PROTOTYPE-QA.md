# Assignment 001 verification — October 30, 2026

## Actual checks executed
- Node automated suite: 33 tests passed, 0 failed. Includes curriculum geometry/counts, teaching-first sequence, wrong/affirmative answers, reasoning uncertainty/follow-ups, partial tile completion, connected building, independent answer locking, hint withholding, review scoring, commands, explicit voice completion, token tampering/expiry/scope, request byte cap, origin restriction, safe replay, stale turns, session quota, privacy alarm scheduling, and model fallback/schema/cost-off behavior.
- `npm run check`: JavaScript syntax checks passed.
- `python3 scripts/build-curriculum.py`: reviewed JSON structure passed; the old duplicating generator now only validates and never overwrites curriculum.
- `npm run test:runtime`: Wrangler 4.156.0 bundle/dry-run passed. Miniflare/workerd executed 5 checks successfully: authorization, actual Durable Object session state, idempotent replay, progression and stale revision rejection. No Cloudflare deployment and no paid model request occurred.
- Independent QA agent executed the tests and challenged edge cases. Fixed repeat/follow-up mismatch, lost assessment explanations beginning with How, inconsistent skipped-reasoning denominator, deferred expiration cleanup, queued Pause/Stop racing the answer throttle, and stale recovery state on reconnect/restart.
- Browser manually completed all 9 teaching ideas and all 8 assessment activities. Wrong first answer stayed in teaching; another example displayed; repeat preserved clarification; all missing tiles and connected builds worked, including Send with no typed building answer; independent Help withheld hints; final review showed 7/7 plus unscored reasoning and teaching assistance.
- Visual browser inspection: desktop viewport approximately 1344 pixels; 360/768-pixel iframe viewports inspected side by side. Both smaller layouts had scrollWidth equal to clientWidth (no horizontal page overflow). These are browser layout checks, not physical device tests.

## Source verification
Original private 32-page `Chris_Chapter_6_Complete_Ordered.pdf` inspected directly: PDF pages 1–4, printed 213–216. Original equivalent activities teach surface, unit squares, complete covering without gaps/overlaps, counting, partial tiling, irregular outlines, constructing a given area, edge length, and reasoning. No scans were added to the repository. Existing approved portrait retained.

## Remaining verification and limitations
- The cloud browser returned speech synthesis errors. Actual speech playback, microphone permissions, transcription quality and continuous listening must be tested on a physical Chromebook and iPhone.
- Speech recognition is browser-dependent, may process audio through the browser vendor, and can stop independently. Words are preserved; child explicitly says I'm finished or uses Send. This is an experimental browser voice interaction, not a completed streaming real-time voice system. No app silence deadline submits an answer.
- No live Anthropic request executed. AI is disabled. Current provider documentation retrieval failed in this environment; model availability, schema compatibility, latency and dollar cost remain unverified. The optional model only chooses reviewed explanations; it does not grade open reasoning or generate unrestricted dialogue.
- Open explanations are preserved as uncertain for parent review and followed by a concept-specific check. The system does not claim that a multiple-choice follow-up verifies the original explanation.
- Local demo answer keys are inspectable; protected Worker owns authoritative session progression and grading. Do not use this pilot as a high-stakes assessment.
- Parent-provisioned one-hour bearer tokens are a bounded private-pilot access mechanism, not multi-family account authentication. Production requires an access/privacy review and owner deployment approval.
- No durable parent learning history, accounts, exported progress or public preview deployment. Local work is lost on restart/reload; Worker pilot work expires with its token.

## Next acceptance milestone
Owner tests teaching, pause/repeat/help, spoken multi-phrase answers, browser-ended listening and the full independent sequence on Christopher's Chromebook. After that review, provision a separate protected Worker with AI still off. Separately approve a small model budget and provider configuration before live AI evaluation; select a dedicated streaming voice approach only after its privacy and cost are reviewed. No merge or production deploy without owner approval.
