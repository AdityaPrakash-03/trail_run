import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONFIG, type Variant } from "@/config";
import { conversions, equippedAfterPurchase, funnel, sampleCohort, trialAbandonment } from "@/analytics";
import { useTrial } from "./provider";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TABS = ["Variant", "Event log", "Funnel", "Economy", "About"] as const;
const label: Record<string, string> = {
  reward_viewed: "Viewed hoodie",
  trial_intro_viewed: "Saw trial intro",
  trial_started: "Started trial",
  trial_completed: "Finished trial",
  reward_goal_selected: "Saved as goal",
  goal_progressed: "Made progress",
  reward_redeemed: "Redeemed",
  face_added: "Face added",
  face_removed: "Face removed",
  reward_equipped: "Reward equipped",
};
const pct = (n: number) => `${n.toFixed(0)}%`;

export function Debug({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { player, setVariant, reset, addCoins } = useTrial();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Variant");
  const [confirm, setConfirm] = useState(false);
  const [useSample, setUseSample] = useState(false);
  const data = useMemo(() => (useSample ? sampleCohort() : player.events), [useSample, player.events]);
  const exportCsv = () => {
    const rows = ["variant,step,unique_players,percent_of_viewers"];
    for (const v of ["A", "B"] as const)
      for (const step of funnel(data, v))
        rows.push(
          `${v},${step.name},${step.applicable ? step.count : "n/a"},${step.rate === null ? "n/a" : step.rate.toFixed(1)}`,
        );
    rows.push(`A,trial_abandonment_runs,n/a,n/a`, `B,trial_abandonment_runs,,${trialAbandonment(data, "B").toFixed(1)}`);
    download(`trial-run-funnel${useSample ? "-sample" : ""}.csv`, rows.join("\n"), "text/csv");
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 z-40" />
        <Dialog.Content className="debug-sheet fixed z-50" aria-describedby="debug-description">
          <div className="sheet-handle" />
          <div className="debug-head">
            <Dialog.Title className="text-base font-semibold">Debug & analytics</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close debug panel">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description id="debug-description" className="sr-only">
            Inspect the demo variant, local events, funnel and coin rules.
          </Dialog.Description>
          <div className="debug-tabs" role="tablist" aria-label="Debug views">
            {TABS.map((name) => (
              <Button
                variant="ghost"
                className={`debug-tab ${tab === name ? "active" : ""}`}
                role="tab"
                id={`tab-${name}`}
                aria-selected={tab === name}
                aria-controls="debug-tabpanel"
                key={name}
                onClick={() => setTab(name)}
              >
                {name}
              </Button>
            ))}
          </div>
          <div className="debug-body" role="tabpanel" id="debug-tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === "Variant" && (
              <>
                <div className="eyebrow">Current assignment</div>
                <h2 className="mt-2">Variant {player.variant}</h2>
                <p className="subcopy">Random 50/50 assignment, saved on this device.</p>
                <div className="variant-options">
                  {(["A", "B"] as Variant[]).map((v) => (
                    <Button
                      variant="outline"
                      className={`variant-option ${player.variant === v ? "selected-variant" : ""}`}
                      aria-pressed={player.variant === v}
                      key={v}
                      onClick={() => setVariant(v)}
                    >
                      <strong>Variant {v}</strong>
                      <span>{v === "A" ? "Normal reward card" : "Playable trial"}</span>
                    </Button>
                  ))}
                </div>
                {confirm ? (
                  <div>
                    <p className="subcopy mb-3">Clear coins, goals, bonuses and events?</p>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => {
                          reset();
                          setConfirm(false);
                        }}
                      >
                        Reset all data
                      </Button>
                      <Button variant="outline" onClick={() => setConfirm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setConfirm(true)}>
                    <RotateCcw />
                    Reset all data
                  </Button>
                )}
              </>
            )}
            {tab === "Event log" && (
              <>
                <div className="progress-row">
                  <span>{player.events.length} events</span>
                  <span className="text-muted-foreground">Latest first</span>
                </div>
                {player.events.length === 0 && <p className="subcopy">No events yet.</p>}
                {[...player.events].reverse().map((event, i) => (
                  <details className="event-item" key={`${event.timestamp}-${i}`}>
                    <summary>
                      <span>{event.event_name}</span>
                      <time>{new Date(event.timestamp).toLocaleTimeString("en-GB")}</time>
                    </summary>
                    <pre>{JSON.stringify(event, null, 2)}</pre>
                  </details>
                ))}
              </>
            )}
            {tab === "Funnel" && (
              <>
                <div className="seg" role="group" aria-label="Data source">
                  <button type="button" aria-pressed={!useSample} onClick={() => setUseSample(false)}>
                    My events
                  </button>
                  <button type="button" aria-pressed={useSample} onClick={() => setUseSample(true)}>
                    Sample cohort
                  </button>
                </div>
                {useSample && (
                  <p className="sim-banner">Simulated data, not real users. Built to show how the A/B view reads.</p>
                )}
                {(["A", "B"] as Variant[]).map((v) => {
                  const c = conversions(data, v);
                  return (
                    <section className="mb-7" key={v}>
                      <h2>
                        Variant {v} <small className="text-muted-foreground">{c.viewers} viewers</small>
                      </h2>
                      {funnel(data, v).map((step) => (
                        <div className="funnel-row" key={step.name}>
                          <div className="progress-row">
                            <span>{label[step.name] ?? step.name}</span>
                            <span className="num">
                              {step.applicable ? `${step.count} · ${pct(step.rate ?? 0)}` : "n/a"}
                            </span>
                          </div>
                          <div className="progress">
                            <div
                              className="progress-fill"
                              ref={(el) => {
                                if (el) el.style.width = `${Math.min(100, step.rate ?? 0)}%`;
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      {(() => { const e = equippedAfterPurchase(data, v); return <div className="funnel-row"><div className="progress-row"><span>Equipped after purchase</span><span className="num">{e.count} · {pct(e.rate)}</span></div><div className="progress"><div className="progress-fill" style={{ width: `${Math.min(100, e.rate)}%` }} /></div></div>; })()}
                      <div className="kpis">
                        <div>
                          <b className="num">{pct(c.goalRate)}</b>
                          <span>viewers who set a goal</span>
                        </div>
                        <div>
                          <b className="num">{pct(c.redeemRate)}</b>
                          <span>viewers who redeemed</span>
                        </div>
                        {c.trialToGoal !== null && (
                          <div>
                            <b className="num">{pct(c.trialToGoal)}</b>
                            <span>trial finishers who set a goal</span>
                          </div>
                        )}
                      </div>
                      <p className="subcopy">
                        Trial runs quit early: {v === "A" ? "n/a" : `${trialAbandonment(data, v).toFixed(0)}%`}
                      </p>
                    </section>
                  );
                })}
                <p className="subcopy">
                  Unique players, hoodie only. Each step is a share of everyone who viewed the hoodie, because the trial is optional.
                  No significance claim.
                </p>
              </>
            )}
            {tab === "Economy" && (
              <>
                <h2>Coin rules</h2>
                {[
                  ["Starting coins", CONFIG.startingCoins],
                  ["Per catch", `+${CONFIG.coinsPerCatch}`],
                  ["Round", `${CONFIG.roundSeconds} seconds`],
                  ["Starting hearts", CONFIG.hearts],
                  ["Typical round", "80 to 150 coins"],
                  ["Hoodie goal", `${CONFIG.hoodieCoins} coins`],
                  ["Trial bonus", `+${CONFIG.trialBonus}, once`],
                  ["Bonus needs", `${CONFIG.trialMinSeconds}s played`],
                  ["Trial pickups added", "No"],
                  ["Cosmetic only", "Yes"],
                  ["Speed increase", "20%"],
                  ["Event cap", CONFIG.eventCap],
                ].map(([l, value]) => (
                  <div className="economy-row" key={l}>
                    <span className="text-muted-foreground">{l}</span>
                    <span>{value}</span>
                  </div>
                ))}
                <Button className="w-full mt-5" variant="outline" onClick={addCoins}>
                  +100 coins
                </Button>
                <p className="subcopy">Reviewer shortcut. Not part of normal gameplay.</p>
              </>
            )}
            {tab === "About" && (
              <>
                <h2>About this prototype</h2>
                <ul className="about">
                  <li>
                    <b>Hypothesis.</b> A playable trial makes players more likely to pick a reward and redeem it, compared with a normal reward card.
                  </li>
                  <li>
                    <b>One difference.</b> Variant A and B share the same product, price, coin cost and game. Only the trial differs.
                  </li>
                  <li>
                    <b>No farming.</b> Trial coins are never added. One bonus of {CONFIG.trialBonus} coins, and only if you play {CONFIG.trialMinSeconds}+ seconds.
                  </li>
                  <li>
                    <b>Cosmetic only.</b> The hoodie never changes gameplay or the economy.
                  </li>
                  <li>
                    <b>Photo privacy.</b> Face previews stay on this device, are stored separately, and are never uploaded or added to event data.
                  </li>
                  <li>
                    <b>Preview only.</b> This mockup is not AI try-on. A real product order and AI try-on are future work.
                  </li>
                  <li>
                    <b>No interruptions.</b> The store never opens during a round. Progress shows after it.
                  </li>
                  <li>
                    <b>Limits.</b> Demo data in your browser. A real version needs studio integration and server-side checks. The avatar shows look, not fabric or fit.
                  </li>
                </ul>
              </>
            )}
          </div>
          <div className="debug-footer">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-xs px-2"
                aria-label="Download events as JSON"
                onClick={() =>
                  download(
                    `trial-run-events${useSample ? "-sample" : ""}.json`,
                    JSON.stringify(data, null, 2),
                    "application/json",
                  )
                }
              >
                <Download />
                Events JSON
              </Button>
              <Button variant="outline" className="flex-1 text-xs px-2" aria-label="Download funnel as CSV" onClick={exportCsv}>
                <Download />
                Funnel CSV
              </Button>
            </div>
            <p>
              Offering a playable product trial increases the rate at which players select and later redeem a reward,
              compared with a normal reward card.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
