# Shelf Life

Shelf Life is a mobile-first kitchen for sharing food, chores and house points. Real houses use email-link sign-in. Choose **Try demo** to explore Clifton House as Adam, Maya or Leo with data saved in your browser.

## Run locally

Use Node.js 22.12+ or 24 and Bun 1.3+ with the committed lockfile.

```sh
git pull --ff-only
bun install --frozen-lockfile
bun run dev
```

Open the local URL printed by Vite. The sample haul and manual entry work immediately. Use **Profile → Reset demo data** to restore the shelves and move their dates relative to today.

## Enable My Houses in Lovable

1. In the Lovable project, enable the built-in backend and email authentication. Ask Lovable to provision the tables, privileges and functions in [ops/lovable-houses.sql](ops/lovable-houses.sql) through its database workflow.
2. Enable passwordless email links and allow the app root as an auth redirect on both the preview origin and `https://test341.lovable.app/`. Use Lovable’s backend environment bindings. The browser needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`). The TanStack server needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the service-role key belongs only in Lovable's server secrets.
3. In the preview, sign in, set a name, and create a house under **Profile → My Houses**. Generate an invite link, then open it in a separate browser profile and sign in with a second address. Open each email sign-in link in the browser that requested it.
4. Verify the second member sees the same house and that food and points updates appear in the other browser. Publish once the preview passes.

## Rehearse the demo

1. Select **Try demo**, choose **Adam**, open **Scan**, then use **Try sample haul**. Review and save the yoghurt dated tomorrow.
2. Switch to **Leo** using the avatar in the header. Request Adam’s yoghurt from **Up for Grabs**. Switch back to Adam and accept the incoming request. Leo now owns the yoghurt and the transfer cost zero.
3. As Leo, open **Leaderboard → Log chore → Take out the bins** to earn 10 points. Request Maya’s milk for 6 points. Accept as Maya, then check the balances and activity feed.
4. To hand off development, push the tested changes when the team is ready. The next contributor pulls before editing. Commits to `main` sync to the [Lovable project](https://lovable.dev/projects/d7dc76ba-cc09-49ef-9056-aaf9fe1fb753).

## Connect live scanning

Live scanning is available to signed-in house members. The TanStack server checks membership and issues a one-minute scan grant. A Cloudflare Durable Object enforces six provider calls per user per minute and 120 across the deployment per UTC day.

Generate a 32-byte base64url `SCAN_GRANT_SECRET` and set the same value in the Lovable server secrets and the Cloudflare Worker secrets. In local development, set it in the app’s `.env.local` and in `worker/.dev.vars`. Also set `GEMINI_API_KEY` in `worker/.dev.vars`. Keep both secrets out of frontend variables and Git.

Run Wrangler from the repository root with the scanner configuration.

```sh
npx wrangler@4 dev --config worker/wrangler.toml
```

In the repository root, set `VITE_SCAN_API_URL=http://localhost:8787/scan` in `.env.local` and restart Vite. Open the app at the localhost origin listed in `worker/wrangler.toml`. Camera capture on a phone uses the HTTPS-hosted app or the device’s own localhost.

For hosting, set `ALLOWED_ORIGINS` in `worker/wrangler.toml` to the exact Lovable preview and published origins that will call the scanner. Separate origins with commas. Confirm that the Google AI Studio key can use the configured Gemini model.

```sh
npx wrangler@4 deploy --config worker/wrangler.toml
npx wrangler@4 secret put GEMINI_API_KEY --config worker/wrangler.toml
npx wrangler@4 secret put SCAN_GRANT_SECRET --config worker/wrangler.toml
```

Set the Lovable frontend build variable `VITE_SCAN_API_URL` to the deployed Worker URL including `/scan`, and rebuild. The scanner sends photos to Google Gemini and validates structured model responses. An unavailable haul scan offers a sample or manual entry. A close-up with a visible date and missing year asks the user to enter the full date before saving.

## Verify

```sh
bun run test
bunx tsc --noEmit
bun run lint
bun run build
```

For the local production build, run the generated Cloudflare entry with the following command.

```sh
npx wrangler@4 dev --local --config .output/server/wrangler.json
```

In the deployed preview, sign in as a house member and scan several real UK labels. Include a numeric date with a year, a yearless date just before today and a faint dot-matrix print. Check the full date, label type and manual-entry fallback. The automated Worker tests mock Gemini.
