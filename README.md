# Trial Run / Coin Catch

A local-only playable rewards prototype for the PlaySuper assignment. Everyday Streetwear and all offers are fictional. No real voucher is issued.

## Run locally

Use Node.js 22 or newer and Bun.

```sh
bun install
bun run dev
```

Open the localhost address printed by Vite.

```sh
bun run test
```

## Built

- Reward store and details with a drag-to-rotate 3D hoodie viewer (Crimson/Navy). Optional cosmetic "Try it in play" trial (variant B only).
- 30-second 3D endless-runner style coin game (three.js): chase camera, neon city, coins with combo, spikes, 3 hearts, FOV kick, camera shake, particles. Pointer/touch drag or arrow keys / A, D.
- All sound synthesised in the browser (WebAudio): sfx, generative music loop, haptics, mute toggle. No audio files.
- One active goal, milestone ticks (25/50/75/100%), live HUD, run summary, fake voucher redeem for any affordable reward.
- Persistent A/B assignment, balance, goal, bonus, vouchers and events (localStorage, key `trial-run-player-v2`).
- Hoodie redemption equips that hoodie for normal game rounds by default. Equipping changes appearance only.
- Optional face crop on the hoodie details page beside the colour and avatar preview. The saved face appears only on that preview; the trial and normal game use the game's default character face. It is stored separately under `trial-run-face-v1`, stays in browser storage or session memory, and is never uploaded or included in analytics.
- Analytics sheet: variant override, event log, funnel (unique players, hoodie only), economy, About tab, JSON/CSV export. Optional simulated cohort, clearly labelled as not real users.
- Reduced-motion support, WebGL-failure fallback, accessible controls.

## Events

`variant_assigned`, `reward_viewed`, `reward_goal_selected`, `trial_intro_viewed`, `trial_declined`, `trial_started`, `trial_abandoned`, `trial_completed`, `game_session_started`, `game_session_ended`, `goal_progressed`, `goal_milestone_reached`, `redeem_started`, `reward_redeemed`, `face_added`, `face_removed`, `reward_equipped`. Every event carries `player_id` and `session_id`. Face events never include image data or file names.

## Face preview and outfit

Players add a cropped face preview from the hoodie details page beside the colour and avatar preview. The face appears only on this preview, not in playable rounds. Photos are stored separately from player progress in `trial-run-face-v1`; they are not uploaded and are never included in analytics exports. Players can remove the photo at any time. The hoodie can be equipped after purchase and appears in normal rounds when equipped. This is a local prototype preview, not AI try-on or a real voucher.

Limits: face images must be under 8 MB and supported by the browser. Clearing site data removes a stored face. The face on the avatar is a simple local mockup and does not model fit or fabric. A real AI try-on is future work.

## Assumptions and limits

- Everyday Streetwear and all offers are fictional. No real voucher or product exists.
- Trial coins are never added. One-time +50 bonus only if the player plays at least 15 seconds. Replays earn no bonus.
- Normal coins settle at the end of a round. Quitting loses the unfinished round.
- Funnel counts unique players, with each step as a share of viewers (the trial is optional, so it is not a linear funnel). No significance claims. Sample cohort is generated, not measured.
- Local data can be edited by the browser owner. Not a secure economy. A real version needs studio integration and server-side validation.
- No login, backend, payment or external API. Fonts are bundled. Colours are my approximation, not PlaySuper's official brand palette.
- Verified in headless Chromium with software WebGL only. Check feel, sound and touch on a real phone before presenting.

## Deploy to Vercel as static files

1. Push this project to a GitHub repo, then import that repository in Vercel.
2. Choose **Other** for Framework Preset. Leave Root Directory at the repository root.
3. Set Install Command to `bun install`.
4. Set Build Command to `bun run build:static`.
5. Set Output Directory to `dist/client`.
6. Use Node.js 22 or newer. No environment variables or secrets are required.
7. Click **Deploy**. Open the resulting `https://your-project.vercel.app` address.
8. Verify `/`, `/details`, `/play`, `/trial`, `/trial-result`, `/summary`, and `/redeem` load directly and on refresh. Each path is prerendered as its own HTML file. State is loaded after the page opens.

The static configuration disables the hosting server output. Do not use the default Cloudflare build output as the Vercel output directory.

## Deploy to Netlify as static files

1. Import the same repository in Netlify.
2. Set Build Command to `bun run build:static` and Publish Directory to `dist/client`.
3. Use Node.js 22 or newer and Bun. No secrets are needed.
4. Deploy, open the generated `https://your-site.netlify.app` link, then check the same paths and refresh behavior.

## File map

`src/config.ts`: coin constants and reward data. `src/analytics.ts`: event tracking and funnel computations. `src/lib/trial-state.ts`: pure settlement rules and local data read. `src/components/trial-run/`: provider, illustrations, game, store, results, shared controls and debug sheet. `src/routes/`: one screen per URL. `src/styles.css`: design tokens and styles. `src/test/trial-rules.test.ts`: economy and analytics tests.

## Tools used

Lovable (first scaffold), Claude (game engine, 3D, audio, analytics, review), three.js, Space Grotesk and JetBrains Mono (bundled), Vitest, Playwright Chromium for UI checks. No runtime AI.
