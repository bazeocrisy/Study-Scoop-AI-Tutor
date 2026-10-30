# Cloudflare AI Tutor Worker — development only

Built separately from Word Workshop's OCR Worker, using the same Cloudflare + Anthropic architecture. **Not deployed.**

## Setup (when ready)
1. Confirm the current supported Anthropic model ID and update `MODEL`.
2. Configure `ANTHROPIC_API_KEY` and `PARENT_PASSPHRASE` as Worker secrets using Wrangler; never commit values.
3. Deploy only to a protected parent testing environment after reviewing authentication, rate limits, budget, and children's privacy.
4. Do not use the shared passphrase as a permanent student authentication system.

## Routes
- `GET /health`: configuration status, no secrets
- `POST /api/tutor`: JSON `{conceptIndex,action,message}` with `x-parent-key` header; actions: `start`, `answer`, `question`.

## Known gaps
- This is a **stateless prototype**. The browser currently controls concept index; no verified server-side progression, identity, or persistence.
- Open-ended answers return `needs-review` instead of incorrectly treating them as wrong.
- No real-time audio, streaming, abuse-resistant quotas, child accounts, or production privacy review.
- The frontend is not yet connected to this Worker.
- The Worker uses an imported JSON curriculum; verify bundling with Wrangler before deployment.
- Model output is constrained by prompting but still requires evaluation and safety checks.

The existing Study Scoop production website and Word Workshop Worker remain untouched.
