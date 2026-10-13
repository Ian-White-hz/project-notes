# Project Notes: private cloud setup

The current `index.html` is a local-first notebook. Cloud sync is **not active yet**. The included `cloud-sync.js` is an unconnected draft adapter; it does not run when the page opens.

## Planned setup

1. Create a Supabase project under your account.
2. In Supabase **SQL Editor**, run `supabase-schema.sql`. Its row-level security rules limit each signed-in account to its own notebook.
3. In **Authentication**, enable email/password sign-in and create your account. Afterward, you can disable new sign-ups if you want only your account to register.
4. Host the static site over HTTPS (for example, Cloudflare Pages). The site URL makes it accessible from your devices; Supabase stores the shared notes.
5. Provide the **project URL** and **publishable key** (or legacy `anon` key) to finish connecting the site. These are intended for browser use. Never share the `service_role` or secret key, or your password.

Before cloud upload is enabled, the site should show the destination project and the number of local projects and entries, then require your explicit choice to upload them. The upload includes project names and descriptions, entry titles and bodies, tags, status, priorities, and timestamps. Existing local notes should remain backed up as JSON. Once connected, edits can sync across devices; conflicting simultaneous edits should be surfaced for review instead of silently overwriting one device's work.

## Files

- `index.html`: current local website, with English interface.
- `cloud-sync.js`: inactive draft for Supabase authentication and revision-aware sync.
- `supabase-schema.sql`: database table and access rules.

Do not deploy this folder as a finished cloud app yet: the site has not been connected to the adapter, and no live browser test has been completed in this environment.
