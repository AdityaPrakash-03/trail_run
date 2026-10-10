import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/trial-run/shell";
import { Game } from "@/components/trial-run/game";
import { pageHead } from "@/lib/route-meta";
export const Route = createFileRoute("/trial")({
  head: () =>
    pageHead(
      "Trial Run",
      "Try a cosmetic hoodie in a fictional game round. One-time demo coin bonus.",
    ),
  component: () => (
    <AppShell game={true}>
      <Game mode="trial" />
    </AppShell>
  ),
});
