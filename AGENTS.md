<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Trial Run architecture
- Keep TanStack Start route files for each screen and the persistent provider in the root; this preserves the platform router and player state across navigation.
- All player progress and events live in browser localStorage, initialized after hydration; this prototype has no application backend or login.
- Keep economy constants in src/config.ts, pure settlement rules in src/lib/trial-state.ts, and tracking in src/analytics.ts so the rules are auditable and testable.
- Use a single Canvas engine for normal and trial modes and token-driven inline SVG illustrations; the demo needs no downloaded assets or game libraries.
- Prerender every public screen with identical loading markup; local player state is loaded only in the browser and must not be captured in build output.
