# learn-skit project handover

**Status:** The application runs in the local preview and uses a live Supabase project for Google sign-in, private study content, progress and video storage. The 37 module packs, individual EVS videos and all three combined EVS streams have been uploaded. A public frontend deployment has not been confirmed.

**Creators:** RISHITH RASWANT and TUSHAAR BHARARA. The credit is on the signed-in homepage beneath “How a session feels”.

Use this file as the current handover. [PRD.md](../PRD.md) is the original ClayPrep specification. [DECISIONS.md](DECISIONS.md) records decisions through the earlier build, and [RESUME_STATUS.md](RESUME_STATUS.md) describes the earlier local-only milestone. Their references to separate predicted/bonus pages, an unconnected backend or local-only combined video describe earlier states.

- [What students can do](#what-students-can-do)
- [What changed from the PRD](#what-changed-from-the-prd)
- [Google sign-in configuration](#google-sign-in-configuration)
- [Supabase and data access](#supabase-and-data-access)
- [Content and video maintenance](#content-and-video-maintenance)
- [Build, preview and deploy](#build-preview-and-deploy)
- [Verification and remaining work](#verification-and-remaining-work)
- [Troubleshooting](#troubleshooting)

## What students can do

| Area | Current experience |
|---|---|
| Entry | A glass sign-in panel opens Google OAuth. Any eligible Google account can sign up. Study screens require sign-in. The onboarding form can be skipped, and asks for optional name, branch, year and subject preferences. |
| Subjects | Environmental Studies (EVS) and one **Quantitative & Qualitative Skills 1.0** subject. Quantitative and Qualitative are groups inside the same subject. The module filter offers All modules and High yield. |
| Flashcards | Module Cards display the prompt, answer or formula, and supporting note together. Previous/Next and arrow keys move between cards, and the current card is saved. Optional recall and ratings remain in **Study tools → Review cards**, which has due, starred, saved and all decks, daily-new limits and bidirectional review settings. |
| Notes | Skills modules have 20 nine-section notes in total, with formulas, worked examples, traps and prerequisites. EVS modules use starred-fact cheat sheets. Reading position and read markers are saved. |
| Module practice | Answer one question at a time with feedback, explanations, hints/shortcuts where supplied, shared passages and source-conflict notices. The module stores selections and the current question. |
| Full syllabus test | One untimed test per subject containing **200 core + 40 bonus = 240 questions**. The session includes each question ID once, saves selections and review marks, resumes after reload and shows explanations after submission. Old Predicted/Bonus routes redirect here. A saved test shares the existing test slot with timed tests, and starting over from the full-syllabus screen prompts before replacing an unfinished attempt. |
| Timed tests | A separate tool lets students choose modules, count, difficulty and test duration. It provides a countdown, question navigation, review marks and results/history. |
| EVS videos | **Individual lessons** keeps the module picker, auto-advance, captions, three paces and speed controls. **Whole syllabus** uses the combined stream for the selected pace, with a single native timeline, chapter jumps, captions and saved position. |
| Other study tools | Search, saved cards/questions/notes, mistake notebook, EVS reference sheets, study stats, settings and Dawn/Dusk themes. Reference categories cover dates, acts, SDGs, confusable pairs and acronyms. |
| Accounts and feedback | Own-data export, account deletion, issue reporting and general feedback. Privacy, Terms, About and methodology remain available as separate pages. |
| Admin | Protected overview, users and activity, traffic, funnel, retention, content quality, reports and system views. Includes report status changes and a JSON export of aggregate metrics. |
| Offline | Installable app shell. Previously loaded packs are stored in account-scoped IndexedDB for offline use by the same signed-in account. Local progress and pending writes survive reconnect. Sign-out removes the private pack and hides account progress. Video streaming requires a connection. |

### Routes and credits

- Local preview: http://127.0.0.1:4173/
- Subject routes: `#/s/evs` and `#/s/skills-1`.
- Full tests: `#/s/evs/full-test` and `#/s/skills-1/full-test`.
- EVS video library: `#/s/evs/videos`.
- Module routes: `#/s/{subject}/{module}/{cards|practice|notes|video}`. Video is present for EVS modules with media.
- Study tools: `#/tools` with subroutes including '/cards', '/search', '/bookmarks', '/mistakes', '/mock', '/reference', '/settings', '/stats' and '/admin'.
- Legacy quantitative and qualitative routes redirect to 'skills-1'. Standalone predicted/bonus routes and subject-specific predicted/bonus routes redirect to the corresponding full test.

## What changed from the PRD

| Original plan | Current implementation and reason |
|---|---|
| ClayPrep using Next.js App Router, React, TypeScript, Tailwind and Vercel | Renamed **learn-skit**. Owner chose to retain the existing vanilla HTML/CSS/JavaScript site and add Supabase. Hash routing makes it suitable for static hosting. A public Vercel launch is unconfirmed. |
| Guest access, guest-to-account merge and optional VIT-only enforcement | Sign-in required for all study material, by owner instruction. No guest progress merge or admission gate based on university email. The profile schema can store VIT-domain verification for information. |
| Three subject cards and separate Quantitative and Qualitative routes | Two subjects. Combined Skills retains 10 Quantitative and 10 Qualitative/soft-skills modules and the original module IDs. |
| Predicted and Bonus study sheets, cover mode, standalone print views | Initially moved into each subject, then merged into the **Full syllabus test** at the owner's request. Source flags and solutions remain in practice/results. The standalone print/filter workflow was removed with those pages. |
| All modules, Live now and High yield controls and subject subtitle | Removed duplicate Live now control and the subject header subtitle following browser feedback. |
| Flip-and-rate module flashcards | Replaced by one-sided quick reading with explicit navigation. Spaced repetition still exists in the separate review tool. |
| Original footer and compact sign-in presentation | Removed footer, enlarged sign-in panel, and added the creator note beneath the homepage study steps. Legal and feedback links are reachable elsewhere. |
| Module video or separate compilation exports | EVS lite chalkboard retained. Whole syllabus first used a playlist that swapped files. After feedback, it was replaced with one combined HLS stream per pace. Each stream has a native timeline covering the whole course. |
| Detailed dashboard resume chips and weighted progress bars | The site has a Continue action, module progress indicator and saved positions per surface. It does not have the PRD's exact weighted dashboard and secondary resume-chip layout. |
| Full Next.js analytics stack, Vercel anonymous analytics, Sentry, Speed Insights and public CV endpoint | Supabase receives first-party authenticated events. Admin reports include traffic source hostname, device category, route views, active-time estimates, funnel and retention. No location collection. JSON metrics export exists, and Study statistics is behind sign-in. Dedicated public badge/chart endpoints and the full CV kit were not built. |
| KaTeX conversion and exact P1 reference-sheet formats | Formulas render as authored text. EVS reference views draw from tagged cards with filtering and answer covers. Original KaTeX, math-conversion reports and all bespoke reference layouts were not added. |
| Exact PRD CI/CD, full cross-browser/a11y checks, production load and performance targets | CI workflow and local verification exist. Release-level browser coverage, two-device cloud sync timing, SLA, traffic capacity and Lighthouse targets are unverified. |

The app uses the provided material for a fully MCQ-based FAT. No past papers were supplied. “Predicted” describes editorial prioritisation based on the supplied decks. Four-option, single-answer scoring is used, with no negative marking configured.

## Google sign-in configuration

The owner created the Google Cloud project and configured Google and Supabase using the setup instructions in this project. The application uses Supabase JavaScript with PKCE, persistent sessions, token refresh and a restricted list of internal return routes. The browser feedback showed the authenticated app and a **Sign out** control. The Google Cloud console settings, publishing status, project ID and OAuth credentials were not independently inspected.

| Setting | Configuration used for the local app |
|---|---|
| Google Cloud console | Select the learn-skit project and open Google Auth Platform. |
| Branding | App name 'learn-skit', with support and developer contact emails chosen in the Google console by the owner. |
| Audience and scope | External audience was the instructed setup. Use basic identity scopes 'openid', email and profile. Wider API scopes are unnecessary. Verify publishing status in Google before a public rollout. |
| OAuth client | Web application, suggested display name 'learn-skit web'. The browser uses Supabase OAuth. |
| Google authorised JavaScript origin | `http://127.0.0.1:4173` for local preview. Add the public HTTPS origin when known. |
| Google authorised redirect URI | `https://bvbwukdbwnoyopxrwtrk.supabase.co/auth/v1/callback`. Verify the exact value in Supabase's Google provider panel when migrating projects. |
| Supabase Google provider | **Authentication → Sign In / Providers → Google**. Enable Google, enter the OAuth client ID and client secret and leave the provider security checks enabled. |
| Supabase application return settings | **Authentication → URL Configuration**. Local Site URL `http://127.0.0.1:4173/` and Redirect URL `http://127.0.0.1:4173/**`. For production, use the real HTTPS site URL and its return address. |

Google returns to the Supabase callback. Supabase finishes authentication and returns to the app. On the app, `js/access.js` processes the PKCE callback, restores a user session and then fetches private content. A profile trigger creates the account's profile row. The Google OAuth client secret stays in the provider settings. If the Google secret is lost or rotated, generate a new secret in Google Cloud and update the provider in Supabase.

For screen-by-screen setup or a new project, see [SETUP_SUPABASE_GOOGLE.md](SETUP_SUPABASE_GOOGLE.md). Its early status note and its original media upload instructions predate the live imports and combined streaming work.

## Supabase and data access

**Project ref:** 'bvbwukdbwnoyopxrwtrk'. **Project URL:** `https://bvbwukdbwnoyopxrwtrk.supabase.co`. The owner supplied the URL and keys and reported completing the dashboard steps. Local configuration was added, then the 37 content rows and media were uploaded to that project. Supabase plan, region, production return URLs and admin grant state require confirmation in the dashboard.

### Local environment and admin provisioning

Copy [.env.example](../.env.example) to '.env.local' on a new checkout and populate local values from the project dashboard or the owner's credential store.

| Name | Used by |
|---|---|
| `SUPABASE_URL` | Build and administrator scripts. |
| `SUPABASE_PUBLISHABLE_KEY` | Browser client. The build writes it under the legacy property name 'supabaseAnonKey' in `dist/js/config.js`. |
| `SUPABASE_SECRET_KEY` | Local import and upload scripts. It has elevated access. Keep it out of the browser, handover, hosted build variables and source control. |
| `ADMIN_EMAILS` | Local SQL generation. The supplied admin account is 'rishithraswant@gmail.com'. |
| `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` | Legacy aliases supported by the relevant scripts. Prefer the publishable and secret key names above. |
| `SUPABASE_DB_URL` | Optional legacy configuration. SQL Editor setup needs no database URL. |

The earlier Supabase secret key was shared in chat. Rotation was advised. The handover does not establish whether rotation was performed. If still outstanding, create a replacement in **Settings → API Keys**, update the local secret, verify administrator scripts with the replacement and revoke the old key. The replacement value belongs in the local environment or credential store.

To grant admin access, sign in with the intended Google account once, run 'node scripts/create-admin-sql.mjs' and execute the generated `private-build/create-admin.sql` in Supabase SQL Editor. This resolves the account and inserts its user ID into `study_admin_members`. Setting the email locally, or generating the SQL, does not by itself grant access. Verify that the Admin tile appears for the intended account and that an ordinary account cannot access the admin functions. No automatic cloud role grant was performed by the assistant.

### Schema and policies

Apply these migrations in order on a **fresh** project. On the existing project, inspect deployed objects and migration history before applying any SQL again.

| Migration | What it establishes |
|---|---|
| [001_initial.sql](../supabase/migrations/001_initial.sql) | `study_modules` with composite '(subject, module_id)' key and JSONB payload, `study_progress` with '(user_id, kind, item_id)' key, timestamp trigger, signed-in content reads, user-owned progress RLS and a private 'study-videos' bucket. |
| [002_study_features.sql](../supabase/migrations/002_study_features.sql) | Profiles and automatic profile creation, explicit admin membership, server-graded attempts, reports, event logging, onboarding updates, account deletion and row-level grants/policies. |
| [003_analytics_admin.sql](../supabase/migrations/003_analytics_admin.sql) | Aggregates, admin dashboard and user activity, report resolution, own-data export and an admin-only event retention function. |

- **Content:** authenticated accounts can select module packs. Administrator scripts upsert packs. Packs use stable IDs, authored content and private storage object references. The public `js/data.js` only has the catalogue and course chapter metadata.
- **Progress:** the browser stores a per-account local queue and debounces writes by 1.5 seconds. `study_progress` only allows the owning user to read or write their rows. Remote state loads on sign-in and unsynced local writes are reapplied. Notes, card positions, video times and test state use stable keys. Ordinary lesson progress and whole-syllabus progress are stored separately.
- **Attempts and reports:** `study_attempt` resolves the answer key on the server from the module payload and keys attempts by UUID for idempotency. `study_report` validates content reports, and owner/admin access controls apply. Because signed-in users receive their study packs, feedback timing is a study feature rather than protection against a determined exam-taker.
- **Analytics:** `study_event` accepts defined event types and rate-limits events. The browser sends signed-in page views, device class, referrer hostname and approximate active time. There is no cloud maintenance schedule recorded. `study_prune_analytics(180)` is the prepared owner-only cleanup option.
- **Account deletion/export:** deletion removes the current auth user and cascades owner-linked progress, profiles, role and attempts. Reports/events can remain with null user IDs. Export combines account-owned cloud records and local progress where available, with a device-only fallback.
- **Storage:** 'study-videos' remains private. Individual modules use one-hour signed video/caption links. Whole-course playback signs private playlists and captions and batches media-object links with six-hour expiry. A link remains usable until it expires.
- **Offline:** IndexedDB contains the authenticated pack cache with an account ID key. LocalStorage contains account progress and queues. The service worker caches the public shell. Sign-out clears the current private pack and removes private content from the rendered state.

## Content and video maintenance

### Content inventory

| Subject | Modules | Cards | Core MCQs | Bonus MCQs | Notes |
|---|---:|---:|---:|---:|---|
| EVS | 17 | 450 | 200 | 40 | Starred-fact cheat sheets |
| Quantitative | 10 | 170 | 120 | 25 | 10 |
| Qualitative and soft skills | 10 | 106 | 80 | 15 | 10 |
| **Total** | **37** | **726** | **400** | **80** | **20 skills notes plus EVS cheat sheets** |

- EVS source PDF is `EVSCat2_merged (1).pdf`. Read [EVS_CAT2_CONTENT_SPEC.md](../EVS_CAT2_CONTENT_SPEC.md). Text extraction, author packs, stable ID maps, built packs and verification reports are in 'evs-cat2-content/'.
- Skills source PDF is `merged_presentation_choladeck (1).pdf`. Read [STUDY_CONTENT_SPEC.md](../STUDY_CONTENT_SPEC.md). Extracted/OCR material is under `study-content/source/`, packs under `study-content/modules/` and QA under `study-content/reports/`. Both question adapters preserve answers and IDs when publishing options. Preserve IDs across edits to protect saved attempts, bookmarks and resume.
- EVS M03, M04, M09 and M11 were completed after the earlier handoff. All 17 EVS modules and 20 Skills modules passed content validation. The earlier M15 assertion/reason was rewritten using source page 368, where warmer water holds less dissolved oxygen and the temperature rise stresses aquatic life.
- The final EVS answer-key comparisons agreed on 240/240. Skills verification included 95 qualitative cold solves, 64 independently calculated numerical items and executable checks for all 145 numerical questions. These are machine/AI checks. Human or faculty sign-off is separate.
- Conflicting source values remain disclosed where applicable. Examples include fresh-water percentages, Namami Gange 2014/2015 and the M01 waste figure, along with other source flags in the QA and content. Review source evidence before modifying a marked answer. The coverage and answer-key reports describe the checks actually performed.
- Edit authored source, run validation, rebuild and use 'node scripts/import-content.mjs' when publishing content changes. Rebuilding writes `private-build/content.json`. It does not alter Supabase until the import is run. The importer upserts existing module keys. It does not delete removed modules.

### Video inventory and pipeline

| Pace | Combined duration | Chaptered export | Private stream |
|---|---:|---|---|
| Full | 132.78 min | `FULL.mp4`, `FULL.m4a`, 19 chapters | `course/full/` |
| Sprint | 43.93 min | `SPRINT.mp4`, `SPRINT.m4a`, 19 chapters | `course/sprint/` |
| Blitz | 11.10 min | `BLITZ.mp4`, `BLITZ.m4a`, 18 chapters | `course/blitz/` |

All paces cover the 17 modules, with a warm-up. Full and Sprint also include the final recap. Individual lessons have three variants per module. Their **51 MP4s and 51 VTT captions** were uploaded under paths such as 'M01/M01.mp4' and 'M01/M01_sprint.vtt'. All video output remains outside `dist/`. WAV and SRT files and standalone combined MP4/M4A files are local media deliverables.

Neerja ('en-IN-NeerjaNeural') at +25% narrates the lite chalkboard. The engine uses 1280×720 at 24 fps. The two owner-approved external narration batches covered 109 and 209 segments. The manifests and generation reports are kept with the private build and QA material. Offline validation and packaging reuse local files. Preserve the recorded approved scope when generating additional speech.

Whole-syllabus playback uses **HLS.js** with fragmented MP4. FFmpeg remuxes each existing combined export without re-encoding. Each course directory contains `index.m3u8`, `init.mp4`, numbered '.m4s' fragments and one combined `captions.vtt` with shifted cue times. The app rewrites the signed manifest in memory and attaches the stream once. Chapter seeking changes the player's position within that source. Chunking keeps each upload below the per-file cap while retaining original quality. The three uploaded streams contain 266, 88 and 22 media fragments respectively, plus init segments, playlists and captions.

For changed media, use the existing stages below. The Python tools require the local video dependencies and FFmpeg/FFprobe. The `FFMPEG` environment variable can point the Node packager at another installation.

~~~powershell
# From the project root, with the project Python added to PATH.
python scripts/validate-video.py
python scripts/render-ready-videos.py --workers 2
python scripts/verify-renders.py
python scripts/assemble-course.py
python scripts/verify-course.py
node scripts/package-course.mjs

npm run build
# Run only the upload/import steps relevant to the change.
node scripts/upload-videos.mjs
node scripts/upload-course.mjs
node scripts/import-content.mjs
~~~

The course uploader accepts pace arguments, for example `node scripts/upload-course.mjs sprint`. It uploads media before publishing the playlist. When making a large change to an established stream, use versioned storage paths and switch after uploading to avoid mixing old and new fragments during active playback. Current stable paths are used by `js/workspace.js`.

### Recreate the service on a new Supabase project

1. Create the new project and populate the local environment with its URL and keys. Open SQL Editor and apply migrations 001, 002 and 003 in order.
2. Update the Google OAuth client with the new project's callback URL. Configure the Google provider and application return URLs in the new Supabase project.
3. Run `npm ci` and `npm run build`. Restore or regenerate the local lesson and course files, then run both media upload scripts and the content importer. If the course files already exist, no narration or re-encoding is needed to upload them.
4. Start the preview and sign in with the designated admin. Generate and apply the admin SQL in the new project. Check signed-in and signed-out access before deploying.
5. To retain existing user accounts and progress, handle that as a separate Supabase migration. The module and media import scripts only restore study packs and video assets.

## Build, preview and deploy

Use Node.js 24, which is the CI version used for the current project, and Python 3.12 for authoring and browser checks. On the original Windows machine Python is at 'C:/Users/Rishith Raswant/AppData/Local/Programs/Python/Python312/python.exe'. Python/Chrome/Playwright/FFmpeg are only needed for authoring, media and browser checks. npm installs HLS.js and the PGlite test dependency.

~~~powershell
npm ci
npm run build
npm test
npm run preview
~~~

The preview serves only `dist/` at `http://127.0.0.1:4173/`. If it is already running, rebuild and refresh the existing tab. For production, publish only `dist/` on a static HTTPS host. Set the production origin in Google Auth Platform and update Supabase Site URL and allowed return URLs. Only the public URL and publishable key belong in hosted frontend build variables. Hash routes require no module-specific server rewrites. If public config changes, rebuild before publishing. If an old service worker is still active, reload online to pick up the versioned shell.

### Workspace map

| Path | Purpose |
|---|---|
| `index.html`, `css/`, `js/app.js` | App shell, theme, home, subject/module navigation, notes, module cards/practice/video. |
| `js/workspace.js`, `js/study-core.js` | Full tests, mock tests, quick study tools, review scheduling, video library, settings and admin UI. |
| `js/access.js`, `js/private-cache.js`, `sw.js` | PKCE/auth, progress sync and RPCs, account-scoped offline packs and service-worker shell. |
| `scripts/build.mjs`, `scripts/content-adapters.mjs` | Transform packs, generate catalogue/config/import, copy public assets and version the shell. |
| `scripts/import-content.mjs`, `scripts/upload-videos.mjs`, `scripts/package-course.mjs`, `scripts/upload-course.mjs` | Administrator delivery and combined course packaging. |
| `supabase/migrations/` | Schema, auth trigger, storage policies, SQL functions and analytics. |
| `authoring/legacy-data.js` | Historical catalogue input and demos. The public build strips private study data. |
| 'evs-cat2-content/qa/', `study-content/reports/` | Content evidence, independent review and video QA. |
| `private-build/`, 'evs-cat2-content/video/out/' | Generated private payloads/admin SQL and large media. Save these separately if needed for handover. |
| `tests/`, `scripts/browser-smoke.py`, `scripts/offline-admin-smoke.py`, '.github/workflows/ci.yml' | Repeatable SQL, security, content, study-core, browser, offline, real media fixture and CI checks. |

This folder had no Git repository at handover. If moving to version control, keep '.env.local', `private-build/`, generated media and source materials with restricted distribution out of public commits. Preserve the private source files and media separately, since generated media and build outputs are ignored by default.

## Verification and remaining work

### Verified

- The 37 module rows were imported and counted on the live service. An anonymous request using the publishable key could not read the packs.
- Live uploads completed for all individual video/caption files and all combined HLS streams. Live checks signed each course's media objects and verified first/last object and caption access. Signed delivery was exercised separately from browser authentication in these checks.
- Local Node suite passes 13 tests, including actual SQL permission/ownership tests in PGlite. Chrome smoke tests exercise the current subject/card/test flows, sign-in gate, admin fixtures, offline caching and layout checks. Browser media tests play real HLS files using a mocked authenticated session and verify native duration, chapter seeking without switching sources and playback resume.
- FFprobe checked the 51 module videos and standalone combined exports. Content validators and recorded independent answer comparisons passed. Local speech-transport regressions passed on the offline fixtures.

### Owner checks and known gaps

1. Confirm public hosting target, Google publishing status, production URLs and whether the exposed Supabase secret was rotated.
2. Confirm live admin membership. Sign in with two different accounts and verify ordinary users cannot access admin data or one another's progress/exports.
3. Run full Google OAuth and private playback tests from the final host, including a long Full session, chapter jumps and captions. Test at least Chrome/Edge plus the Safari/Firefox/mobile devices expected in use. The local browser tests do not certify these devices or public hosting.
4. Check normal cross-device progress, offline reconnect, and a disposable-account deletion on the live project. Existing local/fake sessions confirm behaviour under test conditions.
5. Check production storage and egress after usage starts. Combined streams add about 386 MB of stored bytes. Review analytics retention and confirm report/privacy contact details for the public service.
6. Complete human/faculty review where flagged. Treat production performance, accessibility certification, official course approval, uptake metrics and uptime as open until measured or checked.

## Troubleshooting

| Symptom | Check |
|---|---|
| App says Google sign-in is being configured | Verify URL and publishable key, rebuild and make sure the host serves the new `dist/`. |
| `redirect_uri_mismatch` | Copy the exact Google provider callback from Supabase into the Google client's authorised redirect URIs. |
| Sign-in returns to the wrong page | Check Supabase Site URL and Redirect URLs, Google origin, and the browser's actual host and port. |
| Signed in but no study material | Confirm the build catalogue matches the live module IDs and the 37 module import ran. Check RLS and authenticated access. |
| Video link fails | Confirm bucket/object exists, the storage read policy permits signed-in users, and the session is active. Reselect pace to refresh links. For combined playback check the playlist, init, segments and captions under `course/{pace}/`. |
| Whole syllabus still resets at each chapter | Reload online and check that the new build serves `dist/js/vendor/hls.js`. Whole-syllabus mode should show a single player duration until the complete course ends. |
| Admin tile missing | Confirm the intended account signed in and the generated role-bootstrap SQL was run against the correct project. |
| Another preview is already open | Reuse the existing server listening at port 4173. |
| Need to reproduce media | Retain the private narration cache and authoritative source packs. Verify module renders, assemble the course, package it, upload it and rebuild as applicable. |

## 20 November 2026 — Private video delivery moved to Cloudflare R2

Production media provider is now R2. Vercel continues to host the website and the protected signing endpoint; Supabase continues to provide Google authentication, course records, student progress, attempts and reports. The private R2 bucket is `learn-skit`, not `learn-skit-videos`.

Uploaded and verified 487 published objects (743,052,117 bytes): 102 lesson/caption files and 385 complete-course playlist, initialization, video-segment and caption files. Existing object paths were preserved. Source videos were uploaded locally, avoiding an additional Supabase download. All Supabase media copies remain intact for rollback.

The browser calls POST `/api/media-urls` with its Supabase access token. The server validates the user through Supabase Auth, restricts requested object paths and batch size, and returns six-hour signed GET URLs. Media bytes travel directly from private R2 storage to the browser. The signing API sends no-store responses; R2 public access remains disabled. The site CSP permits the R2 origin and video elements use anonymous cross-origin mode for captions. R2 CORS allows GET/HEAD from production and local preview, with Range and response-range headers.

Server-only Vercel variables: `R2_MEDIA_ENABLED=true`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Upload-only local variables: `R2_UPLOAD_ACCESS_KEY_ID`, `R2_UPLOAD_SECRET_ACCESS_KEY`. Credential values are excluded from Git, browser bundles and documentation. A separate bucket-scoped read-only token is recommended for playback when credentials are next replaced; the existing token was changed to Object Read & Write to complete migration. The API itself only signs GET requests.

Reupload command: `node scripts/upload-r2-videos.mjs`. Uploads are idempotent by SHA-256 metadata and content length, and the ignored `private-build/r2-upload-report.json` records verification. The private media and test artifacts remain excluded from Git. `scripts/local-env.mjs` supports digits in variable names, including R2.

Validation completed: 29 automated tests pass; the source-only checkout passes 28 with one expected private-content skip. Live production API denies guests and invalid sessions (401), denies invalid paths (400), and signs valid student requests (200). Actual production Chrome playback and seeking passed for a lesson and combined-course stream. All three course paces passed playlist, first/last segment, caption and CORS checks. Observed zero Supabase Storage media requests in the production player check. An isolated temporary diagnostic account was removed after testing. Native Safari/iOS was not physically tested: the Windows Playwright WebKit media runtime rejected both a known standard MP4 and the lesson fixture, so no Safari decode pass is claimed.

Local preview also supports the protected signing route. After changing local media settings, rebuild and restart preview. Rollback: set Vercel `R2_MEDIA_ENABLED=false` and redeploy; that selects the retained Supabase media provider. No database migration or student-progress changes are required.

This migration stops new video downloads from consuming Supabase Storage egress on refreshed clients. It does not erase quota already used, and already-open old tabs may keep using previously issued Supabase URLs until refreshed.
