import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, CheckCircle2, Headphones, Info, Music2, RotateCcw, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CONFIG, getReward, type RewardId } from "@/config";
import { hasRedeemed } from "@/lib/trial-state";
import { sfx } from "@/game3d/audio";
import { useTrial } from "./provider";
import { CoinIcon } from "./art";
import { Back, ColourPicker, Progress, Terms } from "./shared";
import { Viewer3D } from "./viewer3d";

function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}

function Confetti() {
  const colours = ["#ffd36b", "#ff5b4a", "#4cd0d6", "#ffffff"];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <i
          key={i}
          className={`c${i % 6} k${i % 4}`}
          data-colour={colours[i % colours.length]}
        />
      ))}
    </div>
  );
}

function RewardGlyph({ id }: { id: RewardId }) {
  return id === "food" ? <Utensils size={34} /> : id === "music" ? <Music2 size={34} /> : <Headphones size={34} />;
}

export function TrialResult() {
  const { player, result, saveGoal } = useTrial();
  const awarded = result?.mode === "trial" && result.awarded;
  useEffect(() => {
    if (awarded) sfx.bonus();
  }, [awarded]);
  if (!result || result.mode !== "trial")
    return (
      <main className="page">
        <Back />
        <h1>No trial result yet.</h1>
        <Button asChild>
          <Link to="/">Back to store</Link>
        </Button>
      </main>
    );
  const done = hasRedeemed(player, "hoodie");
  return (
    <main className="page center-screen">
      {awarded && <Confetti />}
      <div className="eyebrow">TRIAL RUN</div>
      <h1>Trial complete.</h1>
      <p className={`result-label ${result.tooShort ? "warn" : ""}`}>
        {result.awarded
          ? `+${CONFIG.trialBonus} coins added`
          : result.tooShort
            ? `No bonus. Play at least ${CONFIG.trialMinSeconds} seconds to get it. You can try again.`
            : "Trial bonus already claimed"}
      </p>
      <div className="product-stage spotlight rounded-lg result-stage">
        <Viewer3D colour={player.colour} className="stage-viewer" />
      </div>
      <div className="flex justify-center">
        <ColourPicker />
      </div>
      <p className="subcopy">
        <span className="num">{result.catches * CONFIG.coinsPerCatch}</span> trial coins caught. Not added to your balance.
      </p>
      <p className="subcopy mb-6">
        Your balance: <span className="num">{player.balance}</span> coins
      </p>
      <div className="button-stack">
        <Button disabled={done} onClick={() => saveGoal("hoodie", "trial_result")}>
          {done ? (
            "Redeemed"
          ) : player.goal === "hoodie" ? (
            <>
              <Check />
              Saved as your goal
            </>
          ) : (
            "Save as my goal"
          )}
        </Button>
        {player.variant === "B" && (
          <Button variant="outline" asChild>
            <Link to="/trial">
              <RotateCcw />
              Try again
            </Link>
          </Button>
        )}
        <span className="text-muted-foreground text-[11px]">
          {player.trialClaimed ? "Trying again earns 0 bonus coins." : "The bonus is still waiting for you."}
        </span>
        <Button variant="ghost" asChild>
          <Link to="/">Back to store</Link>
        </Button>
      </div>
    </main>
  );
}

export function Summary() {
  const { player, result } = useTrial();
  const goal = getReward(player.goal);
  const milestone = result?.mode === "normal" ? result.milestone : null;
  useEffect(() => {
    if (milestone) sfx.bonus();
  }, [milestone]);
  if (!result || result.mode !== "normal")
    return (
      <main className="page">
        <Back />
        <h1>No round result yet.</h1>
        <Button asChild>
          <Link to="/play">Play a round</Link>
        </Button>
      </main>
    );
  const canRedeem = !!goal && player.balance >= goal.cost && !hasRedeemed(player, goal.id);
  const closer = Math.round(result.pctAfter - result.pctBefore);
  return (
    <main className="page center-screen">
      <div className="eyebrow">ROUND COMPLETE</div>
      <h1>{result.endedBy === "hearts" ? "Rough round." : "Good catch."}</h1>
      <div className="result-number num">
        <CoinIcon size={34} />
        +<CountUp to={result.earned} />
      </div>
      <p className="subcopy">Coins earned this round</p>
      <p className="text-sm mt-5">
        Your balance: <strong className="num">{player.balance}</strong> coins
      </p>
      <p className="subcopy">
        {result.endedBy === "hearts" ? "No hearts left" : "Time’s up"} · {result.duration.toFixed(0)} seconds played
      </p>
      {goal && (
        <div className="result-summary">
          <div className="progress-row">
            <span>Goal: {goal.short}</span>
            <span className="num">
              {Math.min(player.balance, goal.cost)}/{goal.cost}
            </span>
          </div>
          <Progress balance={player.balance} cost={goal.cost} />
          <p className="progress-caption mb-0">
            {player.balance >= goal.cost
              ? "You can redeem now"
              : `${goal.cost - player.balance} coins to go`}
            {closer > 0 && <span className="closer"> · {closer}% closer</span>}
          </p>
          {milestone && (
            <p className="milestone">
              {milestone >= 100
                ? `Goal reached. The ${goal.short.toLowerCase()} is yours to redeem.`
                : milestone === 50
                  ? `Halfway to the ${goal.short.toLowerCase()}.`
                  : `${milestone}% of the way to the ${goal.short.toLowerCase()}.`}
            </p>
          )}
        </div>
      )}
      <div className="button-stack mt-7">
        {canRedeem && goal && (
          <Button asChild>
            <Link to="/redeem" search={{ reward: goal.id }}>
              Redeem {goal.short.toLowerCase()}
              <ArrowRight />
            </Link>
          </Button>
        )}
        <Button variant={canRedeem ? "outline" : "default"} asChild>
          <Link to="/play">
            <RotateCcw />
            Play again
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/">Back to store</Link>
        </Button>
      </div>
    </main>
  );
}

