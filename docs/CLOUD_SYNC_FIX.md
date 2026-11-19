# Cloud sync fix — 20 November 2026

The failure was reproduced against the live Supabase API with an isolated temporary account (deleted after testing).

Removing a bookmark queues a `position` row with a null payload. PostgREST converts the top-level JSON null into SQL NULL, which violates the existing `study_progress.payload NOT NULL` constraint (SQLSTATE 23502). One such row rejects the whole batch, so later card and question progress stays queued. The former generic warning incorrectly suggested a network disconnection.

The client now stores cleared values as `{ "__learn_skit_null": true }`, decodes that marker to null when reading cloud progress, and applies the conversion to ordinary batches and page-exit writes. Previously queued null or absent payloads are converted when retried, preserving other queued progress. No schema, permission or RLS relaxation is required.

Retries also run when returning to the tab and after token refresh. A successful recovery displays a confirmation. Repeated identical failure toasts are suppressed; `LearnSkit.syncStatus` exposes pending count and a sanitized error code for diagnosis, without record contents or tokens.

Verification: live ordinary inserts/updates succeeded; raw null and mixed null batches failed with 23502; the corrected mixed batch succeeded and read back correctly. Automated checks cover bookmark removal, old cache replay, recovery, account isolation, and the latest progress-counting behavior. Chrome and WebKit smoke checks exercise the bookmark buttons and tab-return retry.

Existing users should reload the original browser/device while online. Do not clear browser storage: it may hold progress that has not reached the server. The updated client retries that queue automatically. Already-open tabs may need a second reload after the new service worker activates.
