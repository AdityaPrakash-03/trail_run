import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/trial-run/shell";
import { TrialResult } from "@/components/trial-run/results";
import { pageHead } from "@/lib/route-meta";
export const Route = createFileRoute("/trial-result")({
  head: () => pageHead("Trial Result", "See your one-time trial bonus and choose a reward goal."),
  component: () => (
    <AppShell game={false}>
      <TrialResult />
    </AppShell>
  ),
});
