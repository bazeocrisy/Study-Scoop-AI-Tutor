# AI Tutor engine — Stage 4

The curriculum and teaching policy are committed independently of the current scripted interface.

**Not yet connected to a model.** Next implement a backend session endpoint that accepts only a current concept, a student's response, and minimal ephemeral session state. It returns a validated structured action: `speak`, `show_visual`, `ask`, `wait`, `advance`, or `end`. The backend must enforce curriculum boundaries and verify math answers deterministically. Voice turn-taking will be integrated only after text-mode evaluation.

## Acceptance checks
- All five concepts have an objective and a check.
- The independent assessment comes after teaching.
- The original textbook is referenced without copying its pages to the website.
- Wrong answers do not automatically advance.
- The model cannot alter answer keys or access other student profiles.
- No public API credentials or personal data.
