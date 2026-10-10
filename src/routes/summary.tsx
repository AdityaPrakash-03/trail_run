import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/trial-run/shell";
import { Summary } from "@/components/trial-run/results";
import { pageHead } from "@/lib/route-meta";
export const Route = createFileRoute("/summary")({
  head: () => pageHead("Run Summary", "See earned coins and progress toward your chosen reward."),
  component: () => (
    <AppShell game={false}>
      <Summary />
    </AppShell>
  ),
});
