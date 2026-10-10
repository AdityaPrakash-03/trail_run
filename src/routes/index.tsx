import { createFileRoute } from "@tanstack/react-router";
import { Store } from "@/components/trial-run/store";
import { AppShell } from "@/components/trial-run/shell";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reward Store | Coin Catch" },
      { name: "description", content: "Choose a fictional reward and earn coins in Coin Catch." },
      { property: "og:title", content: "Reward Store | Coin Catch" },
      {
        property: "og:description",
        content: "Choose a reward goal in this local-only Trial Run prototype.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell dock={true}>
      <Store />
    </AppShell>
  ),
});
