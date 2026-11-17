# Connect Supabase and Google sign-in

Prepared 17 November 2026. No external account setup has been performed. The app, content, SQL and upload tools are ready locally.

## 1. Create your Supabase project

1. Sign in to the [Supabase dashboard](https://supabase.com/dashboard), select **New project**, and choose your organisation.
2. Name it `learn-skit`, save the database password privately, choose a nearby available region (Mumbai if available), and wait for provisioning.
3. Use **Connect** to find the HTTPS project URL. Open **Settings → API Keys** for a publishable key and a secret key. The browser uses the publishable key; local administrator scripts use the secret key. [Official key guide](https://supabase.com/docs/guides/getting-started/api-keys).

Edit the existing root `.env.local`; preserve the existing admin email:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_VALUE
SUPABASE_SECRET_KEY=sb_secret_YOUR_VALUE
ADMIN_EMAILS=your-google-email@example.com
```

No database URL is required for the SQL Editor workflow. The older `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` aliases are also supported. Google's client secret belongs in Supabase, not in the browser or this environment file.

## 2. Apply all three migrations

In Supabase **SQL Editor → New query**, paste and run the complete contents of each file **in order, once each**, against the new project:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_study_features.sql`
3. `supabase/migrations/003_analytics_admin.sql`

They prepare private content/progress, profiles, protected admin roles, server-graded attempts, reports/events, account data functions and analytics. Migration 001 creates the `study-videos` bucket as private. Confirm that in Storage. Keep RLS enabled. Resolve any SQL error before proceeding; these files are a new-project baseline, not a reset script for another deployed database.

## 3. Configure Google

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project and open **Google Auth Platform**.
2. Complete **Branding** with the learn-skit name, support email and developer contact. Add your real hosted homepage/privacy/terms addresses for production. The app provides `/#/privacy` and `/#/terms`.
3. Choose **External** in **Audience**. Review **Data Access** and keep basic identity scopes only (`openid`, email, profile). Check publishing status before public launch. Google documents an exception to test-user restrictions for basic-identity-only apps. [Audience rules](https://support.google.com/cloud/answer/15549945), [production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).
4. In **Clients**, create a **Web application** OAuth client named `learn-skit web`.
5. Add `http://127.0.0.1:4173` and your eventual production origin to **Authorised JavaScript origins**. Use origins without hash paths.
6. In Supabase **Authentication → Sign In / Providers → Google**, copy the displayed callback URL. Paste that exact URL into Google's **Authorised redirect URIs**. A hosted project normally uses `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
7. Create the client and copy its client ID/secret into the Supabase Google provider form. Enable the provider and save, retaining default security checks. [Supabase Google instructions](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

Google returns the user to Supabase's callback; Supabase then returns them to the study site. These are different addresses. The study homepage is not Google's callback URI.

## 4. Set return addresses in Supabase

Open **Authentication → URL Configuration**. For local testing, set Site URL to `http://127.0.0.1:4173/` and add `http://127.0.0.1:4173/**` to Redirect URLs. When hosted, set the exact HTTPS production root as Site URL and allow its return URL. Prefer precise production paths to broad wildcard rules. [Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

Allow new-user signup if any Google account should register. This app applies no institutional-email restriction.

## 5. Upload and import

Run in PowerShell from this project:

```powershell
npm ci
npm run build
node scripts/upload-videos.mjs
node scripts/import-content.mjs
npm run preview
```

The uploader sends 51 verified MP4 lessons and 51 VTT captions to the private bucket. The importer upserts 37 modules. Rerunning updates the same object paths/module keys. Wait for successful completion. Larger combined course exports are not uploaded automatically.

Open <http://127.0.0.1:4173/> in a normal Chrome/Edge tab. Continue with Google and complete or skip optional onboarding. The study dashboard should replace the sign-in gate.

## 6. Provision your admin account

First sign in once with your intended admin Google account so its user exists. Then run:

```powershell
node scripts/create-admin-sql.mjs
```

Paste the generated `private-build/create-admin.sql` into Supabase SQL Editor and run it. It provisions the email(s) in local `ADMIN_EMAILS`; it raises an error if the account has not signed in yet. Return to Study tools. Your Admin tile should appear; its route is `/#/tools/admin`. A normal account must be denied. A profile field cannot grant admin access.

## 7. Host the app

Run `npm run build` after changing public settings. Upload **only `dist/`** to your chosen static HTTPS host. A build-based host uses `npm ci && npm run build`, output `dist`, and only the URL/publishable key as build environment values. Keep secret-key import commands local.

Update Google origins and Supabase return addresses to the final host. Hash routes require no per-module server rewrites. The project has not been published for you.

## 8. Verify the real connection

- Sign in with your admin and a separate ordinary account. Test sign-out and cancelling a login.
- Confirm signed-out visitors/direct anonymous API requests cannot obtain module payloads.
- Review cards, answer questions, save items and pause a video; verify resume on a second browser/device with the same account.
- Confirm the other account cannot read your progress/export or call admin functions.
- Play all three video paces and English captions. Submit an issue and resolve it in Admin.
- Open a previously loaded deck offline, reconnect and verify sync; confirm sign-out clears private offline packs.
- Test deletion with a disposable account only; it permanently removes that account and its owned study records.
- Review privacy/contact wording for your real service. Schedule retention as needed: prepared admin-only `study_prune_analytics(180)` removes events older than 180 days; no cloud schedule exists yet.

## Troubleshooting

| Symptom | Check |
|---|---|
| Gate remains unconfigured | Edit URL/publishable key, rebuild, and serve the new `dist/`. |
| `redirect_uri_mismatch` | Google's redirect URI must equal the hosted Supabase callback exactly. |
| Returns to wrong site | Fix Supabase Site URL and allow-list for the address in your browser. |
| Login works, content fails | Apply all migrations and run importer; retain private RLS. |
| Video unavailable | Complete upload, confirm object path and reopen lesson for a fresh signed URL. |
| Admin denied | Sign in once with the configured email before running provisioning SQL. |
| Google access blocked | Check External audience, basic scopes, publishing status and the account's organisation policies. |
| Old app after rebuild | Reload online for service-worker update; clear this site's storage and sign in again if necessary. |
