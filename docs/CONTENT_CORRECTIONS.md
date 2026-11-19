# Content corrections

## 20 November 2026 — MCQ-BLOOD-007

Reviewed the reported incomplete question against its source and live Supabase payload. The relationship and correct option were already valid, but the short prompt relied on a separately collapsible scenario.

Embedded the complete scenario in the prompt and clarified the reasoning. The private authoring item uses `context_in_question: true`; the build omits the redundant scenario box for explicitly self-contained questions. IDs, options, correct option index, other module content and student progress remain unchanged.

Backed up the live module privately, patched only the prompt, hint, explanation and duplicate scenario metadata, and verified the result by reading it back. Marked the one matching incomplete-question report resolved. The private source and content remain excluded from GitHub. Verified both practice routes in Chrome and WebKit and passed the full course validator and 23 automated tests.
