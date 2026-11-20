# Low-usage operation for the exam traffic window

Supabase remains the identity system: Google sign-in, account creation, session refresh, one profile per account and explicit reports. Do not delete auth users, disable the registration trigger, or move identity records to R2. Total registrations can be read in Authentication > Users; optional read-only SQL is in `supabase/account-health-check.sql`.

Production study progress is OFF, including device persistence. Answers are held in the current page's memory only. No per-answer attempt, module/video position or activity heartbeat is sent. The owner confirmed applying the backend pause for old clients. That pause affects only study_progress, study_attempts and study_events. Existing records remain intact.

Counts of registered accounts and new registrations remain available from auth.users without additional tracking. The existing admin activity/retention/study-time metrics rely on study_events and are now historical; do not represent them as current active-user counts. auth.users.last_sign_in_at can count accounts with a successful sign-in during a period, but does not count concurrent users or every return visit with a retained session. Do not introduce a polling loop just to refresh a count.

All 487 video objects and the single 37-module private content bundle are on private R2. Both former Supabase media buckets were independently listed and found empty on 20 November. Supabase retains small course source/grading rows and student records. Vercel serves the static website and authenticated signing endpoint. It does not proxy video bytes. The endpoint currently verifies sessions against Supabase Auth, so a fresh content URL still needs healthy Auth.

## R2 request budget

R2 Standard includes 10 GB-month storage, 1 million Class A operations and 10 million Class B operations per month. These are billing allowances, not a promise that the service stops before a charge. Confirm actual usage in the R2 dashboard. Official source: https://developers.cloudflare.com/r2/pricing/

- Student study answers create zero R2 writes/list operations. Class A usage comes primarily from publishing files and bucket administration. Signing a URL is computed locally by the SDK and does not read/list/write R2 objects.
- The stored published set is approximately 0.744 GB. Keep Standard storage; the free allowance does not apply to Infrequent Access.
- Loading the bundled material makes one object GET, not one GET per question. Module navigation then uses material already in memory. Account-scoped IndexedDB also holds the material for failure recovery.
- Video playback is the main Class B source: manifests, initialization files, segments, captions and MP4 range requests. Each segment/range request counts; one watch is not one read. Seeking, replaying and network retries can add reads.
- A planning example of 10,000 viewing sessions at 300 reads each is 3 million Class B requests. This is an estimate, not measured traffic or a hard upper bound. Subtract the month's already-used requests before budgeting new traffic.
- Check usage morning/evening during the next two days, including Vercel function usage. Investigate at 50% and take action at 75% of the remaining budget. If video traffic threatens the allowance, deliberately pause video access while keeping text practice and sign-in working; do not create student progress objects in R2.
- Keep R2 public access disabled, credentials server-side and six-hour GET links. Do not repeatedly reupload the library or list the bucket per visitor.

## Unhealthy Auth / PostgREST

Removing downloads and tracking reduces application load but cannot reset consumed billing counters or guarantee infrastructure health. Both services depend on database connectivity. Inspect Supabase Auth/Postgres logs around the outage, connection counts and CPU/memory; avoid repeatedly refreshing log explorer or blindly terminating database sessions.

`supabase/account-health-check.sql` returns aggregate account counts, connection states and the relevant trigger states without student details. Run manually in SQL Editor only. If Auth or REST becomes unhealthy again after restart and the new low-usage build, provide those diagnostics and timestamps to Supabase support. Do not bypass authentication to make private material accessible.

On 20 November, after the owner-applied backend pause and restart, Auth health returned 200, the Auth admin listing returned 200, PostgREST profile/module HEAD counts returned 206, and a temporary diagnostic account could authenticate and obtain protected R2 URLs (200). It was deleted afterward. This verifies recovery at that time, not future uptime. New-user profile creation alongside the tracking pause also passes the PostgreSQL/PGlite regression test.
