import { CONFIG, MILESTONES, REWARD_IDS, getReward, type Colour, type RewardId, type Variant } from "@/config";
import type { AnalyticsEvent } from "@/analytics";
import { uid } from "@/lib/uid";

export interface PlayerState {
  playerId: string;
  balance: number;
  goal: RewardId | null;
  variant: Variant;
  colour: Colour;
  trialClaimed: boolean;
  equipped: boolean;
  vouchers: Partial<Record<RewardId, string>>;
  normalSessions: number;
  events: AnalyticsEvent[];
}

export const initialPlayer = (variant: Variant): PlayerState => ({
  playerId: uid(),
  balance: CONFIG.startingCoins,
  goal: null,
  variant,
  colour: "Crimson",
  trialClaimed: false,
  equipped: false,
  vouchers: {},
  normalSessions: 0,
  events: [],
});

export const hasRedeemed = (state: PlayerState, id: RewardId) => !!state.vouchers[id];

/** The trial bonus is paid once, and only if the player stayed in the round long enough. */
export function settleTrial(state: PlayerState, eligible = true) {
  const awarded = eligible && !state.trialClaimed;
  return {
    state: {
      ...state,
      trialClaimed: state.trialClaimed || awarded,
      balance: state.balance + (awarded ? CONFIG.trialBonus : 0),
    },
    awarded,
  };
}

export function settleNormal(state: PlayerState, catches: number) {
  return {
    ...state,
    balance: state.balance + catches * CONFIG.coinsPerCatch,
    normalSessions: state.normalSessions + 1,
  };
}

export function redeemReward(state: PlayerState, id: RewardId, code: string): PlayerState {
  const reward = getReward(id);
  if (!reward || state.balance < reward.cost || hasRedeemed(state, id)) return state;
  return {
    ...state,
    balance: state.balance - reward.cost,
    goal: state.goal === id ? null : state.goal,
    vouchers: { ...state.vouchers, [id]: code },
    equipped: id === "hoodie" ? true : state.equipped,
  };
}

export const redeemHoodie = (state: PlayerState, code: string) => redeemReward(state, "hoodie", code);

export function setRewardEquipped(state: PlayerState, id: RewardId, equipped: boolean): PlayerState {
  if (id !== "hoodie" || !hasRedeemed(state, id)) return state;
  return { ...state, equipped };
}

/** Highest milestone (25, 50, 75, 100) crossed by moving from `before` to `after` coins. */
export function milestoneCrossed(before: number, after: number, cost: number): number | null {
  const pct = (n: number) => Math.min(100, (n / cost) * 100);
  const a = pct(before);
  const b = pct(after);
  let hit: number | null = null;
  for (const m of MILESTONES) if (a < m && b >= m) hit = m;
  return hit;
}

export function readPlayer(): PlayerState | null {
  try {
    const raw = localStorage.getItem("trial-run-player-v2") ?? localStorage.getItem("trial-run-player-v1");
    if (!raw) return null;
    const s = JSON.parse(raw);
    if ((s.variant !== "A" && s.variant !== "B") || !Number.isFinite(s.balance) || s.balance < 0)
      return null;
    const vouchers: PlayerState["vouchers"] =
      s.vouchers && typeof s.vouchers === "object" ? { ...s.vouchers } : {};
    if (s.redeemed && typeof s.voucher === "string" && !vouchers.hoodie) vouchers.hoodie = s.voucher;
    return {
      ...initialPlayer(s.variant),
      ...s,
      equipped: typeof s.equipped === "boolean" ? s.equipped : !!vouchers.hoodie,
      vouchers,
      goal: REWARD_IDS.includes(s.goal) ? s.goal : null,
      events: Array.isArray(s.events) ? s.events.slice(-CONFIG.eventCap) : [],
    };
  } catch {
    return null;
  }
}

export const STORAGE_KEY = "trial-run-player-v2";
