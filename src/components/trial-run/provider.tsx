import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { appendEvent, configureAnalytics, track } from "@/analytics";
import {
  STORAGE_KEY,
  hasRedeemed,
  initialPlayer,
  milestoneCrossed,
  readPlayer,
  redeemReward,
  settleNormal,
  settleTrial,
  setRewardEquipped,
  type PlayerState,
} from "@/lib/trial-state";
import { uid } from "@/lib/uid";
import { getFace } from "@/lib/trial-face";
import { CONFIG, getReward, type Colour, type RewardId, type Variant } from "@/config";

export interface RunResult {
  mode: "normal" | "trial";
  catches: number;
  duration: number;
  endedBy: "timer" | "hearts";
  awarded: boolean;
  earned: number;
  tooShort: boolean;
  milestone: number | null;
  goalId: RewardId | null;
  pctBefore: number;
  pctAfter: number;
}
interface AppContext {
  player: PlayerState;
  face: string | null;
  ready: boolean;
  storageError: boolean;
  result: RunResult | null;
  setColour: (colour: Colour) => void;
  equip: (equipped: boolean) => void;
  setPlayerFace: (face: string | null) => void;
  saveGoal: (id: RewardId, source: "store_card" | "details" | "trial_result") => void;
  setVariant: (v: Variant) => void;
  reset: () => void;
  addCoins: () => void;
  finishRun: (
    result: Pick<RunResult, "mode" | "catches" | "duration" | "endedBy">,
  ) => void;
  redeem: (id: RewardId, equipped?: boolean) => void;
}
const Context = createContext<AppContext | null>(null);
const randomVariant = (): Variant => (Math.random() < 0.5 ? "A" : "B");

export function TrialProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState(initialPlayer("A"));
  const [face, setFace] = useState<string | null>(null);
  const ref = useRef(player);
  const session = useRef("");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  function update(next: PlayerState) {
    ref.current = next;
    setPlayer(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  useEffect(() => {
    session.current = uid();
    configureAnalytics(
      () => ({
        session_id: session.current,
        player_id: ref.current.playerId,
        variant: ref.current.variant,
        balance_at_event: ref.current.balance,
      }),
      (event) => update({ ...ref.current, events: appendEvent(ref.current.events, event) }),
    );
    const saved = readPlayer();
    setFace(getFace());
    update(saved ?? initialPlayer(randomVariant()));
    if (!saved) track("variant_assigned", { method: "random" });
    setReady(true);
  }, []);
  const value: AppContext = {
    player,
    face,
    ready,
    storageError,
    result,
    setColour: (colour) => update({ ...ref.current, colour }),
    equip: (equipped) => {
      const next = setRewardEquipped(ref.current, "hoodie", equipped);
      if (next === ref.current) return;
      update(next);
      track("reward_equipped", { reward_id: "hoodie", equipped });
    },
    setPlayerFace: (value) => setFace(value),
    saveGoal: (id, source) => {
      if (hasRedeemed(ref.current, id)) return;
      update({ ...ref.current, goal: id });
      track("reward_goal_selected", {
        reward_id: id,
        source,
        tried_first: id === "hoodie" && ref.current.trialClaimed,
      });
    },
    setVariant: (variant) => {
      update({ ...ref.current, variant });
      track("variant_assigned", { method: "manual" });
    },
    reset: () => {
      update(initialPlayer(randomVariant()));
      setResult(null);
      track("variant_assigned", { method: "random" });
    },
    addCoins: () => update({ ...ref.current, balance: ref.current.balance + CONFIG.debugCoins }),
    finishRun: (run) => {
      const before = ref.current;
      let awarded = false;
      let tooShort = false;
      let milestone: number | null = null;
      let pctBefore = 0;
      let pctAfter = 0;
      let earned = 0;
      const goal = getReward(before.goal);
      if (run.mode === "trial") {
        const eligible = run.endedBy === "timer" || run.duration >= CONFIG.trialMinSeconds;
        tooShort = !eligible && !before.trialClaimed;
        const settled = settleTrial(before, eligible);
        awarded = settled.awarded;
        earned = awarded ? CONFIG.trialBonus : 0;
        update(settled.state);
        track("trial_completed", {
          reward_id: "hoodie",
          catches: run.catches,
          duration_sec: run.duration,
          ended_by: run.endedBy,
          bonus_awarded: awarded,
        });
      } else {
        earned = run.catches * CONFIG.coinsPerCatch;
        update(settleNormal(before, run.catches));
        if (goal) {
          pctBefore = Math.min(100, (before.balance / goal.cost) * 100);
          pctAfter = Math.min(100, (ref.current.balance / goal.cost) * 100);
          milestone = milestoneCrossed(before.balance, ref.current.balance, goal.cost);
          if (earned > 0)
            track("goal_progressed", {
              reward_id: goal.id,
              coins_earned: earned,
              progress_pct_before: pctBefore,
              progress_pct_after: pctAfter,
            });
          if (milestone)
            track("goal_milestone_reached", { reward_id: goal.id, milestone_pct: milestone });
        }
        track("game_session_ended", {
          coins_earned: earned,
          duration_sec: run.duration,
          ended_by: run.endedBy,
        });
      }
      setResult({
        ...run,
        awarded,
        earned,
        tooShort,
        milestone,
        goalId: goal?.id ?? null,
        pctBefore,
        pctAfter,
      });
    },
    redeem: (id, equipped = true) => {
      const before = ref.current;
      const reward = getReward(id);
      if (!reward) return;
      const code = `EVSW-${reward.code}-${Math.floor(1000 + Math.random() * 9000)}`;
      const next = redeemReward(before, id, code);
      if (next === before) return;
      if (id === "hoodie") {
        const final = { ...next, equipped };
        update(final);
        track("reward_equipped", { reward_id: id, equipped });
      } else update(next);
      track("reward_redeemed", {
        reward_id: id,
        coins_spent: reward.cost,
        tried_first: id === "hoodie" && before.trialClaimed,
        sessions_to_redeem: before.normalSessions,
      });
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTrial() {
  const context = useContext(Context);
  if (!context) throw new Error("Trial provider missing");
  return context;
}