export function Redeem({ rewardId = "hoodie" }: { rewardId?: RewardId }) {
  const { player, equip, redeem } = useTrial();
  const reward = getReward(rewardId) ?? getReward("hoodie")!;
  const done = hasRedeemed(player, reward.id);
  const [justNow, setJustNow] = useState(false);
  const [wearOnRedeem, setWearOnRedeem] = useState(true);
  useEffect(() => {
    if (justNow) sfx.redeem();
  }, [justNow]);
  if (done)
    return (
      <main className="page center-screen">
        {justNow && <Confetti />}
        <div className="success-icon">
          <CheckCircle2 size={30} />
        </div>
        <div className="eyebrow">REDEMPTION COMPLETE</div>
        <h1>Your demo voucher.</h1>
        <p className="subcopy">{reward.name}</p>
        {reward.id === "hoodie" && <>
          <div className="product-stage spotlight rounded-lg mt-4"><Viewer3D colour={player.colour} hoodie={player.equipped} /></div>
          <label className="flex items-center justify-between mt-4">Wear it in game <Switch checked={player.equipped} onCheckedChange={equip} /></label>
          <p className="subcopy">Hoodie unlocked in game. Order the real one and wear the same hoodie in both worlds.</p>
        </>}
        <div className="voucher num">{player.vouchers[reward.id]}</div>
        <p className="text-sm">Prototype only, no real voucher issued</p>
        <p className="subcopy mt-3">
          {reward.cost} coins spent. Your balance: <span className="num">{player.balance}</span> coins.
        </p>
        <Button className="w-full mt-8" asChild>
          <Link to="/">
            Back to store
            <ArrowRight />
          </Link>
        </Button>
      </main>
    );
  const afford = player.balance >= reward.cost;
  return (
    <main className="page">
      <Back />
      <div className="eyebrow">YOUR REWARD</div>
      <h1>Redeem your {reward.short.toLowerCase()}.</h1>
      {reward.id === "hoodie" ? (
        <div className="product-stage spotlight rounded-lg mt-6">
          <Viewer3D colour={player.colour} className="stage-viewer" hoodie={wearOnRedeem} />
        </div>
      ) : (
        <div className="product-stage spotlight rounded-lg mt-6 glyph-stage">
          <RewardGlyph id={reward.id} />
        </div>
      )}
      <p className="mt-6">{reward.offer}</p>
      {reward.id === "hoodie" && <>
        <p className="subcopy">Hoodie unlocked in game. Order the real one and wear the same hoodie in both worlds.</p>
        <label className="flex items-center justify-between mt-3">Wear it in game <Switch checked={wearOnRedeem} onCheckedChange={setWearOnRedeem} /></label>
      </>}
      <div className="demo-note">
        <Info size={12} />
        Prototype offer, hypothetical
      </div>
      <div className="result-summary">
        <div className="progress-row">
          <span>Coin cost</span>
          <span className="coin-label num">
            <CoinIcon />
            {reward.cost}
          </span>
        </div>
        <div className="progress-row mb-0">
          <span>Your balance</span>
          <span className="num">{player.balance} coins</span>
        </div>
      </div>
      {reward.id === "hoodie" && (
        <>
          <h2>Terms summary</h2>
          <Terms />
        </>
      )}
      <p className="honest-note">
        Prototype only, no real voucher issued. No payment, size selection or delivery happens in this demo.
      </p>
      <Button
        className="w-full"
        disabled={!afford}
        onClick={() => {
          redeem(reward.id, wearOnRedeem);
          setJustNow(true);
        }}
      >
        {afford ? "Confirm redemption" : `${reward.cost - player.balance} coins to go`}
      </Button>
    </main>
  );
}
