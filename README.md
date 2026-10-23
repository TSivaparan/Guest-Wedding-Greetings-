# Our Wedding Wishes (React + Vite + TypeScript)

QR code → guest form (name, relationship, message, signature) → Supabase → `/admin` (cards, shared wedding board, print, backup).

## Stack (all free, no card needed)
- React 18 + TypeScript + Vite, react-router-dom
- Supabase free plan: Postgres + admin login (signatures are small PNGs stored in the table, so no file storage needed)
- Cloudflare Pages / Netlify / Vercel for hosting
- QR code: qrcode-monkey.com (static QR codes never expire)

## Run locally
```bash
npm install
cp .env.example .env     # then fill in the two Supabase values
npm run dev
```
Guest page: http://localhost:5173/  Admin: http://localhost:5173/admin

## Supabase setup
1. supabase.com → New project → SQL Editor → paste `schema.sql` → Run.
2. Authentication → Users → Add user (your email + password) = admin login.
   Authentication → Providers → Email → turn OFF "Allow new users to sign up".
3. Project Settings → API → copy Project URL and anon public key into `.env`.

## Deploy (Cloudflare Pages)
1. Push this folder to GitHub.
2. Cloudflare Pages → Create project → connect the repo.
   Build command `npm run build`, output directory `dist`.
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. `public/_redirects` already makes `/admin` work on refresh (also works on Netlify).
5. Make a QR code for your `https://….pages.dev/` address.

## Customise
- Couple names and date: `src/config.ts`
- Text in English and Tamil: `src/i18n.tsx`
- Colours and ornaments: `src/styles.css`, `src/components/Ornaments.tsx`

## Before the wedding
- Supabase free projects pause after 7 days of no activity. Open the site the day before, or set a free ping on cron-job.org.
- Send a test wish from a phone, print one card, download a JSON backup.
- After the wedding keep the JSON and CSV backups on Google Drive.
