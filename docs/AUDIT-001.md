# Assignment 001 audit — 2026-10-30
Baseline: 49743c419bffdbfd53f6b85a0c8df1467f6f3f88.

- Frontend hardcodes a second curriculum, never calls either backend, offers no partial tiling or reasoning, and reveals hints during its one-question assessment.
- Node backend uses a different provider, accepts arbitrary client session IDs, lacks authentication and durable quotas; open reasoning can never pass.
- Worker trusts client conceptIndex, uses a shared passphrase, only checks a declared content length, lacks timeouts, rate/cost caps and response schema enforcement.
- No automated tests, dependencies or deployment workflow; portrait missing.
- Word Workshop reference keeps secrets server-side and bounds model output. Its shared key and per-isolate counter are explicitly insufficient for this tutor. Do not reuse its live Worker.
- Original 32-page PDF located privately and visually reviewed: PDF pages 1–4 = printed 213–216. p213 compares surface patterns. p214 bulletin-board tiling/counting (15 square units), unit-square side lengths, partial cover. p215 valid/invalid tilings, partial rectangles and irregular figures, gap/overlap reasoning, side lengths. p216 drawing a given area (20/18), doghouse floor, squares vs circles, relationship of edge squares to side length and reflection. Public lesson uses original equivalent problems, not scans or copied exercises.
- Approved teacher source located: Grade 3 Area Lesson with Teacher.png. Exact asset retained; UI crops via CSS only.
- Live model compatibility, microphone behavior on physical Chromebook/iPhone, and paid latency/cost cannot be verified without services/device access. No paid calls authorized.
