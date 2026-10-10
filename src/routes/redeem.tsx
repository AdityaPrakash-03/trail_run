import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/trial-run/shell";
import { Redeem } from "@/components/trial-run/results";
import { pageHead } from "@/lib/route-meta";
import { useEffect } from "react";
import { track } from "@/analytics";
import { REWARD_IDS, getReward, type RewardId } from "@/config";
import { hasRedeemed } from "@/lib/trial-state";
import { useTrial } from "@/components/trial-run/provider";
export const Route = createFileRoute("/redeem")({
  validateSearch: (s: Record<string, unknown>) => ({
    reward: (REWARD_IDS as string[]).includes(String(s["reward"])) ? (s["reward"] as RewardId) : ("hoodie" as RewardId),
  }),
  head: () => pageHead("Redeem Reward", "Confirm a hypothetical voucher using demo coins."),
  component: Page,
});
function Page() {
  const { reward } = Route.useSearch();
  const { ready, player } = useTrial();
  useEffect(() => {
    const r = getReward(reward);
    if (ready && r && !hasRedeemed(player, reward) && player.balance >= r.cost)
      track("redeem_started", { reward_id: reward });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reward]);
  return (
    <AppShell>
      <Redeem rewardId={reward} />
    </AppShell>
  );
}
