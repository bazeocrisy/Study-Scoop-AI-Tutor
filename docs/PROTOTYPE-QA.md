# Chapter 6-1 Prototype — QA and next build steps

## Source
Original Chapter 6 textbook, printed pages 213–216, Lesson 6-1 Understand Area. Keep this as the authoritative instructional reference. Existing Study Scoop lessons are **not** the teaching source.

## Current implementation
- Five-step browser prototype: inside area, unit square, tiling, counting, independent check
- Browser speech synthesis reads lesson and questions
- Experimental browser speech recognition fills in answers (browser support varies)
- Spoken feedback after checking answers
- No accounts, persistent data, live LLM, real-time turn-taking, or deployed preview yet
- Portrait image path reserved at `assets/tutor-portrait.png`, image not yet committed

## Important limitations to address
1. The current prototype does not teach all original printed-page exercises 1–12 and is not yet a validated complete lesson.
2. Speech recognition is not equivalent to a real-time conversational tutor. It requires a manual mic press and answer confirmation.
3. Speech services may send audio to browser vendors; do not use with children until privacy/consent reviewed.
4. Correct answers are deterministic and not evaluated by an LLM; preserve this separation.
5. Real textbook scans should not be republished on a public site without permission. Create original equivalent visuals and problems.

## Acceptance test on Chromebook
- Correctly read each question; wait for user initiation to record spoken response.
- Confirm mic permission behavior and fallback for unsupported browsers.
- Speak 'fifteen' for the 3×5 grid; confirm it becomes 15.
- Speak 'twelve' for the 2×6 grid; confirm it becomes 12.
- Wrong answers show an explanation and do not advance.
- Correct answers unlock Continue.
- Restart returns to the first concept.
- Validate mobile/Chromebook screen widths and keyboard focus.

## Next engineering milestones
1. Add approved tutor portrait asset; verify image loads.
2. Add local test harness and run browser checks.
3. Build real-time speech turn-taking using a secure backend and controlled session state.
4. Introduce a curriculum-grounded teaching engine with structured actions (explain, ask, wait, display visual, assess).
5. Add human-reviewed textbook-aligned independent problems, session limits, and privacy safeguards.
6. Deploy a protected preview only after the owner approves the hosting configuration.

Do not merge into main without owner review.
