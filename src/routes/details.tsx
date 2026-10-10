import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/trial-run/shell";
import { Details } from "@/components/trial-run/store";
import { pageHead } from "@/lib/route-meta";
export const Route = createFileRoute("/details")({
  validateSearch: (s: Record<string, unknown>) => ({
    reward: typeof s["reward"] === "string" ? s["reward"] : "hoodie",
  }),
  head: () =>
    pageHead(
      "Reward Details",
      "See fictional reward details, coin requirements and clear offer terms.",
    ),
  component: Page,
});
function Page() {
  const { reward } = Route.useSearch();
  return (
    <AppShell>
      <Details rewardId={reward} />
    </AppShell>
  );
}
