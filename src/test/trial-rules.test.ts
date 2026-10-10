import { describe, expect, it, vi } from "vitest";
import { CONFIG } from "@/config";
import {
  hasRedeemed,
  initialPlayer,
  milestoneCrossed,
  redeemHoodie,
  redeemReward,
  settleNormal,
  settleTrial,
  readPlayer,
  setRewardEquipped,
} from "@/lib/trial-state";
import {
  appendEvent,
  conversions,
  funnel,
  sampleCohort,
  trialAbandonment,
  type AnalyticsEvent,
  type EventName,
  configureAnalytics,
  track,
} from "@/analytics";
import { getFace, removeFace, setFace } from "@/lib/trial-face";

const event = (
  name: EventName,
  variant: "A" | "B" = "B",
  player = "p1",
  reward = "hoodie",
): AnalyticsEvent => ({
  event_name: name,
  variant,
  timestamp: "2026-10-09T15:00:00.000Z",
  session_id: `s-${player}`,
  player_id: player,
  balance_at_event: 0,
  reward_id: reward,
});

describe("Trial Run economy", () => {
  it("starts a new player with zero coins", () => expect(initialPlayer("A").balance).toBe(0));
  it("defaults equipped off and migrates existing hoodie vouchers to equipped", () => {
    expect(initialPlayer("A").equipped).toBe(false);
    const oldPlayer = { ...initialPlayer("A"), vouchers: { hoodie: "demo" } } as Record<string, unknown>;
    delete oldPlayer["equipped"];
    localStorage.setItem("trial-run-player-v2", JSON.stringify(oldPlayer));
    expect(readPlayer()?.equipped).toBe(true);
    localStorage.setItem("trial-run-player-v2", JSON.stringify({ ...initialPlayer("A"), vouchers: { hoodie: "demo" }, equipped: false }));
    expect(readPlayer()?.equipped).toBe(false);
  });
  it("allows equipping only an owned hoodie", () => {
    const fresh = initialPlayer("A");
    expect(setRewardEquipped(fresh, "hoodie", true)).toBe(fresh);
    expect(setRewardEquipped(fresh, "hoodie", false)).toBe(fresh);
    const owned = { ...fresh, vouchers: { hoodie: "demo" } };
    expect(setRewardEquipped(owned, "hoodie", true).equipped).toBe(true);
  });
  it("awards five coins per normal catch", () =>
    expect(settleNormal(initialPlayer("A"), 20).balance).toBe(100));
  it("awards fifty trial coins once and never adds trial pickups", () => {
    const first = settleTrial(initialPlayer("B"));
    expect(first.state.balance).toBe(50);
    expect(first.awarded).toBe(true);
    const replay = settleTrial(first.state);
    expect(replay.state.balance).toBe(50);
    expect(replay.awarded).toBe(false);
  });
  it("pays no bonus for a trial that was too short, and keeps it available", () => {
    const short = settleTrial(initialPlayer("B"), false);
    expect(short.awarded).toBe(false);
    expect(short.state.balance).toBe(0);
    expect(short.state.trialClaimed).toBe(false);
    expect(settleTrial(short.state, true).state.balance).toBe(50);
  });
  it("does not redeem below five hundred coins", () => {
    const player = { ...initialPlayer("A"), balance: 499 };
    expect(redeemHoodie(player, "fake")).toBe(player);
  });
  it("deducts five hundred coins and clears the active goal", () => {
    const player = redeemHoodie({ ...initialPlayer("B"), balance: 600, goal: "hoodie" }, "EVSW-HOODIE-4821");
    expect(player.balance).toBe(100);
    expect(player.goal).toBeNull();
    expect(player.vouchers.hoodie).toBe("EVSW-HOODIE-4821");
    expect(hasRedeemed(player, "hoodie")).toBe(true);
  });
  it("permits only one voucher per reward", () => {
    const once = redeemHoodie({ ...initialPlayer("A"), balance: 1000 }, "fake");
    expect(redeemHoodie(once, "second")).toBe(once);
    expect(once.balance).toBe(500);
  });
  it("redeems the other rewards at their own cost", () => {
    const p = redeemReward({ ...initialPlayer("A"), balance: 200, goal: "food" }, "food", "EVSW-FOOD-1234");
    expect(p.balance).toBe(50);
    expect(p.goal).toBeNull();
    expect(redeemReward({ ...initialPlayer("A"), balance: 799 }, "earbuds", "x").vouchers.earbuds).toBeUndefined();
  });
  it("finds the highest milestone crossed in a round", () => {
    expect(milestoneCrossed(100, 120, 500)).toBeNull();
    expect(milestoneCrossed(100, 140, 500)).toBe(25);
    expect(milestoneCrossed(100, 260, 500)).toBe(50);
    expect(milestoneCrossed(100, 400, 500)).toBe(75);
    expect(milestoneCrossed(450, 520, 500)).toBe(100);
  });
  it("uses a thirty-second round and three hearts", () => {
    expect(CONFIG.roundSeconds).toBe(30);
    expect(CONFIG.hearts).toBe(3);
  });
  it("ramps falling speed by twenty percent", () => expect(CONFIG.fallSpeedRamp).toBe(0.2));
  it("gives one hundred coins in the reviewer shortcut", () => expect(CONFIG.debugCoins).toBe(100));
});

