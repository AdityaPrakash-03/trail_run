import { CONFIG, type Variant } from "./config";

export type EventName =
  | "variant_assigned"
  | "reward_viewed"
  | "trial_intro_viewed"
  | "trial_declined"
  | "trial_started"
  | "trial_completed"
  | "trial_abandoned"
  | "reward_goal_selected"
  | "goal_milestone_reached"
  | "game_session_started"
  | "goal_progressed"
  | "game_session_ended"
  | "redeem_started"
  | "reward_redeemed"
  | "face_added"
  | "face_removed"
  | "reward_equipped";

export interface AnalyticsEvent {
  event_name: EventName;
  timestamp: string;
  session_id: string;
  player_id?: string;
  variant: Variant;
  balance_at_event: number;
  [key: string]: unknown;
}

let getBase: () => { session_id: string; player_id: string; variant: Variant; balance_at_event: number };
let append: (event: AnalyticsEvent) => void;

export function configureAnalytics(base: typeof getBase, sink: typeof append) {
  getBase = base;
  append = sink;
}

export function track(name: EventName, props: Record<string, unknown> = {}) {
  if (!getBase || !append) return;
  if (name === "face_added") props = { source: "camera_or_file" };
  if (name === "face_removed") props = {};
  if (name === "reward_equipped") props = { reward_id: "hoodie", equipped: props["equipped"] === true };
  append({ ...props, ...getBase(), event_name: name, timestamp: new Date().toISOString() });
}

export function appendEvent(events: AnalyticsEvent[], event: AnalyticsEvent) {
  return [...events, event].slice(-CONFIG.eventCap);
}

/**
 * Funnel for the hoodie, the one product that supports a trial.
 * Each step counts unique players. The percentage is the share of players who viewed the hoodie.
 * The trial is optional, so steps are compared with viewers, not with the step above.
 */
export const FUNNEL_STEPS: EventName[] = [
  "reward_viewed",
  "trial_intro_viewed",
  "trial_started",
  "trial_completed",
  "reward_goal_selected",
  "goal_progressed",
  "reward_redeemed",
];
const TRIAL_STEPS = new Set<EventName>(["trial_intro_viewed", "trial_started", "trial_completed"]);
const who = (e: AnalyticsEvent) => String(e.player_id ?? e.session_id);

const hoodieEvents = (events: AnalyticsEvent[], variant: Variant) =>
  events.filter((e) => e.variant === variant && e["reward_id"] === "hoodie");

const players = (events: AnalyticsEvent[], name: EventName) =>
  new Set(events.filter((e) => e.event_name === name).map(who));

export function funnel(events: AnalyticsEvent[], variant: Variant) {
  const rows = hoodieEvents(events, variant);
  const viewers = players(rows, "reward_viewed").size;
  return FUNNEL_STEPS.map((name) => {
    const applicable = variant === "B" || !TRIAL_STEPS.has(name);
    const count = applicable ? players(rows, name).size : 0;
    const rate = !applicable ? null : viewers ? (count / viewers) * 100 : 0;
    return { name, count, rate, applicable };
  });
}

export function conversions(events: AnalyticsEvent[], variant: Variant) {
  const rows = hoodieEvents(events, variant);
  const viewers = players(rows, "reward_viewed").size;
  const goal = players(rows, "reward_goal_selected");
  const redeemed = players(rows, "reward_redeemed");
  const completers = players(rows, "trial_completed");
  const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);
  const completerGoal = [...completers].filter((p) => goal.has(p)).length;
  return {
    viewers,
    goalRate: pct(goal.size, viewers),
    redeemRate: pct(redeemed.size, viewers),
    goalToRedeem: pct(redeemed.size, goal.size),
    trialToGoal: variant === "B" ? pct(completerGoal, completers.size) : null,
  };
}

export function equippedAfterPurchase(events: AnalyticsEvent[], variant: Variant) {
  const rows = hoodieEvents(events, variant);
  const redeemers = players(rows, "reward_redeemed");
  const latest = new Map<string, boolean>();
  for (const event of rows) if (event.event_name === "reward_equipped") latest.set(who(event), event["equipped"] === true);
  const count = [...redeemers].filter((p) => latest.get(p) === true).length;
  return { count, rate: redeemers.size ? count / redeemers.size * 100 : 0 };
}

/** Share of trial runs that were quit before the end. Counts runs, not players. */
export function trialAbandonment(events: AnalyticsEvent[], variant: Variant) {
  const rows = hoodieEvents(events, variant);
  const starts = rows.filter((e) => e.event_name === "trial_started").length;
  const quits = rows.filter((e) => e.event_name === "trial_abandoned").length;
  return starts ? (quits / starts) * 100 : 0;
}

// ---- Simulated cohort, so the A/B view has something to show. Clearly labelled in the UI. ----
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cached: AnalyticsEvent[] | null = null;
export function sampleCohort(): AnalyticsEvent[] {
  if (cached) return cached;
  const rand = rng(20261010);
  const out: AnalyticsEvent[] = [];
  const base = Date.parse("2026-10-01T09:00:00.000Z");
  const params = {
    A: { intro: 0, start: 0, finish: 0, goalTried: 0, goalPlain: 0.27, progress: 0.72, redeem: 0.3 },
    B: { intro: 0.38, start: 0.82, finish: 0.78, goalTried: 0.62, goalPlain: 0.27, progress: 0.74, redeem: 0.33 },
  } as const;
  for (const variant of ["A", "B"] as const) {
    const p = params[variant];
    for (let i = 0; i < 200; i++) {
      const player = `sample-${variant}-${i}`;
      let clock = base + i * 41_000 + (variant === "B" ? 17_000 : 0);
      const push = (name: EventName, extra: Record<string, unknown> = {}) => {
        clock += 4000 + Math.floor(rand() * 90_000);
        out.push({
          event_name: name,
          timestamp: new Date(clock).toISOString(),
          session_id: `${player}-s1`,
          player_id: player,
          variant,
          balance_at_event: Math.floor(rand() * 400),
          reward_id: "hoodie",
          simulated: true,
          ...extra,
        });
      };
      push("reward_viewed", { surface: "store_card" });
      let tried = false;
      if (rand() < p.intro) {
        push("trial_intro_viewed");
        if (rand() < p.start) {
          push("trial_started", { colour: "Crimson" });
          if (rand() < p.finish) {
            tried = true;
            push("trial_completed", { ended_by: "timer", bonus_awarded: true });
          } else push("trial_abandoned", { seconds_played: Math.floor(rand() * 20) });
        } else push("trial_declined");
      }
      if (rand() < (tried ? p.goalTried : p.goalPlain)) {
        push("reward_goal_selected", { source: tried ? "trial_result" : "store_card", tried_first: tried });
        if (rand() < p.progress) {
          push("goal_progressed", { coins_earned: 60 + Math.floor(rand() * 80) });
          if (rand() < p.redeem) push("reward_redeemed", { tried_first: tried });
        }
      }
    }
  }
  cached = out;
  return out;
}
