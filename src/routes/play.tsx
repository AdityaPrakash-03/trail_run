import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/trial-run/shell";
import { Game } from "@/components/trial-run/game";
import { pageHead } from "@/lib/route-meta";
export const Route = createFileRoute("/play")({
  head: () =>
    pageHead(
      "Play Coin Catch",
      "Catch coins in a thirty-second round and progress toward your saved goal.",
    ),
  component: () => (
    <AppShell game={true}>
      <Game mode="normal" />
    </AppShell>
  ),
});
