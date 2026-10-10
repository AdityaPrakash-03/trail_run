import { useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Check, ChevronRight, Headphones, Info, Music2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { REWARDS, getReward, type RewardId } from "@/config";
import { hasRedeemed } from "@/lib/trial-state";
import { track } from "@/analytics";
import { useTrial } from "./provider";
import { CoinIcon } from "./art";
import { Back, ColourPicker, GoalProgress, RewardActions, Terms } from "./shared";
import { Viewer3D } from "./viewer3d";
import { FaceStep } from "./face-step";

function RewardIcon({ id }: { id: RewardId }) {
  return id === "food" ? <Utensils size={20} /> : id === "music" ? <Music2 size={20} /> : <Headphones size={20} />;
}

export function Store() {
  const { player, ready, saveGoal, equip } = useTrial();
  const navigate = useNavigate();
  const cards = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ready || !cards.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            track("reward_viewed", {
              reward_id: (e.target as HTMLElement).dataset["reward"],
              surface: "store_card",
            });
            observer.unobserve(e.target);
          }
      },
      { threshold: 0.2 },
    );
    cards.current.querySelectorAll("[data-reward]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ready, player.variant]);
  const goal = getReward(player.goal);
  return (
    <main className="page" ref={cards}>
      <div className="eyebrow">Try it on. Play for it.</div>
      <h1>Your next reward.</h1>
      <p className="subcopy">Play a round, collect coins, redeem a real reward.</p>
      {goal && (
        <Link to="/details" search={{ reward: goal.id }} className="goal-chip">
          <Check size={13} />
          <span>Goal: {goal.short}</span>
          <span className="ml-auto num">
            {Math.min(player.balance, goal.cost)} / {goal.cost}
          </span>
          <ChevronRight size={13} />
        </Link>
      )}
      <div className="section-heading">
        <h2>Featured reward</h2>
        <span className="small-label">DEMO STORE</span>
      </div>
      <article className="reward-card" data-reward="hoodie">
        <div className="product-stage spotlight">
          <span className="stage-caption">EVERYDAY STREETWEAR</span>
          <Viewer3D colour={player.colour} className="stage-viewer" hoodie={!hasRedeemed(player, "hoodie") || player.equipped} />
        </div>
        <div className="card-body">
          <ColourPicker />
          <h3>The everyday hoodie</h3>
          <p className="price">
            Rs 1,499 <span>Illustrative price</span>
          </p>
          <GoalProgress />
          <RewardActions source="store_card" />
          {hasRedeemed(player, "hoodie") && <label className="flex items-center justify-between mt-3">{player.equipped ? "Equipped" : "Equip"}<Switch checked={player.equipped} onCheckedChange={equip} /></label>}
          <Link to="/details" search={{ reward: "hoodie" }} className="detail-link">
            View details
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </article>
      <div className="demo-note">
        <Info size={12} />
        Prototype offer, hypothetical. No real rewards issued.
      </div>
      <div className="section-heading">
        <h2>More rewards</h2>
        <span className="text-muted-foreground text-xs">Something for everyone</span>
      </div>
      <div className="more-list">
        {REWARDS.slice(1).map((reward) => {
          const done = hasRedeemed(player, reward.id);
          const afford = player.balance >= reward.cost;
          return (
            <article className="mini-reward" key={reward.id} data-reward={reward.id}>
              <div className="reward-icon">
                <RewardIcon id={reward.id} />
              </div>
              <div>
                <h3>{reward.name}</h3>
                <p>{reward.offer}</p>
              </div>
              <div className="mini-actions">
                <span className="coin-label num">
                  <CoinIcon size={13} />
                  {reward.cost}
                </span>
                {done ? (
                  <span className="mini-done">Redeemed</span>
                ) : afford ? (
                  <Button
                    variant="link"
                    className="mini-save"
                    onClick={() => navigate({ to: "/redeem", search: { reward: reward.id } })}
                  >
                    Redeem
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    className="mini-save"
                    onClick={() => saveGoal(reward.id, "store_card")}
                  >
                    {player.goal === reward.id ? "Goal saved" : "Save as goal"}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

export function Details({ rewardId = "hoodie" }: { rewardId?: string }) {
  const { player, face, ready, saveGoal, equip, setPlayerFace } = useTrial();
  const navigate = useNavigate();
  const reward = REWARDS.find((r) => r.id === rewardId) ?? REWARDS[0];
  useEffect(() => {
    if (ready) track("reward_viewed", { reward_id: reward.id, surface: "details" });
  }, [ready, reward.id, player.variant]);
  if (reward.id !== "hoodie") {
    const done = hasRedeemed(player, reward.id);
    const afford = player.balance >= reward.cost;
    return (
      <main className="page">
        <Back />
        <div className="eyebrow">No preview available for this reward</div>
        <h1>{reward.name}</h1>
        <p>{reward.offer}</p>
        <p className="subcopy">Prototype offer, hypothetical. Redeeming gives a demo code only.</p>
        <div className="info-section mt-6">
          <GoalProgress id={reward.id} />
          {done ? (
            <Button className="w-full" disabled>
              <Check />
              Redeemed
            </Button>
          ) : afford ? (
            <Button
              className="w-full"
              onClick={() => navigate({ to: "/redeem", search: { reward: reward.id } })}
            >
              Redeem
            </Button>
          ) : (
            <Button className="w-full" onClick={() => saveGoal(reward.id, "details")}>
              {player.goal === reward.id ? "Goal saved" : "Save as goal"}
            </Button>
          )}
        </div>
      </main>
    );
  }
  return (
    <main className="page">
      <Back />
      <div className="product-stage spotlight rounded-lg tall">
        <Viewer3D colour={player.colour} className="stage-viewer" face={face} hoodie={!hasRedeemed(player, "hoodie") || player.equipped} />
      </div>
      <ColourPicker />
      <FaceStep face={face} onChange={setPlayerFace} />
      <div className="product-brand">EVERYDAY STREETWEAR</div>
      <h1>Everyday Streetwear Hoodie</h1>
      <p className="price">
        Rs 1,499 <span>Illustrative price</span>
      </p>
      <p className="text-sm">{reward.offer}</p>
      <div className="demo-note">
        <Info size={12} />
        Prototype offer, hypothetical
      </div>
      <div className="info-section mt-5">
        <GoalProgress />
        <RewardActions source="details" />
        {hasRedeemed(player, "hoodie") && <label className="flex items-center justify-between mt-3">{player.equipped ? "Equipped" : "Equip"}<Switch checked={player.equipped} onCheckedChange={equip} /></label>}
      </div>
      <section className="info-section">
        <h2>The real-world details</h2>
        <dl className="specs">
          <div>
            <dt>Fabric</dt>
            <dd>Cotton blend, 320 GSM</dd>
          </div>
          <div>
            <dt>Fit</dt>
            <dd>Relaxed</dd>
          </div>
          <div>
            <dt>Colours</dt>
            <dd>Crimson, Navy</dd>
          </div>
          <div>
            <dt>Sizes</dt>
            <dd>S to XXL</dd>
          </div>
        </dl>
      </section>
      <details className="info-section">
        <summary>
          Offer terms
          <ChevronRight size={16} />
        </summary>
        <Terms />
      </details>
      <div className="honest-note">
        <Info size={18} className="shrink-0 mt-1" />
        <span>Preview shows how it looks. It does not show fabric feel or fit.</span>
      </div>
    </main>
  );
}
