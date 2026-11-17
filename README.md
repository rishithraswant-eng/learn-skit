# learn-skit

FAT revision app for Environmental Studies and Quantitative & Qualitative Skills. The frontend uses plain HTML, CSS and JavaScript. Supabase provides Google sign-in, private study packs, progress, and media.

- [Project handover](docs/HANDOVER.md)
- [Original PRD](PRD.md)
- [Supabase and Google setup](docs/SETUP_SUPABASE_GOOGLE.md)

## Build and preview

Use Node.js 24 and run:

```powershell
npm ci
npm run build
npm test
npm run preview
```

Open http://127.0.0.1:4173/. This source-only repository includes a metadata catalogue. The app fetches actual packs from a separately configured Supabase project after sign-in. For a new backend, obtain the private study and media files from the project owner, then follow the handover for migrations and imports. The build can run without private content. Content validation and private-media browser fixtures require the corresponding local files.

Copy .env.example to .env.local to configure a local preview. Keep database and OAuth secrets in private configuration. A static deployment needs only the project URL and publishable key at build time, and publishes only dist/.