describe("Trial Run analytics", () => {
  it("strips image data and file names from new event props", () => {
    const sink = vi.fn();
    configureAnalytics(() => ({ session_id: "s", player_id: "p", variant: "A", balance_at_event: 0 }), sink);
    track("face_added", { data: "data:image/jpeg;base64,secret", file_name: "private.jpg", source: "camera_or_file" });
    expect(sink.mock.calls[0]?.[0]).not.toHaveProperty("data");
    expect(sink.mock.calls[0]?.[0]).not.toHaveProperty("file_name");
    expect(sink.mock.calls[0]?.[0]).toHaveProperty("source", "camera_or_file");
  });
  it("stores and removes face images, including when storage writes are blocked", () => {
    setFace("data:image/jpeg;base64,test");
    expect(getFace()).toBe("data:image/jpeg;base64,test");
    removeFace();
    expect(getFace()).toBeNull();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    setFace("data:image/jpeg;base64,memory");
    expect(getFace()).toBe("data:image/jpeg;base64,memory");
    spy.mockRestore();
    removeFace();
  });
  it("caps events at two thousand, dropping the oldest", () => {
    const events = Array.from({ length: 2000 }, () => event("reward_viewed"));
    events[0] = event("trial_started");
    const appended = appendEvent(events, event("reward_redeemed"));
    expect(appended).toHaveLength(2000);
    expect(appended[0]?.event_name).toBe("reward_viewed");
    expect(appended.at(-1)?.event_name).toBe("reward_redeemed");
  });
  it("counts each player once per step, however many times they viewed", () => {
    const rows = funnel(
      [event("reward_viewed", "A"), event("reward_viewed", "A"), event("reward_viewed", "A", "p2")],
      "A",
    );
    expect(rows[0]?.count).toBe(2);
  });
  it("keeps other rewards out of the hoodie funnel", () => {
    const rows = funnel(
      [event("reward_viewed", "A", "p1", "food"), event("reward_goal_selected", "A", "p1", "food")],
      "A",
    );
    expect(rows[0]?.count).toBe(0);
    expect(rows[4]?.count).toBe(0);
  });
  it("skips trial steps for A and shows each step as a share of viewers", () => {
    const rows = funnel(
      [
        event("reward_viewed", "A", "p1"),
        event("reward_viewed", "A", "p2"),
        event("reward_goal_selected", "A", "p1"),
      ],
      "A",
    );
    expect(rows[1]?.applicable).toBe(false);
    expect(rows[2]?.rate).toBeNull();
    expect(rows[4]?.rate).toBe(50);
  });
  it("never exceeds one hundred percent", () => {
    const rows = funnel(
      [event("reward_viewed", "B"), event("reward_goal_selected", "B"), event("reward_goal_selected", "B")],
      "B",
    );
    expect(rows.every((r) => r.rate === null || r.rate <= 100)).toBe(true);
  });
  it("separates variants and measures trial abandonment per run", () => {
    const events = [
      event("reward_viewed", "B", "p1"),
      event("trial_started", "B", "p1"),
      event("trial_started", "B", "p1"),
      event("trial_completed", "B", "p1"),
      event("trial_abandoned", "B", "p1"),
      event("reward_viewed", "A", "p9"),
    ];
    expect(funnel(events, "B")[0]?.count).toBe(1);
    expect(funnel(events, "A")[0]?.count).toBe(1);
    expect(trialAbandonment(events, "B")).toBe(50);
  });
  it("reports goal and redeem rates against viewers", () => {
    const c = conversions(
      [
        event("reward_viewed", "A", "p1"),
        event("reward_viewed", "A", "p2"),
        event("reward_viewed", "A", "p3"),
        event("reward_viewed", "A", "p4"),
        event("reward_goal_selected", "A", "p1"),
        event("reward_goal_selected", "A", "p2"),
        event("reward_redeemed", "A", "p1"),
      ],
      "A",
    );
    expect(c.goalRate).toBe(50);
    expect(c.redeemRate).toBe(25);
    expect(c.goalToRedeem).toBe(50);
  });
  it("builds a labelled simulated cohort for both variants", () => {
    const sample = sampleCohort();
    expect(sample.every((e) => e["simulated"] === true)).toBe(true);
    expect(funnel(sample, "A")[0]?.count).toBe(200);
    expect(funnel(sample, "B")[0]?.count).toBe(200);
    expect(funnel(sample, "A")[2]?.applicable).toBe(false);
  });
});
